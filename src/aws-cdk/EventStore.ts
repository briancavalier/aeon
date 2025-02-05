
import { RemovalPolicy } from 'aws-cdk-lib'
import { AttributeType, BillingMode, ITable, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { IEventBus } from 'aws-cdk-lib/aws-events'
import { IGrantable } from 'aws-cdk-lib/aws-iam'
import { ApplicationLogLevel, IFunction, LoggingFormat, Runtime, StartingPosition, SystemLogLevel } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { resolve } from 'node:path'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'

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
  readonly billingMode?: BillingMode
  readonly byKeyPositionIndexName?: string
  readonly eventBus: IEventBus
  readonly logLevel?: ApplicationLogLevel
}

const defaultByKeyPositionIndexName = 'by-key-position'

export class EventStore extends Construct implements IEventStore {
  public readonly name: string
  public readonly eventsTable: ITable
  public readonly byKeyPositionIndexName: string
  public readonly metadataTable: ITable
  public readonly eventBus: IEventBus
  public readonly notifier: IFunction
  public readonly logLevel?: ApplicationLogLevel
  public readonly config: string

  constructor(scope: Construct, id: string, { byKeyPositionIndexName, eventBus, logLevel, ...tableProps }: EventStoreProps) {
    super(scope, id)

    this.name = id
    this.byKeyPositionIndexName = byKeyPositionIndexName ?? defaultByKeyPositionIndexName
    this.logLevel = logLevel
    const eventsTable = new Table(scope, `${id}-table`, {
      partitionKey: { name: 'slice', type: AttributeType.STRING },
      sortKey: { name: 'position', type: AttributeType.STRING },
      stream: StreamViewType.KEYS_ONLY,
      ...tableProps,
    })

    eventsTable.addGlobalSecondaryIndex({
      indexName: this.byKeyPositionIndexName,
      partitionKey: { name: 'key', type: AttributeType.STRING },
      sortKey: { name: 'position', type: AttributeType.STRING }
    })

    const metadataTable = new Table(scope, `${id}-table-metadata`, {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      ...tableProps
    })

    this.eventsTable = eventsTable
    this.metadataTable = metadataTable

    this.config = JSON.stringify({
      name: this.name,
      eventsTable: this.eventsTable.tableName,
      metadataTable: this.metadataTable.tableName,
      byKeyPositionIndexName: this.byKeyPositionIndexName,
    })

    this.eventBus = eventBus
    
    this.notifier = new NodejsFunction(scope, `${id}-handler`, {
      // FIXME: How to use import.meta.dirname here?
      entry: resolve(__dirname, './notify.ts'),
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
