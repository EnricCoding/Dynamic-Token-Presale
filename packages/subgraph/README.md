# Dynamic Presale Subgraph

The Graph subgraph for indexing and querying Dynamic Presale smart contract events.

## 📋 Overview

This subgraph indexes three main contracts:
- **DynamicPresale**: Multi-phase token presale with dynamic pricing
- **TokenVesting**: Linear vesting schedules with cliff periods
- **MyToken**: ERC20 token with minting, burning, and pausing capabilities

## 🚀 Setup

### Prerequisites
- Node.js >= 16
- Graph CLI installed globally: `npm install -g @graphprotocol/graph-cli`

### Installation

```bash
cd packages/subgraph
npm install
```

### Configuration

1. **Update contract addresses in `subgraph.yaml`:**
   - Replace `0x0000000000000000000000000000000000000000` with deployed contract addresses
   - Update `startBlock` with the deployment block numbers

2. **Generate types:**
```bash
npm run codegen
```

3. **Build subgraph:**
```bash
npm run build
```

## 📡 Deployment

### Deploy to The Graph Studio

1. Create a subgraph at [thegraph.com/studio](https://thegraph.com/studio/)
2. Update the deploy script in `package.json` with your subgraph name
3. Authenticate:
```bash
graph auth --studio <YOUR_DEPLOY_KEY>
```
4. Deploy:
```bash
npm run deploy
```

### Deploy to Local Graph Node

1. Start local graph node (requires Docker)
2. Create subgraph:
```bash
npm run create-local
```
3. Deploy:
```bash
npm run deploy-local
```

## 📊 Entities

### Core Entities

- **User**: Tracks all user interactions (purchases, claims, vesting, etc.)
- **PresaleStats**: Global presale statistics
- **Phase**: Individual presale phases with pricing and supply
- **Purchase**: Purchase events
- **Claim**: Token claim events
- **Refund**: Refund events
- **VestingSchedule**: Vesting schedules for beneficiaries
- **TokenRelease**: Token release events from vesting

### Supporting Entities

- **Withdrawal**: Owner proceeds withdrawals
- **PaymentWithdrawal**: Excess/refund withdrawals (pull pattern)
- **TokenTransfer**: ERC20 transfer events
- **VestingStats**: Global vesting statistics

## 🔍 Example Queries

### Get User Details
```graphql
{
  user(id: "0x...") {
    totalContributed
    totalTokensPurchased
    totalTokensClaimed
    purchases {
      ethAmount
      tokensAmount
      timestamp
    }
    vestingSchedules {
      totalAmount
      released
      remaining
    }
  }
}
```

### Get Presale Statistics
```graphql
{
  presaleStats(id: "1") {
    totalRaised
    totalTokensSold
    totalBuyers
    softCapReached
    saleEnded
  }
}
```

### Get All Phases
```graphql
{
  phases(orderBy: phaseId, orderDirection: asc) {
    phaseId
    priceWei
    supply
    sold
    remaining
    startTime
    endTime
    isActive
  }
}
```

### Get Recent Purchases
```graphql
{
  purchases(
    first: 10
    orderBy: timestamp
    orderDirection: desc
  ) {
    buyer {
      id
    }
    phase {
      phaseId
    }
    ethAmount
    tokensAmount
    timestamp
  }
}
```

### Get Vesting Schedules for User
```graphql
{
  vestingSchedules(
    where: { beneficiary: "0x..." }
  ) {
    scheduleId
    totalAmount
    released
    remaining
    startTime
    duration
    cliff
    revoked
  }
}
```

## 🏗️ Architecture

```
subgraph/
├── schema.graphql          # GraphQL schema definitions
├── subgraph.yaml           # Subgraph manifest
├── package.json            # Dependencies and scripts
├── src/
│   ├── dynamic-presale.ts  # DynamicPresale event handlers
│   ├── token-vesting.ts    # TokenVesting event handlers
│   └── my-token.ts         # MyToken event handlers
└── generated/              # Auto-generated code (after codegen)
```

## 🧪 Testing

The subgraph uses Matchstick for unit testing:

```bash
npm test
```

## 📝 Notes

- The subgraph only tracks transfers between non-zero addresses (excludes mints/burns)
- User balances are updated in real-time based on claims, releases, and transfers
- All timestamps are in Unix epoch format (seconds)
- All token amounts are in wei (base units)

## 🔗 Useful Links

- [The Graph Docs](https://thegraph.com/docs/)
- [AssemblyScript API](https://thegraph.com/docs/en/developing/assemblyscript-api/)
- [Subgraph Studio](https://thegraph.com/studio/)
