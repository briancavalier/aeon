import { IRule, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { IFunction } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { IEventStore } from './EventStore'

export interface EventStoreSubscriptionProps {
  readonly eventStore: IEventStore
  readonly handler: IFunction
  readonly categories?: readonly string[]
}

export class EventStoreSubscription extends Construct {
  public readonly rule: IRule
  constructor(scope: Construct, id: string, {
    eventStore,
    handler,
    categories
  }: EventStoreSubscriptionProps) {
    super(scope, id)

    this.rule = new Rule(this, `${id}-subscription-rule`, {
      ruleName: `${id}-subscription-rule`,
      eventBus: eventStore.eventBus,
      targets: [new LambdaFunction(handler, {
        event: RuleTargetInput.fromEventPath('$.detail')
      })],
      eventPattern: {
        source: [eventStore.name],
        detail: categories ? {
          category: categories.map(s => s.match(/\*/g) ? ({ wildcard: s }) : s)
        } : undefined
      }
    })

    eventStore.grantReadEvents(handler)
  }
}
