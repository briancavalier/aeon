export type LeaderboardEvent =
  | LeaderboardCreatedEvent
  | CompetitorAddedEvent
  | CompetitorScoreUpdatedEvent

export type LeaderboardCreatedEvent = Readonly<{
  tag: 'created',
  id: Id<'Leaderboard'>,
  name: string,
  description: string
}>

export type CompetitorAddedEvent = Readonly<{
  tag: 'competitor-added',
  id: Id<'Leaderboard'>,
  userId: Id<'User'>,
  score: number
}>

export type CompetitorScoreUpdatedEvent = Readonly<{
  tag: 'competitor-score-updated',
  id: Id<'Leaderboard'>,
  userId: Id<'User'>,
  score: number
}>

export type Id<A, T = string> = T & { readonly Id: unique symbol, type: A }
