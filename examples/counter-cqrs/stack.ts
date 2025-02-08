import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb'
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

    const counterView = new TableV2(this, 'counter-view', {
      tableName: 'counter-cqrs-view',
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const update = new NodejsFunction(this, 'counter-cqrs-update-handler', {
      functionName: 'counter-update-handler',
      ...commonFunctionProps,
      entry: resolve(__dirname, 'update.ts'),
      environment: {
        ...commonFunctionEnv,
        viewTable: counterView.tableName
      }
    })

    counterView.grantReadWriteData(update)
    new EventStoreSubscription(this, 'counter-cqrs-update-subscription', {
      eventStore: props.eventStore,
      handler: update,
      categories: ['counter']
    })

    // -------------------------------------------
    // Query

    const query = new NodejsFunction(this, 'counter-cqrs-query-handler', {
      functionName: 'counter-cqrs-query-handler',
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
