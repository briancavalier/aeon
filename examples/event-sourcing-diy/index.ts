import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { Billing } from 'aws-cdk-lib/aws-dynamodb'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { ApplicationLogLevel, FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda'
import { EventStore } from '../../src/aws-cdk'
import { resolve } from 'node:path'
import { commonFunctionEnv, commonFunctionProps } from '../lib/cdk-defaults'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'

const app = new App()

const id = 'eventSourcingDIY'
const stack = new Stack(app, id)

const eventBus = new EventBus(stack, `${id}-eventstore-notifications`, {
  eventBusName: `${id}-eventstore-notifications`
})

// -------------------------------------------
// Event store

const eventStore = new EventStore(stack, `${id}-eventstore`, {
  removalPolicy: RemovalPolicy.DESTROY,
  billing: Billing.onDemand(),
  logLevel: ApplicationLogLevel.DEBUG,
  eventBus
})

// -------------------------------------------
// Command handler

// const commandHandler = new NodejsFunction(stack, `${id}-command-handler`, {
//   functionName: `${id}-command-handler`,
//   ...commonFunctionProps,
//   entry: resolve(__dirname, 'behavior/handler.ts'),
//   environment: {
//     ...commonFunctionEnv,
//     eventStoreConfig: eventStore.config
//   }
// })

// eventStore.grantReadWriteEvents(commandHandler)

// // -------------------------------------------
// // Query handler

// const queryHandler = new NodejsFunction(stack, `${id}-query-handler`, {
//   functionName: `${id}-query-handler`,
//   ...commonFunctionProps,
//   entry: resolve(__dirname, 'query/handler.ts'),
//   environment: {
//     ...commonFunctionEnv,
//     eventStoreConfig: eventStore.config
//   }
// })

// eventStore.grantReadEvents(queryHandler)

// // -------------------------------------------
// // Expose command and query handler functions via function urls

// const commandHandlerUrl = commandHandler.addFunctionUrl({
//   authType: FunctionUrlAuthType.NONE,
//   cors: {
//     allowedOrigins: ['*'],
//     allowedMethods: [HttpMethod.POST],
//     allowedHeaders: ['Content-Type'],
//     exposedHeaders: ['Etag', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods']
//   }
// })

// const queryHandlerUrl = queryHandler.addFunctionUrl({
//   authType: FunctionUrlAuthType.NONE,
//   cors: {
//     allowedOrigins: ['*'],
//     allowedMethods: [HttpMethod.GET],
//     allowedHeaders: ['Content-Type', 'If-Match'],
//     exposedHeaders: ['Retry-After', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods']
//   }
// })

// new CfnOutput(stack, 'commandUrl', { value: commandHandlerUrl.url })
// new CfnOutput(stack, 'queryUrl', { value: queryHandlerUrl.url })

new CfnOutput(stack, 'eventStoreConfig', { value: eventStore.config })
// -------------------------------------------
// Deploy

app.synth()
