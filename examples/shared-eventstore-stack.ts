import { RemovalPolicy, Stack } from "aws-cdk-lib"
import { EventBus, IEventBus } from "aws-cdk-lib/aws-events"
import { Construct } from "constructs"
import { EventStore, IEventStore } from "../src/aws-cdk"
import { BillingMode } from "aws-cdk-lib/aws-dynamodb"

export class CounterEventStoreStack extends Stack {
  public readonly eventStore: IEventStore
  
  constructor(scope: Construct, id: string) {
    super(scope, id)

    // -------------------------------------------
    // Event bus for notifications

    const eventBus = new EventBus(this, `${id}-eventstore-notifications`)

    // -------------------------------------------
    // Event store

    this.eventStore = new EventStore(this, `${id}-eventstore`, {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      eventBus
    })
  }
}