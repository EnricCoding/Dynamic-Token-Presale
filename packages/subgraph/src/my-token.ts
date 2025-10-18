import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/MyToken/MyToken";
import { User, TokenTransfer } from "../generated/schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Helper: Get or create User
function getOrCreateUser(address: Bytes, timestamp: BigInt): User {
  let user = User.load(address.toHexString());
  if (user == null) {
    user = new User(address.toHexString());
    user.totalContributed = BigInt.fromI32(0);
    user.totalTokensPurchased = BigInt.fromI32(0);
    user.totalTokensClaimed = BigInt.fromI32(0);
    user.totalRefunded = BigInt.fromI32(0);
    user.totalVested = BigInt.fromI32(0);
    user.totalReleased = BigInt.fromI32(0);
    user.tokenBalance = BigInt.fromI32(0);
    // NEW: pendingPayments must be initialized for subgraph consistency
    user.pendingPayments = BigInt.fromI32(0);
    user.firstInteractionTimestamp = timestamp;
    user.lastInteractionTimestamp = timestamp;
    user.save();
  }
  return user;
}

// Handler: Transfer
export function handleTransfer(event: Transfer): void {
  let fromAddress = event.params.from.toHexString();
  let toAddress = event.params.to.toHexString();

  // Skip if mint (from zero address) - already tracked in claim/release
  if (fromAddress == ZERO_ADDRESS) {
    return;
  }

  // Skip if burn (to zero address) - not tracking burns for now
  if (toAddress == ZERO_ADDRESS) {
    return;
  }

  // Get or create users
  let fromUser = getOrCreateUser(event.params.from, event.block.timestamp);
  let toUser = getOrCreateUser(event.params.to, event.block.timestamp);

  // Update balances
  fromUser.tokenBalance = fromUser.tokenBalance.minus(event.params.value);
  fromUser.lastInteractionTimestamp = event.block.timestamp;
  fromUser.save();

  toUser.tokenBalance = toUser.tokenBalance.plus(event.params.value);
  toUser.lastInteractionTimestamp = event.block.timestamp;
  toUser.save();

  // Create TokenTransfer entity
  let transferId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let transfer = new TokenTransfer(transferId);
  transfer.from = fromUser.id;
  transfer.to = toUser.id;
  transfer.amount = event.params.value;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();
}
