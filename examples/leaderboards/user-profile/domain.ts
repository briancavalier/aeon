import { Id } from '../../lib/id'

export type UserProfileEvent = DisplayNameUpdatedEvent

export type DisplayNameUpdatedEvent = Readonly<{
  type: 'display-name-updated',
  userId: Id<'User'>,
  displayName: string
}>
