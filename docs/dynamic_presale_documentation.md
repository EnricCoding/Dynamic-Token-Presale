# Dynamic Token Presale — Documentación del Proyecto

> Documentación completa para desarrollo, pruebas, despliegue y demo del proyecto **Dynamic Presale** — preparado como proyecto portfolio‑grade.

---

## Índice

1. Resumen ejecutivo
2. Stack tecnológico
3. Arquitectura general
4. Requisitos y presets (valores de ejemplo)
5. Diseño de contratos (resumen)
6. Estructura del monorepo (workspaces)
7. Guía de instalación y desarrollo local (paso a paso)
8. Tests y calidad (estrategia)
9. Subgraph — esquema y handlers
10. Frontend — componentes clave y flujo UX
11. CI / CD (GitHub Actions)
12. Seguridad y checklist pre‑mainnet
13. Roadmap y entregables por versión
14. Suposiciones tomadas
15. Notas finales y contactos

---

# 1. Resumen ejecutivo

Este repositorio implementa una **preventa de tokens dinámica** (presale) pensada como proyecto profesional para portfolio. El objetivo es ofrecer una solución completa: contratos seguros en Solidity, pruebas exhaustivas, indexación con The Graph, frontend con experiencia de wallet fluida y pipeline CI para despliegues en testnet (Sepolia) y, con adaptaciones, a mainnet.

El flujo principal del producto:

- Fases configurables (precio por fase y/o por tiempo).
- Usuarios conectan wallet, ven precio y supply restante, compran tokens (`buy()` payable).
- Al finalizar la venta: si se alcanza `softCap` → `claim()` (lazy mint o asignación); si no → `requestRefund()` vía pull payments.
- Indexado por The Graph para métricas (total raised, buyers, tokens por fase) y dashboard.


# 2. Stack tecnológico

- **Contratos / Dev**: Solidity `^0.8.20`, Hardhat (TypeScript), `hardhat-deploy`, OpenZeppelin Contracts `^5.4.0`.
- **Testing & QA**: Hardhat tests (Mocha/Chai), `solidity-coverage`, `hardhat-gas-reporter`. Fuzzing: Foundry (opcional).
- **Indexación**: The Graph CLI `^0.97.1`, `@graphprotocol/graph-ts`.
- **Frontend (dApp)**: Next.js 15 (App Router), React 19, Wagmi `^2.16.1`, Viem `^2.33.x`, RainbowKit, TailwindCSS, shadcn/ui, Recharts.
- **Infra/Deploy**: Sepolia testnet, Vercel (frontend), Graph Studio (subgraph), Pinata/IPFS (opcional para metadata).
- **CI/CD**: GitHub Actions (lint, tests, coverage, slither (opcional), deploy, verify).


# 3. Arquitectura general

```
Frontend (Next.js)    <---  (read contract + subgraph) --->  Smart Contract (DynamicPresale)
  - Wallet Connect (RainbowKit)                              - buy(), claim(), refund(), phases
  - Dashboard (phase, price, progress)                        - PullPayment pattern for refunds
  - Calls via Wagmi + Viem                                   - Events: Purchased, Claimed, RefundRequested
                                                                |
                                                                v
                                                      The Graph (Subgraph)
                                                       - index events
                                                       - expose metrics for dashboard
```

Componentes principales:

- `MyToken.sol` (ERC20 mintable for demo)
- `DynamicPresale.sol` (core presale logic)
- `TokenVesting.sol` (simple vesting contract; opcional)
- `subgraph/` (schema + mappings)
- `frontend/` (Next.js app)


# 4. Requisitos y presets (valores ejemplo)

> Estos valores son ejemplos para pruebas y demo. Ajustar para producción.

- Token total supply (demo): `100_000_000 * 10**18`
- Tokens en venta: `300_000 * 10**18` (3 fases x 100k cada una)
- Fases (ejemplo):
  - Phase 0: 100k tokens, precio `0.0005 ETH / token`
  - Phase 1: 100k tokens, precio `0.0010 ETH / token`
  - Phase 2: 100k tokens, precio `0.0020 ETH / token`
- SoftCap: `10 ETH` (demo)
- Min buy: `0.01 ETH` (`10**16 wei`)
- Max per wallet (demo): `20 ETH` (configurable)
- Vesting (opcional): 20% TGE, resto linear en 180 días


# 5. Diseño de contratos (resumen)

**DynamicPresale.sol** — responsabilidades:

- Gestionar fases (struct Phase: price, supply, sold, start, end).
- Permitir `buy()` payable: calcula tokens comprables, asigna `pendingTokens`, contabiliza ETH aportado y maneja exceso con `_asyncTransfer` (PullPayment).
- `claim()`: lazy mint al comprador (requiere que el token tenga `mint()` y que el presale sea authorized owner / minter).
- `requestRefund()`: solo si la venta terminó y `softCap` no alcanzado; usa PullPayment.
- `withdrawProceeds(address)`: owner/multisig recoge fondos si softCap alcanzado y venta finalizada.
- Seguridad: `ReentrancyGuard`, `Pausable`, CEI, eventos exhaustivos.

