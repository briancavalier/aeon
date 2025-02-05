import { App } from 'aws-cdk-lib'
import { CounterCQRSStack } from '../counter-cqrs/stack'
import { CounterStack } from '../counter-basic/stack'
import { CounterOptimisticConcurrencyStack } from './stack'

const app = new App()

const { eventStore } = new CounterStack(app, 'counter-basic')
new CounterCQRSStack(app, 'counter-cqrs', { eventStore })
new CounterOptimisticConcurrencyStack(app, 'counter-optimistic-concurrency', { eventStore })

app.synth()
