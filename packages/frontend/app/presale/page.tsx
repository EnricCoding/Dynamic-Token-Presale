// packages/frontend/app/presale/page.tsx
'use client';

import React, { JSX, useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { usePresaleRead } from '@/app/hooks/usePresaleRead';
import { usePresaleMutations } from '@/app/hooks/usePresaleMutation';
import { Skeleton, Spinner } from '../components/ui';
import type { Phase, CalcResult } from '@/app/types/presale.type';

/* ---------- Helpers ---------- */

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

/* ---------- Component ---------- */

export default function PresaleDashboard(): JSX.Element {
  // mounted guard to prevent SSR reads
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const clientAddress = mounted ? (address ?? null) : null;

  // read-only contract helpers (client-only)
  const presale = usePresaleRead();

  // react-query client
  const qc = useQueryClient();

  // mutations
  const { buyMutation, claimMutation, requestRefundMutation } = usePresaleMutations();

  /* ---------- Queries (useQuery v5: single options object with generics) ---------- */

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

  // calculate tokens for an entered amount
  const [ethToSend, setEthToSend] = useState<string>('0.01');
  const amountWeiForCalc = useMemo<bigint | null>(() => {
    if (!mounted) return null;
    const n = Number(ethToSend);
    if (!Number.isFinite(n) || n <= 0) return null;
    return BigInt(Math.floor(n * 1e18));
  }, [mounted, ethToSend]);

  const calculateQ = useQuery<CalcResult, Error>({
    queryKey: ['presale', 'calculate', amountWeiForCalc?.toString() ?? 'null'],
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

  /* ---------- Light logs for debugging (non noisy) ---------- */
  useEffect(() => {
    if (totalRaisedQ.data !== undefined && totalRaisedQ.data !== null) {
      console.info('[PresaleDashboard] totalRaised:', totalRaisedQ.data.toString());
    }
  }, [totalRaisedQ.data]);

  useEffect(() => {
    if (phasesListQ.data) console.info('[PresaleDashboard] phases loaded:', phasesListQ.data.length);
  }, [phasesListQ.data]);

  /* ---------- UI helpers ---------- */

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

  const displayBigInt = (v?: bigint | null): string => {
    if (!v) return '0';
    try {
      return formatBigIntWithCommas(v.toString());
    } catch {
      return v.toString();
    }
  };

  /* ---------- Actions (mutations) ---------- */

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
      await requestRefundMutation.mutateAsync();
      qc.invalidateQueries({ queryKey: ['presale'] });
      alert('Refund request submitted.');
    } catch (err) {
      console.error('request refund failed', err);
      alert('Request refund failed — see console for details');
    }
  }

  /* ---------- Derived UI state ---------- */

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

  const [countdownLabel] = secsLeft == null ? ['—'] : formatTimeLeft(secsLeft);

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

  /* ---------- Render ---------- */

  function StatCard({ title, loading, children }: { title: string; loading?: boolean; children: React.ReactNode }) {
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight text-slate-900">Presale Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Participate in the Dynamic Token Presale — price and supply change per phase. Connect your wallet to buy, claim or request refunds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ConnectButton showBalance={false} />
        </div>
      </header>

      {/* Top summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total raised" loading={totalRaisedQ.isFetching}>
          {totalRaisedQ.isLoading ? <Skeleton className="h-8 w-32" /> : `${displayWeiAsEth(totalRaised)} ETH`}
        </StatCard>

        <StatCard title="Soft cap" loading={softCapQ.isFetching}>
          {softCapQ.isLoading ? (
            <Skeleton className="h-8 w-36" />
          ) : softCap ? (
            <div>
              <div>{displayWeiAsEth(softCap)} ETH</div>
              <div className="text-xs text-slate-500">
                Progress: {softCap > BigInt(0) ? `${Math.round(Number((totalRaised * BigInt(100)) / softCap))}%` : '—'}
                {softCapReached ? ' • Soft cap reached' : ''}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">No soft cap configured</div>
          )}
        </StatCard>

        <StatCard title="Current phase" loading={currentPhaseIndexQ.isFetching || phasesListQ.isFetching}>
          {currentPhase ? (
            <div>
              <div>Phase {currentPhase.phaseId}</div>
              <div className="text-xs text-slate-500">Price: {currentPhasePriceEth} ETH</div>
              <div className="text-xs text-slate-500">Ends in: {countdownLabel}</div>
              <div className="mt-1 text-xs text-slate-500">Remaining: {displayBigInt(remainingTokensQ.data ?? BigInt(0))}</div>
            </div>
          ) : currentPhaseIndex === null ? (
            <div className="text-xs text-slate-500">No active phase</div>
          ) : (
            <Skeleton className="h-8 w-36" />
          )}
        </StatCard>

        <StatCard title="Total buyers & sold" loading={totalTokensSoldQ.isFetching || phasesListQ.isFetching}>
          {totalTokensSoldQ.isLoading ? (
            <Skeleton className="h-8 w-36" />
          ) : (
            <div>
              <div>{displayBigInt(totalTokensSoldQ.data ?? BigInt(0))} tokens</div>
              <div className="text-xs text-slate-500">Phases configured: {phaseCount}</div>
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
                        <div className="text-xs text-slate-500">Price: {formatUnits(p.priceWei, 18)} ETH • Supply: {displayBigInt(p.supply)} • Sold: {displayBigInt(p.sold)}</div>
                      </div>
                      <div className="text-xs text-slate-500">{percentSold}%</div>
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

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
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
                {mounted && amountWeiForCalc === null ? (
                  <div className="text-slate-500">Enter an ETH amount to estimate tokens</div>
                ) : calculateQ.isFetching ? (
                  <div className="inline-flex items-center gap-2 text-slate-500"><Spinner size={12} /> Calculating…</div>
                ) : calculateQ.isError ? (
                  <div className="text-rose-600">Unable to estimate right now</div>
                ) : calculateQ.data ? (
                  <div className="text-slate-700">
                    <div><strong>Estimated tokens:</strong> {displayBigInt(calculateQ.data.tokens)} tokens</div>
                    <div className="text-xs text-slate-500">
                      <strong>Cost:</strong> {displayWeiAsEth(calculateQ.data.cost)} ETH
                      {calculateQ.data.excess > BigInt(0) ? <> — <strong>Excess:</strong> {displayWeiAsEth(calculateQ.data.excess)} ETH</> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <button
                onClick={onBuy}
                disabled={!clientAddress || buying || isAnyLoading}
                className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 font-medium transition ${!clientAddress || buying || isAnyLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                aria-busy={buying}
                title={buying ? 'Processing purchase' : 'Buy tokens'}
              >
                {buying ? (<><Spinner size={16} /><span>Buying…</span></>) : 'Buy'}
              </button>
              <div className="mt-2 text-xs text-slate-500">{connectedHint}</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            <div>Gas is not included in the amount shown. Transactions are processed on-chain.</div>
            <div className="mt-1">Tip: enter a small amount to test the flow before a larger purchase.</div>
          </div>
        </div>
      </section>

      {/* My account & help */}
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
              <div className="font-medium text-slate-900">{displayBigInt(pendingTokensQ.data ?? BigInt(0))}</div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                className={`flex-1 rounded-md px-3 py-2 font-medium ${!clientAddress || claiming ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                onClick={onClaim}
                disabled={!clientAddress || claiming}
                aria-busy={claiming}
                title={!mounted ? 'Connect wallet to claim' : !clientAddress ? 'Connect wallet to claim' : 'Claim your tokens'}
              >
                {claiming ? (<><Spinner size={14} /> Claiming…</>) : 'Claim'}
              </button>

              <button
                className={`flex-1 rounded-md px-3 py-2 font-medium ${!clientAddress || requestingRefund ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                onClick={onRequestRefund}
                disabled={!clientAddress || requestingRefund}
                aria-busy={requestingRefund}
                title={!mounted ? 'Connect wallet to request refund' : !clientAddress ? 'Connect wallet to request refund' : 'Request a refund'}
              >
                {requestingRefund ? (<><Spinner size={14} /> Requesting…</>) : 'Request refund'}
              </button>
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
              <strong className="text-slate-800">Next steps:</strong>{' '}
              Connect wallet → Buy tokens → Claim after sale ends.
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