**MyToken.sol** (demo): ERC20 mintable, `mint()` administrable por owner (en producción usar MINTER_ROLE u Ownable + roles).

**TokenVesting.sol**: contrato simple que mantiene schedules y permite `release()` según calendario.

**Eventos clave**:

- `Purchased(address indexed buyer, uint256 indexed phaseId, uint256 ethAmount, uint256 tokensAmount)`
- `Claimed(address indexed buyer, uint256 tokensAmount)`
- `RefundRequested(address indexed buyer, uint256 ethAmount)`
- `PhaseAdded(...)`, `SoftCapReached(...)`, `Withdrawn(...)`

**Notas de diseño**:

- Trabajar siempre en unidades "base" del token (incluir `decimals`) para evitar truncamiento.
- Evitar arrays on-chain de buyers; usar eventos y subgraph para listados y agregación.
- Usar `immutable` para addresses/constants donde aplique.


# 6. Estructura del monorepo (workspaces)

```
dynamic-presale/
├─ package.json (root, pnpm workspaces)
├─ packages/
│  ├─ contracts/    # Hardhat, contracts, tests, deploy scripts
│  ├─ subgraph/     # The Graph: schema, mappings, abis
│  ├─ frontend/     # Next.js app (App Router)
│  └─ tools/        # scripts compartidos (export ABIs, utils)
└─ .github/workflows/
```

Cada paquete tiene su propio `package.json` con scripts (`build`, `test`, `lint`, `deploy:sepolia`, etc.).


# 7. Guía de instalación y desarrollo local (paso a paso)

> Asume entorno UNIX (Mac/Linux/WSL). Usa `pnpm` como package manager (recomendado) — puedes usar `npm`/`yarn` adaptando comandos.

## 7.1 Clonar & bootstrap

```bash
git clone <repo> dynamic-presale
cd dynamic-presale
# si usas pnpm
pnpm -w install
```

## 7.2 Configurar variables de entorno

Copia `.env.example` a `.env` dentro de `packages/contracts` y a `packages/frontend/.env.local` según necesites.

Ejemplo `.env` (packages/contracts):

```
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
DEPLOYER_PRIVATE_KEY=0xYOURKEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

## 7.3 Compilar contratos

```bash
cd packages/contracts
pnpm run compile
```

## 7.4 Ejecutar tests

```bash
pnpm --filter @dynamic-presale/contracts test
# o desde root
pnpm -w test
```

## 7.5 Levantar nodo local (Hardhat node) y deploy local

En una terminal:

```bash
pnpm --filter @dynamic-presale/contracts run node
```

En otra terminal:

```bash
pnpm --filter @dynamic-presale/contracts run deploy:local
```

## 7.6 Deploy en Sepolia (ejecutar después de poner .env con SEPOLIA_RPC y DEPLOYER_PRIVATE_KEY)

```bash
pnpm --filter @dynamic-presale/contracts run deploy:sepolia
pnpm --filter @dynamic-presale/contracts run verify
```

> Nota: `verify` usa ETHERSCAN_API_KEY.


# 8. Tests y calidad (estrategia completa)

**Tipos de pruebas**:

- Unitarios (Hardhat + Mocha/Chai): cobertura de happy path y edge cases (comprar, exceso, agotamiento, rounding, claim, refund).
- Integration: flujos end‑to‑end (múltiples compradores, finalizar venta y reclamar/refund). Usar `evm_increaseTime` para simular tiempos si se configuran fases por tiempo.
- Fuzzing / Property testing: Foundry (recomendado) para invariants: `totalRaised == sum contributions`, `tokensSold <= supply`, `no double claim`.
- Static analysis: Slither (docker) y MythX / Sonar (opcional).
- Coverage: `solidity-coverage` y target > 85% en core logic.
- Gas reporting: `hardhat-gas-reporter` para medir `buy`, `claim`, `withdraw`.

**Pruebas recomendadas a escribir**:

- `buy()` mínimo (0.01 ETH) y máximo por wallet.
- `buy()` que agota parte de la fase y deja exceso (que quede en PullPayment escrow).
- `claim()` sólo si `saleEnded()` y `softCap` alcanzado.
- `requestRefund()` solo si `saleEnded()` y `softCap` no alcanzado.
- `withdrawProceeds()` sólo owner y solo si condiciones cumplidas.
- `pause()`/`unpause()` cases and reentrancy attack attempt.


# 9. Subgraph — esquema y handlers

**schema.graphql** (sugerido):

```graphql
type Purchase @entity { id: ID!, buyer: Bytes!, phaseId: Int!, ethAmount: BigInt!, tokensAmount: BigInt!, txHash: Bytes!, timestamp: BigInt! }
type Claim @entity { id: ID!, buyer: Bytes!, tokensAmount: BigInt!, txHash: Bytes!, timestamp: BigInt! }
type Refund @entity { id: ID!, buyer: Bytes!, ethAmount: BigInt!, txHash: Bytes!, timestamp: BigInt! }
type Stats @entity { id: ID!, totalRaised: BigInt!, totalBuyers: Int!, totalTokensSold: BigInt! }
```

**Mappings (handlers)**: generar `handlePurchased`, `handleClaimed`, `handleRefundRequested` que:

- creen entidades `Purchase/Claim/Refund` con `id = txHash-logIndex`.
- actualicen `Stats` agregadas (totalRaised, totalBuyers contador único por buyer, totalTokensSold).

**Despliegue**:

- Generar ABIs y adaptar `subgraph.yaml` con la dirección del contrato desplegado en Sepolia.
- Deploy a Graph Studio o indexer propio (si aplica).


# 10. Frontend — componentes clave y flujo UX

**Páginas / componentes principales**:

- `Landing` — CTA Connect Wallet.
- `DashboardPresale` — `PhaseCard`, `ProgressBar`, `BuyForm`, `MetricsPanel` (subgraph).
- `BuyModal` — muestra estimate tokens, gas estimate, boton buy; muestra tx hash con enlace Etherscan.
- `MyContributions` — muestra `contributionsWei`, `pendingTokens`, vesting schedule y botones `Claim`/`Refund`.
- `AdminPanel` — accesible al owner: `addPhase`, `pause/unpause`, `withdraw`.

**Hooks**:

- `usePresale` — lee `getCurrentPhase()` on-chain (Viem), refresca periódicamente (15s), expone `buy()`, `claim()`, `requestRefund()`.
- `useOnchainFallback` — si subgraph está atrasado, fallback to on-chain reads.

**UX Considerations**:

- Mostrar slippage warning: price may change between read and tx; provide `minTokensExpected` parameter pattern if needed.
- Mostrar Etherscan link para cada tx (hash) y toasts con estado.
- Accessibility: botones grandes, tooltips explicativos.


# 11. CI / CD (GitHub Actions)

**Pipelines sugeridos**:

- `ci.yml`: checkout → pnpm install → contracts tests → frontend build → subgraph codegen (optional) → report coverage.
- `deploy.yml` (manual trigger or on tag): deploy contracts (sepolia/mainnet) → verify (etherscan) → run subgraph deploy → build and deploy frontend to Vercel.

**Tips**:

- Guarda addresses y ABIs como artifacts en el job `contracts:deploy` para que `frontend` y `subgraph` los consuman.
- Uso de Secrets: `SEPOLIA_RPC`, `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `GRAPH_ACCESS_TOKEN`, `VERCEL_TOKEN`.


