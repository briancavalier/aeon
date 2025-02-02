import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'
import { EventStore, IEventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../aws-defaults'

export class CounterStack extends Stack {
  public readonly eventStore: IEventStore

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // -------------------------------------------
    // Event store

    const counterEventStore = this.eventStore = new EventStore(this, 'counter-events', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST
    })

    // -------------------------------------------
    // Aggregate

    const command = new NodejsFunction(this, `counter-command-handler`, {
      ...commonFunctionProps,
      entry: resolve(__dirname, 'command.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: counterEventStore.config
      }
    })

    counterEventStore.grantReadWriteEvents(command)

    const commandUrl = command.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    // -------------------------------------------
    // Query

    const query = new NodejsFunction(this, `counter-query-handler`, {
      ...commonFunctionProps,
      entry: resolve(__dirname, 'query.ts'),
      environment: {
        ...commonFunctionEnv,
        eventStoreConfig: counterEventStore.config
      }
    })

    counterEventStore.grantReadEvents(query)

    const queryUrl = query.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'commandUrl', { value: commandUrl.url })
    new CfnOutput(this, 'queryUrl', { value: queryUrl.url })
    new CfnOutput(this, 'commandLogGroup', { value: command.logGroup.logGroupName })
    new CfnOutput(this, 'queryLogGroup', { value: query.logGroup.logGroupName })
  }
}
