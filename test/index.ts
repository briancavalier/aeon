import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { EventStore } from '../src/aws-cdk'
import { Billing } from 'aws-cdk-lib/aws-dynamodb'
import { ApplicationLogLevel } from 'aws-cdk-lib/aws-lambda'

const app = new App()

const id = `integrationTest`
const stack = new Stack(app, id)

const eventBus = new EventBus(stack, `${id}-eventstore-notifications`, {
  eventBusName: `${id}-eventstore-notifications`
})

// -------------------------------------------
// Event store

const eventStore = new EventStore(stack, `${id}-eventstore`, {
  removalPolicy: RemovalPolicy.DESTROY,
  billing: Billing.onDemand(),
  logLevel: ApplicationLogLevel.DEBUG,
  eventBus
})

new CfnOutput(stack, 'eventStoreConfig', { value: eventStore.config })

app.synth()
