import { App } from 'aws-cdk-lib'
import { CounterNotifyStack } from '../counter-notify/stack'
import { CounterStack } from '../counter-basic/stack'
import { CounterOptimisticConcurrencyStack } from './stack'

const app = new App()

const { eventStore } = new CounterStack(app, 'counter')
new CounterNotifyStack(app, 'counter-notify', { eventStore })
new CounterOptimisticConcurrencyStack(app, 'counter-snapshot', { eventStore })

app.synth()
