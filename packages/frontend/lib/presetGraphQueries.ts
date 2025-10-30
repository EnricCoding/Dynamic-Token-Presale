// packages/frontend/lib/presetGraphQueries.ts
import { gql } from "@apollo/client";

export const PRESALE_STATS_QUERY = gql`
  query PresaleStats {
    presaleStats(id: "1") {
      totalRaised
      totalTokensSold
      totalBuyers
      softCap
      minBuy
      maxPerWallet
      softCapReached
      saleEnded
      totalPhases
      totalPurchases
      totalClaims
      totalRefunds
      totalEscrow
    }
  }
`;

export const PURCHASES_BY_USER = gql`
  query PurchasesByUser($buyer: Bytes!) {
    purchases(where: { buyer: $buyer }) {
      id
      ethAmount
      tokensAmount
      timestamp
      phase {
        phaseId
      }
    }
  }
`;
