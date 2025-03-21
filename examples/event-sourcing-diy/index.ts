import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { EventStore } from '../../src/aws-cdk'

const app = new App()

const id = 'eventSourcingDIY'
const stack = new Stack(app, id)

// -------------------------------------------
// Event store

const eventStore = new EventStore(stack, `${id}-eventstore`, {
  removalPolicy: RemovalPolicy.DESTROY,
})

new CfnOutput(stack, 'eventStoreConfig', { value: eventStore.config })

// -------------------------------------------
// Deploy

app.synth()
