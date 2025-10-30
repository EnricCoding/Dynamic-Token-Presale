// packages/frontend/hooks/presale.types.ts
export type TxHash = `0x${string}`;

export interface Phase {
  phaseId: number;
  priceWei: bigint;
  supply: bigint;
  sold: bigint;
  start: number; // unix seconds
  end: number;   // unix seconds
}

export interface CalcResult {
  tokens: bigint;
  cost: bigint;
  excess: bigint;
}
