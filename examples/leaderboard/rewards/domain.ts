export type ClaimEvent =
  | Readonly<{ type: 'claimed', rewardId: string, amount: number }>
  | Readonly<{ type: 'claim-paid', rewardId: string, amount: number }>
  | Readonly<{ type: 'claim-fulfilled', rewardId: string, reason: string }>

export type InventoryEvent =
  | Readonly<{ type: 'reward-added', rewardId: string, name: string, price: number }>
  | Readonly<{ type: 'reward-removed', rewardId: string }>
