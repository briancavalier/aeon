import { RemovalPolicy, Stack } from "aws-cdk-lib"
import { Billing } from "aws-cdk-lib/aws-dynamodb"
import { EventBus } from "aws-cdk-lib/aws-events"
import { ApplicationLogLevel } from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"
import { EventStore, IEventStore } from "../../src/aws-cdk"

/**
 * Stack for all the counter examples.  Creates the shared
 * EventStore and an EventBus for notifying subscribers.
 */
export class CounterEventStoreStack extends Stack {
  public readonly eventStore: IEventStore

  constructor(scope: Construct, id: string) {
    super(scope, id)

    // -------------------------------------------
    // Event bus for notifications

    const eventBus = new EventBus(this, `${id}-eventstore-notifications`, {
      eventBusName: `${id}-eventstore-notifications`
    })

    // -------------------------------------------
    // Event store

    this.eventStore = new EventStore(this, `${id}-eventstore`, {
      removalPolicy: RemovalPolicy.DESTROY,
      billing: Billing.onDemand(),
      logLevel: ApplicationLogLevel.DEBUG,
      eventBus
    })
  }
}
