// packages/frontend/app/hooks/usePresaleQueries.ts
import { useMemo } from "react";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { usePresaleRead } from "./usePresaleRead";
import type { Phase, CalcResult } from "../types/presale.type";

/**
 * Query key helpers
 */
export const PRESALE_KEYS = {
  all: ["presale"] as const,
  totalPhases: () => [...PRESALE_KEYS.all, "totalPhases"] as const,
  phasesList: () => [...PRESALE_KEYS.all, "phasesList"] as const,
  phase: (phaseId: number) => [...PRESALE_KEYS.all, "phase", phaseId] as const,
  remainingTokens: () => [...PRESALE_KEYS.all, "remainingTokens"] as const,
  calculateTokens: (amountWei: bigint) =>
    [...PRESALE_KEYS.all, "calculate", String(amountWei)] as const,
  totalRaised: () => [...PRESALE_KEYS.all, "totalRaised"] as const,
  totalTokensSold: () => [...PRESALE_KEYS.all, "totalTokensSold"] as const,
  softCapReached: () => [...PRESALE_KEYS.all, "softCapReached"] as const,
  saleEnded: () => [...PRESALE_KEYS.all, "saleEnded"] as const,
  softCap: () => [...PRESALE_KEYS.all, "softCap"] as const,
  minBuy: () => [...PRESALE_KEYS.all, "minBuy"] as const,
  maxPerWallet: () => [...PRESALE_KEYS.all, "maxPerWallet"] as const,
  tokenUnit: () => [...PRESALE_KEYS.all, "tokenUnit"] as const,
  hasActivePhase: () => [...PRESALE_KEYS.all, "hasActivePhase"] as const,
  currentPhase: () => [...PRESALE_KEYS.all, "currentPhase"] as const,
  totalBuyers: () => [...PRESALE_KEYS.all, "totalBuyers"] as const,
  owner: () => [...PRESALE_KEYS.all, "owner"] as const,
  user: (address: string) => ["user", address] as const,
  userContributions: (address: string) =>
    ["user", address, "contributions"] as const,
  userPendingTokens: (address: string) =>
    ["user", address, "pendingTokens"] as const,
};

/**
 * Convenience generic for useQuery options in this module
 *
 * UseQueryOptions<QueryFnData, Error, TData>
 */
type QO<T> = UseQueryOptions<T, Error, T>;

/* -------------------------
   Presale query hooks
   ------------------------- */

export function useTotalPhases(options?: QO<number>) {
  const { getTotalPhases } = usePresaleRead();
  return useQuery<number, Error>({
    queryKey: PRESALE_KEYS.totalPhases(),
    queryFn: () => getTotalPhases(),
    staleTime: 10_000,
    ...(options ?? {}),
  });
}

/**
 * Fetch all phases in one query.
 * Note: this runs getTotalPhases then parallel getPhase(i).
 */
export function useAllPhases(options?: QO<Phase[]>) {
  const { getTotalPhases, getPhase } = usePresaleRead();
  return useQuery<Phase[], Error>({
    queryKey: PRESALE_KEYS.phasesList(),
    queryFn: async () => {
      const total = await getTotalPhases();
      if (total === 0) return [];
      const arr = new Array<Promise<Phase>>(total);
      for (let i = 0; i < total; i++) {
        arr[i] = getPhase(i);
      }
      return Promise.all(arr);
    },
    staleTime: 20_000,
    ...(options ?? {}),
  });
}

export function usePhase(phaseId: number | undefined, options?: QO<Phase>) {
  const { getPhase } = usePresaleRead();

  return useQuery<Phase, Error>({
    queryKey:
      phaseId === undefined
        ? ([...PRESALE_KEYS.all, "phase", "undefined"] as const)
        : PRESALE_KEYS.phase(phaseId),
    queryFn: async () => {
      if (phaseId === undefined) throw new Error("phaseId required");
      return getPhase(phaseId);
    },
    enabled: phaseId !== undefined,
    staleTime: 10_000,
    ...(options ?? {}),
  });
}

export function useRemainingTokens(options?: QO<bigint>) {
  const { remainingTokensInCurrentPhase } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: PRESALE_KEYS.remainingTokens(),
    queryFn: () => remainingTokensInCurrentPhase(),
    staleTime: 5_000,
    ...(options ?? {}),
  });
}

export function useCalculateTokens(
  amountWei: bigint | null,
  options?: QO<CalcResult>
) {
  const { calculateTokens } = usePresaleRead();
  return useQuery<CalcResult, Error>({
    queryKey:
      amountWei === null
        ? ([...PRESALE_KEYS.all, "calculate", "null"] as const)
        : PRESALE_KEYS.calculateTokens(amountWei),
    queryFn: async () => {
      if (amountWei === null) throw new Error("amountWei required");
      return calculateTokens(amountWei);
    },
    enabled: amountWei !== null,
    staleTime: 1_000,
    ...(options ?? {}),
  });
}

export function useTotalRaised(options?: QO<bigint>) {
  const { getTotalRaised } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: PRESALE_KEYS.totalRaised(),
    queryFn: () => getTotalRaised(),
    staleTime: 10_000,
    ...(options ?? {}),
  });
}

