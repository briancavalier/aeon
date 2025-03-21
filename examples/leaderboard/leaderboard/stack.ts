import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { Billing } from 'aws-cdk-lib/aws-dynamodb'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { resolve } from 'node:path'
import { EventStore } from '../../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../../lib/cdk-defaults'

export class LeaderboardStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id)

    const eventBus = new EventBus(this, `${id}-eventstore-notifications`, {
      eventBusName: `${id}-eventstore-notifications`
    })

    // -------------------------------------------
    // Event store

    const eventStore = new EventStore(this, `${id}-eventstore`, {
      removalPolicy: RemovalPolicy.DESTROY,
      billing: Billing.onDemand(),
      eventBus
    })

    const command = new NodejsFunction(this, 'leaderboard-command-handler', {
      functionName: 'leaderboard-command-handler',
      ...commonFunctionProps,
      entry: resolve(import.meta.dirname, 'command.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config
      }
    })

    eventStore.grantReadWriteEvents(command)

    const commandUrl = command.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    const query = new NodejsFunction(this, 'leaderboard-competitors-query-handler', {
      functionName: 'leaderboard-competitors-query-handler',
      ...commonFunctionProps,
      entry: resolve(import.meta.dirname, 'query.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config
      }
    })

    eventStore.grantReadEvents(query)

    const queryUrl = query.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'leaderboardCommandUrl', { value: commandUrl.url })
    new CfnOutput(this, 'leaderboardCompetitorsueryUrl', { value: queryUrl.url })
  }
}

