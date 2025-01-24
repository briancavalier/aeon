
import { RemovalPolicy } from 'aws-cdk-lib'
import { AttributeType, BillingMode, ITable, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { IGrantable } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export interface IEventStore {
  readonly name: string
  readonly eventsTable: ITable
  readonly metadataTable: ITable
  readonly config: string

  grantReadEvents(g: IGrantable): void
  grantReadWriteEvents(g: IGrantable): void
}

export type EventStoreProps = {
  readonly removalPolicy?: RemovalPolicy,
  readonly billingMode?: BillingMode
}

export class EventStore extends Construct implements IEventStore {
  public readonly name: string
  public readonly eventsTable: ITable
  public readonly byKeyPositionIndexName = 'by-key-position'
  public readonly metadataTable: ITable
  public readonly config: string

  constructor(scope: Construct, id: string, tableProps: EventStoreProps) {
    super(scope, id)

    this.name = id

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
