// packages/contracts/scripts/showPhases.ts
import "dotenv/config";
import { ethers } from "ethers";

const ABI = [
  "function totalPhases() view returns (uint256)",
  "function getPhase(uint256) view returns (uint256 priceWei, uint256 supply, uint256 sold, uint256 start, uint256 end)",
  "function owner() view returns (address)",
  "function getCurrentPhase() view returns (uint256)",
];

async function main() {
  const RPC = process.env.SEPOLIA_RPC;
  const CONTRACT =
    process.env.CONTRACT_ADDRESS ?? process.env.CONTRACT ?? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!RPC || !CONTRACT) {
    console.error("Missing env: SEPOLIA_RPC or CONTRACT_ADDRESS");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(String(RPC));
  const contract = new ethers.Contract(CONTRACT, ABI, provider);

  try {
    const owner = await contract.owner().catch(() => null);
    console.log("owner:", owner);

    const total = Number(await contract.totalPhases());
    console.log("totalPhases:", total);

    for (let i = 0; i < total; i++) {
      const p = await contract.getPhase(i);
      console.log(`phase ${i}: priceWei=${String(p[0])} supply=${String(p[1])} sold=${String(p[2])} start=${Number(p[3])} end=${Number(p[4])}`);
    }

    const cp = await contract.getCurrentPhase().catch(() => null);
    console.log("getCurrentPhase ->", cp === null ? "null / revert" : String(cp));
  } catch (err: any) {
    console.error("Error reading contract:", err?.message ?? err);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
