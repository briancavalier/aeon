import { App } from 'aws-cdk-lib'
import { CounterCQRSStack } from './stack'
import { CounterEventStoreStack } from '../shared-eventstore-stack'
import { CounterStack } from '../counter-basic/stack'

const app = new App()

const { eventStore } = new CounterEventStoreStack(app, 'counter-events')
new CounterStack(app, 'counter-basic', { eventStore })
new CounterCQRSStack(app, 'counter-cqrs', { eventStore })

app.synth()
