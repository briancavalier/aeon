import { App } from 'aws-cdk-lib'
import { CounterStack } from './stack'
import { CounterEventStoreStack } from '../eventstore-stack'

const app = new App()

const { eventStore } = new CounterEventStoreStack(app, 'counter-events')
new CounterStack(app, 'counter-basic', { eventStore })

app.synth()
