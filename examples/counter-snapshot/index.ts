import { App } from 'aws-cdk-lib'
import { CounterCQRSStack } from '../counter-cqrs/stack'
import { CounterSnapshotStack } from './stack'
import { CounterEventStoreStack } from '../shared-eventstore-stack'

const app = new App()

const { eventStore } = new CounterEventStoreStack(app, 'counter-events')
new CounterCQRSStack(app, 'counter-cqrs', { eventStore })
new CounterSnapshotStack(app, 'counter-snapshot', { eventStore })

app.synth()
