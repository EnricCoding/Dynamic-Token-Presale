// packages/frontend/lib/wagmi.ts
/**
 * wagmi bootstrap compatible con wagmi v2.x + rainbowkit v2.x
 *
 * - Declara `chains` como tupla `readonly [Chain, ...Chain[]]` para cumplir la firma de createConfig.
 * - Usa Viem `http` transport y lo expone en `transports`.
 * - Conectores mínimos: injected + walletConnect (opcional si proporcionas WC_PROJECT_ID).
 *
 * Variables de entorno:
 * - NEXT_PUBLIC_SEPOLIA_RPC (recomendado) o SEPOLIA_RPC
 * - NEXT_PUBLIC_WC_PROJECT_ID (opcional, para WalletConnect v2)
 */

import { createConfig } from "wagmi";
import { http } from "viem";
import { sepolia } from "viem/chains";
import type { Chain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";

const RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? process.env.SEPOLIA_RPC ?? "";
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

export const chains: readonly [Chain, ...Chain[]] = [sepolia];

const transports = {
  [sepolia.id]: http(RPC_URL || "https://rpc.ankr.com/eth_sepolia"),
};

const connectors = [
  injected(),
  ...(WC_PROJECT_ID ? [walletConnect({ projectId: WC_PROJECT_ID })] : []),
];

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports,
});
