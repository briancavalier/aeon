import { App } from 'aws-cdk-lib'
import { CounterCQRSStack } from '../counter-cqrs/stack'
import { CounterStack } from '../counter-basic/stack'
import { CounterOptimisticConcurrencyStack } from './stack'

const app = new App()

const { eventStore } = new CounterStack(app, 'counter')
new CounterCQRSStack(app, 'counter-notify', { eventStore })
new CounterOptimisticConcurrencyStack(app, 'counter-snapshot', { eventStore })

app.synth()
