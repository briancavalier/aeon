import { App } from 'aws-cdk-lib'
import { CounterStack } from './stack'

const app = new App()
new CounterStack(app, 'counter')

app.synth()
