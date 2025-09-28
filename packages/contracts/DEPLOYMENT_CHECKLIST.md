# 📋 Deployment Checklist - Dynamic Presale System

## 🔧 Pre-Deployment Setup

### ✅ Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Set `DEPLOYER_PRIVATE_KEY` (without 0x prefix) 
- [ ] Set `SEPOLIA_RPC` URL (Infura/Alchemy/QuickNode)
- [ ] Set `ETHERSCAN_API_KEY` for verification
- [ ] Test RPC connections work
- [ ] Ensure deployer account has sufficient ETH for gas

### ✅ Code Verification
- [ ] Run `npm run compile` - should complete without errors
- [ ] Run `npm test` - all tests should pass
- [ ] Run `npm run coverage` - verify good test coverage
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Review constructor parameters in deploy script

### ✅ Security Review
- [ ] Verify OpenZeppelin contracts version (v5.4.0)
- [ ] Check access control roles are properly configured
- [ ] Confirm pause mechanisms are working
- [ ] Verify soft cap and limits are correct
- [ ] Test refund mechanism in failed scenario

## 🧪 Testnet Deployment (Sepolia)

### Step 1: Deploy Contracts
```bash
# Deploy to Sepolia
npm run deploy:sepolia
```

### Step 2: Verify Deployment
- [ ] Check deployment transaction in explorer
- [ ] Verify all three contracts deployed successfully
- [ ] Note contract addresses in `.env` file
- [ ] Verify MINTER_ROLE granted to presale contract

### Step 3: Contract Verification
```bash
# Verify contracts on Etherscan
npm run verify:sepolia
```

### Step 4: Configuration Check
```bash
# Check deployment status
npm run status
```

- [ ] Token parameters correct (name, symbol, cap)
- [ ] Presale parameters correct (soft cap, limits)
- [ ] Phases configured with correct prices and times
- [ ] Vesting contract has token allocation

### Step 5: Functional Testing
```bash
# Test buying tokens
npm run buy-tokens 0.1

# Check status after purchase
npm run status
```

- [ ] Buy function works correctly
- [ ] Gas costs reasonable (<200k for buy)
- [ ] Events emitted correctly
- [ ] Balances update properly

### Step 6: Admin Functions Testing
```bash
# Test pause functionality
npm run manage-presale pause
npm run manage-presale unpause

# Test vesting creation
npm run manage-vesting create-team <address> <amount>
```

- [ ] Pause/unpause works
- [ ] End sale function works
- [ ] Vesting creation works
- [ ] Emergency functions work

## 🚀 Mainnet Deployment

### ⚠️ CRITICAL PRE-MAINNET CHECKS
- [ ] **Double-check all parameters** - NO changes possible after deploy
- [ ] **Verify deployer account** has sufficient ETH (estimate ~0.1 ETH)
- [ ] **Test complete flow** on Sepolia multiple times
- [ ] **Security audit** completed if handling significant funds
- [ ] **Team approval** for mainnet deployment
- [ ] **Backup plan** for emergency scenarios

### Step 1: Final Configuration Review
- [ ] Review `deploy/001_deploy_contracts.ts` parameters
- [ ] Confirm phase timing is correct for launch
- [ ] Verify token allocation matches tokenomics
- [ ] Double-check soft cap and limits

### Step 2: Deploy to Mainnet
```bash
# CAREFUL: This deploys to mainnet with real ETH!
npm run deploy:mainnet
```

### Step 3: Immediate Verification
- [ ] Verify deployment transaction successful
- [ ] Check all contract addresses
- [ ] Update `.env` with mainnet addresses
- [ ] Verify on Etherscan immediately

### Step 4: Post-Deployment Setup
```bash
# Verify contracts
npm run verify:mainnet

# Check deployment
npm run status
```

- [ ] All contracts verified on Etherscan
- [ ] Ownership transferred correctly
- [ ] Initial parameters set correctly

## 📊 Post-Deployment Monitoring

### Day 1: Launch Monitoring
- [ ] Monitor first transactions
- [ ] Check gas costs are reasonable
- [ ] Verify events are emitting correctly
- [ ] Monitor for any reverts or issues

### Week 1: Operational Monitoring
- [ ] Track total raised vs soft cap
- [ ] Monitor phase progression
- [ ] Check for any admin actions needed
- [ ] Prepare for phase transitions

### End of Sale: Finalization
- [ ] End sale when appropriate
- [ ] Verify soft cap reached
- [ ] Enable claims or process refunds
- [ ] Create team/advisor vesting schedules
- [ ] Withdraw proceeds to multisig

## 🆘 Emergency Procedures

### If Issues Found
1. **Pause immediately**: `npm run manage-presale pause`
2. **Assess the situation**: Check logs, transactions, balances
3. **Communicate**: Notify team and users if needed
4. **Fix if possible**: Use admin functions to resolve
5. **Resume carefully**: Test fix, then unpause

### If Soft Cap Not Reached
1. **Verify sale ended**: Check end conditions
2. **Enable refunds**: Communicate to users
3. **Process refunds**: Users call `requestRefund()`
4. **Monitor refund process**: Ensure all users can claim

### If Emergency Stop Needed
1. **Pause all contracts**: Presale and token if needed
2. **Stop all operations**: No buys, no claims, no transfers
3. **Assess situation**: Work with team on resolution
4. **Communicate**: Transparent communication with users

## ✅ Success Criteria

### Deployment Success
- [ ] All contracts deployed without errors
- [ ] All contracts verified on Etherscan
- [ ] Initial configuration correct
- [ ] Admin functions accessible

### Operational Success
- [ ] Users can buy tokens successfully
- [ ] Phase transitions work correctly
- [ ] Soft cap tracking accurate
- [ ] Gas costs reasonable

### Final Success
- [ ] Soft cap reached (or refunds processed)
- [ ] Token distribution successful
- [ ] Vesting schedules created
- [ ] Funds withdrawn safely
- [ ] No security incidents

---

## 📞 Contact Information

**Deployment Lead**: [Your Name]
**Technical Contact**: [Technical Lead]
**Emergency Contact**: [24/7 Contact]

**Last Updated**: [Date]
**Checklist Version**: 1.0