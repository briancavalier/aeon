import { EventPattern, IEventBus, IRule, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { IFunction, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { IEventStore } from './eventstore'

export class EventBusNotifier extends Construct {
  public readonly notify: IFunction

  constructor(scope: Construct, id: string, props: {
    eventStore: IEventStore
    eventBus: IEventBus
  }) {
    super(scope, id)

    const notify = this.notify = new NodejsFunction(scope, `${id}-handler`, {
      entry: 'src/eventbridge/notify.ts',
      runtime: Runtime.NODEJS_22_X,
      environment: {
        eventStoreName: props.eventStore.name,
        eventBusName: props.eventBus.eventBusName
      }
    })

    props.eventBus.grantPutEventsTo(notify)
    props.eventStore.eventsTable.grantStreamRead(notify)

    notify.addEventSource(new DynamoEventSource(props.eventStore.eventsTable, {
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
}

export class EventBusSubscriber extends Construct {
  public readonly rule: IRule
  constructor(scope: Construct, id: string, props: {
    eventStore: IEventStore
    eventBus: IEventBus
    target: IFunction
    eventPattern?: EventPattern
  }) {
    super(scope, id)

    this.rule = new Rule(this, `${id}-rule`, {
      eventBus: props.eventBus,
      targets: [new LambdaFunction(props.target, {
        event: RuleTargetInput.fromEventPath('$.detail')
      })],
      eventPattern: props.eventPattern ?? {
        source: [props.eventStore.name],
      }
    })

    props.eventStore.grantReadEvents(props.target)
  }
}
