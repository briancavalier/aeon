import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'
import { IEventStore } from '../../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../../lib/cdk-defaults'

export interface CounterSnapshotStackProps extends StackProps {
  eventStore: IEventStore
}

export class CounterSnapshotStack extends Stack {
  constructor(scope: Construct, id: string, { eventStore, ...props }: CounterSnapshotStackProps) {
    super(scope, id, props)

    // -------------------------------------------
    // Aggregate

    const command = new NodejsFunction(this, 'counter-snapshot-command-handler', {
      functionName: 'counter-snapshot-command-handler',
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

    new CfnOutput(this, 'commandUrl', { value: commandUrl.url })
    new CfnOutput(this, 'commandLogGroup', { value: command.logGroup.logGroupName })
  }
}
