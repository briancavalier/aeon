import { App } from 'aws-cdk-lib'
import { CounterCQRSLazyStack } from './stack'
import { CounterEventStoreStack } from '../eventstore-stack'
import { CounterStack } from '../counter-basic/stack'

const app = new App()

const { eventStore } = new CounterEventStoreStack(app, 'counter-events')
new CounterStack(app, 'counter-basic', { eventStore })
new CounterCQRSLazyStack(app, 'counter-cqrs-lazy', { eventStore })

app.synth()
