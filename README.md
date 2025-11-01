# Dynamic Token Presale

A production-ready blockchain presale system with multi-phase token distribution, linear vesting with cliff periods, and decentralized indexing via The Graph.

## What Is This?

A complete smart contract system that handles:
- **Multi-phase token presale** with dynamic pricing
- **Soft cap mechanism** (soft cap = 10 ETH, if not reached → refunds)
- **Token vesting** for team/advisors with cliff periods
- **Pull payment escrow** for safe ETH handling
- **GraphQL indexing** via The Graph for real-time data

**Status:** Deployed on Sepolia testnet | 117 passing tests ✅

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                             │
│         React/Next.js 15 Frontend (Wagmi + TanStack Query)          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ • Home Page (intro & navigation)                            │   │
│  │ • Presale Dashboard (buy, claim, refund)                    │   │
│  │   - Real-time phase timeline with countdown                 │   │
│  │   - Soft cap progress bar                                   │   │
│  │   - Token calculator with gas warnings                      │   │
│  │   - Account summary (contributions, pending tokens)         │   │
│  │ • Wallet Integration (Wagmi with MetaMask support)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              ↑ GraphQL ↓
┌─────────────────────────────────────────────────────────────────────┐
│               INDEXING & QUERY LAYER (The Graph)                    │
│          Subgraph: dynamic-presale-subgraph v0.0.1                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 12 Entities:                                                │   │
│  │ • User, PresaleStats, Phase, Purchase, Claim, Refund       │   │
│  │ • VestingSchedule, TokenRelease, TokenTransfer             │   │
│  │ • PaymentQueued, PaymentWithdrawal, VestingStats           │   │
│  │                                                              │   │
│  │ 3 Data Sources:                                             │   │
│  │ • DynamicPresale (8 events)                                │   │
│  │ • TokenVesting (3 events)                                   │   │
│  │ • MyToken (1 event)                                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                     ↑ Contracts & Events ↓
┌─────────────────────────────────────────────────────────────────────┐
│            BLOCKCHAIN LAYER (Ethereum Sepolia)                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  MyToken (ERC20)                                            │   │
│  │  ├─ Minting/Burning with Roles                            │   │
│  │  ├─ Pausable Transfers                                     │   │
│  │  └─ Capped Supply (100M)                                  │   │
│  │                                                              │   │
│  │  DynamicPresale                        TokenVesting        │   │
│  │  ├─ buy()                             ├─ createVesting()   │   │
│  │  ├─ claim()                           ├─ release()         │   │
│  │  ├─ refund()                          ├─ releaseSchedule() │   │
│  │  ├─ addPhase()                        └─ revokeVesting()   │   │
│  │  └─ withdrawPayments()                                     │   │
│  │     (Pull Payment Pattern)                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                         ↑ RPC (Alchemy) ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  ETHEREUM SEPOLIA TESTNET                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Purchase Flow:**
```
User sends ETH → buy() 
  → Validates phase & amount
  → Calculates tokens
  → Stores in pendingTokens
  → Excess ETH → escrow
  → Emits Purchased event
    → Subgraph indexes event
      → User entity updated
      → Purchase entity created
        → Frontend queries & displays
```

**Claim Flow (Soft Cap Reached):**
```
Presale ends → endSale() called
  → Soft cap check: yes
  → Emits SaleEnded(true)
    → Subgraph updates PresaleStats
      → Frontend enables claim button
User calls claim()
  → Mints tokens
  → Emits Claimed event
    → Subgraph updates User & Claim entities
      → Frontend shows new token balance
```

**Vesting Flow:**
```
Owner calls createVesting()
  → Sets cliff + duration
  → Emits VestingCreated event
    → Subgraph creates VestingSchedule entity
      → Frontend shows countdown to cliff
Cliff passes → Beneficiary calls release()
  → Linear calculation: tokens / duration * elapsed
  → Transfers tokens
  → Emits TokensReleased event
    → Subgraph updates released amount
      → Frontend shows updated balance
```

### Contract Dependencies

```
MyToken
  ↑
  └─ DynamicPresale: Calls token.mint() on claim
  └─ TokenVesting: Holds tokens for vesting schedules

DynamicPresale
  └─ Owns phases, manages presale state
  └─ Escrows excess ETH via pull payment pattern

TokenVesting
  └─ Independently manages vesting schedules
  └─ No dependencies on DynamicPresale
```

