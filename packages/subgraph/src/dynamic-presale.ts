import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Purchased,
  Claimed,
  RefundRequested,
  PhaseAdded,
  SoftCapReached,
  SaleEnded,
  Withdrawn,
  PaymentsWithdrawn,
  PaymentQueued as PaymentQueuedEvent
} from "../generated/DynamicPresale/DynamicPresale";
import {
  User,
  PresaleStats,
  Phase,
  Purchase,
  Claim,
  Refund,
  Withdrawal,
  PaymentWithdrawal,
  PaymentQueued as PaymentQueuedEntity
} from "../generated/schema";

function getOrCreateUser(address: Bytes, timestamp: BigInt): User {
  let id = address.toHexString();
  let user = User.load(id);
  if (user == null) {
    user = new User(id);
    user.totalContributed = BigInt.fromI32(0);
    user.totalTokensPurchased = BigInt.fromI32(0);
    user.totalTokensClaimed = BigInt.fromI32(0);
    user.totalRefunded = BigInt.fromI32(0);
    user.totalVested = BigInt.fromI32(0);
    user.totalReleased = BigInt.fromI32(0);
    user.tokenBalance = BigInt.fromI32(0);
    user.pendingPayments = BigInt.fromI32(0);
    user.firstInteractionTimestamp = timestamp;
    user.lastInteractionTimestamp = timestamp;
    user.save();
  }
  return user;
}

function getOrCreatePresaleStats(): PresaleStats {
  let stats = PresaleStats.load("1");
  if (stats == null) {
    stats = new PresaleStats("1");
    stats.totalRaised = BigInt.fromI32(0);
    stats.totalTokensSold = BigInt.fromI32(0);
    stats.totalBuyers = BigInt.fromI32(0);
    stats.softCap = BigInt.fromI32(0);
    stats.minBuy = BigInt.fromI32(0);
    stats.maxPerWallet = BigInt.fromI32(0);
    stats.softCapReached = false;
    stats.saleEnded = false;
    stats.totalPhases = BigInt.fromI32(0);
    stats.totalPurchases = BigInt.fromI32(0);
    stats.totalClaims = BigInt.fromI32(0);
    stats.totalRefunds = BigInt.fromI32(0);
    stats.totalEscrow = BigInt.fromI32(0);
    stats.lastUpdatedTimestamp = BigInt.fromI32(0);
    stats.save();
  }
  return stats;
}

