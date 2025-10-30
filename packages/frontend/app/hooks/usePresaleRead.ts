// packages/frontend/app/hooks/usePresaleRead.ts
import { useCallback, useMemo, useRef } from "react";
import type { Address } from "viem";
import { parseAbi } from "viem";
import { usePublicClient } from "wagmi";
import { DYNAMIC_PRESALE_ADDRESS } from "@/lib/addresses";
import { DynamicPresaleABI } from "@/lib/abi";
import type { CalcResult, Phase } from "../types/presale.type";

/**
 * Helpers
 */
function toBigIntSafe(v: unknown): bigint {
  try {
    return BigInt(String(v));
  } catch {
    throw new Error(
      `usePresaleRead: failed to convert value to bigint (${String(v)})`
    );
  }
}

function toNumberSafe(v: unknown, ctx = "value"): number {
  const b = toBigIntSafe(v);
  const n = Number(b);
  if (!Number.isSafeInteger(n)) {
    throw new Error(
      `usePresaleRead: ${ctx} out of safe integer range (${String(v)})`
    );
  }
  return n;
}

function normalizePhaseResponse(res: unknown) {
  const get = (key: keyof Phase | number): unknown => {
    if (res && typeof res === "object") {
      const obj = res as Record<string, unknown>;
      const k = String(key);
      if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
      // array-like fallback
      const arr = res as ArrayLike<unknown>;
      if (
        arr &&
        typeof arr.length === "number" &&
        typeof key === "number" &&
        key >= 0 &&
        key < arr.length
      ) {
        return arr[key];
      }
    }
    return undefined;
  };

  const priceWei = get("priceWei") ?? get(0);
  const supply = get("supply") ?? get(1);
  const sold = get("sold") ?? get(2);
  const start = get("start") ?? get(3);
  const end = get("end") ?? get(4);

  if (
    priceWei === undefined ||
    supply === undefined ||
    sold === undefined ||
    start === undefined ||
    end === undefined
  ) {
    throw new Error("usePresaleRead: unexpected phase response shape");
  }

  return {
    priceWei: toBigIntSafe(priceWei),
    supply: toBigIntSafe(supply),
    sold: toBigIntSafe(sold),
    start: toNumberSafe(start, "phase.start"),
    end: toNumberSafe(end, "phase.end"),
  };
}

/**
 * Hook: usePresaleRead
 *
 * - All React hooks are called unconditionally and in stable order.
 * - Functions themselves check `isServer` at runtime and throw clear errors if called server-side.
 */