export function useTotalTokensSold(options?: QO<bigint>) {
  const { getTotalTokensSold } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: PRESALE_KEYS.totalTokensSold(),
    queryFn: () => getTotalTokensSold(),
    staleTime: 10_000,
    ...(options ?? {}),
  });
}

export function useSoftCapReached(options?: QO<boolean>) {
  const { getSoftCapReached } = usePresaleRead();
  return useQuery<boolean, Error>({
    queryKey: PRESALE_KEYS.softCapReached(),
    queryFn: () => getSoftCapReached(),
    staleTime: 10_000,
    ...(options ?? {}),
  });
}

export function useSaleEnded(options?: QO<boolean>) {
  const { getSaleEnded } = usePresaleRead();
  return useQuery<boolean, Error>({
    queryKey: PRESALE_KEYS.saleEnded(),
    queryFn: () => getSaleEnded(),
    staleTime: 10_000,
    ...(options ?? {}),
  });
}

/* -------------------------
   Extra getters useful for product/UI
   ------------------------- */

export function useSoftCap(options?: QO<bigint>) {
  const { getSoftCap } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: PRESALE_KEYS.softCap(),
    queryFn: () => getSoftCap(),
    staleTime: 30_000,
    ...(options ?? {}),
  });
}

export function useMinBuy(options?: QO<bigint>) {
  const { getMinBuy } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: PRESALE_KEYS.minBuy(),
    queryFn: () => getMinBuy(),
    staleTime: 30_000,
    ...(options ?? {}),
  });
}

export function useMaxPerWallet(options?: QO<bigint>) {
  const { getMaxPerWallet } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: PRESALE_KEYS.maxPerWallet(),
    queryFn: () => getMaxPerWallet(),
    staleTime: 30_000,
    ...(options ?? {}),
  });
}

export function useTokenUnit(options?: QO<bigint>) {
  const { getTokenUnit } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: PRESALE_KEYS.tokenUnit(),
    queryFn: () => getTokenUnit(),
    staleTime: 60_000,
    ...(options ?? {}),
  });
}

export function useHasActivePhase(options?: QO<boolean>) {
  const { hasActivePhase } = usePresaleRead();
  return useQuery<boolean, Error>({
    queryKey: PRESALE_KEYS.hasActivePhase(),
    queryFn: () => hasActivePhase(),
    staleTime: 5_000,
    ...(options ?? {}),
  });
}

/**
 * getCurrentPhase (safe)
 * returns number | null — useful to render "no active phase" without throwing.
 */
export function useCurrentPhase(options?: QO<number | null>) {
  const { getCurrentPhaseSafe } = usePresaleRead();
  return useQuery<number | null, Error>({
    queryKey: PRESALE_KEYS.currentPhase(),
    queryFn: () => getCurrentPhaseSafe(),
    staleTime: 5_000,
    ...(options ?? {}),
  });
}

export function useTotalBuyers(options?: QO<number>) {
  const { getTotalBuyers } = usePresaleRead();
  return useQuery<number, Error>({
    queryKey: PRESALE_KEYS.totalBuyers(),
    queryFn: () => getTotalBuyers(),
    staleTime: 30_000,
    ...(options ?? {}),
  });
}

export function useOwner(options?: QO<Address>) {
  const { getOwner } = usePresaleRead();
  return useQuery<Address, Error>({
    queryKey: PRESALE_KEYS.owner(),
    queryFn: () => getOwner(),
    staleTime: 60_000,
    ...(options ?? {}),
  });
}

/* -------------------------
   User-scoped queries
   ------------------------- */

export function useMyContributions(options?: QO<bigint>) {
  const { address } = useAccount();
  // address from wagmi useAccount is string | undefined
  return useContributionsOf(address ?? null, options);
}

export function useContributionsOf(
  address: string | null,
  options?: QO<bigint>
) {
  const { contributionsOf } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: address
      ? PRESALE_KEYS.userContributions(address)
      : (["user", "null", "contributions"] as const),
    queryFn: async () => {
      if (!address) throw new Error("address required");
      return contributionsOf(address as Address);
    },
    enabled: Boolean(address),
    staleTime: 5_000,
    ...(options ?? {}),
  });
}

export function useMyPendingTokens(options?: QO<bigint>) {
  const { address } = useAccount();
  return usePendingTokensOf(address ?? null, options);
}

export function usePendingTokensOf(
  address: string | null,
  options?: QO<bigint>
) {
  const { pendingTokensOf } = usePresaleRead();
  return useQuery<bigint, Error>({
    queryKey: address
      ? PRESALE_KEYS.userPendingTokens(address)
      : (["user", "null", "pendingTokens"] as const),
    queryFn: async () => {
      if (!address) throw new Error("address required");
      return pendingTokensOf(address as Address);
    },
    enabled: Boolean(address),
    staleTime: 5_000,
    ...(options ?? {}),
  });
}

/**
 * Convenience aggregated snapshot for a dashboard
 */
export function usePresaleDashboardSnapshot() {
  const totalRaised = useTotalRaised();
  const totalTokensSold = useTotalTokensSold();
  const remaining = useRemainingTokens();
  const totalPhases = useTotalPhases();
  const currentPhase = useCurrentPhase();

  return useMemo(
    () => ({
      totalRaised,
      totalTokensSold,
      remaining,
      totalPhases,
      currentPhase,
    }),
    [totalRaised, totalTokensSold, remaining, totalPhases, currentPhase]
  );
}
