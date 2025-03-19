export type LeaderboardEvent =
  | Readonly<{ type: 'started' }>
  | Readonly<{ type: 'joined', userId: string }>
  | Readonly<{ type: 'scored', userId: string, score: number }>
  | Readonly<{ type: 'finished', ranking: readonly Competitor[] }>

export type Competitor
  = Readonly<{ userId: string, score: number }>
