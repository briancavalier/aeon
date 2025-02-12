import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'
import { IEventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../lib/cdk-defaults'

export interface CounterStackProps extends StackProps {
  eventStore: IEventStore
}

export class CounterStack extends Stack {
  constructor(scope: Construct, id: string, { eventStore, ...props }: CounterStackProps) {
    super(scope, id, props)

    // -------------------------------------------
    // Aggregate

    const command = new NodejsFunction(this, 'counter-basic-command-handler', {
      functionName: 'counter-basic-command-handler',
      ...commonFunctionProps,
      entry: resolve(__dirname, 'command.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config
      }
    })

    eventStore.grantReadWriteEvents(command)

    const commandUrl = command.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    // -------------------------------------------
    // Query

    const query = new NodejsFunction(this, 'counter-basic-query-handler', {
      functionName: 'counter-basic-query-handler',
      ...commonFunctionProps,
      entry: resolve(__dirname, 'query.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config
      }
    })

    eventStore.grantReadEvents(query)

    const queryUrl = query.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'commandUrl', { value: commandUrl.url })
    new CfnOutput(this, 'queryUrl', { value: queryUrl.url })
    new CfnOutput(this, 'commandLogGroup', { value: command.logGroup.logGroupName })
    new CfnOutput(this, 'queryLogGroup', { value: query.logGroup.logGroupName })
  }
}
