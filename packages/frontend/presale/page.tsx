// packages/frontend/app/presale/page.tsx
import React from "react";

export default function PresalePage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Presale Dashboard</h2>
      <p className="mb-6 text-slate-600">
        This is the presale dashboard placeholder. Next: integrate subgraph queries and on-chain reads.
      </p>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Current Phase</h3>
          <div className="text-sm text-slate-500">No phase loaded yet.</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Metrics</h3>
          <div className="text-sm text-slate-500">Total raised, buyers and tokens sold (from subgraph).</div>
        </div>
      </section>
    </div>
  );
}
