// packages/contracts/scripts/activatePhase.ts
import "dotenv/config";
import { ethers } from "ethers";

/**
 * Simple arg parsing (no dependency)
 * Example usage:
 *  ts-node scripts/activatePhase.ts --action update --phaseId 0 --price 0.0005 --supply 1000000 --duration 86400
 */

function parseArgs(): Record<string, string> {
  const argv = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const ABI = [
  "function owner() view returns (address)",
  "function addPhase(uint256 priceWei, uint256 supply, uint256 start, uint256 end) external",
  "function updatePhase(uint256 phaseId, uint256 priceWei, uint256 supply, uint256 start, uint256 end) external",
  "function getPhase(uint256 phaseId) view returns (uint256 priceWei, uint256 supply, uint256 sold, uint256 start, uint256 end)",
  "function getCurrentPhase() view returns (uint256)",
  "function totalPhases() view returns (uint256)",
];

async function main(): Promise<void> {
  const args = parseArgs();
  const RPC = process.env.SEPOLIA_RPC;
  const PK = process.env.DEPLOYER_PRIVATE_KEY;
  const CONTRACT =
    process.env.CONTRACT_ADDRESS ?? process.env.CONTRACT ?? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!RPC || !PK || !CONTRACT) {
    console.error(
      "Missing required env vars. Ensure SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY and CONTRACT (or CONTRACT_ADDRESS) are set."
    );
    process.exit(1);
  }

  // Create provider/wallet early so we can query chain time
  const provider = new ethers.JsonRpcProvider(String(RPC));
  const wallet = new ethers.Wallet(String(PK), provider);
  const contract = new ethers.Contract(CONTRACT, ABI, wallet);

  const action = (args.action ?? args.a ?? "update").toLowerCase(); // 'add' or 'update'
  const phaseId = args.phaseId ? Number(args.phaseId) : 0;
  const duration = args.duration ? Number(args.duration) : 86400; // default 1 day
  const priceArg = args.price ?? "0.0005"; // ETH by default
  const supplyArg = args.supply ?? "1000000"; // tokens (human units)
  const startArg = args.start ?? "now";
  const force = args.force === "true" || args.force === "1" || args.force === "yes";

  // price: allow decimal ETH or raw wei
  let priceWei: bigint;
  try {
    // if contains '.' treat as ETH decimal
    if (String(priceArg).includes(".")) {
      priceWei = ethers.parseUnits(String(priceArg), 18);
    } else {
      const asNum = Number(priceArg);
      if (!Number.isNaN(asNum) && asNum > 0 && asNum < 1e6) {
        priceWei = ethers.parseUnits(String(priceArg), 18);
      } else {
        priceWei = BigInt(String(priceArg));
      }
    }
  } catch (e) {
    console.error("Invalid price argument:", priceArg);
    process.exit(1);
  }

  // supply: treat as token human amount and convert to 18 decimals
  let supplyUnits: bigint;
  try {
    supplyUnits = ethers.parseUnits(String(supplyArg), 18);
  } catch (e) {
    console.error("Invalid supply argument:", supplyArg);
    process.exit(1);
  }

  // Compute start/end using the chain's latest block timestamp to avoid clock drift.
  // If startArg === "now" we'll set start = latestBlock.timestamp + 60 (1 minute buffer)
  // so the contract sees the start as strictly in the future.
  let startTs: number;
  try {
    const latestBlock = await provider.getBlock("latest");
    // latestBlock may be null in some rare provider failures; fallback to local clock if so.
    const nowOnChain = Number(latestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
    if (startArg === "now") {
      startTs = nowOnChain + 60; // start 60s in the future (safe buffer)
    } else {
      // If user provided explicit start, trust it (but ensure number)
      startTs = Math.floor(Number(startArg));
      if (!Number.isFinite(startTs) || startTs <= 0) {
        console.warn("Provided --start value is not a valid epoch. Falling back to on-chain now + 60s.");
        startTs = nowOnChain + 60;
      }
    }
  } catch (err) {
    // Fallback to local Date.now() if provider call fails, but still add buffer
    console.warn("Warning: failed to read latest block timestamp, falling back to local clock.", err);
    const nowLocal = Math.floor(Date.now() / 1000);
    startTs = startArg === "now" ? nowLocal + 60 : Math.floor(Number(startArg));
  }

  const endTs = startTs + duration;

  console.log("CONFIG", {
    rpc: RPC,
    contract: CONTRACT,
    action,
    phaseId,
    priceWei: priceWei.toString(),
    supplyUnits: supplyUnits.toString(),
    startTs,
    endTs,
    force,
  });

  // sanity: owner check
  try {
    const owner: string = await contract.owner();
    console.log("Contract owner:", owner);
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.warn("WARNING: deployer key is NOT the contract owner. The tx will likely revert if owner-only.");
    } else {
      console.log("Deployer key matches contract owner — OK to proceed.");
    }
  } catch (err) {
    console.warn("Could not read owner() — continuing. Error:", (err as Error).message ?? err);
  }

  // Before sending tx, some safety checks: read existing phases to avoid accidental overlap (best-effort)
  try {
    const totalPhasesRaw: unknown = await contract.totalPhases();
    const totalPhases =
      typeof totalPhasesRaw === "bigint" ? Number(totalPhasesRaw) : Number(totalPhasesRaw ?? 0);
    console.log("totalPhases:", totalPhases);

    if (action === "add") {
      if (totalPhases > 0) {
        // read last phase end
        try {
          const lastIdx = totalPhases - 1;
          const last = await contract.getPhase(lastIdx);
          const lastEnd = Number(last[4]);
          console.log("lastPhase.end:", lastEnd);
        } catch (err) {
          console.warn("Could not read last phase — continuing.", (err as Error).message ?? err);
        }
      }
    } else {
      // update: show existing phase info
      try {
        const existing = await contract.getPhase(phaseId);
        console.log(
          "existing getPhase(%d): price:%s supply:%s sold:%s start:%s end:%s",
          phaseId,
          String(existing[0]),
          String(existing[1]),
          String(existing[2]),
          String(existing[3]),
          String(existing[4])
        );
      } catch (err) {
        console.warn(`Could not read existing phase ${phaseId}:`, (err as Error).message ?? err);
      }
    }
  } catch (err) {
    console.warn("Warning: could not run pre-checks:", (err as Error).message ?? err);
  }

  // send tx
  try {
    const sent = action === "add"
      ? await contract.addPhase(priceWei, supplyUnits, BigInt(startTs), BigInt(endTs))
      : await contract.updatePhase(phaseId, priceWei, supplyUnits, BigInt(startTs), BigInt(endTs));

    // sent.hash is the canonical property in ethers v6
    console.log("Tx submitted:", sent.hash ?? sent);

    const receipt = await sent.wait(1);
    if (!receipt) {
      console.error("Tx mined but no receipt returned (unexpected).");
      process.exit(1);
    }
    console.log("Tx mined. status:", receipt.status);
  } catch (err: any) {
    // Most common cause: revert with message (we surface it)
    console.error("Failed:", err?.message ?? err);
    console.error(
      "If the contract reverted check the revert reason above. You can try adding --force to ignore overlap checks, or adjust --start to be a timestamp slightly in the future."
    );
    process.exit(1);
  }

  // post-check: current phase (may revert if none active)
  try {
    const cp = await contract.getCurrentPhase().catch(() => null);
    console.log("getCurrentPhase ->", cp === null ? "null / revert" : String(cp));
  } catch (err) {
    console.warn("getCurrentPhase failed:", (err as Error).message ?? err);
  }

  // read phase 0 or phaseId
  const checkId = action === "add" ? 0 : phaseId;
  try {
    const p = await contract.getPhase(checkId);
    // p is tuple [priceWei, supply, sold, start, end]
    console.log(
      `getPhase(${checkId}) -> priceWei:${String(p[0])}, supply:${String(p[1])}, sold:${String(p[2])}, start:${Number(
        p[3]
      )}, end:${Number(p[4])}`
    );
  } catch (err) {
    console.warn(`getPhase(${checkId}) failed:`, (err as Error).message ?? err);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Unhandled error", err);
  process.exit(1);
});