export function usePresaleRead() {
  const isServer = typeof window === "undefined";

  // Hooks called in stable order (no conditional hooks) to satisfy eslint react-hooks rules:
  const publicClient = usePublicClient();

  const parsedAbi = useMemo(() => {
    try {
      if (
        Array.isArray(DynamicPresaleABI) &&
        DynamicPresaleABI.length > 0 &&
        typeof DynamicPresaleABI[0] === "string"
      ) {
        return parseAbi(DynamicPresaleABI as unknown as string[]);
      }
      return DynamicPresaleABI;
    } catch (err) {
      // Keep parse failure loud
      console.error("[usePresaleRead] parseAbi error:", err);
      throw err;
    }
    // note: DynamicPresaleABI is static; no deps required
  }, []);

  const initLoggedRef = useRef(false);
  if (!initLoggedRef.current) {
    initLoggedRef.current = true;
    console.info("[usePresaleRead] init:", {
      hasPublicClient: !!publicClient,
      isClientEnv: !isServer,
      contractAddress: DYNAMIC_PRESALE_ADDRESS,
      parsedAbiType: Array.isArray(parsedAbi)
        ? `array(${parsedAbi.length})`
        : typeof parsedAbi,
    });
    if (isServer) {
      console.warn(
        "[usePresaleRead] running on SERVER. Ensure caller is a client component (add 'use client')."
      );
    }
  }

  const address = DYNAMIC_PRESALE_ADDRESS as Address;

  /**
   * readRaw — always defined (useCallback called unconditionally)
   * It checks isServer at runtime and throws if used in server context.
   *
   * opts.suppressLog: when true, do not print console.error on contract reverts.
   */
  const readRaw = useCallback(
    async (
      functionName: string,
      args?: unknown[],
      opts?: { suppressLog?: boolean }
    ): Promise<unknown> => {
      if (isServer) {
        throw new Error(
          "usePresaleRead: attempted read on server. Hook is client-only."
        );
      }

      // small args preview for logs
      const argsPreview = (args ?? []).map((a) => {
        try {
          if (typeof a === "bigint") return a.toString();
          if (typeof a === "object") return JSON.stringify(a).slice(0, 120);
          return String(a);
        } catch {
          return String(a);
        }
      });

      if (!opts?.suppressLog) {
        console.debug(`[usePresaleRead] readRaw -> calling ${functionName}`, {
          address,
          args: argsPreview,
        });
      }

      // typed wrapper for publicClient.readContract
      const pc = publicClient as unknown as {
        readContract: (params: {
          address: Address;
          abi: unknown;
          functionName: unknown;
          args?: unknown[];
        }) => Promise<unknown>;
      };

      try {
        const res = await pc.readContract({
          address,
          abi: parsedAbi,
          functionName: functionName as unknown,
          args: args ?? [],
        });
        if (!opts?.suppressLog) {
          console.debug(`[usePresaleRead] readRaw -> success ${functionName}`);
        }
        return res;
      } catch (err) {
        // Log unless caller explicitly asked to suppress logs (expected revert)
        if (!opts?.suppressLog) {
          console.error(`[usePresaleRead] readRaw -> error ${functionName}`, {
            functionName,
            args: argsPreview,
            error: String(err),
          });
        }
        // Still throw so callers that expect errors can handle them
        throw new Error(
          `usePresaleRead.readRaw: failed calling ${functionName} (${String(
            (err as Error).message ?? err
          )})`
        );
      }
    },
    [publicClient, parsedAbi, address, isServer]
  );

  // All reader callbacks — defined unconditionally (stable hook order)
  const getTotalPhases = useCallback(async (): Promise<number> => {
    const res = await readRaw("totalPhases");
    const num = toNumberSafe(res, "totalPhases");
    return num;
  }, [readRaw]);

  const getPhase = useCallback(
    async (phaseId: number): Promise<Phase> => {
      const res = await readRaw("getPhase", [BigInt(phaseId)]);
      const normalized = normalizePhaseResponse(res);
      return {
        phaseId,
        priceWei: normalized.priceWei,
        supply: normalized.supply,
        sold: normalized.sold,
        start: normalized.start,
        end: normalized.end,
      };
    },
    [readRaw]
  );

  const remainingTokensInCurrentPhase =
    useCallback(async (): Promise<bigint> => {
      const res = await readRaw("remainingTokensInCurrentPhase");
      return toBigIntSafe(res);
    }, [readRaw]);

  const calculateTokens = useCallback(
    async (ethAmountWei: bigint): Promise<CalcResult> => {
      const res = await readRaw("calculateTokens", [ethAmountWei]);
      if (Array.isArray(res) && res.length >= 3) {
        return {
          tokens: toBigIntSafe(res[0]),
          cost: toBigIntSafe(res[1]),
          excess: toBigIntSafe(res[2]),
        };
      }
      if (res && typeof res === "object") {
        const obj = res as Record<string, unknown>;
        const tokens = obj["tokens"] ?? obj[0];
        const cost = obj["cost"] ?? obj[1];
        const excess = obj["excess"] ?? obj[2];
        return {
          tokens: toBigIntSafe(tokens),
          cost: toBigIntSafe(cost),
          excess: toBigIntSafe(excess),
        };
      }
      throw new Error(
        "usePresaleRead: unexpected response shape from calculateTokens"
      );
    },
    [readRaw]
  );

  const contributionsOf = useCallback(
    async (wallet: Address): Promise<bigint> => {
      const res = await readRaw("contributionsWei", [wallet]);
      return toBigIntSafe(res);
    },
    [readRaw]
  );

  const pendingTokensOf = useCallback(
    async (wallet: Address): Promise<bigint> => {
      const res = await readRaw("pendingTokens", [wallet]);
      return toBigIntSafe(res);
    },
    [readRaw]
  );

  const getTotalRaised = useCallback(async (): Promise<bigint> => {
    const res = await readRaw("totalRaised");
    return toBigIntSafe(res);
  }, [readRaw]);

  const getTotalTokensSold = useCallback(async (): Promise<bigint> => {
    const res = await readRaw("totalTokensSold");
    return toBigIntSafe(res);
  }, [readRaw]);

  const getSoftCapReached = useCallback(async (): Promise<boolean> => {
    const res = await readRaw("softCapReached");
    return Boolean(res as unknown as boolean);
  }, [readRaw]);

  const getSaleEnded = useCallback(async (): Promise<boolean> => {
    const res = await readRaw("saleEnded");
    return Boolean(res as unknown as boolean);
  }, [readRaw]);

  const getSoftCap = useCallback(async (): Promise<bigint> => {
    const res = await readRaw("softCap");
    return toBigIntSafe(res);
  }, [readRaw]);

  const getMinBuy = useCallback(async (): Promise<bigint> => {
    const res = await readRaw("minBuy");
    return toBigIntSafe(res);
  }, [readRaw]);

  const getMaxPerWallet = useCallback(async (): Promise<bigint> => {
    const res = await readRaw("maxPerWallet");
    return toBigIntSafe(res);
  }, [readRaw]);

  const hasActivePhase = useCallback(async (): Promise<boolean> => {
    const res = await readRaw("hasActivePhase");
    return Boolean(res as unknown as boolean);
  }, [readRaw]);

  /**
   * getCurrentPhaseSafe — this call may revert if no phase active.
   * We call readRaw with suppressLog = true to avoid noisy console.error on expected revert.
   */
  const getCurrentPhaseSafe = useCallback(async (): Promise<number | null> => {
    try {
      const res = await readRaw("getCurrentPhase", [], { suppressLog: true });
      return toNumberSafe(res, "currentPhase");
    } catch {
      // expected: contract may revert when no active phase — return null silently
      return null;
    }
  }, [readRaw]);

  const paymentsOf = useCallback(
    async (acct: Address): Promise<bigint> => {
      const res = await readRaw("paymentsOf", [acct]);
      return toBigIntSafe(res);
    },
    [readRaw]
  );

  const escrowBalance = useCallback(async (): Promise<bigint> => {
    const res = await readRaw("escrowBalance");
    return toBigIntSafe(res);
  }, [readRaw]);

  const getTotalBuyers = useCallback(async (): Promise<number> => {
    const res = await readRaw("totalBuyers");
    return toNumberSafe(res, "totalBuyers");
  }, [readRaw]);

  const getOwner = useCallback(async (): Promise<Address> => {
    const res = await readRaw("owner");
    return res as unknown as Address;
  }, [readRaw]);

  const getTokenDecimals = useCallback(async (): Promise<number> => {
    const res = await readRaw("tokenDecimals");
    return toNumberSafe(res, "tokenDecimals");
  }, [readRaw]);

  const getTokenUnit = useCallback(async (): Promise<bigint> => {
    const res = await readRaw("tokenUnit");
    return toBigIntSafe(res);
  }, [readRaw]);

  // export all readers
  return {
    getTotalPhases,
    getPhase,
    remainingTokensInCurrentPhase,
    calculateTokens,
    contributionsOf,
    pendingTokensOf,

    getTotalRaised,
    getTotalTokensSold,
    getSoftCapReached,
    getSaleEnded,

    getSoftCap,
    getMinBuy,
    getMaxPerWallet,
    hasActivePhase,
    getCurrentPhaseSafe,
    paymentsOf,
    escrowBalance,
    getTotalBuyers,
    getOwner,
    getTokenDecimals,
    getTokenUnit,
  } as const;
}