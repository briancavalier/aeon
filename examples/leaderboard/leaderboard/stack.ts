import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { FunctionUrlAuthType, IFunction } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { resolve } from 'node:path'
import { EventStore, EventStoreSubscription } from '../../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../../lib/cdk-defaults'

export interface LeaderboardStackProps {
  readonly accountCommandApi: IFunction
}

export class LeaderboardStack extends Stack {
  constructor(scope: App, id: string, { accountCommandApi }: LeaderboardStackProps) {
    super(scope, id)

    const eventStore = new EventStore(this, `${id}-eventstore`, {
      removalPolicy: RemovalPolicy.DESTROY,
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

    const creditWinners = new NodejsFunction(this, 'leaderboard-credit-winners-handler', {
      functionName: 'leaderboard-credit-winners-handler',
      ...commonFunctionProps,
      entry: resolve(import.meta.dirname, 'process-credit-winners.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config,
      }
    })

    accountCommandApi.grantInvoke(creditWinners)

    eventStore.grantReadEvents(creditWinners)
    new EventStoreSubscription(this, 'leaderboard-credit-winners-subscription', {
      eventStore,
      handler: creditWinners,
      key: ['leaderboard/*'],
      type: ['finished']
    })

    new CfnOutput(this, 'leaderboardCommandUrl', { value: commandUrl.url })
    new CfnOutput(this, 'leaderboardCompetitorsQueryUrl', { value: queryUrl.url })
  }
}

