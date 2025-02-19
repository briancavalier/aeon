import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb'
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { resolve } from 'node:path'
import { EventStoreSubscription, IEventStore } from '../../src/aws-cdk'
import { commonFunctionEnv, commonFunctionProps } from '../lib/cdk-defaults'

export interface CounterCQRSLazyStackProps extends StackProps {
  eventStore: IEventStore
}

export class CounterCQRSLazyStack extends Stack {
  constructor(scope: Construct, id: string, props: CounterCQRSLazyStackProps) {
    super(scope, id, props)

    // -------------------------------------------
    // View

    const counterView = new TableV2(this, 'coutner-cqrs-lazy-lazy-view', {
      tableName: 'coutner-cqrs-lazy-view',
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // -------------------------------------------
    // Query

    const query = new NodejsFunction(this, 'coutner-cqrs-lazy-query-handler', {
      functionName: 'coutner-cqrs-lazy-query-handler',
      ...commonFunctionProps,
      entry: resolve(__dirname, 'query.ts'),
      environment: {
        ...commonFunctionEnv,
        viewTable: counterView.tableName,
        eventStoreConfig: props.eventStore.config
      }
    })

    counterView.grantReadWriteData(query)
    props.eventStore.grantReadEvents(query)

    const queryUrl = query.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })

    new CfnOutput(this, 'queryUrl', { value: queryUrl.url })
    new CfnOutput(this, 'queryLogGroup', { value: query.logGroup.logGroupName })
  }
}
