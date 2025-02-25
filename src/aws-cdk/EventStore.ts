
import { RemovalPolicy } from 'aws-cdk-lib'
import { AttributeType, Billing, ITable, ITableV2, StreamViewType, TableV2 } from 'aws-cdk-lib/aws-dynamodb'
import { IEventBus } from 'aws-cdk-lib/aws-events'
import { IGrantable } from 'aws-cdk-lib/aws-iam'
import { ApplicationLogLevel, IFunction, LoggingFormat, Runtime, StartingPosition, SystemLogLevel } from 'aws-cdk-lib/aws-lambda'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'

export interface IEventStore {
  readonly name: string
  readonly eventsTable: ITable
  readonly metadataTable: ITable
  readonly eventBus: IEventBus

  readonly config: string

  grantReadEvents(g: IGrantable): void
  grantReadWriteEvents(g: IGrantable): void
}

export type EventStoreProps = {
  readonly removalPolicy?: RemovalPolicy,
  readonly billing?: Billing,
  readonly revisionIndex?: string
  readonly eventBus: IEventBus
  readonly logLevel?: ApplicationLogLevel
}

const defaultRevisionIndex = 'by-revision'

export class EventStore extends Construct implements IEventStore {
  public readonly name: string
  public readonly eventsTable: ITableV2
  public readonly revisionIndex: string
  public readonly metadataTable: ITableV2
  public readonly eventBus: IEventBus
  public readonly notifier: IFunction
  public readonly logLevel?: ApplicationLogLevel

  public readonly config: string

  constructor(scope: Construct, id: string, { revisionIndex, eventBus, logLevel, ...tableProps }: EventStoreProps) {
    super(scope, id)

    this.name = id
    this.revisionIndex = revisionIndex ?? defaultRevisionIndex
    this.logLevel = logLevel

    const eventsTable = new TableV2(scope, `${id}-table`, {
      tableName: id,
      partitionKey: { name: 'key', type: AttributeType.STRING },
      sortKey: { name: 'revision', type: AttributeType.STRING },
      dynamoStream: StreamViewType.NEW_IMAGE,
      ...tableProps,
    })

    eventsTable.addGlobalSecondaryIndex({
      indexName: this.revisionIndex,
      partitionKey: { name: 'slice', type: AttributeType.STRING },
      sortKey: { name: 'revision', type: AttributeType.STRING }
    })

    const metadataTable = new TableV2(scope, `${id}-table-metadata`, {
      tableName: `${id}-metadata`,
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      dynamoStream: StreamViewType.NEW_IMAGE,
      ...tableProps
    })

    this.eventsTable = eventsTable
    this.metadataTable = metadataTable

    this.config = JSON.stringify({
      name: this.name,
      eventsTable: this.eventsTable.tableName,
      metadataTable: this.metadataTable.tableName,
      revisionIndex: this.revisionIndex,
    })

    this.eventBus = eventBus

    this.notifier = new NodejsFunction(scope, `${id}-notifier`, {
      functionName: `${id}-notifier`,
      entry: resolve(import.meta.dirname, './notify.ts'),
      runtime: Runtime.NODEJS_22_X,
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: logLevel,
      systemLogLevelV2: SystemLogLevel.WARN,
      environment: {
        eventStoreConfig: this.config,
        eventBusName: this.eventBus.eventBusName
      }
    })

    this.eventBus.grantPutEventsTo(this.notifier)
    this.eventsTable.grantStreamRead(this.notifier)

    this.notifier.addEventSource(new DynamoEventSource(this.eventsTable, {
      startingPosition: StartingPosition.LATEST,
      filters: [
        {
          pattern: JSON.stringify({
            eventName: ['INSERT'],
          })
        }
      ]
    }))
  }

  grantReadEvents(g: IGrantable) {
    this.eventsTable.grantReadData(g)
    this.metadataTable.grantReadData(g)
  }

  grantReadWriteEvents(g: IGrantable) {
    this.eventsTable.grantReadWriteData(g)
    this.metadataTable.grantReadWriteData(g)
  }
}
