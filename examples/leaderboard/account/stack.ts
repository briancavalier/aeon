import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { FunctionUrlAuthType, IFunction } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { resolve } from 'node:path'
import { EventStore } from '../../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../../lib/cdk-defaults'

export class AccountStack extends Stack {
  public readonly commandApi: IFunction

  constructor(scope: App, id: string) {
    super(scope, id)

    const eventStore = new EventStore(this, `${id}-eventstore`, {
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const command = this.commandApi = new NodejsFunction(this, 'account-command-handler', {
      functionName: 'account-command-handler',
      ...commonFunctionProps,
      entry: resolve(import.meta.dirname, 'command.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config
      }
    })

    eventStore.grantReadWriteEvents(command)

    const query = new NodejsFunction(this, 'account-summary-query-handler', {
      functionName: 'account-summary-query-handler',
      ...commonFunctionProps,
      entry: resolve(import.meta.dirname, 'query-account-summary/index.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config
      }
    })

    eventStore.grantReadEvents(query)

    const queryUrl = query.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'accountSummaryQueryUrl', { value: queryUrl.url })
  }
}

