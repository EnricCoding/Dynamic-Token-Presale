# Subgraph Deployment Guide

## 🎯 Prerequisites

1. **Deploy Smart Contracts First**
   ```bash
   cd ../contracts
   npm run deploy:sepolia
   ```
   Note down the contract addresses and deployment block numbers.

2. **Install Dependencies**
   ```bash
   cd ../subgraph
   npm install
   ```

## 📝 Configuration Steps

### Step 1: Update Contract Addresses

Edit `subgraph.yaml` and replace these values:

```yaml
dataSources:
  - kind: ethereum
    name: DynamicPresale
    source:
      address: "YOUR_DYNAMIC_PRESALE_ADDRESS"  # <-- Update this
      startBlock: YOUR_START_BLOCK             # <-- Update this
```

Repeat for `TokenVesting` and `MyToken` sections.

### Step 2: Generate TypeScript Types

```bash
npm run codegen
```

This generates TypeScript types from your contracts' ABIs and GraphQL schema.

### Step 3: Build the Subgraph

```bash
npm run build
```

This compiles the AssemblyScript code to WebAssembly.

## 🚀 Deployment Options

### Option A: Deploy to The Graph Studio (Recommended)

1. **Create Subgraph in Studio**
   - Go to [thegraph.com/studio](https://thegraph.com/studio/)
   - Click "Create a Subgraph"
   - Name it: `dynamic-presale-subgraph`
   - Select network: `Sepolia`

2. **Get Deploy Key**
   - Copy your deploy key from the studio dashboard

3. **Authenticate**
   ```bash
   graph auth --studio <YOUR_DEPLOY_KEY>
   ```

4. **Update package.json**
   Edit the deploy script:
   ```json
   "deploy": "graph deploy --studio dynamic-presale-subgraph"
   ```

5. **Deploy**
   ```bash
   npm run deploy
   ```

6. **Publish (when ready)**
   - Go to studio dashboard
   - Click "Publish" to move to mainnet/production

### Option B: Deploy to Hosted Service (Legacy)

1. **Create Subgraph**
   ```bash
   graph create <GITHUB_USERNAME>/dynamic-presale --node https://api.thegraph.com/deploy/
   ```

2. **Deploy**
   ```bash
   graph deploy <GITHUB_USERNAME>/dynamic-presale \
     --ipfs https://api.thegraph.com/ipfs/ \
     --node https://api.thegraph.com/deploy/
   ```

### Option C: Local Graph Node (Development)

1. **Start Local Graph Node**
   ```bash
   # Clone graph-node repo if you haven't
   git clone https://github.com/graphprotocol/graph-node
   cd graph-node/docker
   docker-compose up
   ```

2. **Create Local Subgraph**
   ```bash
   npm run create-local
   ```

3. **Deploy Locally**
   ```bash
   npm run deploy-local
   ```

4. **Access GraphQL Playground**
   - Open: http://localhost:8000/subgraphs/name/dynamic-presale-subgraph

## ✅ Verification Steps

### 1. Check Subgraph Status

After deployment, check sync status:

**Studio/Hosted:**
- Check dashboard for sync progress
- Wait for "Synced" status

**Local:**
```bash
curl http://localhost:8030/graphql -X POST \
  -d '{"query": "{indexingStatusForCurrentVersion(subgraphName: \"dynamic-presale-subgraph\") { synced health fatalError { message } }}"}'
```

### 2. Test Basic Query

**Studio/Hosted:**
Use the playground in your dashboard

**Local:**
```bash
curl http://localhost:8000/subgraphs/name/dynamic-presale-subgraph/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ presaleStats(id: \"1\") { totalRaised totalTokensSold } }"}'
```

### 3. Verify Data

Test with a sample purchase transaction:

```graphql
{
  purchases(first: 1, orderBy: timestamp, orderDirection: desc) {
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

## 🐛 Troubleshooting

### Issue: "No contract address found"
**Solution:** Make sure you updated contract addresses in `subgraph.yaml`

### Issue: "Failed to index block"
**Solution:** 
- Check if `startBlock` is correct
- Verify contract addresses are correct
- Check if contracts are verified on Etherscan

### Issue: "AssemblyScript compilation error"
**Solution:**
- Run `npm run codegen` again
- Check for TypeScript errors in handlers
- Ensure ABIs are up to date

### Issue: "Subgraph not syncing"
**Solution:**
- Check RPC endpoint is working
- Verify network name matches deployment network
- Check logs for specific errors

## 📊 Monitoring

### Check Indexing Progress

```graphql
{
  _meta {
    block {
      number
      hash
      timestamp
    }
    deployment
    hasIndexingErrors
  }
}
```

### Check for Errors

```graphql
{
  _meta {
    hasIndexingErrors
  }
}
```

## 🔄 Updates and Redeployment

When you need to update the subgraph:

1. **Make Changes** to handlers or schema
2. **Increment Version** in `package.json`
3. **Regenerate Types**
   ```bash
   npm run codegen
   ```
4. **Rebuild**
   ```bash
   npm run build
   ```
5. **Deploy Again**
   ```bash
   npm run deploy
   ```

**Note:** Schema changes may require creating a new subgraph version.

## 📚 Next Steps

After successful deployment:

1. **Test Queries** - Use example queries from `queries.md`
2. **Integrate with Frontend** - Use Apollo Client or similar
3. **Monitor Performance** - Check query response times
4. **Optimize Queries** - Add indexes if needed

## 🔗 Useful Resources

- [The Graph Documentation](https://thegraph.com/docs/)
- [Studio Dashboard](https://thegraph.com/studio/)
- [AssemblyScript Book](https://www.assemblyscript.org/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
