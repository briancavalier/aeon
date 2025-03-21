import { RemovalPolicy, Stack } from "aws-cdk-lib"
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
    // Event store

    this.eventStore = new EventStore(this, `${id}-eventstore`, {
      removalPolicy: RemovalPolicy.DESTROY,
    })
  }
}
