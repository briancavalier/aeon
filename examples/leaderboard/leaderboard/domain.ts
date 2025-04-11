export type LeaderboardEvent =
  | Readonly<{ type: 'started' }>
  | Readonly<{ type: 'joined', userId: string }>
  | Readonly<{ type: 'scored', userId: string, score: number }>
  | Readonly<{ type: 'finished', competitors: readonly Competitor[] }>
  | Readonly<{ type: 'awarded', userId: string, rank: number, transactionId: string, amount: number }>
  | Readonly<{ type: 'award-failed', userId: string, rank: number, reason: string, transactionId: string, amount: number }>

export type Competitor
  = Readonly<{ userId: string, score: number }>
