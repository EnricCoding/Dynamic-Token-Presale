// packages/frontend/app/hooks/usePresaleMutation.ts
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";

import { usePresaleWrite } from "./usePresaleWrite";
import { PRESALE_KEYS } from "./usePresaleQueries";
import type { TxHash } from "../types/presale.type";

const DEFAULT_WAIT_TIMEOUT_MS = 60_000;

/**
 * Helper: if a publicClient is present, wait for the transaction receipt (with timeout).
 * If publicClient is not available, returns immediately (we don't block).
 *
 * Any errors are thrown to the caller so they can be handled/logged there; callers
 * may choose to swallow errors (we do inside invalidateAfterTx).
 */
async function waitForConfirmationIfPossible(
  publicClient: PublicClient | undefined,
  txHash: TxHash,
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS
): Promise<void> {
  if (!publicClient) return;
  try {
    // viem PublicClient.waitForTransactionReceipt expects hash: `0x${string}`
    await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: timeoutMs,
    });
  } catch (e) {
    // rethrow to let caller decide what to do; upper layer may log and continue
    throw e;
  }
}

/**
 * usePresaleMutations
 *
 * Provides mutations that:
 * - call write helpers to send txs
 * - wait for confirmation if possible
 * - invalidate queries (with defensive error handling)
 */
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

  /* -----------------
     Helpers: invalidaciones comunes
     -----------------*/
  const invalidateAfterTx = useCallback(
    async (tx: TxHash) => {
      try {
        // try to wait for confirmation if possible; if this fails we still continue
        await waitForConfirmationIfPossible(publicClient, tx);
      } catch (err) {
        // don't fail hard just because waiting for receipt failed — log and continue
        // eslint-disable-next-line no-console
        console.warn("waitForConfirmationIfPossible failed or timed out:", err);
      }

      try {
        // Invalidate targeted keys
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.totalRaised() });
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.totalTokensSold() });
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.remainingTokens() });
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.totalPhases() });

        // also do a light invalidation of the global presale namespace to be safe
        void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
      } catch (err) {
        // Log but don't throw
        // eslint-disable-next-line no-console
        console.error("invalidateAfterTx: failed to invalidate queries", err);
      }
    },
    [qc, publicClient]
  );

  /* -----------------
     Buyer mutations
     -----------------*/

  const buyMutation = useMutation<TxHash, Error, bigint>({
    mutationFn: async (valueWei: bigint) => {
      const tx = await writeBuy(valueWei);
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: (_data, _err) => {
      // ensure UI is refreshed even if we couldn't wait for receipt or onSuccess failed
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const claimMutation = useMutation<TxHash, Error, void>({
    mutationFn: async () => {
      const tx = await writeClaim();
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const requestRefundMutation = useMutation<TxHash, Error, void>({
    mutationFn: async () => {
      const tx = await writeRequestRefund();
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  /* -----------------
     Admin mutations
     -----------------*/

  const addPhaseMutation = useMutation<
    TxHash,
    Error,
    {
      priceWei: bigint;
      supply: bigint;
      startTs: number | bigint;
      endTs: number | bigint;
    }
  >({
    mutationFn: async ({ priceWei, supply, startTs, endTs }) => {
      const tx = await writeAddPhase(priceWei, supply, startTs, endTs);
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.phasesList() });
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const endSaleMutation = useMutation<TxHash, Error, void>({
    mutationFn: async () => {
      const tx = await writeEndSale();
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const withdrawProceedsMutation = useMutation<TxHash, Error, string>({
    mutationFn: async (beneficiary) => {
      const tx = await writeWithdrawProceeds(beneficiary);
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const pauseMutation = useMutation<TxHash, Error, void>({
    mutationFn: async () => {
      const tx = await writePause();
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  const unpauseMutation = useMutation<TxHash, Error, void>({
    mutationFn: async () => {
      const tx = await writeUnpause();
      return tx;
    },
    onSuccess: async (txHash) => {
      await invalidateAfterTx(txHash);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: PRESALE_KEYS.all });
    },
  });

  return {
    // buyer
    buyMutation,
    claimMutation,
    requestRefundMutation,

    // admin
    addPhaseMutation,
    endSaleMutation,
    withdrawProceedsMutation,
    pauseMutation,
    unpauseMutation,
  } as const;
}