export function handlePurchased(event: Purchased): void {
  let user = getOrCreateUser(event.params.buyer, event.block.timestamp);
  let stats = getOrCreatePresaleStats();
  
  user.totalContributed = user.totalContributed.plus(event.params.ethAmount);
  user.totalTokensPurchased = user.totalTokensPurchased.plus(event.params.tokensAmount);
  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();
  
  let purchaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let purchase = new Purchase(purchaseId);
  purchase.buyer = user.id;
  purchase.phase = event.params.phaseId.toString();
  purchase.ethAmount = event.params.ethAmount;
  purchase.tokensAmount = event.params.tokensAmount;
  purchase.timestamp = event.block.timestamp;
  purchase.blockNumber = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  purchase.save();
  
  let phase = Phase.load(event.params.phaseId.toString());
  if (phase != null) {
    phase.sold = phase.sold.plus(event.params.tokensAmount);
    phase.remaining = phase.supply.minus(phase.sold);
    if (phase.sold >= phase.supply) {
      phase.isCompleted = true;
      phase.isActive = false;
    }
    phase.save();
  }
  
  stats.totalRaised = stats.totalRaised.plus(event.params.ethAmount);
  stats.totalTokensSold = stats.totalTokensSold.plus(event.params.tokensAmount);
  stats.totalPurchases = stats.totalPurchases.plus(BigInt.fromI32(1));
  
  if (user.totalContributed == event.params.ethAmount) {
    stats.totalBuyers = stats.totalBuyers.plus(BigInt.fromI32(1));
  }
  
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

export function handleClaimed(event: Claimed): void {
  let user = getOrCreateUser(event.params.buyer, event.block.timestamp);
  let stats = getOrCreatePresaleStats();
  
  user.totalTokensClaimed = user.totalTokensClaimed.plus(event.params.tokensAmount);
  user.tokenBalance = user.tokenBalance.plus(event.params.tokensAmount);
  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();
  
  let claimId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let claim = new Claim(claimId);
  claim.buyer = user.id;
  claim.tokensAmount = event.params.tokensAmount;
  claim.timestamp = event.block.timestamp;
  claim.blockNumber = event.block.number;
  claim.transactionHash = event.transaction.hash;
  claim.save();
  
  stats.totalClaims = stats.totalClaims.plus(BigInt.fromI32(1));
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

export function handleRefundRequested(event: RefundRequested): void {
  let user = getOrCreateUser(event.params.buyer, event.block.timestamp);
  let stats = getOrCreatePresaleStats();

  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();
  
  let refundId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let refund = new Refund(refundId);
  refund.buyer = user.id;
  refund.ethAmount = event.params.ethAmount;
  refund.timestamp = event.block.timestamp;
  refund.blockNumber = event.block.number;
  refund.transactionHash = event.transaction.hash;
  refund.save();
  
  stats.totalRefunds = stats.totalRefunds.plus(BigInt.fromI32(1));
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

export function handlePaymentQueued(event: PaymentQueuedEvent): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let pq = new PaymentQueuedEntity(id);

  pq.payee = event.params.dest.toHexString();
  pq.amount = event.params.amount;
  pq.reason = "queued";
  pq.timestamp = event.block.timestamp;
  pq.blockNumber = event.block.number;
  pq.transactionHash = event.transaction.hash;
  pq.save();

  let user = getOrCreateUser(event.params.dest, event.block.timestamp);
  user.pendingPayments = user.pendingPayments.plus(event.params.amount);
  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();

  let stats = getOrCreatePresaleStats();
  stats.totalEscrow = stats.totalEscrow.plus(event.params.amount);
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

export function handlePhaseAdded(event: PhaseAdded): void {
  let stats = getOrCreatePresaleStats();
  
  let phase = new Phase(event.params.phaseId.toString());
  phase.phaseId = event.params.phaseId;
  phase.priceWei = event.params.priceWei;
  phase.supply = event.params.supply;
  phase.sold = BigInt.fromI32(0);
  phase.remaining = event.params.supply;
  phase.startTime = event.params.start;
  phase.endTime = event.params.end;
  phase.isActive = false; 
  phase.isCompleted = false;
  phase.createdAtTimestamp = event.block.timestamp;
  phase.createdAtBlockNumber = event.block.number;
  phase.save();
  
  stats.totalPhases = stats.totalPhases.plus(BigInt.fromI32(1));
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

export function handleSoftCapReached(event: SoftCapReached): void {
  let stats = getOrCreatePresaleStats();
  stats.softCapReached = true;
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

export function handleSaleEnded(event: SaleEnded): void {
  let stats = getOrCreatePresaleStats();
  stats.saleEnded = true;
  stats.saleEndedTimestamp = event.block.timestamp;
  stats.softCapReached = event.params.softCapReached;
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  let withdrawalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdrawal = new Withdrawal(withdrawalId);
  withdrawal.beneficiary = event.params.beneficiary;
  withdrawal.amount = event.params.amount;
  withdrawal.timestamp = event.block.timestamp;
  withdrawal.blockNumber = event.block.number;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.save();
}

export function handlePaymentsWithdrawn(event: PaymentsWithdrawn): void {
  let user = getOrCreateUser(event.params.payee, event.block.timestamp);
  
  let paymentWithdrawalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let paymentWithdrawal = new PaymentWithdrawal(paymentWithdrawalId);
  paymentWithdrawal.payee = user.id;
  paymentWithdrawal.amount = event.params.amount;
  paymentWithdrawal.timestamp = event.block.timestamp;
  paymentWithdrawal.blockNumber = event.block.number;
  paymentWithdrawal.transactionHash = event.transaction.hash;
  paymentWithdrawal.save();
  
  if (user.pendingPayments.ge(event.params.amount)) {
    user.pendingPayments = user.pendingPayments.minus(event.params.amount);
  } else {
    user.pendingPayments = BigInt.fromI32(0);
  }

  user.totalRefunded = user.totalRefunded.plus(event.params.amount);

  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();

  let stats = getOrCreatePresaleStats();
  if (stats.totalEscrow.ge(event.params.amount)) {
    stats.totalEscrow = stats.totalEscrow.minus(event.params.amount);
  } else {
    stats.totalEscrow = BigInt.fromI32(0);
  }
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}
