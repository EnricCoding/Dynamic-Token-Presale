'use client';

import React, { JSX, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV_LINKS = [
  { href: "/presale", label: "Presale" },
  { href: "/vesting", label: "Vesting" },
];

export default function Header(): JSX.Element {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-white/60 backdrop-blur-sm border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 no-underline"
            aria-label="Home — Dynamic Presale"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                className="w-6 h-6"
                aria-hidden
              >
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
              </svg>
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold text-slate-900">
                Dynamic Presale
              </span>
              <span className="text-xs text-slate-500">Token sale demo</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 ml-6">
            {NAV_LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm px-3 py-2 rounded-md transition-colors ${active
                      ? "bg-slate-100 text-slate-900 font-medium shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                  {l.label}
                </Link>
              );
            })}

            <a
              href="https://thegraph.com/studio/subgraph/dynamic-presale-subgraph/"
              target="_blank"
              rel="noreferrer"
              className="text-sm px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              Subgraph
            </a>
          </nav>
        </div>

        {/* Right: connect & mobile menu */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <div className="rounded-xl px-2 py-1">
              <ConnectButton showBalance={false} />
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {open ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        className={`md:hidden transition-[max-height,opacity] duration-200 ease-out overflow-hidden ${open ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
          }`}
        aria-hidden={!open}
      >
        <div className="px-4 pb-4 space-y-2">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block text-sm px-3 py-2 rounded-md transition-colors ${active
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                  }`}
              >
                {l.label}
              </Link>
            );
          })}

          <a
            href="https://thegraph.com/studio/subgraph/dynamic-presale-subgraph/"
            target="_blank"
            rel="noreferrer"
            className="block text-sm px-3 py-2 rounded-md text-slate-700 hover:bg-slate-50"
          >
            Subgraph
          </a>

          <div className="pt-2">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>
    </header>
  );
}
