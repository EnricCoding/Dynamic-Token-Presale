import Link from "next/dist/client/link";

export default function Home() {
  return (
    <div className="py-12">
      <h1 className="text-4xl font-bold mb-4">Dynamic Presale — Demo</h1>
      <p className="text-slate-700 mb-6">
        Welcome to the Dynamic Token Presale demo. Connect your wallet and go to the Presale dashboard to participate.
      </p>

      <div className="flex gap-4">
        <Link href="/presale" className="px-6 py-3 bg-indigo-600 text-white rounded-md">Open Presale Dashboard</Link>
        <Link href="/admin" className="px-6 py-3 border rounded-md">Admin (owner)</Link>
      </div>
    </div>
  );
}