### Security Layers

```
┌─────────────────────────────────────────┐
│   FRONTEND VALIDATION                   │
│   • Form validation                     │
│   • Wallet checks                       │
│   • UI warnings                         │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   SMART CONTRACT VALIDATION             │
│   • Input checks (address, amount)      │
│   • State checks (paused, ended)        │
│   • Limits (minBuy, maxPerWallet)       │
│   • Business logic (soft cap)           │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   REENTRANCY PROTECTION                 │
│   • ReentrancyGuard on all state mods   │
│   • Checks-Effects-Interactions pattern │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   ACCESS CONTROL                        │
│   • Role-based (MINTER, PAUSER)         │
│   • Owner checks                        │
│   • No unprotected functions            │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   SAFE ARITHMETIC & TRANSFERS           │
│   • SafeERC20 for token transfers       │
│   • Careful division handling           │
│   • No overflow/underflow risks         │
└─────────────────────────────────────────┘
```

---

## Quick Facts

| What | Details |
|------|---------|
| **Contracts** | 3 (MyToken, DynamicPresale, TokenVesting) |
| **Lines of Code** | 5,000+ Solidity |
| **Test Coverage** | 117 passing tests, 100% critical paths |
| **Network** | Ethereum Sepolia |
| **Gas Cost** | ~5.2M total deployment |
| **Token Cap** | 100M tokens |
| **Presale Soft Cap** | 10 ETH |
| **Min Buy** | 0.01 ETH |
| **Max Per Wallet** | 20 ETH |

---

## Live Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| MyToken | `0x4B0056348e71722Ee0bF6466D278102aF2165F1E` |
| DynamicPresale | `0x7878dBCFd713b76b1De6F0812fEC9c6c2b8d55Bc` |
| TokenVesting | `0x626Cb432AcE64ED61Fe246021Afb2630F2BEe3D9` |
| **Subgraph** | https://api.studio.thegraph.com/query/117753/dynamic-presale-subgraph/0.0.1 |

---

## How It Works

### User Flow
```
1. User sends ETH → buy() function
2. Tokens stored in pendingTokens (not minted yet)
3. Presale ends → endSale() called
4. If soft cap reached (10 ETH):
   - User calls claim() → receives tokens
   If soft cap NOT reached:
   - User calls refund() → gets ETH back via escrow
```

### Team/Advisor Vesting
```
1. Owner creates vesting schedule (cliff + duration)
2. After cliff period passes
3. Beneficiary calls release() → tokens unlock linearly
4. Owner can revoke if revocable=true → unvested tokens returned
```

---

## Smart Contracts Explained

### MyToken (ERC20)
- Standard ERC20 token with minting/burning
- Role-based access: MINTER_ROLE, PAUSER_ROLE, BURNER_ROLE
- Pausable transfers for emergencies
- Capped supply (100M tokens)

### DynamicPresale
- **buy()**: Buy tokens in active phase
  - Validates minBuy (0.01 ETH) and maxPerWallet (20 ETH)
  - Excess ETH goes to escrow
  - Tokens stored in pendingTokens mapping
  
- **claim()**: Get tokens after presale succeeds
  - Only works if soft cap reached (10 ETH)
  - Only works after presale ends
  - Mints tokens to user
  
- **refund()**: Get ETH back if soft cap fails
  - Only works if soft cap NOT reached
  - Queues ETH in escrow
  
- **withdrawPayments()**: User withdraws their escrow ETH
  - Pull payment pattern (user initiates withdrawal)
  - Prevents failed transfers and reentrancy

### TokenVesting
- **createVesting()**: Owner creates vesting schedule
  - `totalAmount`: tokens to vest
  - `duration`: total time (e.g., 365 days)
  - `cliff`: lock-up period (e.g., 30 days)
  - `revocable`: can owner revoke?
  
- **release()**: Beneficiary unlocks vested tokens
  - Only unlocks if cliff has passed
  - Linear release: tokens unlock proportionally over time
  - Formula: `(totalAmount / duration) * elapsed + fractional_remainder`
  
