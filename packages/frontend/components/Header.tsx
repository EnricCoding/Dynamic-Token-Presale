import React from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Header() {
  return (
    <header className="bg-white border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold">
            Dynamic Presale
          </Link>
          <nav className="hidden md:flex gap-4 ml-6 text-sm text-slate-600">
            <Link href="/presale">Presale</Link>
            <Link href="/vesting">Vesting</Link>
            <a href="https://thegraph.com/studio/subgraph/dynamic-presale-subgraph/" target="_blank" rel="noreferrer">Subgraph</a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ConnectButton showBalance={false} />
        </div>
      </div>
    </header>
  );
}
