import { ApplicationLogLevel, LoggingFormat, Runtime, SystemLogLevel } from 'aws-cdk-lib/aws-lambda'

export const commonFunctionEnv = {
  NODE_OPTIONS: '--enable-source-maps',
} as const

export const commonFunctionProps = {
  runtime: Runtime.NODEJS_22_X,
  bundling: { sourceMap: true },
  loggingFormat: LoggingFormat.JSON,
  applicationLogLevelV2: ApplicationLogLevel.DEBUG,
  SystemLogLevelV2: SystemLogLevel.WARN,
} as const
