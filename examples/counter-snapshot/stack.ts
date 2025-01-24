import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'
import { EventStore, IEventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../aws-defaults'

export interface CounterSnapshotStackProps extends StackProps {
  eventStore: IEventStore
}

export class CounterSnapshotStack extends Stack {
  public readonly eventStore: IEventStore

  constructor(scope: Construct, id: string, props: CounterSnapshotStackProps) {
    super(scope, id, props)

    // -------------------------------------------
    // Snapshot store

    const counterSnapshotEventStore = this.eventStore = new EventStore(this, 'counter-snapshots', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST
    })

    // -------------------------------------------
    // Aggregate

    const command = new NodejsFunction(this, `counter-command-snapshot-handler`, {
      ...commonFunctionProps,
      entry: resolve(__dirname, 'command.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: props.eventStore.config,
        snapshotStoreConfig: counterSnapshotEventStore.config
      }
    })

    props.eventStore.grantReadWriteEvents(command)
    counterSnapshotEventStore.grantReadWriteEvents(command)

    const commandUrl = command.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'commandUrl', { value: commandUrl.url })
  }
}
