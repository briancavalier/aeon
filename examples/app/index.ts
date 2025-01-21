import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { EventBusNotifier, EventBusSubscription } from '../../src/aws-constructs/eventbridge'
import { EventStore } from '../../src/aws-constructs/eventstore'

const commonFunctionEnv = {
  NODE_OPTIONS: '--enable-source-maps',
}

const app = new App()
const stack = new Stack(app, 'leaderboard')

// -------------------------------------------
// Infra

const eventBus = new EventBus(stack, 'all-events', {
  eventBusName: 'all-events'
})

// -------------------------------------------
// Leaderboard Event store

export const leaderboardEventStore = EventStore.createTables(stack, 'leaderboard-events', {
  removalPolicy: RemovalPolicy.DESTROY,
  billingMode: BillingMode.PAY_PER_REQUEST
})

new EventBusNotifier(stack, 'leaderboard-events-notifier', {
  eventStore: leaderboardEventStore,
  eventBus
})

// -------------------------------------------
// Leaderboard aggregate

const leaderboard = new NodejsFunction(stack, `leaderboard-events-handler`, {
  entry: 'examples/leaderboard/index.ts',
  runtime: Runtime.NODEJS_22_X,
  environment: {
    ...commonFunctionEnv,
    eventStoreName: leaderboardEventStore.name
  },
  bundling: {
    sourceMap: true,
  }
})

leaderboardEventStore.grantReadWriteEvents(leaderboard)

const leaderboardCommandUrl = leaderboard.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
})

// -------------------------------------------
// User Profile Event store

export const userProfileEventStore = EventStore.createTables(stack, 'user-profile-events', {
  removalPolicy: RemovalPolicy.DESTROY,
  billingMode: BillingMode.PAY_PER_REQUEST
})

new EventBusNotifier(stack, 'user-profile-events-notifier', {
  eventStore: userProfileEventStore,
  eventBus
})


// -------------------------------------------
// User Profile aggregate

const userProfile = new NodejsFunction(stack, `user-profile-events-handler`, {
  entry: 'examples/user-profile/index.ts',
  runtime: Runtime.NODEJS_22_X,
  environment: {
    ...commonFunctionEnv,
    eventStoreName: userProfileEventStore.name
  },
  bundling: {
    sourceMap: true,
  }
})

userProfileEventStore.grantReadWriteEvents(userProfile)

const userProfileCommandUrl = userProfile.addFunctionUrl({
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

const update = new NodejsFunction(stack, `leaderboard-view-update`, {
  entry: 'examples/view/update.ts',
  runtime: Runtime.NODEJS_22_X,
  environment: {
    ...commonFunctionEnv,
    viewTableName: leaderboardView.tableName
  },
  bundling: {
    sourceMap: true,
  }
})

leaderboardView.grantReadWriteData(update)
leaderboardEventStore.grantReadEvents(update)
userProfileEventStore.grantReadEvents(update)

new EventBusSubscription(stack, `leaderboard-view-leaderboard-subscription`, {
  eventStore: leaderboardEventStore,
  eventBus,
  subscriber: update
})

new EventBusSubscription(stack, `leaderboard-view-user-profile-subscription`, {
  eventStore: userProfileEventStore,
  eventBus,
  subscriber: update
})

const query = new NodejsFunction(stack, `leaderboard-view-query`, {
  entry: 'examples/view/query.ts',
  runtime: Runtime.NODEJS_22_X,
  environment: {
    ...commonFunctionEnv,
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

new CfnOutput(stack, 'leaderboardCommandUrl', { value: leaderboardCommandUrl.url })
new CfnOutput(stack, 'userProfileCommandUrl', { value: userProfileCommandUrl.url })
new CfnOutput(stack, 'queryUrl', { value: queryUrl.url })

// -------------------------------------------
// Done

app.synth()
