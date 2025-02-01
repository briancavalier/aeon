import { App } from 'aws-cdk-lib'
import { CounterStack } from '../counter-basic/stack'
import { CounterCQRSStack } from './stack'

const app = new App()
const { eventStore } = new CounterStack(app, 'counter')
new CounterCQRSStack(app, 'counter-cqrs', { eventStore })

app.synth()
