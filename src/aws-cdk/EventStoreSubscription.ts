import { IRule, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { IFunction } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { IEventStore } from './EventStore'

export interface EventStoreSubscriptionProps {
  readonly eventStore: IEventStore
  readonly handler: IFunction
  readonly key?: readonly string[]
  readonly type?: readonly string[]
}

export class EventStoreSubscription extends Construct {
  public readonly rule: IRule
  constructor(scope: Construct, id: string, {
    eventStore,
    handler,
    key,
    type
  }: EventStoreSubscriptionProps) {
    super(scope, id)

    let events: Record<string, unknown> | undefined = undefined

    if(key) events = { key: key.map(toFilterPattern) }
    if(type) events = { ...events, type: type.map(toFilterPattern) }

    this.rule = new Rule(this, `${id}-subscription-rule`, {
      ruleName: `${id}-subscription-rule`,
      eventBus: eventStore.eventBus,
      targets: [new LambdaFunction(handler, {
        event: RuleTargetInput.fromEventPath('$.detail')
      })],
      eventPattern: {
        source: [eventStore.name],
        detail: events ? { events } : undefined
      }
    })

    eventStore.grantReadEvents(handler)
  }
}

const toFilterPattern = (s: string) => s.match(/\*/g) ? ({ wildcard: s }) : s
