# Dynamic Presale Subgraph - Query Examples

## User Queries

### Get Complete User Profile
```graphql
query GetUserProfile($userAddress: String!) {
  user(id: $userAddress) {
    id
    # Presale data
    totalContributed
    totalTokensPurchased
    totalTokensClaimed
    totalRefunded
    
    # Vesting data
    totalVested
    totalReleased
    
    # Token balance
    tokenBalance
    
    # Activity timestamps
    firstInteractionTimestamp
    lastInteractionTimestamp
    
    # Related entities
    purchases(orderBy: timestamp, orderDirection: desc) {
      id
      phase {
        phaseId
        priceWei
      }
      ethAmount
      tokensAmount
      timestamp
    }
    
    vestingSchedules(where: { revoked: false }) {
      scheduleId
      totalAmount
      released
      remaining
      startTime
      duration
      cliff
      lastReleasedTimestamp
    }
  }
}
```

### Get User's Purchase History
```graphql
query GetUserPurchases($userAddress: String!, $first: Int = 50) {
  purchases(
    where: { buyer: $userAddress }
    first: $first
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    ethAmount
    tokensAmount
    timestamp
    blockNumber
    transactionHash
    phase {
      phaseId
      priceWei
    }
  }
}
```

## Presale Queries

### Get Global Presale Stats
```graphql
query GetPresaleStats {
  presaleStats(id: "1") {
    totalRaised
    totalTokensSold
    totalBuyers
    softCap
    minBuy
    maxPerWallet
    softCapReached
    saleEnded
    saleEndedTimestamp
    totalPhases
    totalPurchases
    totalClaims
    totalRefunds
    lastUpdatedTimestamp
  }
}
```

### Get All Phases with Details
```graphql
query GetAllPhases {
  phases(orderBy: phaseId, orderDirection: asc) {
    id
    phaseId
    priceWei
    supply
    sold
    remaining
    startTime
    endTime
    isActive
    isCompleted
    createdAtTimestamp
    
    # Get purchases count and total
    purchases {
      ethAmount
      tokensAmount
    }
  }
}
```

### Get Active Phase
```graphql
query GetActivePhase($currentTime: BigInt!) {
  phases(
    where: {
      isActive: true
      startTime_lte: $currentTime
      endTime_gte: $currentTime
    }
    first: 1
  ) {
    phaseId
    priceWei
    supply
    sold
    remaining
    startTime
    endTime
  }
}
```

### Get Recent Purchases (Last 24h)
```graphql
query GetRecentPurchases($since: BigInt!, $first: Int = 100) {
  purchases(
    where: { timestamp_gte: $since }
    first: $first
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    buyer {
      id
    }
    phase {
      phaseId
      priceWei
    }
    ethAmount
    tokensAmount
    timestamp
    transactionHash
  }
}
```

### Get Top Buyers
```graphql
query GetTopBuyers($first: Int = 10) {
  users(
    first: $first
    orderBy: totalContributed
    orderDirection: desc
    where: { totalContributed_gt: "0" }
  ) {
    id
    totalContributed
    totalTokensPurchased
    totalTokensClaimed
    purchases {
      id
    }
  }
}
```

## Vesting Queries

### Get All Active Vesting Schedules
```graphql
query GetActiveVestingSchedules($first: Int = 100) {
  vestingSchedules(
    where: { revoked: false, remaining_gt: "0" }
    first: $first
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    id
    beneficiary {
      id
    }
    scheduleId
    totalAmount
    released
    remaining
    startTime
    duration
    cliff
    lastReleasedTimestamp
  }
}
```

### Get Vesting Schedule Details
```graphql
query GetVestingSchedule($beneficiary: String!, $scheduleId: String!) {
  vestingSchedule(id: $beneficiary-$scheduleId) {
    id
    beneficiary {
      id
      totalVested
      totalReleased
    }
    scheduleId
    totalAmount
    released
    remaining
    startTime
    duration
    cliff
    revocable
    revoked
    revokedAt
    revokedAmount
    createdAtTimestamp
    
    # Release history
    releases(orderBy: timestamp, orderDirection: desc) {
      id
      amount
      timestamp
      transactionHash
    }
  }
}
```

### Get Vesting Stats
```graphql
query GetVestingStats {
  vestingStats(id: "1") {
    totalSchedules
    totalCommitted
    totalReleased
    totalRevoked
    lastUpdatedTimestamp
  }
}
```

### Get Recent Token Releases
```graphql
query GetRecentReleases($first: Int = 50) {
  tokenReleases(
    first: $first
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    beneficiary {
      id
    }
    schedule {
      scheduleId
      totalAmount
    }
    amount
    timestamp
    transactionHash
  }
}
```

## Claims & Refunds

### Get All Claims
```graphql
query GetAllClaims($first: Int = 100) {
  claims(
    first: $first
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    buyer {
      id
    }
    tokensAmount
    timestamp
    transactionHash
  }
}
```

### Get All Refunds
```graphql
query GetAllRefunds($first: Int = 100) {
  refunds(
    first: $first
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    buyer {
      id
    }
    ethAmount
    timestamp
    transactionHash
  }
}
```

## Token Transfers

### Get User's Transfer History
```graphql
query GetUserTransfers($userAddress: String!, $first: Int = 50) {
  user(id: $userAddress) {
    transfers(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      to {
        id
      }
      amount
      timestamp
      transactionHash
    }
  }
}
```

## Dashboard Queries

### Get Dashboard Overview
```graphql
query GetDashboard {
  presaleStats(id: "1") {
    totalRaised
    totalTokensSold
    totalBuyers
    softCapReached
    saleEnded
  }
  
  vestingStats(id: "1") {
    totalSchedules
    totalCommitted
    totalReleased
    totalRevoked
  }
  
  phases(
    orderBy: phaseId
    orderDirection: asc
    where: { isCompleted: false }
  ) {
    phaseId
    priceWei
    supply
    sold
    remaining
    isActive
  }
  
  recentPurchases: purchases(
    first: 10
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    buyer {
      id
    }
    ethAmount
    tokensAmount
    timestamp
  }
}
```

### Get User Dashboard
```graphql
query GetUserDashboard($userAddress: String!) {
  user(id: $userAddress) {
    # Stats
    totalContributed
    totalTokensPurchased
    totalTokensClaimed
    totalRefunded
    totalVested
    totalReleased
    tokenBalance
    
    # Recent purchases
    recentPurchases: purchases(
      first: 5
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      ethAmount
      tokensAmount
      timestamp
      phase {
        phaseId
      }
    }
    
    # Active vesting
    activeVesting: vestingSchedules(
      where: { revoked: false, remaining_gt: "0" }
    ) {
      scheduleId
      totalAmount
      released
      remaining
      startTime
      duration
      cliff
    }
    
    # Recent claims
    recentClaims: claims(
      first: 5
      orderBy: timestamp
      orderDirection: desc
    ) {
      tokensAmount
      timestamp
    }
  }
}
```

## Pagination Example

### Paginated Purchases
```graphql
query GetPurchasesPaginated($first: Int!, $skip: Int!) {
  purchases(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    buyer {
      id
    }
    ethAmount
    tokensAmount
    timestamp
    phase {
      phaseId
      priceWei
    }
  }
}
```

## Variables Examples

```json
{
  "userAddress": "0x1234567890123456789012345678901234567890",
  "first": 10,
  "skip": 0,
  "since": "1704067200",
  "currentTime": "1704067200",
  "scheduleId": "0"
}
```
