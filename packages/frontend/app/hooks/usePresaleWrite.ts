import { useCallback, useMemo } from "react";
import type { Address, WalletClient, Account } from "viem";
import { parseAbi } from "viem";
import type { Abi } from "abitype";
import { useWalletClient } from "wagmi";
import type { TxHash } from "../types/presale.type";
import { DYNAMIC_PRESALE_ADDRESS } from "@/lib/addresses";
import { DynamicPresaleABI } from "@/lib/abi";

function safeErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return "unknown error";
  }
}

function resolveAbi(raw: unknown): Abi {
  try {
    if (Array.isArray(raw)) {
      if (raw.length > 0 && typeof raw[0] === "string") {
        return parseAbi(raw as string[]);
      }
      return raw as unknown as Abi;
    }

    if (raw && typeof raw === "object") {
      const obj = raw as { abi?: unknown };
      if (Array.isArray(obj.abi)) {
        const inner = obj.abi as unknown[];
        if (inner.length > 0 && typeof inner[0] === "string") {
          return parseAbi(inner as string[]);
        }
        return inner as unknown as Abi;
      }
    }
  } catch (err) {
  }
  return [] as unknown as Abi;
}

function requireWalletClient(client: WalletClient | undefined): WalletClient {
  if (!client) {
    throw new Error(
      "usePresaleWrite: wallet client is not available. Connect wallet first."
    );
  }
  return client;
}

function toAddress(addr: string): Address {
  if (!addr || typeof addr !== "string") {
    throw new Error("usePresaleWrite: invalid address");
  }
  return addr as Address;
}

function walletAccountOrNull(
  walletClient: WalletClient
): Account | `0x${string}` | null {
  const maybe = (
    walletClient as WalletClient & {
      account?: Account | `0x${string}` | undefined;
    }
  ).account;
  return (maybe ?? null) as Account | `0x${string}` | null;
}

const GAS_LIMITS = {
  buy: BigInt(150_000),
  claim: BigInt(200_000),
  requestRefund: BigInt(300_000),
  addPhase: BigInt(600_000),
  endSale: BigInt(200_000),
  withdrawProceeds: BigInt(200_000),
  pause: BigInt(100_000),
  unpause: BigInt(100_000),
};


