import { Competitor, LeaderboardEvent } from "./domain"

export type LeaderboardCommand =
  | Readonly<{ type: 'start' }>
  | Readonly<{ type: 'join', userId: string }>
  | Readonly<{ type: 'score', userId: string, score: number }>
  | Readonly<{ type: 'finish' }>

export type LeaderboardState =
  | Readonly<{ type: 'not-started' }>
  | Readonly<{ type: 'started', competitors: readonly Competitor[] }>
  | Readonly<{ type: 'finished', ranking: readonly Competitor[] }>

export const initial: LeaderboardState = { type: 'not-started' }

export const decide = (state: LeaderboardState, command: LeaderboardCommand): readonly LeaderboardEvent[] => {
  switch (command.type) {
    case 'start':
      if (state.type !== 'not-started') return []
      return [{ type: 'started' }]

    case 'join': {
      if (state.type !== 'started') return []
      const exists = state.competitors.find(competitor => competitor.userId === command.userId)
      return exists ? [] : [{ type: 'joined', userId: command.userId }]
    }

    case 'score': {
      if (state.type !== 'started') return []
      const exists = state.competitors.find(competitor => competitor.userId === command.userId)
      return exists ? [{ ...command, type: 'scored', }] : []
    }

    case 'finish':
      if (state.type !== 'started') return []
      return [{ type: 'finished', ranking: [...state.competitors].sort((a, b) => b.score - a.score) }]
  }
}

export const update = (state: LeaderboardState, event: LeaderboardEvent): LeaderboardState => {
  switch (event.type) {
    case 'started':
      return { type: 'started', competitors: [] }

    case 'joined':
      if (state.type !== 'started') return state
      return { ...state, competitors: [...state.competitors, { userId: event.userId, score: 0 }] }

    case 'scored':
      if (state.type !== 'started') return state
      return { ...state, competitors: state.competitors.map(competitor => competitor.userId === event.userId ? { ...competitor, score: competitor.score + event.score } : competitor) }

    case 'finished':
      if (state.type !== 'started') return state
      return { type: 'finished', ranking: event.ranking }
  }
}
