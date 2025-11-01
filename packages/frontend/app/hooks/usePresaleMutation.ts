import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";

import { usePresaleWrite } from "./usePresaleWrite";
import { PRESALE_KEYS } from "./usePresaleQueries";
import type { TxHash } from "../types/presale.type";

const DEFAULT_WAIT_TIMEOUT_MS = 60_000;

async function waitForConfirmationIfPossible(
  publicClient: PublicClient | undefined,
  txHash: TxHash,
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS
): Promise<void> {
  if (!publicClient) return;
  await publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    timeout: timeoutMs,
  });
}

function normalizeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return "Unknown error";
  }
}

export function usePresaleMutations() {
  const qc = useQueryClient();
  const publicClient = usePublicClient() as PublicClient | undefined;

  const {
    buy: writeBuy,
    claim: writeClaim,
    requestRefund: writeRequestRefund,
    addPhase: writeAddPhase,
    endSale: writeEndSale,
    withdrawProceeds: writeWithdrawProceeds,
    pause: writePause,
    unpause: writeUnpause,
  } = usePresaleWrite();

  const invalidateAfterTx = useCallback(
    async (tx: TxHash) => {
      try {
        await waitForConfirmationIfPossible(publicClient, tx);
      } catch (err) {
        console.warn(
          "waitForConfirmationIfPossible failed or timed out:",
          normalizeError(err)
        );
      }

      try {
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.totalRaised() });
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.totalTokensSold() });
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.remainingTokens() });
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.totalPhases() });

        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
      } catch (err) {
        console.error(
          "invalidateAfterTx: failed to invalidate queries",
          normalizeError(err)
        );
      }
    },
    [qc, publicClient]
  );

  const buyMutation = useMutation<TxHash, unknown, bigint>({
    mutationFn: async (valueWei: bigint) => {
      try {
        const tx = await writeBuy(valueWei);
        return tx;
      } catch (e) {
        throw new Error(`buy failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: (_data, _err) => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const claimMutation = useMutation<TxHash, unknown, void>({
    mutationFn: async () => {
      try {
        const tx = await writeClaim();
        return tx;
      } catch (e) {
        throw new Error(`claim failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const requestRefundMutation = useMutation<TxHash, unknown, void>({
    mutationFn: async () => {
      try {
        const tx = await writeRequestRefund();
        return tx;
      } catch (e) {
        throw new Error(`requestRefund failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const addPhaseMutation = useMutation<
    TxHash,
    unknown,
    {
      priceWei: bigint;
      supply: bigint;
      startTs: number | bigint;
      endTs: number | bigint;
    }
  >({
    mutationFn: async ({ priceWei, supply, startTs, endTs }) => {
      try {
        const tx = await writeAddPhase(priceWei, supply, startTs, endTs);
        return tx;
      } catch (e) {
        throw new Error(`addPhase failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.phasesList() });
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const endSaleMutation = useMutation<TxHash, unknown, void>({
    mutationFn: async () => {
      try {
        const tx = await writeEndSale();
        return tx;
      } catch (e) {
        throw new Error(`endSale failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const withdrawProceedsMutation = useMutation<TxHash, unknown, string>({
    mutationFn: async (beneficiary) => {
      try {
        const tx = await writeWithdrawProceeds(beneficiary);
        return tx;
      } catch (e) {
        throw new Error(`withdrawProceeds failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const pauseMutation = useMutation<TxHash, unknown, void>({
    mutationFn: async () => {
      try {
        const tx = await writePause();
        return tx;
      } catch (e) {
        throw new Error(`pause failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const unpauseMutation = useMutation<TxHash, unknown, void>({
    mutationFn: async () => {
      try {
        const tx = await writeUnpause();
        return tx;
      } catch (e) {
        throw new Error(`unpause failed: ${normalizeError(e)}`);
      }
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  return {
    buyMutation,
    claimMutation,
    requestRefundMutation,
    addPhaseMutation,
    endSaleMutation,
    withdrawProceedsMutation,
    pauseMutation,
    unpauseMutation,
  } as const;
}
