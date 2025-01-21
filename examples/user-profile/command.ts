import { Id } from '../lib/id'
import { UserProfileEvent } from './domain'

export type UserProfileCommand =
  Readonly<{ type: 'update-display-name', userId: Id<'User'>, displayName: string }>

export type UserProfile = Readonly<{
  userId: Id<'User'>,
  displayName: string
}>

export const decide = (userProfile: UserProfile | undefined, command: UserProfileCommand): readonly UserProfileEvent[] =>
  userProfile && userProfile.displayName === command.displayName
    ? []
    : [{ ...command, type: 'display-name-updated' }]

export const update = (userProfile: UserProfile | undefined, { type, ...data }: UserProfileEvent): UserProfile | undefined =>
  ({ ...userProfile, ...data })
