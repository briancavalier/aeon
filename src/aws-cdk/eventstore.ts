
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

export type EventStoreTableProps = {
  readonly removalPolicy?: RemovalPolicy,
  readonly billingMode?: BillingMode
}

export type EventStoreProps = {
  readonly eventsTable: ITable
  readonly metadataTable: ITable
}

export class EventStore extends Construct implements IEventStore {
  public readonly name: string
  public readonly eventsTable: ITable
  public readonly metadataTable: ITable
  public readonly config: string

  protected constructor(scope: Construct, id: string, p: EventStoreProps) {
    super(scope, id)

    this.name = id
    this.eventsTable = p.eventsTable
    this.metadataTable = p.metadataTable

    this.config = `${this.name},${this.eventsTable.tableName},${this.metadataTable.tableName}`
  }

  static createTables(scope: Construct, id: string, tableProps: EventStoreTableProps) {
    const eventsTable = new Table(scope, `${id}-table`, {
      partitionKey: { name: 'slice', type: AttributeType.STRING },
      sortKey: { name: 'position', type: AttributeType.STRING },
      stream: StreamViewType.KEYS_ONLY,
      ...tableProps,
    })

    eventsTable.addGlobalSecondaryIndex({
      indexName: `${id}-by-key-position`,
      partitionKey: { name: 'key', type: AttributeType.STRING },
      sortKey: { name: 'position', type: AttributeType.STRING }
    })

    const metadataTable = new Table(scope, `${id}-table-metadata`, {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      ...tableProps
    })

    return new EventStore(scope, id, { eventsTable, metadataTable })
  }

  static fromTables = (scope: Construct, id: string, p: EventStoreProps): EventStore => {
    return new EventStore(scope, id, p)
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
