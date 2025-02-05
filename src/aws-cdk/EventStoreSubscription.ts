import { EventPattern, IEventBus, IRule, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { IFunction } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { IEventStore } from './EventStore'

export interface EventStoreSubscriptionProps {
  readonly eventStore: IEventStore
  readonly handler: IFunction
  readonly eventPattern?: EventPattern
}

export class EventStoreSubscription extends Construct {
  public readonly rule: IRule
  constructor(scope: Construct, id: string, {
    eventStore,
    handler,
    eventPattern
  }: EventStoreSubscriptionProps) {
    super(scope, id)

    this.rule = new Rule(this, `${id}-rule`, {
      eventBus: eventStore.eventBus,
      targets: [new LambdaFunction(handler, {
        event: RuleTargetInput.fromEventPath('$.detail')
      })],
      eventPattern: eventPattern ?? {
        source: [eventStore.name],
      }
    })

    eventStore.grantReadEvents(handler)
  }
}
