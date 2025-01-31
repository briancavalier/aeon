import { App } from 'aws-cdk-lib'
import { CounterStack } from '../counter-basic/stack'
import { CounterNotifyStack } from './stack'

const app = new App()
const { eventStore } = new CounterStack(app, 'counter')
new CounterNotifyStack(app, 'counter-notify', { eventStore })

app.synth()
