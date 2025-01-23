import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { ApplicationLogLevel, FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { EventBusNotifier, EventBusSubscription, EventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../aws-defaults'

const app = new App()
const stack = new Stack(app, 'counter-notify')

// -------------------------------------------
// Infra

const eventBus = new EventBus(stack, 'all-events', {
  eventBusName: 'all-events'
})

// -------------------------------------------
// Event store

export const counterEventStore = EventStore.createTables(stack, 'counter-notify-events', {
  removalPolicy: RemovalPolicy.DESTROY,
  billingMode: BillingMode.PAY_PER_REQUEST
})

new EventBusNotifier(stack, 'counter-events-notifier', {
  eventStore: counterEventStore,
  eventBus,
  applicationLogLevelV2: ApplicationLogLevel.DEBUG,
})

// -------------------------------------------
// Aggregate

const command = new NodejsFunction(stack, `counter-command-handler`, {
  ...commonFunctionProps,
  entry: '../counter/command.ts',
  environment: {
    ...commonFunctionEnv,
    eventStoreConfig: counterEventStore.config
  }
})

counterEventStore.grantReadWriteEvents(command)

const commandUrl = command.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
})

// -------------------------------------------
// View

const counterView = new Table(stack, 'counter-view', {
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY
})

const update = new NodejsFunction(stack, `counter-update-handler`, {
  ...commonFunctionProps,
  entry: 'update.ts',
  environment: {
    ...commonFunctionEnv,
    eventStoreConfig: counterEventStore.config,
    viewTable: counterView.tableName
  }
})

counterView.grantReadWriteData(update)
counterEventStore.grantReadEvents(update)

new EventBusSubscription(stack, 'counter-events-subscription', {
  eventBus,
  eventStore: counterEventStore,
  subscriber: update,
})

// -------------------------------------------
// Query

const query = new NodejsFunction(stack, `counter-query-handler`, {
  ...commonFunctionProps,
  entry: 'query.ts',
  environment: {
    ...commonFunctionEnv,
    viewTable: counterView.tableName
  }
})

counterView.grantReadData(query)

const queryUrl = query.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
})

// -------------------------------------------
// Outputs

new CfnOutput(stack, 'commandUrl', { value: commandUrl.url })
new CfnOutput(stack, 'queryUrl', { value: queryUrl.url })

// -------------------------------------------
// Done

app.synth()