export function usePresaleWrite() {
  const { data: maybeWalletClient } = useWalletClient();
  const contractAddress = DYNAMIC_PRESALE_ADDRESS as Address;

  const abi = useMemo<Abi>(() => {
    const resolved = resolveAbi(DynamicPresaleABI);
    return resolved;
  }, []);

  const buy = useCallback(
    async (valueWei: bigint): Promise<TxHash> => {
      const walletClient = requireWalletClient(maybeWalletClient);

      if (typeof valueWei !== "bigint") {
        throw new Error("usePresaleWrite.buy: valueWei must be a bigint");
      }
      if (valueWei <= BigInt(0)) {
        throw new Error("usePresaleWrite.buy: valueWei must be > 0");
      }

      try {
        const account = walletAccountOrNull(walletClient);
        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "buy",
          args: [],
          value: valueWei,
          chain: undefined,
          account,
          gas: GAS_LIMITS.buy,
        });

        return txHash as unknown as TxHash;
      } catch (err: unknown) {
        const msg = safeErrorMessage(err);
        throw new Error(`buy failed: ${msg}`);
      }
    },
    [maybeWalletClient, contractAddress, abi]
  );

  const claim = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);
    try {
      const account = walletAccountOrNull(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi,
        functionName: "claim",
        args: [],
        chain: undefined,
        account,
        gas: GAS_LIMITS.claim,
      });
      return txHash as unknown as TxHash;
    } catch (err: unknown) {
      const msg = safeErrorMessage(err);
      throw new Error(`claim failed: ${msg}`);
    }
  }, [maybeWalletClient, contractAddress, abi]);

  /* ---------- REQUEST REFUND ---------- */
  const requestRefund = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);
    try {
      const account = walletAccountOrNull(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi,
        functionName: "requestRefund",
        args: [],
        chain: undefined,
        account,
        gas: GAS_LIMITS.requestRefund,
      });
      return txHash as unknown as TxHash;
    } catch (err: unknown) {
      const msg = safeErrorMessage(err);
      throw new Error(`requestRefund failed: ${msg}`);
    }
  }, [maybeWalletClient, contractAddress, abi]);

  /* ---------------- Admin actions ---------------- */

  const addPhase = useCallback(
    async (
      priceWei: bigint,
      supply: bigint,
      startTs: number | bigint,
      endTs: number | bigint
    ): Promise<TxHash> => {
      const walletClient = requireWalletClient(maybeWalletClient);

      if (typeof priceWei !== "bigint" || priceWei <= BigInt(0)) {
        throw new Error(
          "usePresaleWrite.addPhase: priceWei must be a bigint > 0"
        );
      }
      if (typeof supply !== "bigint" || supply <= BigInt(0)) {
        throw new Error(
          "usePresaleWrite.addPhase: supply must be a bigint > 0"
        );
      }

      const start =
        typeof startTs === "number"
          ? BigInt(Math.floor(startTs))
          : BigInt(startTs);
      const end =
        typeof endTs === "number" ? BigInt(Math.floor(endTs)) : BigInt(endTs);

      if (start >= end) {
        throw new Error("usePresaleWrite.addPhase: start must be < end");
      }

      try {
        const account = walletAccountOrNull(walletClient);
        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "addPhase",
          args: [priceWei, supply, start, end],
          chain: undefined,
          account,
          gas: GAS_LIMITS.addPhase,
        });
        return txHash as unknown as TxHash;
      } catch (err: unknown) {
        const msg = safeErrorMessage(err);
        throw new Error(`addPhase failed: ${msg}`);
      }
    },
    [maybeWalletClient, contractAddress, abi]
  );

  const endSale = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);
    try {
      const account = walletAccountOrNull(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi,
        functionName: "endSale",
        args: [],
        chain: undefined,
        account,
        gas: GAS_LIMITS.endSale,
      });
      return txHash as unknown as TxHash;
    } catch (err: unknown) {
      const msg = safeErrorMessage(err);
      throw new Error(`endSale failed: ${msg}`);
    }
  }, [maybeWalletClient, contractAddress, abi]);

  const withdrawProceeds = useCallback(
    async (beneficiary: string): Promise<TxHash> => {
      const walletClient = requireWalletClient(maybeWalletClient);
      const b = toAddress(beneficiary);
      try {
        const account = walletAccountOrNull(walletClient);
        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "withdrawProceeds",
          args: [b],
          chain: undefined,
          account,
          gas: GAS_LIMITS.withdrawProceeds,
        });
        return txHash as unknown as TxHash;
      } catch (err: unknown) {
        const msg = safeErrorMessage(err);
        throw new Error(`withdrawProceeds failed: ${msg}`);
      }
    },
    [maybeWalletClient, contractAddress, abi]
  );

  const pause = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);
    try {
      const account = walletAccountOrNull(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi,
        functionName: "pause",
        args: [],
        chain: undefined,
        account,
        gas: GAS_LIMITS.pause,
      });
      return txHash as unknown as TxHash;
    } catch (err: unknown) {
      const msg = safeErrorMessage(err);
      throw new Error(`pause failed: ${msg}`);
    }
  }, [maybeWalletClient, contractAddress, abi]);

  const unpause = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);
    try {
      const account = walletAccountOrNull(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi,
        functionName: "unpause",
        args: [],
        chain: undefined,
        account,
        gas: GAS_LIMITS.unpause,
      });
      return txHash as unknown as TxHash;
    } catch (err: unknown) {
      const msg = safeErrorMessage(err);
      throw new Error(`unpause failed: ${msg}`);
    }
  }, [maybeWalletClient, contractAddress, abi]);

  return {
    buy,
    claim,
    requestRefund,
    addPhase,
    endSale,
    withdrawProceeds,
    pause,
    unpause,
  } as const;
}
