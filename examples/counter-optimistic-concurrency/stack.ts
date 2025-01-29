import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'
import { EventStore, IEventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../aws-defaults'

export interface CounterOptimisticConcurrencyStackProps extends StackProps {
  eventStore: IEventStore
}

export class CounterOptimisticConcurrencyStack extends Stack {
  public readonly snapshotStore: IEventStore

  constructor(scope: Construct, id: string, { eventStore, ...props }: CounterOptimisticConcurrencyStackProps) {
    super(scope, id, props)

    // -------------------------------------------
    // Snapshot store

    const snapshotStore = this.snapshotStore = new EventStore(this, 'counter-snapshots', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST
    })

    // -------------------------------------------
    // Aggregate

    const command = new NodejsFunction(this, `counter-command-optimistic-concurrency-handler`, {
      ...commonFunctionProps,
      entry: resolve(__dirname, 'command.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: eventStore.config,
        snapshotStoreConfig: snapshotStore.config
      }
    })

    eventStore.grantReadWriteEvents(command)
    snapshotStore.grantReadWriteEvents(command)

    const commandUrl = command.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'commandUrl', { value: commandUrl.url })
  }
}
