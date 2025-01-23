import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { EventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../aws-defaults'

const app = new App()
const stack = new Stack(app, 'counter')

// -------------------------------------------
// Event store

export const counterEventStore = EventStore.createTables(stack, 'counter-events', {
  removalPolicy: RemovalPolicy.DESTROY,
  billingMode: BillingMode.PAY_PER_REQUEST
})

// -------------------------------------------
// Aggregate

const command = new NodejsFunction(stack, `counter-command-handler`, {
  ...commonFunctionProps,
  entry: 'command.ts',
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
// Query

const query = new NodejsFunction(stack, `counter-query-handler`, {
  ...commonFunctionProps,
  entry: 'query.ts',
  environment: {
    ...commonFunctionEnv,
    eventStoreConfig: counterEventStore.config
  }
})

counterEventStore.grantReadEvents(query)

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
