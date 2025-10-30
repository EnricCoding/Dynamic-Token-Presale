// packages/frontend/app/hooks/usePresaleWrite.ts
import { useCallback } from "react";
import type { Address, WalletClient } from "viem";
import { useWalletClient } from "wagmi";
import type { TxHash } from "../types/presale.type";
import { DYNAMIC_PRESALE_ADDRESS } from "@/lib/addresses";
import { DynamicPresaleABI } from "@/lib/abi";

/**
 * Narrow WalletClient and throw controlled error if missing.
 */
function requireWalletClient(client: WalletClient | undefined): WalletClient {
  if (!client) {
    throw new Error(
      "usePresaleWrite: wallet client is not available. Connect wallet first."
    );
  }
  return client;
}

/** Minimal address sanity check and cast to viem Address. */
function toAddress(addr: string): Address {
  if (!addr || typeof addr !== "string") {
    throw new Error("usePresaleWrite: invalid address");
  }
  return addr as Address;
}

/**
 * usePresaleWrite
 * - Encapsula las escrituras (tx) al contrato DynamicPresale.
 * - Devuelve TxHash y no espera confirmaciones (deja eso al caller).
 */
export function usePresaleWrite() {
  // useWalletClient returns an object { data, status, ... } — extract the WalletClient (or undefined)
  const { data: maybeWalletClient } = useWalletClient();

  const contractAddress = DYNAMIC_PRESALE_ADDRESS as Address;

  const buy = useCallback(
    async (valueWei: bigint): Promise<TxHash> => {
      const walletClient = requireWalletClient(maybeWalletClient);

      if (valueWei <= BigInt(0)) {
        throw new Error("usePresaleWrite.buy: valueWei must be > 0");
      }

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: DynamicPresaleABI,
        functionName: "buy",
        args: [],
        value: valueWei,
        // satisfy viem ts signatures (use null, not undefined)
        chain: null,
        account: null,
      });

      return txHash as TxHash;
    },
    [maybeWalletClient, contractAddress]
  );

  const claim = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);

    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: DynamicPresaleABI,
      functionName: "claim",
      args: [],
      chain: null,
      account: null,
    });

    return txHash as TxHash;
  }, [maybeWalletClient, contractAddress]);

  const requestRefund = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);

    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: DynamicPresaleABI,
      functionName: "requestRefund",
      args: [],
      chain: null,
      account: null,
    });

    return txHash as TxHash;
  }, [maybeWalletClient, contractAddress]);

  // ---------------- Admin actions ----------------

  const addPhase = useCallback(
    async (
      priceWei: bigint,
      supply: bigint,
      startTs: number | bigint,
      endTs: number | bigint
    ): Promise<TxHash> => {
      const walletClient = requireWalletClient(maybeWalletClient);

      if (priceWei <= BigInt(0)) {
        throw new Error("usePresaleWrite.addPhase: priceWei must be > 0");
      }
      if (supply <= BigInt(0)) {
        throw new Error("usePresaleWrite.addPhase: supply must be > 0");
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

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: DynamicPresaleABI,
        functionName: "addPhase",
        args: [priceWei, supply, start, end],
        chain: null,
        account: null,
      });

      return txHash as TxHash;
    },
    [maybeWalletClient, contractAddress]
  );

  const endSale = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);

    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: DynamicPresaleABI,
      functionName: "endSale",
      args: [],
      chain: null,
      account: null,
    });

    return txHash as TxHash;
  }, [maybeWalletClient, contractAddress]);

  const withdrawProceeds = useCallback(
    async (beneficiary: string): Promise<TxHash> => {
      const walletClient = requireWalletClient(maybeWalletClient);
      const b = toAddress(beneficiary);

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: DynamicPresaleABI,
        functionName: "withdrawProceeds",
        args: [b],
        chain: null,
        account: null,
      });

      return txHash as TxHash;
    },
    [maybeWalletClient, contractAddress]
  );

  const pause = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);

    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: DynamicPresaleABI,
      functionName: "pause",
      args: [],
      chain: null,
      account: null,
    });

    return txHash as TxHash;
  }, [maybeWalletClient, contractAddress]);

  const unpause = useCallback(async (): Promise<TxHash> => {
    const walletClient = requireWalletClient(maybeWalletClient);

    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: DynamicPresaleABI,
      functionName: "unpause",
      args: [],
      chain: null,
      account: null,
    });

    return txHash as TxHash;
  }, [maybeWalletClient, contractAddress]);

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
