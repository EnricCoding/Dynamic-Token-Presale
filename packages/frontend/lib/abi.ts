// packages/frontend/lib/abis.ts
export const DynamicPresaleABI = [
  // read
  "function totalPhases() view returns (uint256)",
  "function getPhase(uint256) view returns (uint256 priceWei, uint256 supply, uint256 sold, uint256 start, uint256 end)",
  "function calculateTokens(uint256) view returns (uint256 tokens, uint256 cost, uint256 excess)",
  "function remainingTokensInCurrentPhase() view returns (uint256)",
  "function contributionsWei(address) view returns (uint256)",
  "function pendingTokens(address) view returns (uint256)",
  "function totalBuyers() view returns (uint256)",
  // actions
  "function buy() payable",
  "function claim()",
  "function requestRefund()",
  "function addPhase(uint256 priceWei, uint256 supply, uint256 start, uint256 end)",
  "function withdrawProceeds(address payable beneficiary)",
  "function endSale()",
];

export const MyTokenABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  // mint/burn are admin-only; not used in frontend except maybe claim->token.mint is done by contract
];
