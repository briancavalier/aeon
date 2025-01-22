import { EventPattern, IEventBus, IRule, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { ApplicationLogLevel, IFunction, LoggingFormat, Runtime, StartingPosition, SystemLogLevel } from 'aws-cdk-lib/aws-lambda'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import path from 'node:path'
import { IEventStore } from './eventstore'

export type EventBusNotifierProps = Readonly<{
  eventStore: IEventStore
  eventBus: IEventBus
  applicationLogLevelV2?: ApplicationLogLevel,
  systemLogLevelV2?: SystemLogLevel,
}>

export class EventBusNotifier extends Construct {
  public readonly notify: IFunction

  constructor(scope: Construct, id: string, {
    eventStore,
    eventBus,
    applicationLogLevelV2,
    systemLogLevelV2
  }: EventBusNotifierProps) {
    super(scope, id)

    const notify = this.notify = new NodejsFunction(scope, `${id}-handler`, {
      // FIXME: How to use import.meta.dirname here?
      entry: path.resolve(__dirname, './notify.ts'),
      runtime: Runtime.NODEJS_22_X,
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2,
      systemLogLevelV2,
      environment: {
        eventStoreConfig: eventStore.config,
        eventBusName: eventBus.eventBusName
      }
    })

    eventBus.grantPutEventsTo(notify)
    eventStore.eventsTable.grantStreamRead(notify)

    notify.addEventSource(new DynamoEventSource(eventStore.eventsTable, {
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

export class EventBusSubscription extends Construct {
  public readonly rule: IRule
  constructor(scope: Construct, id: string, props: {
    eventStore: IEventStore
    eventBus: IEventBus
    subscriber: IFunction
    eventPattern?: EventPattern
  }) {
    super(scope, id)

    this.rule = new Rule(this, `${id}-rule`, {
      eventBus: props.eventBus,
      targets: [new LambdaFunction(props.subscriber, {
        event: RuleTargetInput.fromEventPath('$.detail')
      })],
      eventPattern: props.eventPattern ?? {
        source: [props.eventStore.name],
      }
    })

    props.eventStore.grantReadEvents(props.subscriber)
  }
}
