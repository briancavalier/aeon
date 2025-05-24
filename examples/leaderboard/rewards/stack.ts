import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { FunctionUrlAuthType, IFunction } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { resolve } from 'node:path'
import { EventStore } from '../../../src/aws-cdk'
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

    const inventoryCommand = new NodejsFunction(this, 'reward-inventory-command-handler', {
      functionName: 'reward-inventory-command-handler',
      ...commonFunctionProps,
      entry: resolve(import.meta.dirname, 'inventory/command.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config
      }
    })

    eventStore.grantReadWriteEvents(inventoryCommand)

    const inventoryCommandUrl = inventoryCommand.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'rewardInventoryCommandUrl', { value: inventoryCommandUrl.url })
  }
}

