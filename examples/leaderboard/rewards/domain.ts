export type ClaimEvent =
  | Readonly<{ type: 'claimed', rewardId: string, amount: number }>
