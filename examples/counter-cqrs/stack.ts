import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'
import { EventStoreSubscription, IEventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../aws-defaults'

export interface CounterCQRSStackProps extends StackProps {
  eventStore: IEventStore
}

export class CounterCQRSStack extends Stack {
  constructor(scope: Construct, id: string, props: CounterCQRSStackProps) {
    super(scope, id, props)

    // -------------------------------------------
    // View

    const counterView = new Table(this, 'counter-view', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    })

    const update = new NodejsFunction(this, `counter-update-handler`, {
      ...commonFunctionProps,
      entry: resolve(__dirname, 'update.ts'),
      environment: {
        ...commonFunctionEnv,
        viewTable: counterView.tableName
      }
    })

    counterView.grantReadWriteData(update)
    new EventStoreSubscription(this, 'counter-update-subscription', {
      eventStore: props.eventStore,
      handler: update,
      categories: ['counter']
    })

    // -------------------------------------------
    // Query

    const query = new NodejsFunction(this, `counter-query-handler`, {
      ...commonFunctionProps,
      entry: resolve(__dirname, 'query.ts'),
      environment: {
        ...commonFunctionEnv,
        viewTable: counterView.tableName
      }
    })

    counterView.grantReadData(query)

    const queryUrl = query.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'queryUrl', { value: queryUrl.url })
    new CfnOutput(this, 'queryLogGroup', { value: query.logGroup.logGroupName })
  }
}
