// packages/frontend/lib/abi.ts
import { parseAbi } from "viem";

export const DynamicPresaleABI = [
  "function totalPhases() view returns (uint256)",
  "function getPhase(uint256) view returns (uint256 priceWei, uint256 supply, uint256 sold, uint256 start, uint256 end)",
  "function calculateTokens(uint256) view returns (uint256 tokens, uint256 cost, uint256 excess)",
  "function remainingTokensInCurrentPhase() view returns (uint256)",
  "function contributionsWei(address) view returns (uint256)",
  "function pendingTokens(address) view returns (uint256)",
  "function totalBuyers() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function totalTokensSold() view returns (uint256)",
  "function softCapReached() view returns (bool)",
  "function saleEnded() view returns (bool)",
  "function softCap() view returns (uint256)",
  "function minBuy() view returns (uint256)",
  "function maxPerWallet() view returns (uint256)",
  "function hasActivePhase() view returns (bool)",
  "function getCurrentPhase() view returns (uint256)",
  "function paymentsOf(address) view returns (uint256)",
  "function escrowBalance() view returns (uint256)",
  "function owner() view returns (address)",
  "function tokenDecimals() view returns (uint8)",
  "function tokenUnit() view returns (uint256)",
  "function buy() payable",
  "function claim()",
  "function requestRefund()",
  "function addPhase(uint256 priceWei, uint256 supply, uint256 start, uint256 end)",
  "function withdrawProceeds(address beneficiary)",
  "function endSale()",
  "function pause()",
  "function unpause()",
] as const;

// Parsed ABI for viem (do it once)
export const DynamicPresaleAbiParsed = parseAbi(
  DynamicPresaleABI as readonly string[]
);

/* token abi */
export const MyTokenABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
] as const;

export const MyTokenAbiParsed = parseAbi(MyTokenABI as readonly string[]);
