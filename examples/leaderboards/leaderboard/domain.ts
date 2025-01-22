import { Id } from '../../lib/id'

export type LeaderboardEvent =
  | LeaderboardCreatedEvent
  | CompetitorAddedEvent
  | CompetitorScoreUpdatedEvent

export type LeaderboardCreatedEvent = Readonly<{
  type: 'created',
  id: Id<'Leaderboard'>,
  name: string,
  description: string
}>

export type CompetitorAddedEvent = Readonly<{
  type: 'competitor-added',
  id: Id<'Leaderboard'>,
  userId: Id<'User'>,
  score: number
}>

export type CompetitorScoreUpdatedEvent = Readonly<{
  type: 'competitor-score-updated',
  id: Id<'Leaderboard'>,
  userId: Id<'User'>,
  score: number
}>
