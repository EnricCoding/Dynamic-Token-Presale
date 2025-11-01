'use client';

import React, { JSX, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { usePresaleRead } from '@/app/hooks/usePresaleRead';
import { usePresaleMutations } from '@/app/hooks/usePresaleMutation';
import { Skeleton, Spinner } from '../components/ui';
import type { Phase, CalcResult } from '@/app/types/presale.type';


const ETH_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
});

const TIME_CONSTANTS = {
  MINUTE: 60,
  HOUR: 60 * 60,
  DAY: 24 * 60 * 60,
} as const;

const IconClock = (): JSX.Element => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconZap = (): JSX.Element => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconCheckCircle = (): JSX.Element => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

const IconAlertCircle = (): JSX.Element => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
  </svg>
);

const IconLock = (): JSX.Element => (
  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.72-7 8.77V12H5V6.3l7-3.11v8.8z" opacity="0.3" />
  </svg>
);

function InfoTooltip({ text }: { text: string }): JSX.Element {
  return (
    <span
      role="tooltip"
      title={text}
      aria-label={text}
      className="inline-flex items-center justify-center ml-2 rounded-full border border-slate-200 bg-slate-50 text-xs w-5 h-5 cursor-help"
    >
      ?
    </span>
  );
}

const MetricCard = React.memo(function MetricCard({
  title,
  tooltip,
  loading,
  value,
  subtext,
}: {
  title: string;
  tooltip?: string;
  loading: boolean;
  value: React.ReactNode;
  subtext?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="relative bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-slate-600">{title}</span>
            {tooltip && <InfoTooltip text={tooltip} />}
          </div>
          {loading && <Spinner size={14} className="text-slate-400" />}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            {subtext && <div className="text-xs text-slate-500 mt-2">{subtext}</div>}
          </div>
        )}
      </div>
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

export default function PresaleDashboard(): JSX.Element {
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const clientAddress = mounted ? (address ?? null) : null;

  const presale = usePresaleRead();

  const qc = useQueryClient();

  const { buyMutation, claimMutation, requestRefundMutation } = usePresaleMutations();

  /* ---------- Queries ---------- */

  const totalRaisedQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'totalRaised'],
    queryFn: async () => presale.getTotalRaised(),
    enabled: mounted,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const remainingTokensQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'remainingTokens'],
    queryFn: async () => presale.remainingTokensInCurrentPhase(),
    enabled: mounted,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const totalTokensSoldQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'totalTokensSold'],
    queryFn: async () => presale.getTotalTokensSold(),
    enabled: mounted,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const totalBuyersQ = useQuery<number, Error>({
    queryKey: ['presale', 'totalBuyers'],
    queryFn: async () => presale.getTotalBuyers(),
    enabled: mounted,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const contributionsQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'contributions', clientAddress ?? 'anon'],
    queryFn: async () => {
      if (!clientAddress) return BigInt(0);
      return presale.contributionsOf(clientAddress);
    },
    enabled: mounted && !!clientAddress,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const pendingTokensQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'pendingTokens', clientAddress ?? 'anon'],
    queryFn: async () => {
      if (!clientAddress) return BigInt(0);
      return presale.pendingTokensOf(clientAddress);
    },
    enabled: mounted && !!clientAddress,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // token decimals for formatting
  const tokenDecimalsQ = useQuery<number, Error>({
    queryKey: ['presale', 'tokenDecimals'],
    queryFn: async () => presale.getTokenDecimals(),
    enabled: mounted,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // SALE ENDED flag (needed to decide claim/refund UX)
  const saleEndedQ = useQuery<boolean, Error>({
    queryKey: ['presale', 'saleEnded'],
    queryFn: async () => presale.getSaleEnded(),
    enabled: mounted,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // calculate tokens for an entered amount (dynamic)
  const [ethToSend, setEthToSend] = useState<string>('0.01');
  const amountWeiForCalc = useMemo<bigint | null>(() => {
    const n = Number(ethToSend);
    if (!Number.isFinite(n) || n <= 0) return null;
    return BigInt(Math.floor(n * 1e18));
  }, [ethToSend]);

  const calculateQueryKey = ['presale', 'calculate', amountWeiForCalc?.toString() ?? 'null'];
  const calculateQuery = useQuery<CalcResult, Error>({
    queryKey: calculateQueryKey,
    queryFn: async () => {
      if (amountWeiForCalc == null) throw new Error('no amount for calc');
      return presale.calculateTokens(amountWeiForCalc);
    },
    enabled: mounted && amountWeiForCalc != null,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  // phases: fetch total then fetch phases in parallel
  const phasesListQ = useQuery<Phase[], Error>({
    queryKey: ['presale', 'phasesList'],
    queryFn: async () => {
      const total = await presale.getTotalPhases();
      if (total <= 0) return [];
      const promises: Promise<Phase>[] = Array.from({ length: total }, (_, i) => presale.getPhase(i));
      const phases = await Promise.all(promises);
      return phases;
    },
    enabled: mounted,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const currentPhaseIndexQ = useQuery<number | null, Error>({
    queryKey: ['presale', 'currentPhaseIndex'],
    queryFn: async () => presale.getCurrentPhaseSafe(),
    enabled: mounted,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const softCapQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'softCap'],
    queryFn: async () => presale.getSoftCap(),
    enabled: mounted,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const minBuyQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'minBuy'],
    queryFn: async () => presale.getMinBuy(),
    enabled: mounted,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const maxPerWalletQ = useQuery<bigint, Error>({
    queryKey: ['presale', 'maxPerWallet'],
    queryFn: async () => presale.getMaxPerWallet(),
    enabled: mounted,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  /* ---------- UX helpers ---------- */

  const displayWeiAsEth = (v?: bigint | null): string => {
    if (!v) return '0';
    try {
      const asStr = formatUnits(v as bigint, 18);
      const asNum = Number(asStr);
      if (!Number.isFinite(asNum)) return asStr;
      return ETH_FORMATTER.format(asNum);
    } catch {
      return String(v);
    }
  };

  const displayTokens = (v?: bigint | null): string => {
    if (!v) return '0';
    const decimals = tokenDecimalsQ.data ?? 18;
    try {
      const asStr = formatUnits(v as bigint, decimals);
      const asNum = Number(asStr);
      const maxFrac = Math.min(6, decimals);
      if (Number.isFinite(asNum)) {
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFrac }).format(asNum);
      }
      return asStr;
    } catch {
      try {
        return (v as bigint).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      } catch {
        return String(v);
      }
    }
  };

  async function onBuy(): Promise<void> {
    try {
      const amount = Number(ethToSend);
      if (!Number.isFinite(amount) || amount <= 0) {
        alert('Please enter a valid ETH amount greater than 0');
        return;
      }

      const wei = BigInt(Math.floor(amount * 1e18));

      if (minBuyQ.data && wei < minBuyQ.data) {
        alert(`Amount is below minimum: ${displayWeiAsEth(minBuyQ.data)} ETH`);
        return;
      }

      if (maxPerWalletQ.data && contributionsQ.data) {
        const wouldBe = wei + (contributionsQ.data ?? BigInt(0));
        if (wouldBe > maxPerWalletQ.data) {
          alert(`Purchase would exceed max per wallet (${displayWeiAsEth(maxPerWalletQ.data)} ETH)`);
          return;
        }
      }

      // Defensive check: ensure there's an active phase and tokens remaining
      const remaining = remainingTokensQ.data ?? BigInt(0);
      const currentPhaseIdx = currentPhaseIndexQ.data ?? null;
      if (currentPhaseIdx === null || remaining <= BigInt(0)) {
        alert('No active phase or no tokens remaining — cannot buy right now.');
        return;
      }

      await buyMutation.mutateAsync(wei);
      qc.invalidateQueries({ queryKey: ['presale'] });
      alert('Transaction submitted. Check your wallet.');
    } catch (err) {
      console.error('buy failed', err);
      alert('Buy failed — see console for details');
    }
  }

  async function onClaim(): Promise<void> {
    try {
      // defensive: ensure sale ended and soft cap reached and user has pending tokens
      const saleEnded = saleEndedQ.data ?? false;
      const softCap = softCapQ.data ?? null;
      const totalRaised = totalRaisedQ.data ?? BigInt(0);
      const softCapReached = softCap != null ? totalRaised >= softCap : undefined;
      const pending = pendingTokensQ.data ?? BigInt(0);

      if (!saleEnded) {
        alert('Sale has not ended yet. You can only claim after the sale ends.');
        return;
      }
      if (softCapReached === false) {
        alert('Soft cap not reached — claiming disabled. You may request a refund.');
        return;
      }
      if (pending <= BigInt(0)) {
        alert('No pending tokens to claim for this wallet.');
        return;
      }

      await claimMutation.mutateAsync();
      qc.invalidateQueries({ queryKey: ['presale'] });
      alert('Claim transaction submitted.');
    } catch (err) {
      console.error('claim failed', err);
      alert('Claim failed — see console for details');
    }
  }

  async function onRequestRefund(): Promise<void> {
    try {
      const saleEnded = saleEndedQ.data ?? false;
      const softCap = softCapQ.data ?? null;
      const totalRaised = totalRaisedQ.data ?? BigInt(0);
      const softCapReached = softCap != null ? totalRaised >= softCap : undefined;
      const contributed = contributionsQ.data ?? BigInt(0);

      if (!saleEnded) {
        alert('Sale has not ended yet. Refunds are only available after sale end if the soft cap was not met.');
        return;
      }
      if (softCapReached === true) {
        alert('Soft cap was reached — refunds are disabled. You may claim tokens instead.');
        return;
      }
      if (contributed <= BigInt(0)) {
        alert('No contribution found for this wallet to refund.');
        return;
      }

      await requestRefundMutation.mutateAsync();
      qc.invalidateQueries({ queryKey: ['presale'] });
      alert('Refund request submitted.');
    } catch (err) {
      console.error('request refund failed', err);
      alert('Request refund failed — see console for details');
    }
  }

  /* ---------- Derived state ---------- */

  const buying = buyMutation.status === 'pending';
  const claiming = claimMutation.status === 'pending';
  const requestingRefund = requestRefundMutation.status === 'pending';

  const isAnyLoading =
    totalRaisedQ.isLoading ||
    remainingTokensQ.isLoading ||
    totalTokensSoldQ.isLoading ||
    phasesListQ.isLoading ||
    contributionsQ.isLoading ||
    pendingTokensQ.isLoading;

  const totalRaised = totalRaisedQ.data ?? BigInt(0);
  const softCap = softCapQ.data ?? null;
  const softCapReached = softCap != null ? totalRaised >= softCap : undefined;
  const currentPhaseIndex = currentPhaseIndexQ.data ?? null;
  const currentPhase = phasesListQ.data?.find((p) => p.phaseId === currentPhaseIndex) ?? null;
  const hasActive = currentPhase !== null;

  // seconds left for active phase (real time)
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    const idx = currentPhaseIndex;
    if (idx == null || !phasesListQ.data) {
      setSecsLeft(null);
      return;
    }
    const phase = phasesListQ.data.find((p) => p.phaseId === idx);
    if (!phase) {
      setSecsLeft(null);
      return;
    }
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      setSecsLeft(Math.max(0, phase.end - now));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [currentPhaseIndex, phasesListQ.data]);

  // Format remaining time for display
  const formatTimeLeft = (seconds: number): [string, boolean] => {
    if (seconds <= 0) return ['Ended', true];
    const days = Math.floor(seconds / TIME_CONSTANTS.DAY);
    const hours = Math.floor((seconds % TIME_CONSTANTS.DAY) / TIME_CONSTANTS.HOUR);
    const mins = Math.floor((seconds % TIME_CONSTANTS.HOUR) / TIME_CONSTANTS.MINUTE);
    const secs = seconds % TIME_CONSTANTS.MINUTE;
    if (days > 0) return [`${days}d ${hours}h`, false];
    if (hours > 0) return [`${hours}h ${mins}m`, false];
    if (mins > 0) return [`${mins}m ${secs}s`, false];
    return [`${secs}s`, false];
  };

  const [countdownLabel] = secsLeft == null ? ['—'] : [formatTimeLeft(secsLeft)[0]];

  // Soft cap progress percent (0-100) using BigInt arithmetic
  const softCapPercent = (() => {
    try {
      if (!softCap || softCap === BigInt(0)) return 0;
      const pct = Number((totalRaised * BigInt(100)) / softCap);
      if (!Number.isFinite(pct)) return 0;
      return Math.max(0, Math.min(100, Math.round(pct)));
    } catch {
      return 0;
    }
  })();

  // Derived checks for UX: allow/disable actions according to on-chain state
  const remainingTokens = remainingTokensQ.data ?? BigInt(0);
  const contributions = contributionsQ.data ?? BigInt(0);
  const pendingTokens = pendingTokensQ.data ?? BigInt(0);
  const saleEnded = saleEndedQ.data ?? false;

  const canBuy = hasActive && remainingTokens > BigInt(0);
  const canClaim = saleEnded === true && softCapReached === true && pendingTokens > BigInt(0);
  const canRequestRefund = saleEnded === true && softCapReached === false && contributions > BigInt(0);

  const buyDisabledReason = !hasActive
    ? 'No active phase — purchases disabled'
    : remainingTokens <= BigInt(0)
      ? 'No tokens remaining in the current phase'
      : 'Connect your wallet to buy';

  const claimDisabledReason = !saleEnded
    ? 'Sale not finished — you can only claim after sale end'
    : softCapReached === false
      ? 'Soft cap not reached — claim disabled (you may request refund)'
      : pendingTokens <= BigInt(0)
        ? 'No pending tokens to claim'
        : 'Connect your wallet to claim';

  const refundDisabledReason = !saleEnded
    ? 'Sale not finished — refunds available only after sale ends'
    : softCapReached === true
      ? 'Soft cap reached — refunds disabled'
      : contributions <= BigInt(0)
        ? 'No contribution found for this wallet'
        : 'Connect your wallet to request refund';

  /* ---------- Render ---------- */

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4" role="banner">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">
              Token Presale
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-xl">
              Participate in our presale and secure your tokens at the best price. Follow the phases below as they progress.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-lg px-4 py-3" role="status" aria-live="polite">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
            <span className="text-sm text-slate-700">
              {isAnyLoading ? 'Syncing…' : 'Network: Active'}
            </span>
          </div>
        </header>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5" aria-label="Presale metrics">
          <MetricCard
            title="Total Raised"
            loading={totalRaisedQ.isLoading}
            value={`${displayWeiAsEth(totalRaised)} ETH`}
            subtext="Total ETH collected from all buyers"
          />

          <MetricCard
            title="Soft Cap"
            tooltip="Minimum amount of ETH needed for a successful sale"
            loading={softCapQ.isLoading}
            value={softCap ? `${displayWeiAsEth(softCap)} ETH` : '—'}
            subtext={
              softCap ? (
                <div>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${softCapPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${softCapPercent}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-600">{softCapPercent}% reached</div>
                </div>
              ) : (
                'No soft cap configured'
              )
            }
          />

          <MetricCard
            title="Total Sold"
            loading={totalTokensSoldQ.isLoading}
            value={displayTokens(totalTokensSoldQ.data ?? BigInt(0))}
          />

          <MetricCard
            title="Unique Buyers"
            tooltip="Number of unique addresses that have purchased"
            loading={totalBuyersQ.isLoading}
            value={totalBuyersQ.data ?? 0}
          />
        </section>

        {/* Phase Status & Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="text-indigo-600">
                  <IconClock />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Phase Timeline</h2>
              </div>
              <div className="space-y-3">
                {phasesListQ.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-lg" />
                ) : phasesListQ.data && phasesListQ.data.length > 0 ? (
                  phasesListQ.data.map((p: Phase) => {
                    const now = Math.floor(Date.now() / 1000);
                    const active = now >= p.start && now <= p.end && p.sold < p.supply;
                    const status = active ? 'Live' : now < p.start ? 'Upcoming' : 'Completed';
                    const percentSold = p.supply > BigInt(0) ? Math.round(Number((p.sold * BigInt(100)) / p.supply)) : 0;
                    return (
                      <div
                        key={p.phaseId}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          active
                            ? 'border-indigo-500 bg-indigo-50'
                            : `border-slate-200 bg-white hover:border-slate-300`
                        }`}
                      >
                        {active && (
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-full animate-pulse" />
                        )}

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-bold text-slate-900">Phase {p.phaseId}</span>
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                status === 'Live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1">
                              <p>Price: <span className="font-medium text-slate-900">{formatUnits(p.priceWei, 18)} ETH/token</span></p>
                              <p>Supply: <span className="font-medium text-slate-900">{displayTokens(p.supply)}</span></p>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">{percentSold}%</div>
                            <div className="text-xs text-slate-600">{displayTokens(p.sold)} sold</div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="h-3 rounded-full overflow-hidden bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${percentSold >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                              style={{ width: `${Math.min(100, percentSold)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="text-slate-400 mb-2">
                      <IconLock />
                    </div>
                    <p className="text-sm text-slate-600">No phases configured yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-6 shadow-md text-white">
              <div className="text-sm font-medium text-indigo-100 mb-2">Current Phase</div>
              <div className="text-3xl font-bold mb-1">
                {currentPhase ? `Phase ${currentPhase.phaseId}` : '—'}
              </div>
              <div className="text-indigo-100 mb-4">{currentPhase ? `${Math.round(Number((currentPhase.sold * BigInt(100)) / currentPhase.supply))}%` : '0%'} progress</div>
              <div className="h-3 rounded-full overflow-hidden bg-indigo-500/30">
                <div
                  className="h-full rounded-full bg-white/40 transition-all duration-500"
                  style={{ width: `${currentPhase ? Math.round(Number((currentPhase.sold * BigInt(100)) / currentPhase.supply)) : 0}%` }}
                />
              </div>
              <div className="mt-4 flex items-center gap-2 text-indigo-100 font-mono text-lg">
                <div>⏱</div>
                {countdownLabel}
              </div>
            </div>

            <div className={`rounded-xl p-6 shadow-md border-2 ${
              softCapReached 
                ? 'bg-emerald-50 border-emerald-300' 
                : softCapReached === false
                ? 'bg-rose-50 border-rose-300'
                : 'bg-slate-50 border-slate-300'
            }`}>
              <div className={`text-sm font-medium mb-2 ${
                softCapReached ? 'text-emerald-700' : softCapReached === false ? 'text-rose-700' : 'text-slate-700'
              }`}>
                Soft Cap Status
              </div>
              <div className={`text-2xl font-bold ${
                softCapReached ? 'text-emerald-600' : softCapReached === false ? 'text-rose-600' : 'text-slate-700'
              }`}>
                {softCapReached ? '✓ Reached' : softCapReached === false ? '✗ Not Reached' : 'In Progress'}
              </div>
              <div className="mt-3 h-2 rounded-full overflow-hidden bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${softCapReached ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${softCapPercent}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-medium text-slate-700">{softCapPercent}% completed</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Buy Tokens</h2>
          <p className="text-slate-600 mb-6">Enter ETH amount to see your estimated tokens</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-900 mb-3">ETH Amount</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={ethToSend}
                onChange={(e) => setEthToSend(e.target.value)}
                disabled={buying}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:opacity-50"
                placeholder="0.1"
                aria-label="ETH amount"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">ETH</span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              {minBuyQ.data && <span>Min: {displayWeiAsEth(minBuyQ.data)} ETH</span>}
              {maxPerWalletQ.data && <span className="ml-4">Max: {displayWeiAsEth(maxPerWalletQ.data)} ETH</span>}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 mb-6 border border-slate-200">
            {amountWeiForCalc === null ? (
              <div className="text-slate-600 text-sm">Enter an amount to see estimated tokens</div>
            ) : !hasActive ? (
              <div className="text-rose-600 text-sm">No active phase or no tokens remaining</div>
            ) : calculateQuery.isFetching ? (
              <div className="flex items-center gap-2 text-slate-600">
                <Spinner size={14} />
                Calculating…
              </div>
            ) : calculateQuery.data ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">Estimated Tokens:</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {displayTokens(calculateQuery.data.tokens)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Cost:</span>
                  <span>{displayWeiAsEth(calculateQuery.data.cost)} ETH</span>
                </div>
                {calculateQuery.data.excess > BigInt(0) && (
                  <div className="flex items-center justify-between text-sm text-amber-600">
                    <span>Excess refund:</span>
                    <span>{displayWeiAsEth(calculateQuery.data.excess)} ETH</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <button
            onClick={onBuy}
            disabled={!clientAddress || buying || isAnyLoading || !canBuy}
            className={`
              w-full inline-flex items-center justify-center gap-2 font-medium rounded-lg
              transition-all duration-200 shadow-sm hover:shadow-md
              disabled:opacity-50 disabled:cursor-not-allowed
              px-6 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
              bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white
            `}
            aria-busy={buying}
            aria-disabled={!clientAddress || buying || isAnyLoading || !canBuy}
            title={buying ? 'Processing purchase' : (!canBuy ? buyDisabledReason : 'Buy tokens')}
          >
            <IconZap />
            <span>{buying ? 'Processing…' : 'Buy Now'}</span>
          </button>

          <p className="text-xs text-slate-600 mt-4">
            Gas fees not included. Transactions are processed on the Ethereum blockchain.
          </p>
        </div>

        {/* User Account & Actions */}
        <div className="space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">My Account</h3>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Your Contribution</span>
                <span className="text-slate-900 font-semibold">{displayWeiAsEth(contributionsQ.data ?? BigInt(0))} ETH</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Pending Tokens</span>
                <span className="text-slate-900 font-semibold">
                  {displayTokens(pendingTokensQ.data ?? BigInt(0))}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={onClaim}
                disabled={!clientAddress || claiming || !canClaim}
                className={`
                  w-full inline-flex items-center justify-center gap-2 font-medium rounded-lg
                  transition-all duration-200 shadow-sm hover:shadow-md
                  disabled:opacity-50 disabled:cursor-not-allowed
                  px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500
                  ${!clientAddress || claiming || !canClaim ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white'}
                `}
                aria-busy={claiming}
                aria-disabled={!clientAddress || claiming || !canClaim}
                title={!mounted ? 'Connect wallet to claim' : (!canClaim ? claimDisabledReason : 'Claim your tokens')}
              >
                <IconCheckCircle />
                <span>{claiming ? 'Claiming…' : 'Claim Tokens'}</span>
              </button>

              <button
                onClick={onRequestRefund}
                disabled={!clientAddress || requestingRefund || !canRequestRefund}
                className={`
                  w-full inline-flex items-center justify-center gap-2 font-medium rounded-lg
                  transition-all duration-200 shadow-sm hover:shadow-md
                  disabled:opacity-50 disabled:cursor-not-allowed
                  px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500
                  ${!clientAddress || requestingRefund || !canRequestRefund ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white'}
                `}
                aria-busy={requestingRefund}
                aria-disabled={!clientAddress || requestingRefund || !canRequestRefund}
                title={!mounted ? 'Connect wallet to request refund' : (!canRequestRefund ? refundDisabledReason : 'Request a refund')}
              >
                <IconAlertCircle />
                <span>{requestingRefund ? 'Requesting…' : 'Request Refund'}</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Help</h3>
            <ul className="space-y-2 text-xs text-slate-700">
              <li>
                <span className="text-indigo-600 font-medium">Claim:</span> Get your purchased tokens after sale ends
              </li>
              <li>
                <span className="text-indigo-600 font-medium">Refund:</span> Get ETH back if soft cap not reached
              </li>
              <li>
                <span className="text-indigo-600 font-medium">Status:</span> {isAnyLoading ? 'Loading data…' : 'Network is up-to-date'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
