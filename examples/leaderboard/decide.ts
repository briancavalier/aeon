import { Id, LeaderboardEvent } from '../domain'

export type LeaderboardCommand =
  | Readonly<{ tag: 'create', id: Id<'Leaderboard'>, name: string, description: string }>
  | Readonly<{ tag: 'add-competitor', id: Id<'Leaderboard'>, userId: Id<'User'>, score: number }>
  | Readonly<{ tag: 'update-competitor-score', id: Id<'Leaderboard'>, userId: Id<'User'>, score: number }>

export type Leaderboard = Readonly<{
  id: Id<'Leaderboard'>,
  competitors: readonly Competitor[]
}>

type Competitor = Readonly<{
  userId: string,
  score: number
}>

export const decide = (leaderboard: Leaderboard | undefined, command: LeaderboardCommand): readonly LeaderboardEvent[] => {
  switch (command.tag) {
    case 'create':
      return leaderboard === undefined ? [{ ...command, tag: 'created' }] : []

    case 'add-competitor':
      return leaderboard !== undefined ? [{ ...command, tag: 'competitor-added' }] : []

    case 'update-competitor-score': {
      if (!leaderboard) return []

      // Produce event only if competitor exists and new score > current score
      const competitor = leaderboard?.competitors.find(c => c.userId === command.userId)
      return competitor && command.score > competitor.score
        ? [{ ...command, tag: 'competitor-score-updated' }]
        : []
    }
  }
}

export const update = (leaderboard: Leaderboard | undefined, event: LeaderboardEvent): Leaderboard | undefined => {
  switch (event.tag) {
    case 'created':
      return { id: event.id, competitors: [] }

    case 'competitor-added':
      return leaderboard === undefined ? leaderboard : {
        ...leaderboard,
        competitors: [...leaderboard?.competitors ?? [], { userId: event.userId, score: 0 }]
      }

    case 'competitor-score-updated':
      return leaderboard === undefined ? leaderboard : {
        ...leaderboard,
        competitors: leaderboard.competitors.map(c =>
          c.userId === event.userId ? { ...c, score: event.score } : c
        )
      }
  }
}
