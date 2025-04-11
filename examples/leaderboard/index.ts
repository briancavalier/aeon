import { App } from 'aws-cdk-lib'
import { AccountStack } from './account/stack'
import { LeaderboardStack } from './leaderboard/stack'

const app = new App()

const accountStack = new AccountStack(app, 'account')
const leaderboardStack = new LeaderboardStack(app, 'leaderboard', {
  accountCommandApi: accountStack.commandApi,
})

app.synth()
