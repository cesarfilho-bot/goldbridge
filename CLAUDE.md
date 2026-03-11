# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Environment Variables

Create a `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...       # server-side only, used by /api/chat
```

## Architecture

**Next.js 16 (App Router) + React 19 + Supabase + Recharts**

The entire application lives in a single large file: `app/goldbridge.jsx` (~4680 lines). `app/page.js` simply re-exports it as a client component.

### `app/goldbridge.jsx` structure (by line range)

| Range | Content |
|---|---|
| 1–95 | Theme system (`DARK_T`/`LIGHT_T`), `applyTheme()`, `getBenchmark()` |
| 96–331 | `FIPEZAP_M2` — hardcoded neighborhood price data per m² (FipeZAP/DataZAP sources) |
| 332–501 | `BENCHMARKS` per city, `NeighborhoodSearch`, `getFipeZAP()`, `buildPortfolio()`, `computePort()` |
| 502–629 | `buildInsights()`, KPI/chart helpers (`Tip`, `KPI`, `LeakageGauge`, `SevBadge`, `BenchmarkBar`) |
| 654–961 | `EditModal` — full property edit form |
| 962–1443 | `PageObras` and related obra (maintenance work) components |
| 1444–1785 | `PageValorMercado` — market value page |
| 1786–1936 | `PageDashboard` |
| 1937–2071 | `PageNOI` |
| 2072–2159 | `PageLeakage` |
| 2160–2318 | `PageDetail` |
| 2319–2426 | `PageDecision` / `PageDecisionDetail` |
| 2427–2458 | `PageReport` |
| 2459–2694 | `PageIA` — AI assistant (calls `/api/chat`) |
| 2695–2770 | `Login` component (Supabase email auth) |
| 2771–3141 | `PagePagamentos` — payment tracking |
| 3142–3281 | `PageLocatarios` — tenant management |
| 3282–3532 | `PageFluxoCaixa` — cash flow |
| 3533–3668 | `PageHistorico` — property event history |
| 3669–4238 | `AddImovelModal`, `CancelarContratoModal`, `DeleteConfirmModal` |
| 4239–4390 | `calcIR()`, `autoHistorico()`, `recalcProp()` — core computation functions |
| 4391–end | `App()` — root component: auth, navigation, all Supabase CRUD |

### Key patterns

**Theme**: Global mutable object `T` is reassigned via `Object.assign(T, DARK_T | LIGHT_T)` on every render, then CSS variables are set via `applyTheme()`. Theme persists in `localStorage` as `"gb_theme"` (`"light"` or `"dark"`).

**Navigation**: `page` string state in `App()` determines which `Page*` component renders. No router. Pages: `"dashboard"`, `"noi"`, `"leakage"`, `"detail"`, `"decision"`, `"report"`, `"ia"`, `"pagamentos"`, `"locatarios"`, `"fluxo"`, `"historico"`, `"obras"`, `"valormercado"`.

**State flow**: All state lives in `App()`. Pages receive `PROPS` (the array of property objects) and callbacks. No external state library.

**Data persistence**: Supabase tables `portfolios` and `imoveis`. Always uses the oldest portfolio for each user. `toDB()` maps camelCase JS fields to snake_case DB columns. `recalcProp()` re-derives computed fields (NOI, cap rate, etc.) from raw data + benchmarks on every load/save.

**`autoHistorico()`**: Called on every save — compares old and new property state to automatically append changelog entries to `prop.historico[]`.

**AI page**: `PageIA` sends chat messages to `/api/chat/route.js`, which proxies to Anthropic's API using `claude-sonnet-4-20250514`.

### Supabase schema (inferred from `toDB()`)

`imoveis` table columns include: `portfolio_id`, `user_id`, `name`, `address`, `neighborhood`, `city`, `type`, `status`, `size`, `rent`, `iptu`, `maint_monthly`, `insurance`, `admin`, `admin_pct`, `vacancy_days`, `has_condominio`, `condo_fee`, `condo_pago_por`, `fundo_reserva`, `chamada_extra`, `chamada_extra_parcelas`, `chamada_extra_parcela_atual`, `desconto_aluguel`, `contrato_anos`, `contrato_inicio`, `market_value_manual`, `valor_mercado`, `valor_compra`, `ano_compra`, `obras`, `prestadores`, `pagamentos`, `monthly_data`, `dia_vencimento`, `regime_fiscal`, `indice_reajuste`, `iptu_vencimento`, `iptu_parcelas`, `avaliacoes`, `documentos`, `via_imobiliaria`, `locatario_nome`, `locatario_cpf`, `locatario_telefone`, `locatario_email`, `locatario_garantia`, `locatarios`, `historico`.

`portfolios` table: `id`, `user_id`, `name`, `created_at`.