- **revokeVesting()**: Owner cancels schedule
  - Returns unvested tokens to owner
  - Beneficiary keeps already-released tokens

---

## Getting Started

### Prerequisites
- Node.js >= 20.x
- npm >= 9.x
- MetaMask (for testnet)

### Install

```bash
git clone https://github.com/EnricCoding/Dynamic-Token-Presale.git
cd Dynamic-Token-Presale

# Install all packages
npm install
cd packages/contracts && npm install
cd ../subgraph && npm install
cd ../frontend && npm install
```

### Run Tests

```bash
cd packages/contracts
npm run test                    # All tests
npm run test -- --grep "buy"  # Specific test
npm run coverage              # Coverage report
npm run gas                   # Gas usage report
```

### Deploy to Sepolia

```bash
cd packages/contracts

# Set env vars
cp .env.example .env
# Edit .env: SEPOLIA_RPC and DEPLOYER_PRIVATE_KEY

npm run deploy:sepolia
```

### Subgraph

```bash
cd packages/subgraph
npm run codegen   # Generate types
npm run build     # Build
npm run deploy    # Deploy to The Graph Studio
```

### Frontend

```bash
cd packages/frontend
npm run dev       # Start dev server → http://localhost:3000
```

---

## Security

✅ **Reentrancy Protection** - ReentrancyGuard on all state-modifying functions  
✅ **Access Control** - Role-based permissions via OpenZeppelin  
✅ **Input Validation** - Zero-address checks, amount validation, timestamp checks  
✅ **Safe Arithmetic** - SafeERC20 for transfers  
✅ **Pausable** - Emergency pause on critical functions  
✅ **Pull Payment** - Users withdraw funds, not pushed to them  

---

## Testing

```bash
npm run test          # Run all 117 tests
npm run coverage      # See test coverage
npm run gas          # Check gas usage
```

**Test breakdown:**
- MyToken: 18 tests
- DynamicPresale: 62 tests
- TokenVesting: 37 tests
- Integration: Full end-to-end flow

---

## Project Structure

```
packages/
├── contracts/          # Solidity + Hardhat
│   ├── contracts/      # 3 contracts
│   ├── test/           # 117 tests
│   └── deploy/         # Deployment script
├── subgraph/           # The Graph indexing
│   ├── src/            # Event handlers (TypeScript)
│   └── schema.graphql  # 12 GraphQL entities
└── frontend/           # React/Next.js 15 + Wagmi
    ├── app/
    │   ├── page.tsx           # Home page
    │   ├── presale/
    │   │   └── page.tsx       # Presale dashboard (buy, claim, refund)
    │   ├── layout.tsx         # Root layout
    │   ├── hooks/             # Custom React hooks (usePresaleRead, usePresaleMutations)
    │   ├── providers/         # Wagmi & TanStack providers
    │   └── types/             # TypeScript types
    ├── components/
    │   ├── Header.tsx         # Navigation & wallet connect
    │   └── ui/                # Reusable UI components (Skeleton, Spinner)
    └── public/                # Static assets
```

---

## Tech Stack

- **Smart Contracts**: Solidity ^0.8.20
- **Testing**: Hardhat + Chai + TypeScript
- **Indexing**: The Graph Protocol (Graph TS ^0.38.1)
- **Frontend**: Next.js 15 + React 19 + TypeScript + TailwindCSS 4
- **Web3 Integration**: Wagmi (wallet connection & contract interaction) + Viem
- **Data Fetching**: TanStack Query (React Query) for caching & state management
- **Libraries**: OpenZeppelin, ethers.js v6

---

## Key Achievements

✅ 3 production-grade smart contracts  
✅ 117 comprehensive tests (100% critical paths)  
✅ Multi-phase presale with soft cap logic  
✅ Linear vesting with cliff periods  
✅ Pull payment escrow pattern  
✅ The Graph integration (12 entities, real-time indexing)  
✅ Modern frontend (Next.js 15 + TypeScript)  
✅ Deployed on Sepolia with verified addresses  

---

## Contact

**GitHub**: [@EnricCoding](https://github.com/EnricCoding)  
**Repo**: [Dynamic-Token-Presale](https://github.com/EnricCoding/Dynamic-Token-Presale)

---

