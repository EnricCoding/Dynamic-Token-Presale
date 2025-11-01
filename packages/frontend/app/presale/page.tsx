'use client';

import React, { JSX, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { usePresaleRead } from '@/app/hooks/usePresaleRead';
import { usePresaleMutations } from '@/app/hooks/usePresaleMutation';
import { Skeleton, Spinner } from '../components/ui';
import type { Phase, CalcResult } from '@/app/types/presale.type';

const ethFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
});

function formatBigIntWithCommas(v: string) {
  return v.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatTimeLeft(secondsLeft: number) {
  if (secondsLeft <= 0) return ['Ended', true] as const;
  const days = Math.floor(secondsLeft / (60 * 60 * 24));
  const hours = Math.floor((secondsLeft % (60 * 60 * 24)) / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = Math.floor(secondsLeft % 60);

  if (days > 0) return [`${days}d ${hours}h`, false] as const;
  if (hours > 0) return [`${hours}h ${mins}m`, false] as const;
  if (mins > 0) return [`${mins}m ${secs}s`, false] as const;
  return [`${secs}s`, false] as const;
}

function Info({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex items-center justify-center ml-2 rounded-full border border-slate-200 bg-slate-50 text-xs w-5 h-5"
    >
      ?
    </span>
  );
}

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
      return ethFormatter.format(asNum);
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
        return formatBigIntWithCommas((v as bigint).toString());
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
      // defensive: ensure sale ended and soft cap NOT reached and user contributed
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
  const phaseCount = phasesListQ.data?.length ?? 0;
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

  const [countdownLabel, countdownEnded] = secsLeft == null ? ['—', true] : formatTimeLeft(secsLeft);

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

  // Current phase sold percent
  const currentPhaseSoldPercent = (() => {
    if (!currentPhase) return 0;
    try {
      if (currentPhase.supply === BigInt(0)) return 0;
      const pct = Number((currentPhase.sold * BigInt(100)) / currentPhase.supply);
      if (!Number.isFinite(pct)) return 0;
      return Math.max(0, Math.min(100, Math.round(pct)));
    } catch {
      return 0;
    }
  })();

  const currentPhasePriceEth = currentPhase
    ? (() => {
      try {
        return formatUnits(currentPhase.priceWei, 18);
      } catch {
        return '0';
      }
    })()
    : null;

  const connectedHint = !mounted ? 'Connect your wallet to enable buying' : clientAddress ? 'Connected: quick transactions supported' : 'Connect your wallet to enable buying';

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

  /* ---------- Small UI subcomponents ---------- */

  function StatCard({ title, loading, children }: { title: React.ReactNode; loading?: boolean; children: React.ReactNode }) {
    return (
      <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-slate-500">{title}</h3>
          {loading ? <Spinner size={14} className="text-slate-400" /> : null}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-semibold text-slate-900">{children}</div>
        </div>
      </div>
    );
  }

  /* ---------- Render ---------- */

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight text-slate-900">Presale Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Buy tokens while a phase is <strong>Live</strong>. Soft cap = minimum ETH needed for the sale to be successful. If the soft cap is not reached, buyers can request a refund.
          </p>
        </div>

      </header>

      {/* Top summary - improved UX */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total raised */}
        <StatCard title="Total raised" loading={totalRaisedQ.isFetching}>
          {totalRaisedQ.isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold">{displayWeiAsEth(totalRaised)} <span className="text-sm text-slate-500">ETH</span></div>
              </div>
              <div className="text-xs text-slate-500 mt-2">Total ETH collected so far from all buyers.</div>
            </div>
          )}
        </StatCard>

        {/* Soft cap */}
        <StatCard
          title={<span className="flex items-center">Soft cap <Info text="Soft cap: minimum amount of ETH that must be raised for the sale to be successful. If not reached, buyers can request refunds." /></span>}
          loading={softCapQ.isFetching}
        >
          {softCapQ.isLoading ? (
            <Skeleton className="h-8 w-36" />
          ) : softCap ? (
            <div>
              <div className="flex items-center justify-between">
                <div className="text-lg font-medium">{displayWeiAsEth(softCap)} ETH</div>
                <div className="text-sm text-slate-500">{softCapPercent}%</div>
              </div>

              <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${softCapPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${softCapPercent}%`, transition: 'width 600ms ease' }}
                />
              </div>

              <div className="text-xs text-slate-500 mt-2">
                {softCapPercent >= 100 ? 'Soft cap reached — sale considered successful' : 'Progress toward minimum target needed for a successful sale.'}
                {softCapReached === false ? ' • Soft cap not yet reached' : ''}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">No soft cap configured</div>
          )}
        </StatCard>

        {/* Current phase */}
        <StatCard title="Current phase" loading={currentPhaseIndexQ.isFetching || phasesListQ.isFetching}>
          {currentPhase ? (
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Phase {currentPhase.phaseId} • {countdownEnded ? 'Ended' : 'Live'}</div>
                  <div className="text-xs text-slate-500">Price: {currentPhasePriceEth} ETH</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{displayTokens(currentPhase.supply - currentPhase.sold)} remaining</div>
                  <div className="text-xs text-slate-500">{currentPhaseSoldPercent}% sold</div>
                </div>
              </div>

              <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${currentPhaseSoldPercent}%`, transition: 'width 400ms ease' }} />
              </div>

              <div className="mt-2 text-xs text-slate-500">Ends in: <span className="font-medium">{countdownLabel}</span></div>
            </div>
          ) : currentPhaseIndex === null ? (
            <div className="text-xs text-slate-500">No active phase</div>
          ) : (
            <Skeleton className="h-8 w-36" />
          )}
        </StatCard>

        {/* Buyers & sold */}
        <StatCard
          title={<span className="flex items-center">Buyers & tokens sold <Info text="Buyers = number of unique addresses that purchased. Tokens sold = total tokens allocated (not yet claimed)." /></span>}
          loading={totalTokensSoldQ.isFetching || phasesListQ.isFetching}
        >
          {totalTokensSoldQ.isLoading ? (
            <Skeleton className="h-8 w-36" />
          ) : (
            <div>
              <div className="text-lg font-medium">{displayTokens(totalTokensSoldQ.data ?? BigInt(0))} tokens</div>
              <div className="text-xs text-slate-500 mt-2">Unique buyers: <span className="font-medium">{totalBuyersQ.data ?? 0}</span> • Phases: {phaseCount}</div>
              <div className="text-xs text-slate-500 mt-2">Note: tokens become claimable after the sale ends (if soft cap reached).</div>
            </div>
          )}
        </StatCard>
      </section>

      {/* Phase timeline & buy panel */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Phase timeline</h2>
          <p className="text-sm text-slate-500 mt-1">See past, active and upcoming phases with price and supply.</p>

          <div className="mt-4 space-y-3">
            {phasesListQ.isLoading ? (
              <Skeleton className="h-36 w-full" />
            ) : phasesListQ.data && phasesListQ.data.length > 0 ? (
              phasesListQ.data.map((p: Phase) => {
                const now = Math.floor(Date.now() / 1000);
                const active = now >= p.start && now <= p.end && p.sold < p.supply;
                const status = active ? 'Live' : now < p.start ? 'Upcoming' : 'Completed';
                const percentSold = p.supply > BigInt(0) ? Math.round(Number((p.sold * BigInt(100)) / p.supply)) : 0;
                return (
                  <div key={p.phaseId} className={`p-3 rounded-md border ${active ? 'border-indigo-200' : 'border-slate-100'} bg-white`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Phase {p.phaseId} • {status}</div>
                        <div className="text-xs text-slate-500">
                          Price: {formatUnits(p.priceWei, 18)} ETH • Supply: {displayTokens(p.supply)} • Sold: {displayTokens(p.sold)}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">{percentSold}%</div>
                    </div>
                    <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-300" style={{ width: `${percentSold}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500">No phases configured yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium text-slate-900">Buy tokens</h2>
              <p className="text-sm text-slate-500 mt-1">Enter ETH and see estimated tokens before confirming transaction.</p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">Your contribution</p>
              <p className="font-medium text-slate-900">{displayWeiAsEth(contributionsQ.data ?? BigInt(0))} ETH</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">ETH amount</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={ethToSend}
                onChange={(e) => setEthToSend(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-label="ETH amount"
                disabled={buying}
              />
              <div className="mt-2 text-xs text-slate-500">
                {minBuyQ.data ? <span>Min: {displayWeiAsEth(minBuyQ.data)} ETH</span> : null}
                {maxPerWalletQ.data ? <span className="ml-3">Max per wallet: {displayWeiAsEth(maxPerWalletQ.data)}</span> : null}
              </div>

              <div className="mt-3 text-sm">
                {amountWeiForCalc === null ? (
                  <div className="text-slate-500">Enter an ETH amount to estimate tokens</div>
                ) : !hasActive ? (
                  <div className="text-rose-600">No active phase — purchases are disabled</div>
                ) : calculateQuery.isFetching ? (
                  <div className="inline-flex items-center gap-2 text-slate-500"><Spinner size={12} /> Calculating…</div>
                ) : calculateQuery.isError ? (
                  <div className="text-rose-600">Unable to estimate right now</div>
                ) : calculateQuery.data ? (
                  <div className="text-slate-700">
                    <div><strong>Estimated tokens:</strong> {displayTokens(calculateQuery.data.tokens)} tokens</div>
                    <div className="text-xs text-slate-500">
                      <strong>Cost:</strong> {displayWeiAsEth(calculateQuery.data.cost)} ETH
                      {calculateQuery.data.excess > BigInt(0) ? <> — <strong>Excess:</strong> {displayWeiAsEth(calculateQuery.data.excess)} ETH</> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex mt-5">
              {/* contenedor del botón — ocupa todo el ancho de la columna */}
              <div className="w-full">
                <button
                  onClick={onBuy}
                  disabled={!clientAddress || buying || isAnyLoading || !canBuy}
                  className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 font-medium transition ${!clientAddress || buying || isAnyLoading || !canBuy ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  aria-busy={buying}
                  title={buying ? 'Processing purchase' : (!canBuy ? buyDisabledReason : 'Buy tokens')}
                >
                  {buying ? (<><Spinner size={16} /><span>Buying…</span></>) : 'Buy'}
                </button>
                <div className="mt-2 text-xs">
                  {!hasActive ? (
                    <div className="text-rose-600">No active phase — purchases disabled</div>
                  ) : remainingTokens <= BigInt(0) ? (
                    <div className="text-rose-600">No tokens remaining in current phase</div>
                  ) : (
                    <div className="text-slate-500">{connectedHint}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            <div>Gas is not included in the amount shown. Transactions are processed on-chain.</div>
            <div className="mt-1">Tip: enter a small amount to test the flow before a larger purchase.</div>
          </div>
        </div>
      </section>

      {/* Account & help */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <h3 className="text-sm text-slate-600">My account</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Contributed</div>
              <div className="font-medium text-slate-900">{displayWeiAsEth(contributionsQ.data ?? BigInt(0))} ETH</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Pending tokens</div>
              <div className="font-medium text-slate-900">{displayTokens(pendingTokensQ.data ?? BigInt(0))}</div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                className={`flex-1 rounded-md px-3 py-2 font-medium ${!clientAddress || claiming || !canClaim ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                onClick={onClaim}
                disabled={!clientAddress || claiming || !canClaim}
                aria-busy={claiming}
                title={!mounted ? 'Connect wallet to claim' : (!canClaim ? claimDisabledReason : 'Claim your tokens')}
              >
                {claiming ? (<><Spinner size={14} /> Claiming…</>) : 'Claim'}
              </button>

              <button
                className={`flex-1 rounded-md px-3 py-2 font-medium ${!clientAddress || requestingRefund || !canRequestRefund ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                onClick={onRequestRefund}
                disabled={!clientAddress || requestingRefund || !canRequestRefund}
                aria-busy={requestingRefund}
                title={!mounted ? 'Connect wallet to request refund' : (!canRequestRefund ? refundDisabledReason : 'Request a refund')}
              >
                {requestingRefund ? (<><Spinner size={14} /> Requesting…</>) : 'Request refund'}
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              <p><strong>Claim</strong>: retrieve the tokens you purchased. Available only after the sale ends and the soft cap was reached.</p>
              <p className="mt-1"><strong>Request refund</strong>: ask for your ETH back if the sale ended and the soft cap was not reached. Refunds are processed on-chain.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <h3 className="text-sm text-slate-600">Help & status</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>
              <strong className="text-slate-800">Network / status:</strong>{' '}
              {isAnyLoading ? <span className="inline-flex items-center gap-2"><Spinner size={12} /> Loading data…</span> : <span>Up-to-date</span>}
            </p>

            <p>
              <strong className="text-slate-800">What is soft cap?</strong>{' '}
              <span className="text-slate-600">Minimum ETH required for the sale to be successful. If not reached, buyers can request refunds.</span>
            </p>

            <p>
              <strong className="text-slate-800">Timer:</strong>{' '}
              <span className="text-slate-600">{hasActive ? `${countdownLabel} remaining` : 'No active phase'}</span>
            </p>

            <p className="text-xs text-slate-500">
              All actions are performed on-chain. Transactions may take time depending on network congestion.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
