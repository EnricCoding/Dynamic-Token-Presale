export type TxHash = `0x${string}`;

export interface Phase {
  phaseId: number;
  priceWei: bigint;
  supply: bigint;
  sold: bigint;
  start: number; 
  end: number;   
}

export interface CalcResult {
  tokens: bigint;
  cost: bigint;
  excess: bigint;
}