# 12. Seguridad y checklist pre‑mainnet

Antes de cualquier despliegue a mainnet:

- Sustituir `owner` por un **Gnosis Safe multisig** (>= 2/3).
- Ejecutar Slither y corregir findings.
- Fuzzing/Foundry: probar invariantes a escala.
- Cobertura: `solidity-coverage` > 85% en la lógica central.
- Auditoría externa (o bug bounty) si hay fondos reales en juego.
- Pruebas de integración en fork mainnet (si se usa oráculos/third-parties).
- Documentar gobernanza y procedimientos de emergencia (pausar, rescate, revoke).


# 13. Roadmap y entregables por versión

**v1 (MVP / Portfolio)**
- Contratos: DynamicPresale + MyToken.
- Tests unitarios (hardhat) + coverage.
- Frontend MVP (buy + claim/refund + Etherscan links).
- Deploy en Sepolia + README y demo screenshots.

**v2 (Profesional)**
- Subgraph indexando eventos y dashboard con métricas.
- Vesting integrado para compradores.
- CI con lint/tests/coverage and gas checks.
- Admin panel + multisig recommended workflow documentation.

**v3 (Outstanding)**
- Fuzzing (Foundry), Slither + external audit summary.
- Oráculo (Chainlink) para precio fiat → ETH.
- Swap integration (Uniswap) to convert raises to stable.
- Bug bounty and monitoring (Tenderly/Alchemy alerts).


# 14. Suposiciones tomadas

Estas decisiones se adoptaron para avanzar con un diseño coherente y orientado a portfolio:

- Precio por fase (tabla); no fórmula continua.
- Lazy mint en `claim()` (token debe exponer `mint()`); alternativa: pre‑mint + custodio.
- V1 acepta **solo ETH**; USDC o multi‑asset pueden añadirse en V2.
- `minBuy` = `0.01 ETH` por defecto.
- `softCap` configurable en deploy; ejemplo en tests = `10 ETH`.
- Beneficiary / withdraw por defecto al `owner` del contrato (debe sustituirse por multisig en producción).

Si prefieres cambiar cualquiera de estas suposiciones antes de la implementación, edítalas en el README o indica el cambio y se actualizará el código.


# 15. Notas finales y contacto

Este documento es la guía exhaustiva para desarrollar la presale como proyecto real. En este repo encontrarás: contratos, tests, deploy scripts, subgraph schema, mappings y frontend skeleton.

Si quieres que genere ahora mismo alguno de los artefactos (ej.: tests completos, deploy scripts, subgraph mappings o frontend components) indícalo y lo produzco en el siguiente mensaje.

---

**Licencia**: MIT (por defecto para proyectos de portfolio). Cambia según necesites.

*Generado por el equipo de desarrollo — listo para copiar/pegar en un archivo `Dynamic-Presale-Documentation.md`.*

