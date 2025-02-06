import { IRule, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { IFunction } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { IEventStore } from './EventStore'

export interface EventStoreSubscriptionProps {
  readonly eventStore: IEventStore
  readonly handler: IFunction
  readonly keys?: readonly string[]
}

export class EventStoreSubscription extends Construct {
  public readonly rule: IRule
  constructor(scope: Construct, id: string, {
    eventStore,
    handler,
    keys
  }: EventStoreSubscriptionProps) {
    super(scope, id)

    this.rule = new Rule(this, `${id}-rule`, {
      eventBus: eventStore.eventBus,
      targets: [new LambdaFunction(handler, {
        event: RuleTargetInput.fromEventPath('$.detail')
      })],
      eventPattern: {
        source: [eventStore.name],
        detail: keys ? {
          keys: keys.map(key => key.match(/\*/g) ? ({ wildcard: key }) : key)
        } : undefined
      }
    })

    eventStore.grantReadEvents(handler)
  }
}
