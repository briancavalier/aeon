import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { EventBusNotifier, EventBusSubscriber } from '../../src/aws-constructs/eventbridge'
import { EventStore } from '../../src/aws-constructs/eventstore'

const app = new App()
const stack = new Stack(app, 'leaderboard')

// -------------------------------------------
// Infra

const eventBus = new EventBus(stack, 'all-events', {
  eventBusName: 'all-events'
})

// -------------------------------------------
// Event store

export const eventStore = EventStore.createTables(stack, 'leaderboard-events', {
  removalPolicy: RemovalPolicy.DESTROY,
  billingMode: BillingMode.PAY_PER_REQUEST
})

new EventBusNotifier(stack, 'leaderboard-events-notifier', {
  eventStore,
  eventBus
})

// -------------------------------------------
// Leaderboard aggregate

const leaderboard = new NodejsFunction(stack, `leaderboard-events-handler`, {
  entry: 'examples/leaderboard/index.ts',
  runtime: Runtime.NODEJS_22_X,
  environment: {
    eventStoreName: eventStore.name
  },
  bundling: {
    sourceMap: true,
  }
})

eventStore.grantReadWriteEvents(leaderboard)

const commandUrl = leaderboard.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
})

// -------------------------------------------
// Leaderboard view

const leaderboardView = new Table(stack, 'leaderboard-view', {
  tableName: 'leaderboard-view',
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_IMAGE,
  removalPolicy: RemovalPolicy.DESTROY
})

const update = new NodejsFunction(stack, `leaderboard-view-handler`, {
  entry: 'examples/view/update.ts',
  runtime: Runtime.NODEJS_22_X,
  environment: {
    viewTableName: leaderboardView.tableName
  },
  bundling: {
    sourceMap: true,
  }
})

leaderboardView.grantReadWriteData(update)

new EventBusSubscriber(stack, 'leaderboard-view-update', {
  eventStore,
  eventBus,
  target: update
})

const query = new NodejsFunction(stack, `leaderboard-view-get-leaderboards-handler`, {
  entry: 'examples/view/query.ts',
  runtime: Runtime.NODEJS_22_X,
  environment: {
    viewTableName: leaderboardView.tableName,
  },
  bundling: {
    sourceMap: true,
  }
})

leaderboardView.grantReadData(query)

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
