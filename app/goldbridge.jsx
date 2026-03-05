import { useState, useMemo, useRef, useEffect } from "react";
import {
  Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie,
} from "recharts";

const T = {
  bg: "#08090D", s0: "#0E1018", s1: "#141720", s2: "#1C2030", s3: "#232840",
  border: "#1E2235", borderMid: "#2A3050", gold: "#C8A84B", goldBright: "#E5C96A",
  goldDim: "#6B5A28", goldGlow: "#C8A84B33", text: "#EDF0F8", muted: "#7A82A0",
  dim: "#404868", green: "#2ECC9A", greenDim: "#1A7A5C", red: "#E85565",
  redDim: "#7A2230", amber: "#F5A623", amberDim: "#7A5212", blue: "#4A8CF5",
  blueDim: "#1E3D7A", teal: "#2EC4B6",
};

const BENCHMARKS = {
  "São Paulo": {
    Residencial: { iptu_m2: 18, vacancy_days: 32, maintenance_annual_m2: 45, cap_rate: 0.055 },
    Comercial:   { iptu_m2: 28, vacancy_days: 48, maintenance_annual_m2: 65, cap_rate: 0.072 },
  },
  "Campinas": {
    Residencial: { iptu_m2: 12, vacancy_days: 28, maintenance_annual_m2: 38, cap_rate: 0.062 },
    Comercial:   { iptu_m2: 20, vacancy_days: 42, maintenance_annual_m2: 52, cap_rate: 0.078 },
  },
  "Santo André": {
    Residencial: { iptu_m2: 10, vacancy_days: 35, maintenance_annual_m2: 35, cap_rate: 0.065 },
    Comercial:   { iptu_m2: 16, vacancy_days: 52, maintenance_annual_m2: 48, cap_rate: 0.082 },
  },
  "Americana": {
    Residencial: { iptu_m2: 8, vacancy_days: 30, maintenance_annual_m2: 32, cap_rate: 0.068 },
    Comercial:   { iptu_m2: 14, vacancy_days: 45, maintenance_annual_m2: 45, cap_rate: 0.085 },
  },
};

// ─── FIPEZAP M²/BAIRRO ────────────────────────────────────────────────────────
// Fonte: FipeZAP dez/2025 (residencial venda) + DataZAP SP 2025
// Valorização acumulada SP 12m: +4,56% (FipeZAP dez/2025)
// Média SP residencial: R$11.915/m² (FipeZAP fev/2026)
const FIPEZAP_M2 = {
  "Itaim Bibi":         { res: 19468, com: 14500, var12m: 0.059, fonte: "FipeZAP dez/2025" },
  "Pinheiros":          { res: 18355, com: 13800, var12m: 0.027, fonte: "FipeZAP dez/2025" },
  "Jardins":            { res: 17208, com: 13000, var12m: 0.065, fonte: "FipeZAP dez/2025" },
  "Cerqueira César":    { res: 16800, com: 12500, var12m: 0.060, fonte: "FipeZAP dez/2025" },
  "Jardim Paulista":    { res: 16500, com: 12200, var12m: 0.058, fonte: "FipeZAP dez/2025" },
  "Jardim América":     { res: 16200, com: 12000, var12m: 0.055, fonte: "DataZAP 2025" },
  "Jardim Europa":      { res: 25000, com: 18000, var12m: 0.062, fonte: "DataZAP 2025" },
  "Moema":              { res: 15954, com: 11800, var12m: 0.036, fonte: "FipeZAP dez/2025" },
  "Vila Mariana":       { res: 14906, com: 11000, var12m: 0.035, fonte: "FipeZAP dez/2025" },
  "Paraíso":            { res: 14247, com: 10500, var12m: 0.099, fonte: "FipeZAP dez/2025" },
  "Perdizes":           { res: 13152, com: 9800,  var12m: 0.065, fonte: "FipeZAP dez/2025" },
  "Bela Vista":         { res: 12403, com: 9200,  var12m: 0.038, fonte: "FipeZAP dez/2025" },
  "Consolação":         { res: 12800, com: 9500,  var12m: 0.042, fonte: "DataZAP 2025" },
  "Vila Olímpia":       { res: 18859, com: 14000, var12m: 0.071, fonte: "DataZAP 2025" },
  "Vila Nova Conceição":{ res: 27200, com: 20000, var12m: 0.068, fonte: "DataZAP 2025" },
  "Vila Madalena":      { res: 15800, com: 11500, var12m: 0.170, fonte: "QuintoAndar Q2/2025" },
  "Alto de Pinheiros":  { res: 12984, com: 9500,  var12m: 0.045, fonte: "FipeZAP 2025" },
  "Higienópolis":       { res: 15000, com: 11000, var12m: 0.050, fonte: "FipeZAP 2025" },
  "Morumbi":            { res: 11500, com: 8500,  var12m: 0.038, fonte: "DataZAP 2025" },
  "Campo Belo":         { res: 9880,  com: 7500,  var12m: 0.035, fonte: "QuintoAndar Q2/2025" },
  "Brooklin":           { res: 10500, com: 8000,  var12m: 0.040, fonte: "DataZAP 2025" },
  "Santana":            { res: 8875,  com: 6500,  var12m: 0.042, fonte: "FipeZAP dez/2025" },
  "Vila Andrade":       { res: 8338,  com: 6200,  var12m: 0.026, fonte: "FipeZAP dez/2025" },
  "Cambuí":             { res: 9200,  com: 7000,  var12m: 0.045, fonte: "DataZAP Campinas 2025" },
  "Nova Campinas":      { res: 8500,  com: 6500,  var12m: 0.042, fonte: "DataZAP Campinas 2025" },
  "Centro":             { res: 6500,  com: 5000,  var12m: 0.030, fonte: "DataZAP 2025" },
  "Vila Guiomar":       { res: 5800,  com: 4500,  var12m: 0.028, fonte: "DataZAP Santo André 2025" },
  "_default_São Paulo":    { res: 11915, com: 8800, var12m: 0.0456, fonte: "FipeZAP média SP fev/2026" },
  "_default_Campinas":     { res: 7500,  com: 5500, var12m: 0.038,  fonte: "FipeZAP Campinas 2025" },
  "_default_Santo André":  { res: 6000,  com: 4500, var12m: 0.025,  fonte: "FipeZAP Santo André 2025" },
  // ── AMERICANA ─────────────────────────────────────────────────────────────
  // Fonte: ZAP Imóveis, VivaReal, Camerro Imóveis, A Fortaleza Imóveis — dez/2025
  // Média geral Americana residencial: ~R$4.400/m² (AgentImóvel dez/2025)
  "Jardim São Paulo":           { res: 5800, com: 4200, var12m: 0.035, fonte: "ZAP/VivaReal Americana 2025" },
  "Jardim Terramérica I":       { res: 5200, com: 3800, var12m: 0.032, fonte: "ZAP/VivaReal Americana 2025" },
  "Jardim Terramérica II":      { res: 5000, com: 3600, var12m: 0.030, fonte: "ZAP/VivaReal Americana 2025" },
  "Terramérica":                { res: 5500, com: 4000, var12m: 0.036, fonte: "ZAP/VivaReal Americana 2025" },
  "Vila Mathiesen":             { res: 4800, com: 3500, var12m: 0.028, fonte: "ZAP/VivaReal Americana 2025" },
  "Vila Jones":                 { res: 4200, com: 3000, var12m: 0.025, fonte: "ZAP/VivaReal Americana 2025" },
  "Vila Galo":                  { res: 3800, com: 2800, var12m: 0.022, fonte: "ZAP/VivaReal Americana 2025" },
  "Jardim Brasil":              { res: 4500, com: 3300, var12m: 0.028, fonte: "ZAP/VivaReal Americana 2025" },
  "Jardim da Paz":              { res: 3600, com: 2600, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Jardim Recanto":             { res: 3800, com: 2800, var12m: 0.022, fonte: "ZAP Americana 2025" },
  "Jardim São Pedro":           { res: 4000, com: 2900, var12m: 0.025, fonte: "ZAP Americana 2025" },
  "Parque Gramado":             { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP/VivaReal Americana 2025" },
  "Parque Residencial Nardini": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Cidade Jardim":              { res: 5000, com: 3700, var12m: 0.032, fonte: "ZAP/VivaReal Americana 2025" },
  "Jardim Ipiranga":            { res: 4200, com: 3000, var12m: 0.025, fonte: "ZAP Americana 2025" },
  "Jardim Boer":                { res: 3900, com: 2800, var12m: 0.022, fonte: "ZAP Americana 2025" },
  "São Manoel":                 { res: 3700, com: 2700, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Remanso Azul":               { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Jardim Jaguari":             { res: 4300, com: 3100, var12m: 0.026, fonte: "ZAP Americana 2025" },
  "Balneário Riviera":          { res: 4500, com: 3300, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Antônio Zanaga":             { res: 3800, com: 2800, var12m: 0.022, fonte: "ZAP Americana 2025" },
  "Nielsen Ville":              { res: 4200, com: 3000, var12m: 0.025, fonte: "ZAP Americana 2025" },
  "Machadinho":                 { res: 3500, com: 2500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Jardim das Orquídeas":       { res: 4000, com: 2900, var12m: 0.024, fonte: "ZAP Americana 2025" },
  "Centro Americana":           { res: 5000, com: 4500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "_default_Americana":         { res: 4400, com: 3200, var12m: 0.028, fonte: "AgentImóvel Americana dez/2025" },
};

function getFipeZAP(neighborhood, city, type) {
  return FIPEZAP_M2[neighborhood]
    || FIPEZAP_M2[`_default_${city}`]
    || FIPEZAP_M2["_default_São Paulo"];
}

const SP_ADDRESSES = [
  ["Rua Oscar Freire", "Jardins"], ["Av. Paulista", "Bela Vista"], ["Rua Augusta", "Consolação"],
  ["Rua Haddock Lobo", "Cerqueira César"], ["Al. Santos", "Jardim Paulista"], ["Rua Peixoto Gomide", "Jardins"],
  ["Av. Faria Lima", "Itaim Bibi"], ["Rua Funchal", "Vila Olímpia"], ["Av. Brigadeiro Faria Lima", "Pinheiros"],
  ["Rua João Cachoeira", "Itaim Bibi"], ["Av. Rebouças", "Pinheiros"], ["Rua Padre João Manuel", "Cerqueira César"],
  ["Av. 9 de Julho", "Jardim Paulista"], ["Rua Estados Unidos", "Jardim América"], ["Av. Europa", "Jardim Europa"],
  ["Rua Groenlândia", "Jardim Europa"], ["Av. Morumbi", "Morumbi"], ["Rua Elvira Ferraz", "Vila Olímpia"],
  ["Rua Amauri", "Itaim Bibi"], ["Av. Santo Amaro", "Vila Nova Conceição"],
];
const CAMPINAS_ADDRESSES = [
  ["Av. Norte-Sul", "Cambuí"], ["Rua Conceição", "Centro"], ["Av. José de Souza Campos", "Nova Campinas"],
  ["Rua Barão de Jaguara", "Centro"], ["Av. Andrade Neves", "Centro"],
];
const SANTO_ANDRE_ADDRESSES = [
  ["Av. Dom Pedro II", "Centro"], ["Rua Coronel Oliveira Lima", "Centro"], ["Av. Industrial", "Vila Guiomar"],
];
const ALL_ADDRESSES = [
  ...SP_ADDRESSES.map(([r, b]) => ({ street: r, neighborhood: b, city: "São Paulo", state: "SP" })),
  ...CAMPINAS_ADDRESSES.map(([r, b]) => ({ street: r, neighborhood: b, city: "Campinas", state: "SP" })),
  ...SANTO_ANDRE_ADDRESSES.map(([r, b]) => ({ street: r, neighborhood: b, city: "Santo André", state: "SP" })),
];

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function buildPortfolio() {
  const rng = seeded(42);
  const ri = (min, max) => Math.floor(rng() * (max - min) + min);

  const props = Array.from({ length: 47 }, (_, i) => {
    const addr = ALL_ADDRESSES[i % ALL_ADDRESSES.length];
    const type = i < 30 ? "Residencial" : "Comercial";
    const bm = BENCHMARKS[addr.city]?.[type] || BENCHMARKS["São Paulo"][type];
    const size = type === "Comercial" ? ri(80, 420) : ri(45, 180);
    const rent = type === "Comercial" ? ri(5000, 28000) : ri(2200, 9500);
    const isProblematic = [3, 7, 12, 18, 22, 28, 35].includes(i);
    const iptuMultiplier = isProblematic && type === "Comercial" ? rng() * 0.6 + 1.3 : rng() * 0.4 + 0.8;
    const iptu = Math.round(bm.iptu_m2 * size * iptuMultiplier);
    const mainMultiplier = isProblematic ? rng() * 0.8 + 1.4 : rng() * 0.5 + 0.7;
    const maintMonthly = Math.round((bm.maintenance_annual_m2 * size / 12) * mainMultiplier);
    const insurance = Math.round(rent * 0.025 * 12);
    const admin = Math.round(rent * 0.08);
    const vacancyDays = isProblematic ? ri(45, 140) : ri(0, bm.vacancy_days);
    const status = vacancyDays > 60 ? "Vago" : (rng() > 0.12 ? "Ocupado" : "Vago");
    const annualRent = rent * 12;
    const vacancyCost = Math.round((rent / 30) * vacancyDays);
    const totalIncome = annualRent - vacancyCost;
    const totalExp = iptu + maintMonthly * 12 + insurance + admin * 12 + (isProblematic ? ri(5000, 20000) : ri(0, 3000));
    const noi = totalIncome - totalExp;
    const noiPct = noi / (totalIncome || 1);
    const iptuBenchmark = Math.round(bm.iptu_m2 * size);
    const iptuDelta = ((iptu - iptuBenchmark) / iptuBenchmark) * 100;
    const vacancyDelta = vacancyDays - bm.vacancy_days;
    const maintBenchmark = Math.round(bm.maintenance_annual_m2 * size / 12);
    const maintDelta = ((maintMonthly - maintBenchmark) / maintBenchmark) * 100;
    let leakage = 0;
    // IPTU leakage removido — benchmark não comparável por imóvel
    if (vacancyDays > bm.vacancy_days) leakage += Math.min(35, vacancyDelta * 0.5);
    if (maintDelta > 30) leakage += Math.min(20, maintDelta * 0.4);
    if (noiPct < 0.5) leakage += 20;
    leakage = Math.min(98, Math.max(2, Math.round(leakage + rng() * 8)));
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthlyData = months.map((m, idx) => {
      const hasVacancy = idx >= 6 && idx <= 8 && vacancyDays > 30;
      const inc = hasVacancy ? 0 : rent + ri(-300, 300);
      const exp = Math.round((iptu / 12) + maintMonthly + (insurance / 12) + admin + (rng() > 0.8 ? ri(500, 4000) : 0));
      return { month: m, receita: Math.max(0, inc), despesas: exp, noi: Math.max(0, inc) - exp };
    });
    return {
      id: i + 1,
      name: `${type === "Comercial" ? "Sala Comercial" : "Apartamento"} ${String(i + 1).padStart(3, "0")}`,
      address: `${addr.street}, ${ri(100, 2400)}`, neighborhood: addr.neighborhood,
      city: addr.city, state: addr.state, type, status, size,
      rent, iptu, maintMonthly, insurance, admin, vacancyDays, vacancyCost,
      totalIncome, totalExpenses: totalExp, noi, noiPct, leakage,
      iptuBenchmark, iptuDelta: Math.round(iptuDelta),
      maintBenchmark, maintDelta: Math.round(maintDelta),
      vacancyBenchmark: bm.vacancy_days, vacancyDelta,
      monthlyData, isProblematic,
      obras: [],
      valorMercado: 0,
      valorCompra: 0,
      anoCompra: null,
    };
  });
  return props;
}

const INITIAL_PROPS = buildPortfolio();

const fmt = {
  brl: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0),
  brlK: (v) => v >= 1000000 ? `R$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : fmt.brl(v),
  pct: (v) => `${((v || 0) * 100).toFixed(1)}%`,
  num: (v) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0)),
  date: () => new Date().toLocaleDateString("pt-BR"),
};

function computePort(props) {
  const PORT = {
    receita: props.reduce((s, p) => s + p.totalIncome, 0),
    despesas: props.reduce((s, p) => s + p.totalExpenses, 0),
    noi: props.reduce((s, p) => s + p.noi, 0),
    vacancyCost: props.reduce((s, p) => s + p.vacancyCost, 0),
    occupied: props.filter(p => p.status === "Ocupado").length,
    total: props.length,
  };
  PORT.noiPct = PORT.noi / PORT.receita;
  PORT.leakageScore = Math.round(props.reduce((s, p) => s + p.leakage, 0) / props.length);
  return PORT;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildInsights(PROPS) {
  const insights = [];
  // IPTU benchmark removido — varia por valor venal individual, não comparável por bairro
  const vacProblems = PROPS.filter(p => p.vacancyDays > p.vacancyBenchmark * 1.5).sort((a, b) => b.vacancyCost - a.vacancyCost);
  if (vacProblems.length > 0) {
    const totalCost = vacProblems.reduce((s, p) => s + p.vacancyCost, 0);
    insights.push({ id: 2, type: "vacancy", severity: "alta", icon: "🏠", title: "Vacância Crônica Acima da Média", description: `${vacProblems.length} imóveis com vacância superior a 1,5× o benchmark.`, metric: `Custo total: ${fmt.brl(totalCost)}/ano`, props: vacProblems.slice(0, 5), impactMin: Math.round(totalCost * 0.6), impactMax: totalCost, actions: ["Revisar preço de aluguel", "Contratar corretora especializada por tipo", "Verificar condições do imóvel", "Avaliar flexibilização de garantias"], benchmark: "Fonte: FipeZap, SECOVI-SP 2024" });
  }
  const maintProblems = PROPS.filter(p => p.maintDelta > 40).sort((a, b) => b.maintDelta - a.maintDelta);
  if (maintProblems.length > 0) {
    const totalWaste = maintProblems.reduce((s, p) => s + (p.maintMonthly - p.maintBenchmark) * 12, 0);
    insights.push({ id: 3, type: "maintenance", severity: "média", icon: "🔧", title: "Manutenção com Custo Anômalo", description: `${maintProblems.length} imóveis com custo de manutenção acima de 140% do benchmark.`, metric: `Excesso anual: ${fmt.brl(totalWaste)}`, props: maintProblems.slice(0, 5), impactMin: Math.round(totalWaste * 0.5), impactMax: Math.round(totalWaste * 0.9), actions: ["Solicitar laudo técnico para imóveis com manutenção recorrente", "Comparar custo de reforma preventiva vs manutenção contínua", "Revisar contratos com prestadores", "Implantar check-list de vistoria semestral"], benchmark: "Fonte: ABNT NBR 5674 2024" });
  }
  // Aluguel abaixo do potencial de mercado
  const aluguelBaixo = PROPS.filter(p => {
    const vm = p.marketValueManual > 0 ? p.marketValueManual : p.valorMercado > 0 ? p.valorMercado : 0;
    if (!vm) return false;
    const yieldEsp = p.type === "Comercial" ? 0.007 : 0.005;
    const esperado = vm * yieldEsp;
    const atual = p.rent - (p.descontoAluguel || 0);
    return (esperado - atual) > atual * 0.08;
  }).sort((a, b) => {
    const vmA = a.marketValueManual > 0 ? a.marketValueManual : a.valorMercado || 0;
    const vmB = b.marketValueManual > 0 ? b.marketValueManual : b.valorMercado || 0;
    const espA = vmA * (a.type === "Comercial" ? 0.007 : 0.005);
    const espB = vmB * (b.type === "Comercial" ? 0.007 : 0.005);
    return (espB - (b.rent - (b.descontoAluguel||0))) - (espA - (a.rent - (a.descontoAluguel||0)));
  });
  if (aluguelBaixo.length > 0) {
    const totalPotencial = aluguelBaixo.reduce((s, p) => {
      const vm = p.marketValueManual > 0 ? p.marketValueManual : p.valorMercado || 0;
      const esp = vm * (p.type === "Comercial" ? 0.007 : 0.005);
      const atual = p.rent - (p.descontoAluguel || 0);
      return s + Math.max(0, esp - atual) * 12;
    }, 0);
    insights.push({ id: 5, type: "aluguel_baixo", severity: "alta", icon: "💰", title: "Aluguel Abaixo do Potencial de Mercado", description: `${aluguelBaixo.length} imóvel(is) com aluguel defasado em relação ao valor de mercado informado.`, metric: `Receita adicional potencial: ${fmt.brlK(totalPotencial)}/ano`, props: aluguelBaixo.slice(0, 5), impactMin: Math.round(totalPotencial * 0.5), impactMax: Math.round(totalPotencial), actions: ["Revisar valor do aluguel na próxima renovação de contrato", "Verificar índice de reajuste aplicado (IGPM acumulado)", "Negociar reajuste gradual com o inquilino", "Considerar rescisão e novo contrato a valor de mercado"], benchmark: "Rentabilidade bruta: 0,5% residencial · 0,7% comercial" });
  }

  const noiProblems = PROPS.filter(p => p.noiPct < 0.45 && p.totalIncome > 0).sort((a, b) => a.noiPct - b.noiPct);
  if (noiProblems.length > 0) {
    insights.push({ id: 4, type: "noi", severity: "alta", icon: "📉", title: "NOI Abaixo de 45%", description: `${noiProblems.length} imóveis com margem NOI insuficiente.`, metric: `NOI médio do grupo: ${fmt.pct(noiProblems.reduce((s,p) => s + p.noiPct, 0) / noiProblems.length)}`, props: noiProblems.slice(0, 5), impactMin: Math.round(noiProblems.reduce((s, p) => s + p.noi * 0.1, 0)), impactMax: Math.round(noiProblems.reduce((s, p) => s + p.noi * 0.25, 0)), actions: ["Análise detalhada por imóvel", "Revisar reajuste de aluguel pelo IGPM acumulado", "Renegociar contratos de serviço", "Avaliar desinvestimento em imóveis com NOI < 40% por 12+ meses"], benchmark: "Padrão: NOI entre 55–70% (ABRAII 2024)" });
  }
  return insights;
}

const S = {
  card: { background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 },
  cardGold: { background: `linear-gradient(135deg, ${T.s1} 0%, #1A1608 100%)`, border: `1px solid ${T.goldDim}`, borderRadius: 14, padding: 24 },
  badge: (c) => ({ background: c + "20", color: c, border: `1px solid ${c}40`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, display: "inline-flex", alignItems: "center", gap: 4 }),
  btn: { background: `linear-gradient(135deg, ${T.gold}, ${T.goldBright})`, color: "#0A0800", border: "none", borderRadius: 9, padding: "11px 22px", fontWeight: 800, cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: 0.3 },
  btnGhost: { background: "transparent", color: T.gold, border: `1px solid ${T.goldDim}`, borderRadius: 9, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif" },
  btnDanger: { background: "transparent", color: T.red, border: `1px solid ${T.redDim}`, borderRadius: 9, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif" },
  input: { background: T.s2, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px 14px", color: T.text, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "'Bricolage Grotesque', sans-serif" },
  sel: { background: T.s2, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque', sans-serif" },
  th: { textAlign: "left", padding: "10px 14px", color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" },
  td: { padding: "11px 14px", fontSize: 13, borderBottom: `1px solid ${T.border}40`, color: T.text },
  mono: { fontFamily: "'DM Mono', monospace" },
  label: { color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6, display: "block" },
};

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.s2, border: `1px solid ${T.borderMid}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, boxShadow: "0 8px 32px #00000066" }}>
      <div style={{ color: T.muted, marginBottom: 6, fontWeight: 700, fontSize: 11, letterSpacing: 0.8 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || T.text, marginBottom: 2 }}>{p.name}: <strong>{fmt.brl(p.value)}</strong></div>)}
    </div>
  );
};

function KPI({ label, value, sub, color = T.gold, size = "lg", delta, warn }) {
  const fs = size === "lg" ? 28 : size === "md" ? 22 : 18;
  return (
    <div style={{ ...S.card, flex: 1, minWidth: 150, position: "relative", overflow: "hidden" }}>
      {warn && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.red}, ${T.amber})` }} />}
      <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color, fontSize: fs, fontWeight: 800, ...S.mono, marginBottom: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>{sub}</div>}
      {delta != null && <div style={{ color: delta >= 0 ? T.green : T.red, fontSize: 12, marginTop: 6, fontWeight: 600 }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs período anterior</div>}
    </div>
  );
}

function LeakageGauge({ score }) {
  const color = score < 30 ? T.green : score < 55 ? T.amber : T.red;
  const label = score < 30 ? "Portfólio Saudável" : score < 55 ? "Atenção Necessária" : "Intervenção Urgente";
  const r = 52, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  const arc = (circ * 0.75);
  const filled = arc * (score / 100);
  const rotation = -225;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={140} height={100} style={{ overflow: "visible" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.s3} strokeWidth={10} strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(${rotation} ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform={`rotate(${rotation} ${cx} ${cy})`} style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={26} fontWeight={800} fontFamily="'DM Mono', monospace">{score}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill={T.muted} fontSize={10} fontWeight={600} letterSpacing={1}>LEAKAGE</text>
      </svg>
      <div>
        <div style={{ color, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function SevBadge({ s }) {
  const map = { alta: T.red, média: T.amber, baixa: T.blue };
  return <span style={S.badge(map[s] || T.blue)}>{s === "alta" ? "🔴" : s === "média" ? "🟡" : "🔵"} {s.toUpperCase()}</span>;
}

function BenchmarkBar({ label, value, benchmark, unit = "", delta }) {
  const max = Math.max(value, benchmark) * 1.2;
  const isHigh = value > benchmark;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ color: T.muted, fontSize: 12 }}>{label}</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: T.dim, fontSize: 11 }}>Benchmark: <span style={{ ...S.mono }}>{unit}{fmt.num(benchmark)}</span></span>
          <span style={{ color: isHigh ? T.red : T.green, fontWeight: 700, fontSize: 12, ...S.mono }}>{isHigh ? "▲" : "▼"} {Math.abs(delta)}%</span>
        </div>
      </div>
      <div style={{ position: "relative", height: 6, background: T.s3, borderRadius: 3 }}>
        <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: isHigh ? T.red : T.green, borderRadius: 3 }} />
        <div style={{ position: "absolute", top: -3, left: `${(benchmark / max) * 100}%`, width: 2, height: 12, background: T.gold, borderRadius: 1 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ color: isHigh ? T.red : T.green, fontSize: 11, fontWeight: 700, ...S.mono }}>{unit}{fmt.num(value)}</span>
      </div>
    </div>
  );
}

// ─── EDIT MODAL ──────────────────────────────────────────────────────────────
function EditModal({ prop, onSave, onClose }) {
  const [form, setForm] = useState({
    name: prop.name, address: prop.address, neighborhood: prop.neighborhood,
    city: prop.city, type: prop.type, status: prop.status, size: prop.size,
    rent: prop.rent, iptu: prop.iptu, maintMonthly: prop.maintMonthly,
    insurance: prop.insurance, admin: prop.admin, vacancyDays: prop.vacancyDays,
    hasCondominio: prop.hasCondominio || false,
    condoFee: prop.condoFee || 0,
    fundoReserva: prop.fundoReserva || 0,
    chamadaExtra: prop.chamadaExtra || 0,
    descontoAluguel: prop.descontoAluguel || 0,
    contratoAnos: prop.contratoAnos || 1,
    contratoInicio: prop.contratoInicio || "",
    marketValueManual: prop.marketValueManual || 0,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const num = (k, v) => set(k, parseFloat(v) || 0);
  const handleSave = () => {
    const bm = BENCHMARKS[form.city]?.[form.type] || BENCHMARKS["São Paulo"][form.type];
    const annualRent = form.rent * 12;
    const vacancyCost = Math.round((form.rent / 30) * form.vacancyDays);
    const descontoAnual = Number(form.descontoAluguel) * 12;
    const totalIncome = annualRent - vacancyCost - descontoAnual;
    const condoAnnual = form.hasCondominio ? (Number(form.condoFee) + Number(form.fundoReserva) + Number(form.chamadaExtra)) * 12 : 0;
    const totalExpenses = form.iptu + form.maintMonthly * 12 + form.insurance + form.admin * 12 + condoAnnual;
    const noi = totalIncome - totalExpenses;
    const noiPct = noi / (totalIncome || 1);
    const iptuBenchmark = Math.round(bm.iptu_m2 * form.size);
    const iptuDelta = Math.round(((form.iptu - iptuBenchmark) / iptuBenchmark) * 100);
    const maintBenchmark = Math.round(bm.maintenance_annual_m2 * form.size / 12);
    const maintDelta = Math.round(((form.maintMonthly - maintBenchmark) / maintBenchmark) * 100);
    const vacancyDelta = form.vacancyDays - bm.vacancy_days;
    let leakage = 0;
    // IPTU leakage removido — benchmark não comparável por imóvel
    if (form.vacancyDays > bm.vacancy_days) leakage += Math.min(35, vacancyDelta * 0.5);
    if (maintDelta > 30) leakage += Math.min(20, maintDelta * 0.4);
    if (noiPct < 0.5) leakage += 20;
    leakage = Math.min(98, Math.max(2, Math.round(leakage)));
    const proximoReajuste = form.contratoInicio ? (() => { const d = new Date(form.contratoInicio); const now = new Date(); let y = now.getFullYear(); if (new Date(y, d.getMonth(), d.getDate()) <= now) y++; return new Date(y, d.getMonth(), d.getDate()).toLocaleDateString("pt-BR"); })() : "";
    onSave({ ...prop, ...form, size: Number(form.size), rent: Number(form.rent), iptu: Number(form.iptu), maintMonthly: Number(form.maintMonthly), insurance: Number(form.insurance), admin: Number(form.admin), vacancyDays: Number(form.vacancyDays), condoFee: Number(form.condoFee), fundoReserva: Number(form.fundoReserva), chamadaExtra: Number(form.chamadaExtra), descontoAluguel: Number(form.descontoAluguel), contratoAnos: Number(form.contratoAnos), vacancyCost, totalIncome, totalExpenses, noi, noiPct, iptuBenchmark, iptuDelta, maintBenchmark, maintDelta, vacancyBenchmark: bm.vacancy_days, vacancyDelta, leakage, proximoReajuste, marketValueManual: Number(form.marketValueManual) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.s1, border: `1px solid ${T.borderMid}`, borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "24px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: T.s1, zIndex: 1 }}>
          <div>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>EDITAR IMÓVEL</div>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 17, marginTop: 2 }}>{prop.name}</div>
          </div>
          <button style={{ background: T.s3, border: "none", color: T.muted, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>IDENTIFICAÇÃO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}><div><label style={S.label}>NOME</label><input style={S.input} value={form.name} onChange={e=>set("name",e.target.value)} /></div></div>
              <div style={{ gridColumn: "1/-1" }}><div><label style={S.label}>ENDEREÇO</label><input style={S.input} value={form.address} onChange={e=>set("address",e.target.value)} /></div></div>
              <div><label style={S.label}>BAIRRO</label><input style={S.input} value={form.neighborhood} onChange={e=>set("neighborhood",e.target.value)} /></div>
              <div><label style={S.label}>CIDADE</label><select style={S.sel} value={form.city} onChange={e=>set("city",e.target.value)}>{["São Paulo","Campinas","Santo André","Americana"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>TIPO</label><select style={S.sel} value={form.type} onChange={e=>set("type",e.target.value)}>{["Residencial","Comercial"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>STATUS</label><select style={S.sel} value={form.status} onChange={e=>set("status",e.target.value)}>{["Ocupado","Vago"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>ÁREA (m²)</label><input type="number" style={S.input} value={form.size} onChange={e=>set("size",e.target.value)} /></div>
            </div>
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>DADOS FINANCEIROS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={S.label}>ALUGUEL MENSAL (R$)</label><input type="number" style={S.input} value={form.rent} onChange={e=>set("rent",e.target.value)} /></div>
              <div><label style={S.label}>DESCONTO NO ALUGUEL (R$/mês)</label><input type="number" style={S.input} value={form.descontoAluguel} onChange={e=>set("descontoAluguel",e.target.value)} /></div>
              <div><label style={S.label}>IPTU ANUAL (R$)</label><input type="number" style={S.input} value={form.iptu} onChange={e=>set("iptu",e.target.value)} /></div>
              <div><label style={S.label}>MANUTENÇÃO MENSAL (R$)</label><input type="number" style={S.input} value={form.maintMonthly} onChange={e=>set("maintMonthly",e.target.value)} /></div>
              <div><label style={S.label}>SEGURO ANUAL (R$)</label><input type="number" style={S.input} value={form.insurance} onChange={e=>set("insurance",e.target.value)} /></div>
              <div><label style={S.label}>TAXA ADM. MENSAL (R$)</label><input type="number" style={S.input} value={form.admin} onChange={e=>set("admin",e.target.value)} /></div>
              <div><label style={S.label}>DIAS DE VACÂNCIA/ANO</label><input type="number" style={S.input} value={form.vacancyDays} onChange={e=>set("vacancyDays",e.target.value)} /></div>
              <div><label style={S.label}>VALOR DE MERCADO MANUAL (R$)</label><input type="number" style={S.input} value={form.marketValueManual} onChange={e=>set("marketValueManual",e.target.value)} /></div>
            </div>
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>CONDOMÍNIO</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <input type="checkbox" id="hasCondominio" checked={form.hasCondominio} onChange={e => set("hasCondominio", e.target.checked)} style={{ width: 16, height: 16, accentColor: T.gold, cursor: "pointer" }} />
              <label htmlFor="hasCondominio" style={{ color: T.muted, fontSize: 13, cursor: "pointer" }}>Este imóvel tem condomínio</label>
            </div>
            {form.hasCondominio && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={S.label}>COND. MENSAL (R$)</label><input type="number" style={S.input} value={form.condoFee} onChange={e=>set("condoFee",e.target.value)} /></div>
                <div><label style={S.label}>FUNDO DE RESERVA MENSAL (R$)</label><input type="number" style={S.input} value={form.fundoReserva} onChange={e=>set("fundoReserva",e.target.value)} /></div>
                <div><label style={S.label}>CHAMADA EXTRA MENSAL (R$)</label><input type="number" style={S.input} value={form.chamadaExtra} onChange={e=>set("chamadaExtra",e.target.value)} /></div>
              </div>
            )}
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>CONTRATO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={S.label}>DURAÇÃO DO CONTRATO (anos)</label><input type="number" style={S.input} value={form.contratoAnos} onChange={e=>set("contratoAnos",e.target.value)} /></div>
              <div><label style={S.label}>DATA DE INÍCIO DO CONTRATO</label><input type="date" style={S.input} value={form.contratoInicio} onChange={e=>set("contratoInicio",e.target.value)} /></div>
            </div>
            {form.contratoInicio && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: T.s3, borderRadius: 8, color: T.muted, fontSize: 12 }}>
                📅 Próximo reajuste: <span style={{ color: T.gold, fontWeight: 700 }}>
                  {(() => { const d = new Date(form.contratoInicio); const now = new Date(); let y = now.getFullYear(); if (new Date(y, d.getMonth(), d.getDate()) <= now) y++; return new Date(y, d.getMonth(), d.getDate()).toLocaleDateString("pt-BR"); })()}
                </span> · Normalmente pelo IGPM acumulado
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "16px 28px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button style={S.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={S.btn} onClick={handleSave}>Salvar Alterações</button>
        </div>
      </div>
    </div>
  );
}

// ─── OBRAS MODAL ─────────────────────────────────────────────────────────────
const OBRA_TIPOS = ["Corretiva", "Preventiva", "Retrofit", "Estrutural", "Acabamento", "Elétrica", "Hidráulica"];
const OBRA_STATUS_OPTS = ["Planejada", "Em andamento", "Concluída", "Pausada"];

const OBRA_BM = {
  pintura:              { label:"Pintura Simples",       emoji:"🖌️", desc:"Massa corrida + 2 demãos.",                                                  r_min:60,   r_max:100,  r_ref:80,   mat:0.35, mao:0.60, aux:0.05, dias100:7,  imp_alug:0.04, vac_reduz:15 },
  reforma_simples:      { label:"Reforma Simples",       emoji:"🔧", desc:"Pintura + troca de piso + reparos pontuais.",                                 r_min:800,  r_max:1200, r_ref:1000, mat:0.50, mao:0.45, aux:0.05, dias100:30, imp_alug:0.08, vac_reduz:20 },
  reforma_intermediaria:{ label:"Reforma Intermediária", emoji:"🏗️", desc:"Elétrica + hidráulica parcial + porcelanato + louças.",                      r_min:1200, r_max:2600, r_ref:1800, mat:0.52, mao:0.43, aux:0.05, dias100:60, imp_alug:0.15, vac_reduz:30 },
  retrofit_completo:    { label:"Retrofit Completo",     emoji:"⚡", desc:"Elétrica + hidráulica completas + piso + forro + automação básica.",          r_min:2000, r_max:4200, r_ref:3000, mat:0.55, mao:0.40, aux:0.05, dias100:90, imp_alug:0.25, vac_reduz:45 },
  estrutural:           { label:"Obra Estrutural",       emoji:"🏚️", desc:"Reforço de laje, fundações, alvenaria. Exige ART.",                          r_min:1500, r_max:3500, r_ref:2500, mat:0.45, mao:0.50, aux:0.05, dias100:90, imp_alug:0.05, vac_reduz:0  },
  eletrica:             { label:"Instalação Elétrica",   emoji:"💡", desc:"Troca completa de fiação, disjuntores, tomadas.",                             r_min:150,  r_max:400,  r_ref:250,  mat:0.30, mao:0.65, aux:0.05, dias100:15, imp_alug:0.06, vac_reduz:10 },
  hidraulica:           { label:"Instalação Hidráulica", emoji:"🚿", desc:"Troca de tubulações, registros, torneiras, chuveiros.",                      r_min:120,  r_max:350,  r_ref:200,  mat:0.35, mao:0.60, aux:0.05, dias100:10, imp_alug:0.04, vac_reduz:10 },
  alto_padrao:          { label:"Alto Padrão",           emoji:"✨", desc:"Projeto completo, forro de gesso, automação, mármores, marcenaria.",          r_min:2800, r_max:5500, r_ref:3500, mat:0.57, mao:0.38, aux:0.05, dias100:120,imp_alug:0.35, vac_reduz:60 },
};

// ─── PAGE OBRAS ───────────────────────────────────────────────────────────────
function PageObras({ PROPS, onUpdateProps }) {
  const [view, setView] = useState("lista");
  const [selectedId, setSelectedId] = useState(null);
  const imovel = selectedId ? PROPS.find(p => p.id === selectedId) : null;
  const todasObras = PROPS.flatMap(p => (p.obras || []).map(o => ({ ...o, _prop: p })));
  const totalOrcado    = todasObras.reduce((s, o) => s + (o.orcado || 0), 0);
  const totalExecutado = todasObras.reduce((s, o) => s + (o.executado || 0), 0);
  const emAndamento    = todasObras.filter(o => o.status === "Em andamento").length;
  const concluidas     = todasObras.filter(o => o.status === "Concluída").length;
  const variacao       = totalExecutado - totalOrcado;
  function bmForTipo(tipo) {
    const map = { Retrofit:"retrofit_completo", Estrutural:"estrutural", Elétrica:"eletrica", Hidráulica:"hidraulica", Acabamento:"reforma_simples", Corretiva:"reforma_simples", Preventiva:"pintura" };
    return OBRA_BM[map[tipo]] || OBRA_BM.reforma_simples;
  }
  if (view === "imovel" && imovel) return <ObrasPorImovel prop={imovel} onBack={() => { setView("lista"); setSelectedId(null); }} onSave={up => { onUpdateProps(prev => prev.map(p => p.id === up.id ? up : p)); setSelectedId(up.id); }} bmForTipo={bmForTipo} />;
  if (view === "estimador") return <EstimadorObra PROPS={PROPS} onBack={() => setView("lista")} bmForTipo={bmForTipo} />;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <div>
          <div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:6 }}>GESTÃO DE OBRAS</div>
          <h1 style={{ color:T.text, fontSize:26, fontWeight:800, margin:0 }}>Obras & Reformas</h1>
          <div style={{ color:T.muted, fontSize:13, marginTop:4 }}>Orçado × Real · Material × Mão de Obra · Impacto no NOI</div>
        </div>
        <button style={{ ...S.btn, display:"flex", alignItems:"center", gap:8 }} onClick={() => setView("estimador")}>🧮 Estimador de Custo</button>
      </div>
      <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
        {[
          { label:"TOTAL ORÇADO",    value:fmt.brlK(totalOrcado),    sub:`${todasObras.length} obra(s)`,  color:T.gold },
          { label:"TOTAL EXECUTADO", value:fmt.brlK(totalExecutado), sub:totalOrcado>0?`${((totalExecutado/totalOrcado)*100).toFixed(0)}% do orçado`:"—", color:totalExecutado>totalOrcado?T.red:T.green },
          { label:"VARIAÇÃO TOTAL",  value:(variacao>0?"+":"")+fmt.brlK(variacao), sub:totalOrcado>0?`${((variacao/totalOrcado)*100).toFixed(1)}%`:"—", color:variacao>0?T.red:T.green },
          { label:"EM ANDAMENTO",    value:emAndamento, sub:`${concluidas} concluída(s)`, color:T.amber },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, flex:1, minWidth:140 }}>
            <div style={{ color:T.muted, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:8 }}>{k.label}</div>
            <div style={{ color:k.color, fontSize:26, fontWeight:900, ...S.mono }}>{k.value}</div>
            <div style={{ color:T.dim, fontSize:12, marginTop:4 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {todasObras.filter(o=>o.orcado>0||o.executado>0).length > 0 && <MatMaoCard obras={todasObras} bmForTipo={bmForTipo} />}
      {PROPS.filter(p=>(p.obras||[]).length>0).length > 0 && (
        <div style={S.card}>
          <div style={{ color:T.text, fontWeight:700, fontSize:15, marginBottom:16 }}>Imóveis com Obras Cadastradas</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {PROPS.filter(p=>(p.obras||[]).length>0).map(p => {
              const obras = p.obras||[];
              const orc  = obras.reduce((s,o)=>s+(o.orcado||0),0);
              const exec = obras.reduce((s,o)=>s+(o.executado||0),0);
              const varp = orc>0?((exec-orc)/orc)*100:0;
              const ativas = obras.filter(o=>o.status==="Em andamento").length;
              return (
                <div key={p.id} onClick={()=>{ setSelectedId(p.id); setView("imovel"); }}
                  style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", background:T.s2, borderRadius:10, cursor:"pointer", border:`1px solid ${T.border}` }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=T.gold}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.goldBright, fontWeight:700, fontSize:14 }}>{p.name}</div>
                    <div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{p.neighborhood} · {obras.length} obra(s){ativas>0&&<span style={{ color:T.amber, marginLeft:8 }}>· {ativas} em andamento</span>}</div>
                  </div>
                  <div style={{ textAlign:"right" }}><div style={{ color:T.muted, fontSize:10 }}>Orçado</div><div style={{ color:T.gold, fontSize:14, fontWeight:700, ...S.mono }}>{fmt.brlK(orc)}</div></div>
                  <div style={{ textAlign:"right" }}><div style={{ color:T.muted, fontSize:10 }}>Executado</div><div style={{ color:exec>orc?T.red:T.green, fontSize:14, fontWeight:700, ...S.mono }}>{fmt.brlK(exec)}</div></div>
                  <div style={{ textAlign:"right", minWidth:60 }}><div style={{ color:T.muted, fontSize:10 }}>Variação</div><div style={{ color:varp>0?T.red:T.green, fontSize:14, fontWeight:700 }}>{varp>0?"+":""}{varp.toFixed(1)}%</div></div>
                  <div style={{ color:T.dim, fontSize:16 }}>→</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{ color:T.text, fontWeight:700, fontSize:15, marginBottom:4 }}>Todos os Imóveis</div>
        <div style={{ color:T.muted, fontSize:12, marginBottom:16 }}>Clique para gerenciar obras de qualquer imóvel</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:8 }}>
          {PROPS.map(p => {
            const n = (p.obras||[]).length;
            return (
              <div key={p.id} onClick={()=>{ setSelectedId(p.id); setView("imovel"); }}
                style={{ padding:"10px 14px", background:T.s2, borderRadius:8, cursor:"pointer", border:`1px solid ${n>0?T.goldDim+"60":T.border}` }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.gold}
                onMouseLeave={e=>e.currentTarget.style.borderColor=n>0?T.goldDim+"60":T.border}>
                <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>{p.name}</div>
                <div style={{ color:T.muted, fontSize:11, marginTop:3 }}>{n>0?`${n} obra(s)`:"Sem obras"} · {p.neighborhood}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatMaoCard({ obras, bmForTipo }) {
  const validas = obras.filter(o => (o.orcado||0)+(o.executado||0) > 0);
  if (!validas.length) return null;
  const total = validas.reduce((s,o)=>s+(o.executado||o.orcado||0),0);
  let tMat=0, tMao=0, tAux=0;
  validas.forEach(o => { const v=o.executado||o.orcado||0; const bm=bmForTipo(o.tipo); tMat+=v*(o.pct_mat||bm.mat); tMao+=v*(o.pct_mao||bm.mao); tAux+=v*(o.pct_aux||bm.aux); });
  const pMat=tMat/total, pMao=tMao/total, pAux=tAux/total;
  return (
    <div style={{ ...S.card, border:`1px solid ${T.borderMid}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><div style={{ color:T.text, fontWeight:700, fontSize:15 }}>Material × Mão de Obra</div><div style={{ color:T.muted, fontSize:12, marginTop:2 }}>Estimativa por benchmark SINAPI/SP 2025–2026 · Total: {fmt.brlK(total)}</div></div>
        <div style={{ color:T.dim, fontSize:11, textAlign:"right" }}>Ref. nac. SINAPI dez/2025<br/>mat 57% · m.o. 43%</div>
      </div>
      <div style={{ height:28, borderRadius:8, overflow:"hidden", display:"flex", marginBottom:14 }}>
        <div style={{ width:`${pMat*100}%`, background:T.blue, display:"flex", alignItems:"center", justifyContent:"center" }}>{pMat>0.1&&<span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>{(pMat*100).toFixed(0)}%</span>}</div>
        <div style={{ width:`${pMao*100}%`, background:T.amber, display:"flex", alignItems:"center", justifyContent:"center" }}>{pMao>0.1&&<span style={{ color:"#0A0800", fontSize:11, fontWeight:700 }}>{(pMao*100).toFixed(0)}%</span>}</div>
        <div style={{ width:`${pAux*100}%`, background:T.teal, display:"flex", alignItems:"center", justifyContent:"center" }}>{pAux>0.06&&<span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>{(pAux*100).toFixed(0)}%</span>}</div>
      </div>
      <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
        {[{ label:"Material", value:tMat, pct:pMat, color:T.blue, desc:"Revestimentos, louças, tintas, metais" },{ label:"Mão de Obra", value:tMao, pct:pMao, color:T.amber, desc:"Pedreiro, pintor, eletricista, encanador" },{ label:"Serviços Aux.", value:tAux, pct:pAux, color:T.teal, desc:"Caçamba, limpeza, projetos, laudos" }].map(item => (
          <div key={item.label} style={{ display:"flex", gap:10, alignItems:"flex-start", flex:1, minWidth:150 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:item.color, marginTop:2, flexShrink:0 }} />
            <div><div style={{ color:T.text, fontSize:13, fontWeight:700 }}>{item.label}</div><div style={{ color:item.color, fontSize:18, fontWeight:900, ...S.mono }}>{fmt.brlK(item.value)}</div><div style={{ color:T.dim, fontSize:11 }}>{item.desc}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObrasPorImovel({ prop, onBack, onSave, bmForTipo }) {
  const [obras, setObras] = useState(prop.obras || []);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState("obras");
  const [prestadores, setPrestadores] = useState(prop.prestadores || []);
  const [addingPrest, setAddingPrest] = useState(false);
  const [newPrest, setNewPrest] = useState({ nome:"", especialidade:"", telefone:"", email:"", avaliacao:"", notas:"" });
  const [newO, setNewO] = useState({ descricao:"", tipo:"Corretiva", status:"Planejada", orcado:"", executado:"", pct_mat:"", pct_mao:"", inicio:"", fim:"", notas:"", bm_ref:"" });
  const save = (list) => { setObras(list); onSave({ ...prop, obras:list, prestadores }); };
  const savePrest = (list) => { setPrestadores(list); onSave({ ...prop, obras, prestadores: list }); };
  const addPrestador = () => {
    if (!newPrest.nome) return;
    savePrest([...prestadores, { id: Date.now(), ...newPrest }]);
    setAddingPrest(false);
    setNewPrest({ nome:"", especialidade:"", telefone:"", email:"", avaliacao:"", notas:"" });
  };
  const remPrest = (id) => savePrest(prestadores.filter(p => p.id !== id));
  const addObra = () => {
    if (!newO.descricao) return;
    const bm = OBRA_BM[newO.bm_ref] || bmForTipo(newO.tipo);
    const orc=parseFloat(newO.orcado)||0, exec=parseFloat(newO.executado)||0, mat=parseFloat(newO.pct_mat)||0, mao=parseFloat(newO.pct_mao)||0;
    const entrada = { id:Date.now(), descricao:newO.descricao, tipo:newO.tipo, status:newO.status, orcado:orc, executado:exec, pct_mat:mat>0?mat/100:bm.mat, pct_mao:mao>0?mao/100:bm.mao, pct_aux:1-(mat>0?mat/100:bm.mat)-(mao>0?mao/100:bm.mao), inicio:newO.inicio, fim:newO.fim, notas:newO.notas, bm_ref:newO.bm_ref };
    save([...obras, entrada]);
    setAdding(false);
    setNewO({ descricao:"", tipo:"Corretiva", status:"Planejada", orcado:"", executado:"", pct_mat:"", pct_mao:"", inicio:"", fim:"", notas:"", bm_ref:"" });
  };
  const upd = (id, k, v) => save(obras.map(o => { if (o.id!==id) return o; const nums=["orcado","executado","pct_mat","pct_mao"]; return { ...o, [k]:nums.includes(k)?(parseFloat(v)||0):v }; }));
  const rem = (id) => save(obras.filter(o=>o.id!==id));
  const totalOrc=obras.reduce((s,o)=>s+(o.orcado||0),0), totalExec=obras.reduce((s,o)=>s+(o.executado||0),0), varTotal=totalExec-totalOrc;
  const ESPECIALIDADES = ["Elétrica","Hidráulica","Pintura","Alvenaria","Marcenaria","Serralheria","Ar condicionado","Limpeza","Outros"];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
        <button style={{ ...S.btnGhost, padding:"8px 16px" }} onClick={onBack}>← Obras</button>
        <div style={{ flex:1 }}>
          <div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:4 }}>OBRAS DO IMÓVEL</div>
          <h1 style={{ color:T.text, fontSize:22, fontWeight:800, margin:0 }}>{prop.name}</h1>
          <div style={{ color:T.muted, fontSize:13, marginTop:4 }}>{prop.neighborhood} · {prop.city} · {prop.size}m² · {prop.type}</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
        <div style={S.card}><div style={{ color:T.muted, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:6 }}>NOI ANUAL ATUAL</div><div style={{ color:prop.noi>0?T.green:T.red, fontSize:22, fontWeight:800, ...S.mono }}>{fmt.brlK(prop.noi)}</div><div style={{ color:T.dim, fontSize:11, marginTop:4 }}>Margem: {fmt.pct(prop.noiPct)}</div></div>
        <div style={S.card}><div style={{ color:T.muted, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:6 }}>TOTAL ORÇADO</div><div style={{ color:T.gold, fontSize:22, fontWeight:800, ...S.mono }}>{fmt.brlK(totalOrc)}</div><div style={{ color:T.dim, fontSize:11, marginTop:4 }}>{obras.length} obra(s)</div></div>
        <div style={{ ...S.card, border:`1px solid ${varTotal>0?T.red+"40":T.border}` }}><div style={{ color:T.muted, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:6 }}>VARIAÇÃO</div><div style={{ color:varTotal>0?T.red:T.green, fontSize:22, fontWeight:800, ...S.mono }}>{varTotal>0?"+":""}{fmt.brlK(varTotal)}</div><div style={{ color:T.dim, fontSize:11, marginTop:4 }}>{totalOrc>0?`${((varTotal/totalOrc)*100).toFixed(1)}% do orçado`:"—"}</div></div>
      </div>
      <div style={{ display:"flex", gap:8, borderBottom:`1px solid ${T.border}`, paddingBottom:0 }}>
        {[{ id:"obras", label:"🔨 Obras" }, { id:"prestadores", label:"👷 Prestadores" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t.id?T.gold:"transparent"}`, color:tab===t.id?T.gold:T.muted, fontWeight:700, fontSize:13, padding:"8px 18px", cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>
      {tab === "obras" && <>
        {obras.filter(o=>(o.orcado||0)>0).length>0 && <MatMaoCard obras={obras} bmForTipo={bmForTipo} />}
        {obras.length===0&&!adding&&(
          <div style={{ ...S.card, textAlign:"center", padding:"40px 20px" }}><div style={{ fontSize:40, marginBottom:10 }}>🔨</div><div style={{ color:T.text, fontSize:15, fontWeight:600, marginBottom:6 }}>Nenhuma obra cadastrada</div></div>
        )}
        {obras.map(obra => <ObraCard key={obra.id} obra={obra} prop={prop} bmForTipo={bmForTipo} onUpd={(k,v)=>upd(obra.id,k,v)} onRem={()=>rem(obra.id)} />)}
        {adding && <NovaObraForm form={newO} setForm={setNewO} onAdd={addObra} onCancel={()=>setAdding(false)} propSize={prop.size} bmForTipo={bmForTipo} />}
        {!adding && <button style={{ ...S.btnGhost, width:"100%", padding:14 }} onClick={()=>setAdding(true)}>+ Adicionar Obra / Reforma</button>}
      </>}
      {tab === "prestadores" && <>
        {prestadores.length === 0 && !addingPrest && (
          <div style={{ ...S.card, textAlign:"center", padding:"40px 20px" }}><div style={{ fontSize:40, marginBottom:10 }}>👷</div><div style={{ color:T.text, fontSize:15, fontWeight:600, marginBottom:6 }}>Nenhum prestador cadastrado</div><div style={{ color:T.muted, fontSize:13 }}>Adicione eletricistas, pintores, encanadores e outros prestadores de serviço.</div></div>
        )}
        {prestadores.map(p => (
          <div key={p.id} style={{ ...S.card, border:`1px solid ${T.borderMid}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ color:T.text, fontWeight:700, fontSize:15, marginBottom:4 }}>{p.nome}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                  <span style={S.badge(T.blue)}>{p.especialidade}</span>
                  {p.avaliacao && <span style={S.badge(T.gold)}>{"⭐".repeat(Math.min(5, parseInt(p.avaliacao)||0))} {p.avaliacao}/5</span>}
                </div>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                  {p.telefone && <div style={{ color:T.muted, fontSize:12 }}>📞 {p.telefone}</div>}
                  {p.email && <div style={{ color:T.muted, fontSize:12 }}>✉️ {p.email}</div>}
                </div>
                {p.notas && <div style={{ color:T.dim, fontSize:12, marginTop:8, padding:"8px 12px", background:T.s3, borderRadius:8 }}>{p.notas}</div>}
              </div>
              <button style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:16 }} onClick={() => remPrest(p.id)}>🗑</button>
            </div>
          </div>
        ))}
        {addingPrest && (
          <div style={{ ...S.card, border:`1px solid ${T.gold}40` }}>
            <div style={{ color:T.gold, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:14 }}>NOVO PRESTADOR</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div style={{ gridColumn:"1/-1" }}><div style={S.label}>NOME</div><input style={S.input} value={newPrest.nome} onChange={e=>setNewPrest(f=>({...f,nome:e.target.value}))} placeholder="Ex: João Silva" /></div>
              <div><div style={S.label}>ESPECIALIDADE</div><select style={S.sel} value={newPrest.especialidade} onChange={e=>setNewPrest(f=>({...f,especialidade:e.target.value}))}><option value="">Selecionar...</option>{ESPECIALIDADES.map(e=><option key={e}>{e}</option>)}</select></div>
              <div><div style={S.label}>AVALIAÇÃO (1-5)</div><input type="number" min="1" max="5" style={S.input} value={newPrest.avaliacao} onChange={e=>setNewPrest(f=>({...f,avaliacao:e.target.value}))} placeholder="5" /></div>
              <div><div style={S.label}>TELEFONE</div><input style={S.input} value={newPrest.telefone} onChange={e=>setNewPrest(f=>({...f,telefone:e.target.value}))} placeholder="(19) 99999-9999" /></div>
              <div><div style={S.label}>EMAIL</div><input style={S.input} value={newPrest.email} onChange={e=>setNewPrest(f=>({...f,email:e.target.value}))} placeholder="joao@email.com" /></div>
              <div style={{ gridColumn:"1/-1" }}><div style={S.label}>NOTAS</div><input style={S.input} value={newPrest.notas} onChange={e=>setNewPrest(f=>({...f,notas:e.target.value}))} placeholder="Confiável, rápido, bom preço..." /></div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={S.btn} onClick={addPrestador}>Salvar Prestador</button>
              <button style={S.btnGhost} onClick={()=>setAddingPrest(false)}>Cancelar</button>
            </div>
          </div>
        )}
        {!addingPrest && <button style={{ ...S.btnGhost, width:"100%", padding:14 }} onClick={()=>setAddingPrest(true)}>+ Adicionar Prestador</button>}
      </>}
    </div>
  );
}

function ObraCard({ obra, prop, bmForTipo, onUpd, onRem }) {
  const [open, setOpen] = useState(true);
  const bm=OBRA_BM[obra.bm_ref]||bmForTipo(obra.tipo), varO=(obra.executado||0)-(obra.orcado||0), varP=obra.orcado>0?(varO/obra.orcado)*100:0;
  const pMat=obra.pct_mat||bm.mat, pMao=obra.pct_mao||bm.mao, pAux=Math.max(0,1-pMat-pMao), base=obra.orcado||0;
  const statusC = { "Planejada":T.blue, "Em andamento":T.amber, "Concluída":T.green, "Pausada":T.muted };
  return (
    <div style={{ background:T.s1, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
      <div style={{ padding:"16px 20px", display:"flex", gap:14, alignItems:"flex-start" }}>
        <div style={{ flex:1 }}>
          <input style={{ ...S.input, background:"transparent", border:"none", padding:0, fontSize:15, fontWeight:700, marginBottom:8 }} value={obra.descricao} onChange={e=>onUpd("descricao",e.target.value)} placeholder="Descrição..." />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <select style={{ ...S.sel, padding:"4px 10px", fontSize:11 }} value={obra.tipo} onChange={e=>onUpd("tipo",e.target.value)}>{OBRA_TIPOS.map(t=><option key={t}>{t}</option>)}</select>
            <select style={{ ...S.sel, padding:"4px 10px", fontSize:11 }} value={obra.status} onChange={e=>onUpd("status",e.target.value)}>{OBRA_STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select>
            <span style={S.badge(statusC[obra.status]||T.muted)}>{obra.status}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:18 }} onClick={()=>setOpen(!open)}>{open?"▲":"▼"}</button>
          <button style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:16 }} onClick={onRem}>🗑</button>
        </div>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${T.border}`, padding:"16px 20px", background:T.s0, display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:12 }}>ORÇADO × EXECUTADO</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:14 }}>
              {[["ORÇADO (R$)","orcado"],["EXECUTADO (R$)","executado"],["INÍCIO","inicio","date"],["CONCLUSÃO","fim","date"]].map(([lbl,k,t])=>(
                <div key={k}><div style={S.label}>{lbl}</div><input type={t||"number"} style={S.input} value={obra[k]||""} onChange={e=>onUpd(k,e.target.value)} placeholder={t?"":0} /></div>
              ))}
            </div>
            {(obra.orcado>0||obra.executado>0)&&(
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ color:T.muted, fontSize:12 }}>Orçado × Executado</span>
                  {obra.orcado>0&&obra.executado>0&&<span style={{ color:varO>0?T.red:T.green, fontSize:12, fontWeight:700 }}>{varO>0?"+":""}{varP.toFixed(1)}% ({varO>0?"+":""}{fmt.brl(varO)})</span>}
                </div>
                <div style={{ position:"relative", height:12, background:T.s3, borderRadius:6, overflow:"hidden" }}>
                  <div style={{ position:"absolute", height:"100%", width:`${Math.min(100,(obra.orcado/Math.max(obra.orcado,obra.executado,1))*100)}%`, background:T.gold+"60", borderRadius:6 }} />
                  {obra.executado>0&&<div style={{ position:"absolute", height:"100%", width:`${Math.min(100,(obra.executado/Math.max(obra.orcado,obra.executado,1))*100)}%`, background:varO>0?T.red:T.green, borderRadius:6, opacity:0.85 }} />}
                </div>
              </div>
            )}
          </div>
          <div>
            <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:10 }}>MATERIAL × MÃO DE OBRA</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><div style={{ ...S.label, color:T.blue }}>% MATERIAL</div><input type="number" min="0" max="100" style={{ ...S.input, borderColor:T.blue+"40" }} value={obra.pct_mat>0?Math.round(obra.pct_mat*100):""} onChange={e=>onUpd("pct_mat",parseFloat(e.target.value)/100||bm.mat)} placeholder={`${Math.round(bm.mat*100)} (ref.)`} /></div>
              <div><div style={{ ...S.label, color:T.amber }}>% MÃO DE OBRA</div><input type="number" min="0" max="100" style={{ ...S.input, borderColor:T.amber+"40" }} value={obra.pct_mao>0?Math.round(obra.pct_mao*100):""} onChange={e=>onUpd("pct_mao",parseFloat(e.target.value)/100||bm.mao)} placeholder={`${Math.round(bm.mao*100)} (ref.)`} /></div>
            </div>
            {base>0&&(
              <div>
                <div style={{ height:10, borderRadius:4, overflow:"hidden", display:"flex", marginBottom:8 }}><div style={{ width:`${pMat*100}%`, background:T.blue }} /><div style={{ width:`${pMao*100}%`, background:T.amber }} /><div style={{ width:`${pAux*100}%`, background:T.teal }} /></div>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                  <span style={{ color:T.blue, fontSize:12 }}>▪ Material: {fmt.brlK(base*pMat)} ({(pMat*100).toFixed(0)}%)</span>
                  <span style={{ color:T.amber, fontSize:12 }}>▪ Mão de Obra: {fmt.brlK(base*pMao)} ({(pMao*100).toFixed(0)}%)</span>
                  {pAux>0&&<span style={{ color:T.teal, fontSize:12 }}>▪ Aux.: {fmt.brlK(base*pAux)} ({(pAux*100).toFixed(0)}%)</span>}
                </div>
              </div>
            )}
          </div>
          {obra.orcado>0&&<ImpactoNOI obra={obra} prop={prop} bm={bm} />}
          <div><div style={S.label}>NOTAS</div><input style={S.input} value={obra.notas||""} onChange={e=>onUpd("notas",e.target.value)} placeholder="Pedido do inquilino, problema estrutural, escopo adicional..." /></div>
        </div>
      )}
    </div>
  );
}

function ImpactoNOI({ obra, prop, bm }) {
  const custo=obra.executado||obra.orcado||0, aumentoMes=prop.rent*bm.imp_alug, aumentoAnual=aumentoMes*12;
  const payback=aumentoAnual>0?custo/aumentoAnual:null, noiAfter=prop.noi+aumentoAnual*0.85, ganhoVac=(bm.vac_reduz||0)*(prop.rent/30);
  return (
    <div style={{ padding:14, background:T.s2, borderRadius:10, border:`1px solid ${T.goldDim}40` }}>
      <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:12 }}>💰 IMPACTO NO NOI</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px,1fr))", gap:10 }}>
        {[
          { lbl:"Custo da Obra", val:`-${fmt.brlK(custo)}`, color:T.red, sub:"impacto imediato" },
          { lbl:"Aumento Aluguel Est.", val:`+${fmt.brl(aumentoMes)}/mês`, color:T.green, sub:`+${fmt.pct(bm.imp_alug)} s/ atual` },
          ...(payback?[{ lbl:"Payback Estimado", val:`${payback.toFixed(1)} anos`, color:payback<4?T.green:payback<7?T.amber:T.red, sub:payback<4?"Excelente":payback<7?"Aceitável":"Longo prazo" }]:[]),
          ...(ganhoVac>0?[{ lbl:"Ganho Vacância Est.", val:`+${fmt.brl(ganhoVac)}`, color:T.teal, sub:`↓${bm.vac_reduz}d vacância` }]:[]),
          { lbl:"NOI Pós-Obra Est.", val:`${fmt.brlK(noiAfter)}/ano`, color:noiAfter>prop.noi?T.green:T.amber, sub:`vs atual ${fmt.brlK(prop.noi)}` },
        ].map(item=>(
          <div key={item.lbl} style={{ background:T.s3, borderRadius:8, padding:"10px 12px" }}><div style={{ color:T.muted, fontSize:10, letterSpacing:0.5, marginBottom:4 }}>{item.lbl.toUpperCase()}</div><div style={{ color:item.color, fontSize:14, fontWeight:800, ...S.mono }}>{item.val}</div><div style={{ color:T.dim, fontSize:10, marginTop:3 }}>{item.sub}</div></div>
        ))}
      </div>
    </div>
  );
}

function NovaObraForm({ form, setForm, onAdd, onCancel, propSize, bmForTipo }) {
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const bm=OBRA_BM[form.bm_ref]||bmForTipo(form.tipo), orc=parseFloat(form.orcado)||0, area=parseFloat(propSize)||100;
  return (
    <div style={{ background:T.s0, borderRadius:14, padding:20, border:`2px solid ${T.goldDim}` }}>
      <div style={{ color:T.gold, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:16 }}>NOVA OBRA / REFORMA</div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div><div style={S.label}>DESCRIÇÃO</div><input style={S.input} value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Retrofit elétrico, Pintura geral..." /></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><div style={S.label}>TIPO</div><select style={S.sel} value={form.tipo} onChange={e=>set("tipo",e.target.value)}>{OBRA_TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><div style={S.label}>STATUS INICIAL</div><select style={S.sel} value={form.status} onChange={e=>set("status",e.target.value)}>{OBRA_STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <div style={{ padding:14, background:T.s1, borderRadius:10, border:`1px solid ${T.goldDim}40` }}>
          <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:10 }}>🧮 REFERÊNCIA DE CUSTO — SINAPI/SP 2026</div>
          <div><div style={S.label}>USAR COMO BASE</div><select style={S.sel} value={form.bm_ref} onChange={e=>set("bm_ref",e.target.value)}><option value="">Selecionar tipo de obra...</option>{Object.entries(OBRA_BM).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</select></div>
          {form.bm_ref&&(
            <div style={{ marginTop:12 }}>
              <div style={{ color:T.muted, fontSize:12, marginBottom:10 }}>{bm.desc}</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {[{ lbl:"Faixa/m²", val:`R$${bm.r_min}–${bm.r_max}` },{ lbl:`Est. ${area}m²`, val:`${fmt.brlK(bm.r_min*area)}–${fmt.brlK(bm.r_max*area)}` },{ lbl:"Mat./M.O.", val:`${Math.round(bm.mat*100)}%/${Math.round(bm.mao*100)}%` },{ lbl:"Duração", val:`~${Math.round(bm.dias100*area/100)}d` }].map(x=>(
                  <div key={x.lbl} style={{ background:T.s2, borderRadius:8, padding:"8px 14px" }}><div style={{ color:T.dim, fontSize:10 }}>{x.lbl.toUpperCase()}</div><div style={{ color:T.gold, fontSize:13, fontWeight:700 }}>{x.val}</div></div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><div style={S.label}>VALOR ORÇADO (R$)</div><input type="number" style={S.input} value={form.orcado} onChange={e=>set("orcado",e.target.value)} placeholder="0" /></div>
          <div><div style={S.label}>VALOR EXECUTADO (R$)</div><input type="number" style={S.input} value={form.executado} onChange={e=>set("executado",e.target.value)} placeholder="Deixar vazio se não iniciada" /></div>
          <div><div style={S.label}>DATA DE INÍCIO</div><input type="date" style={S.input} value={form.inicio} onChange={e=>set("inicio",e.target.value)} /></div>
          <div><div style={S.label}>CONCLUSÃO PREVISTA</div><input type="date" style={S.input} value={form.fim} onChange={e=>set("fim",e.target.value)} /></div>
        </div>
        {orc>0&&<div style={{ padding:10, background:T.s1, borderRadius:8 }}><div style={{ color:T.muted, fontSize:11, marginBottom:6 }}>Split estimado:</div><div style={{ display:"flex", gap:16, flexWrap:"wrap" }}><span style={{ color:T.blue, fontSize:12 }}>▪ Material: {fmt.brl(orc*bm.mat)}</span><span style={{ color:T.amber, fontSize:12 }}>▪ Mão de Obra: {fmt.brl(orc*bm.mao)}</span><span style={{ color:T.teal, fontSize:12 }}>▪ Serviços Aux.: {fmt.brl(orc*bm.aux)}</span></div></div>}
        <div><div style={S.label}>NOTAS</div><input style={S.input} value={form.notas} onChange={e=>set("notas",e.target.value)} placeholder="Motivo, escopo, observações..." /></div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}><button style={S.btnGhost} onClick={onCancel}>Cancelar</button><button style={S.btn} onClick={onAdd}>Adicionar Obra</button></div>
      </div>
    </div>
  );
}

function EstimadorObra({ PROPS, onBack, bmForTipo }) {
  const [tipo, setTipo]=useState("reforma_intermediaria"), [area, setArea]=useState(100), [imovelId, setImovelId]=useState("");
  const bm=OBRA_BM[tipo], a=parseFloat(area)||100, cMin=bm.r_min*a, cMax=bm.r_max*a, cRef=bm.r_ref*a;
  const propRef=imovelId?PROPS.find(p=>p.id===parseInt(imovelId)):null, aumentoMes=propRef?propRef.rent*bm.imp_alug:0, payback=aumentoMes>0?cRef/(aumentoMes*12):null;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}><button style={{ ...S.btnGhost, padding:"8px 16px" }} onClick={onBack}>← Voltar</button><div><div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700 }}>FERRAMENTA</div><h1 style={{ color:T.text, fontSize:22, fontWeight:800, margin:0 }}>Estimador de Custo de Obra</h1></div></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={S.card}>
            <div style={{ color:T.text, fontWeight:700, marginBottom:16 }}>Parâmetros</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div><div style={S.label}>TIPO DE OBRA</div><select style={S.sel} value={tipo} onChange={e=>setTipo(e.target.value)}>{Object.entries(OBRA_BM).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</select></div>
              <div><div style={S.label}>ÁREA (m²)</div><input type="number" style={S.input} value={area} onChange={e=>setArea(e.target.value)} /></div>
              <div><div style={S.label}>SIMULAR IMPACTO EM IMÓVEL</div><select style={S.sel} value={imovelId} onChange={e=>setImovelId(e.target.value)}><option value="">Selecionar imóvel...</option>{PROPS.map(p=><option key={p.id} value={p.id}>{p.name} — {p.neighborhood}</option>)}</select></div>
            </div>
          </div>
          <div style={{ ...S.card, border:`1px solid ${T.goldDim}` }}><div style={{ color:T.gold, fontWeight:700, marginBottom:6 }}>{bm.emoji} {bm.label}</div><div style={{ color:T.muted, fontSize:13, lineHeight:1.5 }}>{bm.desc}</div></div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={S.card}>
            <div style={{ color:T.text, fontWeight:700, marginBottom:14 }}>Estimativa de Custo</div>
            {[{ label:"Mínimo", value:fmt.brlK(cMin), color:T.green },{ label:`Referência (R$${bm.r_ref}/m²)`, value:fmt.brlK(cRef), color:T.goldBright, big:true },{ label:"Máximo", value:fmt.brlK(cMax), color:T.amber }].map(row=>(
              <div key={row.label} style={{ display:"flex", justifyContent:"space-between", padding:row.big?"12px 14px":"10px 14px", background:row.big?T.goldGlow:T.s2, borderRadius:8, marginBottom:8, border:row.big?`1px solid ${T.goldDim}`:"none" }}>
                <span style={{ color:row.big?T.gold:T.muted }}>{row.label}</span>
                <span style={{ color:row.color, fontSize:row.big?18:14, fontWeight:row.big?900:700, ...S.mono }}>{row.value}</span>
              </div>
            ))}
          </div>
          {propRef&&(
            <div style={{ ...S.card, border:`1px solid ${T.green}30` }}>
              <div style={{ color:T.green, fontWeight:700, marginBottom:14 }}>Impacto em {propRef.name}</div>
              {[{ label:"NOI atual", value:`${fmt.brlK(propRef.noi)}/ano`, color:T.muted },{ label:"Aumento aluguel est.", value:`+${fmt.brl(aumentoMes)}/mês`, color:T.green },{ label:"NOI pós-obra est.", value:`${fmt.brlK(propRef.noi+aumentoMes*12*0.85)}/ano`, color:T.green },{ label:"Custo da obra", value:`-${fmt.brlK(cRef)}`, color:T.red },...(payback?[{ label:"Payback est.", value:`${payback.toFixed(1)} anos`, color:payback<4?T.green:payback<7?T.amber:T.red }]:[])].map(row=>(
                <div key={row.label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${T.border}30` }}><span style={{ color:T.muted, fontSize:13 }}>{row.label}</span><span style={{ color:row.color, fontWeight:700, fontSize:13, ...S.mono }}>{row.value}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── OBRAS MODAL (LEGADO) ─────────────────────────────────────────────────────
function ObrasModal({ prop, onSave, onClose }) {
  const [obras, setObras] = useState(prop.obras || []);
  const [adding, setAdding] = useState(false);
  const [newObra, setNewObra] = useState({ descricao:"", tipo:"Corretiva", status:"Planejada", orcado:"", executado:"", inicio:"", fim:"", notas:"" });
  const addObra = () => {
    if (!newObra.descricao) return;
    const obra = { id:Date.now(), ...newObra, orcado:parseFloat(newObra.orcado)||0, executado:parseFloat(newObra.executado)||0 };
    setObras([...obras, obra]); setAdding(false);
    setNewObra({ descricao:"", tipo:"Corretiva", status:"Planejada", orcado:"", executado:"", inicio:"", fim:"", notas:"" });
  };
  const removeObra = (id) => setObras(obras.filter(o=>o.id!==id));
  const updateObra = (id,k,v) => setObras(obras.map(o=>o.id===id?{...o,[k]:k==="orcado"||k==="executado"?parseFloat(v)||0:v}:o));
  const totalOrcado=obras.reduce((s,o)=>s+(o.orcado||0),0), totalExecutado=obras.reduce((s,o)=>s+(o.executado||0),0), variacao=totalExecutado-totalOrcado;
  const statusColor={"Planejada":T.blue,"Em andamento":T.amber,"Concluída":T.green,"Pausada":T.muted};
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:T.s1, border:`1px solid ${T.borderMid}`, borderRadius:18, width:"100%", maxWidth:760, maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ padding:"24px 28px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"sticky", top:0, background:T.s1, zIndex:1 }}>
          <div><div style={{ color:T.muted, fontSize:11, fontWeight:700, letterSpacing:1 }}>OBRAS & REFORMAS</div><div style={{ color:T.text, fontWeight:800, fontSize:17, marginTop:2 }}>{prop.name}</div><div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{prop.neighborhood} · {prop.city}</div></div>
          <button style={{ background:T.s3, border:"none", color:T.muted, borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding:28, display:"flex", flexDirection:"column", gap:20 }}>
          {obras.length>0&&(
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div style={{ background:T.s2, borderRadius:10, padding:16 }}><div style={{ color:T.muted, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:6 }}>TOTAL ORÇADO</div><div style={{ color:T.gold, fontSize:22, fontWeight:800, ...S.mono }}>{fmt.brlK(totalOrcado)}</div></div>
              <div style={{ background:T.s2, borderRadius:10, padding:16 }}><div style={{ color:T.muted, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:6 }}>TOTAL EXECUTADO</div><div style={{ color:totalExecutado>totalOrcado?T.red:T.green, fontSize:22, fontWeight:800, ...S.mono }}>{fmt.brlK(totalExecutado)}</div></div>
              <div style={{ background:T.s2, borderRadius:10, padding:16 }}><div style={{ color:T.muted, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:6 }}>VARIAÇÃO</div><div style={{ color:variacao>0?T.red:T.green, fontSize:22, fontWeight:800, ...S.mono }}>{variacao>0?"+":""}{fmt.brlK(variacao)}</div></div>
            </div>
          )}
          {obras.length===0&&!adding&&<div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}><div style={{ fontSize:40, marginBottom:12 }}>🔨</div><div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>Nenhuma obra cadastrada</div></div>}
          {obras.map((obra) => {
            const variacaoObra=(obra.executado||0)-(obra.orcado||0), varPct=obra.orcado>0?((variacaoObra/obra.orcado)*100):0;
            return (
              <div key={obra.id} style={{ background:T.s2, borderRadius:12, padding:18, border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                  <div style={{ flex:1 }}>
                    <input style={{ ...S.input, background:"transparent", border:"none", padding:"0", fontSize:15, fontWeight:700, color:T.text }} value={obra.descricao} onChange={e=>updateObra(obra.id,"descricao",e.target.value)} placeholder="Descrição da obra..." />
                    <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                      <select style={{ ...S.sel, padding:"4px 10px", fontSize:11 }} value={obra.tipo} onChange={e=>updateObra(obra.id,"tipo",e.target.value)}>{OBRA_TIPOS.map(t=><option key={t}>{t}</option>)}</select>
                      <select style={{ ...S.sel, padding:"4px 10px", fontSize:11 }} value={obra.status} onChange={e=>updateObra(obra.id,"status",e.target.value)}>{OBRA_STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select>
                      <span style={S.badge(statusColor[obra.status]||T.muted)}>{obra.status}</span>
                    </div>
                  </div>
                  <button style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:18, padding:"0 4px" }} onClick={()=>removeObra(obra.id)}>🗑</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                  <div><div style={{ ...S.label, fontSize:10 }}>ORÇADO (R$)</div><input type="number" style={{ ...S.input, padding:"8px 12px", fontSize:13 }} value={obra.orcado||""} onChange={e=>updateObra(obra.id,"orcado",e.target.value)} placeholder="0" /></div>
                  <div><div style={{ ...S.label, fontSize:10 }}>EXECUTADO (R$)</div><input type="number" style={{ ...S.input, padding:"8px 12px", fontSize:13 }} value={obra.executado||""} onChange={e=>updateObra(obra.id,"executado",e.target.value)} placeholder="0" /></div>
                  <div><div style={{ ...S.label, fontSize:10 }}>INÍCIO</div><input type="date" style={{ ...S.input, padding:"8px 12px", fontSize:13 }} value={obra.inicio||""} onChange={e=>updateObra(obra.id,"inicio",e.target.value)} /></div>
                  <div><div style={{ ...S.label, fontSize:10 }}>CONCLUSÃO</div><input type="date" style={{ ...S.input, padding:"8px 12px", fontSize:13 }} value={obra.fim||""} onChange={e=>updateObra(obra.id,"fim",e.target.value)} /></div>
                </div>
                <div><div style={{ ...S.label, fontSize:10 }}>NOTAS</div><input style={{ ...S.input, padding:"8px 12px", fontSize:12 }} value={obra.notas||""} onChange={e=>updateObra(obra.id,"notas",e.target.value)} placeholder="Ex: pedido do inquilino..." /></div>
              </div>
            );
          })}
          {adding&&(
            <div style={{ background:T.s0, borderRadius:12, padding:18, border:`1px solid ${T.goldDim}` }}>
              <div style={{ color:T.gold, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:14 }}>NOVA OBRA</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div><div style={S.label}>DESCRIÇÃO</div><input style={S.input} value={newObra.descricao} onChange={e=>setNewObra(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Retrofit elétrico completo..." /></div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div><div style={S.label}>TIPO</div><select style={S.sel} value={newObra.tipo} onChange={e=>setNewObra(f=>({...f,tipo:e.target.value}))}>{OBRA_TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
                  <div><div style={S.label}>STATUS</div><select style={S.sel} value={newObra.status} onChange={e=>setNewObra(f=>({...f,status:e.target.value}))}>{OBRA_STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><div style={S.label}>ORÇADO (R$)</div><input type="number" style={S.input} value={newObra.orcado} onChange={e=>setNewObra(f=>({...f,orcado:e.target.value}))} placeholder="0" /></div>
                  <div><div style={S.label}>EXECUTADO (R$)</div><input type="number" style={S.input} value={newObra.executado} onChange={e=>setNewObra(f=>({...f,executado:e.target.value}))} placeholder="0" /></div>
                </div>
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><button style={S.btnGhost} onClick={()=>setAdding(false)}>Cancelar</button><button style={S.btn} onClick={addObra}>Adicionar Obra</button></div>
              </div>
            </div>
          )}
          {!adding&&<button style={{ ...S.btnGhost, width:"100%", padding:14, fontSize:14 }} onClick={()=>setAdding(true)}>+ Adicionar Obra</button>}
        </div>
        <div style={{ padding:"16px 28px", borderTop:`1px solid ${T.border}`, display:"flex", gap:12, justifyContent:"flex-end" }}>
          <button style={S.btnGhost} onClick={onClose}>Fechar sem salvar</button>
          <button style={S.btn} onClick={()=>{ onSave({...prop,obras}); onClose(); }}>Salvar Obras</button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE VALOR DE MERCADO ────────────────────────────────────────────────────
function PageValorMercado({ PROPS, onUpdateProps }) {
  const [sortBy, setSortBy] = useState("valor_desc");
  const [filterType, setFilterType] = useState("Todos");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const propsComValor = PROPS.map(p => {
    const bm = getFipeZAP(p.neighborhood, p.city, p.type);
    const m2ref = p.type === "Comercial" ? bm.com : bm.res;
    const valorEstimado = p.valorMercado > 0 ? p.valorMercado : m2ref * p.size;
    const valorCompra = p.valorCompra || 0;
    const ganhoCapital = valorCompra > 0 ? valorEstimado - valorCompra : null;
    const ganhoCapitalPct = valorCompra > 0 ? ganhoCapital / valorCompra : null;
    const capRate = valorEstimado > 0 ? p.totalIncome / valorEstimado : 0;
    return { ...p, m2ref, valorEstimado, valorCompra, ganhoCapital, ganhoCapitalPct, capRate, var12m: bm.var12m, valorizacaoAnual: valorEstimado * bm.var12m, fonteM2: bm.fonte, isManual: p.valorMercado > 0 };
  });

  const filtered = propsComValor
    .filter(p => filterType === "Todos" || p.type === filterType)
    .sort((a, b) => {
      if (sortBy === "valor_desc")   return b.valorEstimado - a.valorEstimado;
      if (sortBy === "valor_asc")    return a.valorEstimado - b.valorEstimado;
      if (sortBy === "caprate_desc") return b.capRate - a.capRate;
      if (sortBy === "valorizacao")  return b.var12m - a.var12m;
      if (sortBy === "ganho_desc")   return (b.ganhoCapital||0) - (a.ganhoCapital||0);
      return 0;
    });

  const totalValor     = propsComValor.reduce((s, p) => s + p.valorEstimado, 0);
  const capRateMedio   = propsComValor.reduce((s, p) => s + p.capRate, 0) / propsComValor.length;
  const valorizacaoEst = propsComValor.reduce((s, p) => s + p.valorizacaoAnual, 0);
  const comValorCompra = propsComValor.filter(p => p.valorCompra > 0).length;
  const totalGanho     = propsComValor.filter(p => p.valorCompra > 0).reduce((s, p) => s + (p.ganhoCapital || 0), 0);

  const saveEdit = () => {
    onUpdateProps(prev => prev.map(p => p.id !== editingId ? p : {
      ...p,
      valorMercado: parseFloat(editForm.valorMercado) || 0,
      valorCompra:  parseFloat(editForm.valorCompra)  || 0,
      anoCompra:    editForm.anoCompra || null,
    }));
    setEditingId(null);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({ valorMercado: p.valorMercado || "", valorCompra: p.valorCompra || "", anoCompra: p.anoCompra || "" });
  };

  // top 12 para o gráfico
  const top12 = [...propsComValor].sort((a, b) => b.valorEstimado - a.valorEstimado).slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>INTELIGÊNCIA DE MERCADO</div>
          <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Valor de Mercado</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>FipeZAP por bairro · Cap Rate · Valorização · Ganho de Capital</div>
        </div>
        <div style={{ color: T.dim, fontSize: 11, textAlign: "right" }}>
          FipeZAP dez/2025<br />Média SP: R$11.915/m² · +4,56% a.a.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {[
          { label: "VALOR TOTAL EST.",      value: fmt.brlK(totalValor),      sub: `${PROPS.length} imóveis`,                    color: T.gold },
          { label: "CAP RATE MÉDIO",        value: fmt.pct(capRateMedio),     sub: "aluguel líquido ÷ valor mercado",             color: capRateMedio > 0.06 ? T.green : T.amber },
          { label: "VALORIZAÇÃO ANUAL EST.", value: fmt.brlK(valorizacaoEst), sub: "FipeZAP por bairro",                          color: T.teal },
          ...(comValorCompra > 0 ? [{ label: "GANHO DE CAPITAL", value: fmt.brlK(totalGanho), sub: `${comValorCompra} imóveis com compra`, color: totalGanho >= 0 ? T.green : T.red }] : []),
        ].map(k => (
          <div key={k.label} style={{ ...S.card, flex: 1, minWidth: 160 }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 24, fontWeight: 900, ...S.mono }}>{k.value}</div>
            <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Cap Rate Chart */}
      <div style={S.card}>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Cap Rate por Imóvel — Top 12 por Valor</div>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>verde &gt;7% · amarelo 5–7% · vermelho &lt;5% · meta de mercado SP: 5–8%</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={top12.map(p => ({ name: p.name.replace("Apartamento ", "Ap.").replace("Sala Comercial ", "Sala "), capRate: parseFloat((p.capRate * 100).toFixed(2)), valor: p.valorEstimado, _cr: p.capRate }))} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 10 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fill: T.muted, fontSize: 10 }} unit="%" domain={[0, 12]} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ background: T.s2, border: `1px solid ${T.borderMid}`, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ color: T.gold, fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
                  <div style={{ color: T.text }}>Cap Rate: <strong>{d.capRate}%</strong></div>
                  <div style={{ color: T.muted, fontSize: 12 }}>Valor: {fmt.brlK(d.valor)}</div>
                </div>
              );
            }} />
            <Bar dataKey="capRate" radius={[4, 4, 0, 0]}>
              {top12.map((p, i) => <Cell key={i} fill={p.capRate > 0.07 ? T.green : p.capRate > 0.05 ? T.amber : T.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select style={S.sel} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option>Todos</option><option>Residencial</option><option>Comercial</option>
        </select>
        <select style={S.sel} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="valor_desc">↓ Maior valor</option>
          <option value="valor_asc">↑ Menor valor</option>
          <option value="caprate_desc">↓ Maior cap rate</option>
          <option value="valorizacao">↓ Maior valorização</option>
          <option value="ganho_desc">↓ Maior ganho de capital</option>
        </select>
        <div style={{ color: T.muted, fontSize: 12, marginLeft: "auto" }}>{filtered.length} imóveis · clique em ✎ para inserir valor real</div>
      </div>

      {/* Tabela */}
      <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.s2 }}>
              {["Imóvel", "Bairro", "m²", "R$/m² ref.", "Valor Est.", "Valor Compra", "Ganho Capital", "Cap Rate", "Valor. 12m", ""].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id} style={{ background: i % 2 === 0 ? T.s0 : T.s1 }}>
                  <td style={{ ...S.td, fontWeight: 600, color: T.goldBright, minWidth: 150 }}>
                    <div>{p.name}</div>
                    <div style={{ color: T.dim, fontSize: 11 }}>{p.type}</div>
                  </td>
                  <td style={S.td}>
                    <div style={{ color: T.text, fontSize: 12 }}>{p.neighborhood}</div>
                    <div style={{ color: T.dim, fontSize: 10 }}>{p.fonteM2}</div>
                  </td>
                  <td style={{ ...S.td, ...S.mono }}>{p.size}</td>
                  <td style={{ ...S.td, ...S.mono, color: T.gold }}>{fmt.num(p.m2ref)}</td>

                  {/* Valor estimado / manual */}
                  <td style={{ ...S.td, ...S.mono }}>
                    {isEditing ? (
                      <input type="number" style={{ ...S.input, padding: "6px 10px", fontSize: 12, width: 130 }}
                        value={editForm.valorMercado}
                        onChange={e => setEditForm(f => ({ ...f, valorMercado: e.target.value }))}
                        placeholder={`~${fmt.brlK(p.m2ref * p.size)}`}
                      />
                    ) : (
                      <div>
                        <div style={{ color: T.gold, fontWeight: 700 }}>{fmt.brlK(p.valorEstimado)}</div>
                        <div style={{ color: T.dim, fontSize: 10 }}>{p.isManual ? "✎ manual" : `auto · ${fmt.num(p.m2ref)}/m²`}</div>
                      </div>
                    )}
                  </td>

                  {/* Valor de compra */}
                  <td style={{ ...S.td, ...S.mono }}>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <input type="number" style={{ ...S.input, padding: "6px 10px", fontSize: 12, width: 130 }}
                          value={editForm.valorCompra} placeholder="Valor de compra"
                          onChange={e => setEditForm(f => ({ ...f, valorCompra: e.target.value }))}
                        />
                        <input type="number" style={{ ...S.input, padding: "6px 10px", fontSize: 12, width: 130 }}
                          value={editForm.anoCompra} placeholder="Ano de compra"
                          onChange={e => setEditForm(f => ({ ...f, anoCompra: e.target.value }))}
                        />
                      </div>
                    ) : p.valorCompra > 0 ? (
                      <div>
                        <div style={{ color: T.text }}>{fmt.brlK(p.valorCompra)}</div>
                        {p.anoCompra && <div style={{ color: T.dim, fontSize: 10 }}>{p.anoCompra}</div>}
                      </div>
                    ) : <div style={{ color: T.dim, fontSize: 11 }}>— inserir</div>}
                  </td>

                  {/* Ganho de capital */}
                  <td style={{ ...S.td, ...S.mono }}>
                    {p.ganhoCapital !== null ? (
                      <div>
                        <div style={{ color: p.ganhoCapital >= 0 ? T.green : T.red, fontWeight: 700 }}>
                          {p.ganhoCapital >= 0 ? "+" : ""}{fmt.brlK(p.ganhoCapital)}
                        </div>
                        <div style={{ color: p.ganhoCapitalPct >= 0 ? T.green : T.red, fontSize: 11 }}>
                          {(p.ganhoCapitalPct * 100).toFixed(1)}%
                        </div>
                      </div>
                    ) : <div style={{ color: T.dim, fontSize: 11 }}>Inserir compra →</div>}
                  </td>

                  {/* Cap rate */}
                  <td style={{ ...S.td, ...S.mono }}>
                    <div style={{ color: p.capRate > 0.07 ? T.green : p.capRate > 0.05 ? T.amber : T.red, fontWeight: 700 }}>
                      {fmt.pct(p.capRate)}
                    </div>
                    <div style={{ color: T.dim, fontSize: 10 }}>
                      {p.capRate > 0.07 ? "Excelente" : p.capRate > 0.05 ? "Bom" : "Baixo"}
                    </div>
                  </td>

                  {/* Valorização */}
                  <td style={{ ...S.td, ...S.mono }}>
                    <div style={{ color: T.teal, fontWeight: 700 }}>+{fmt.pct(p.var12m)}</div>
                    <div style={{ color: T.dim, fontSize: 10 }}>+{fmt.brlK(p.valorizacaoAnual)}</div>
                  </td>

                  <td style={S.td}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...S.btn, padding: "6px 14px", fontSize: 12 }} onClick={saveEdit}>✓</button>
                        <button style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 12 }} onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    ) : (
                      <button style={{ ...S.btnGhost, padding: "6px 14px", fontSize: 12 }} onClick={() => startEdit(p)}>✎</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Nota metodologia */}
      <div style={{ padding: "12px 16px", background: T.s1, borderRadius: 10, border: `1px solid ${T.border}` }}>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>📊 Metodologia</div>
        <div style={{ color: T.dim, fontSize: 11, lineHeight: 1.6 }}>
          Estimativas baseadas no Índice FipeZAP dez/2025 por bairro (residencial e comercial separados).
          Média SP residencial: <strong style={{ color: T.gold }}>R$11.915/m²</strong> · Valorização 12m: <strong style={{ color: T.teal }}>+4,56%</strong>.
          Cap rate = receita anual líquida ÷ valor de mercado. Meta de mercado SP: 5–8% residencial.
          Clique em ✎ para inserir valor de mercado real e valor de compra — o ganho de capital é calculado automaticamente.
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function PageDashboard({ PROPS, onNav, onProp }) {
  const PORT = computePort(PROPS);
  const PORT_MONTHLY = MONTHS.map((m, i) => ({ month: m, receita: PROPS.reduce((s, p) => s + p.monthlyData[i].receita, 0), despesas: PROPS.reduce((s, p) => s + p.monthlyData[i].despesas, 0), noi: PROPS.reduce((s, p) => s + p.monthlyData[i].noi, 0) }));
  const INSIGHTS = buildInsights(PROPS);
  const topLeakage = [...PROPS].sort((a, b) => b.leakage - a.leakage).slice(0, 5);
  const costBreakdown = [
    { name: "IPTU", value: PROPS.reduce((s, p) => s + p.iptu, 0), color: T.amber },
    { name: "Manutenção", value: PROPS.reduce((s, p) => s + p.maintMonthly * 12, 0), color: T.red },
    { name: "Seguro", value: PROPS.reduce((s, p) => s + p.insurance, 0), color: T.blue },
    { name: "Administração", value: PROPS.reduce((s, p) => s + p.admin * 12, 0), color: T.teal },
  ];

  // Valor de mercado total do portfólio
  const totalValorMercado = PROPS.reduce((s, p) => {
    const bm = getFipeZAP(p.neighborhood, p.city, p.type);
    const m2 = p.type === "Comercial" ? bm.com : bm.res;
    return s + (p.valorMercado > 0 ? p.valorMercado : m2 * p.size);
  }, 0);

  const totalObras = PROPS.reduce((s, p) => s + (p.obras || []).length, 0);
  const obrasEmAndamento = PROPS.reduce((s, p) => s + (p.obras || []).filter(o => o.status === "Em andamento").length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>PORTFÓLIO · {PROPS.length} IMÓVEIS</div>
          <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Visão Executiva</h1>
        </div>
        <div style={{ color: T.dim, fontSize: 12 }}>{fmt.date()}</div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KPI label="Receita Bruta" value={fmt.brlK(PORT.receita)} sub="últimos 12 meses" />
        <KPI label="NOI" value={fmt.brlK(PORT.noi)} sub={`Margem: ${fmt.pct(PORT.noiPct)}`} color={T.green} delta={3.2} />
        <KPI label="Custo Vacância" value={fmt.brlK(PORT.vacancyCost)} color={T.amber} sub={`${PROPS.filter(p => p.status === "Vago").length} imóveis vagos`} warn />
        <div style={{ ...S.card, minWidth: 180, flex: 1, cursor: "pointer" }} onClick={() => onNav("mercado")}>
          <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>VALOR DE MERCADO EST.</div>
          <div style={{ color: T.gold, fontSize: 28, fontWeight: 800, ...S.mono, lineHeight: 1 }}>{fmt.brlK(totalValorMercado)}</div>
          <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>FipeZAP dez/2025 · ver análise →</div>
        </div>
      </div>

      {totalObras > 0 && (
        <div style={{ padding: "12px 18px", background: T.s2, borderRadius: 10, border: `1px solid ${T.amber}40`, display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>🔨</span>
          <div><span style={{ color: T.text, fontWeight: 600 }}>{totalObras} obra{totalObras > 1 ? "s" : ""} cadastrada{totalObras > 1 ? "s" : ""}</span>{obrasEmAndamento > 0 && <span style={{ color: T.amber, marginLeft: 8 }}>· {obrasEmAndamento} em andamento</span>}</div>
          <button style={{ ...S.btnGhost, marginLeft: "auto", padding: "6px 14px", fontSize: 12 }} onClick={() => onNav("noi")}>Ver imóveis →</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 4, fontSize: 15 }}>NOI Mensal — 2024</div>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>Receita vs NOI líquido</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={PORT_MONTHLY}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.blue} stopOpacity={0.15} /><stop offset="95%" stopColor={T.blue} stopOpacity={0} /></linearGradient>
                <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.2} /><stop offset="95%" stopColor={T.green} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="receita" name="Receita" stroke={T.blue} fill="url(#gR)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="noi" name="NOI" stroke={T.green} fill="url(#gN)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Despesas</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={44} outerRadius={70} dataKey="value" paddingAngle={4}>{costBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={v => fmt.brl(v)} /></PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
            {costBreakdown.map(c => (
              <div key={c.name} style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} /><span style={{ color: T.muted, fontSize: 11 }}>{c.name}</span></div>
                <span style={{ color: T.text, fontSize: 11, ...S.mono }}>{fmt.brlK(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Top 5 — Maior Leakage</div>
          {topLeakage.map((p, i) => (
            <div key={p.id} onClick={() => { onProp(p); onNav("detail"); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 4 ? `1px solid ${T.border}40` : "none", cursor: "pointer" }}>
              <span style={{ color: T.dim, fontSize: 12, minWidth: 20, ...S.mono }}>{i + 1}</span>
              <div style={{ flex: 1 }}><div style={{ color: T.goldBright, fontSize: 13, fontWeight: 600 }}>{p.name}</div><div style={{ color: T.muted, fontSize: 11 }}>{p.neighborhood}</div></div>
              <span style={{ color: p.leakage > 60 ? T.red : T.amber, fontWeight: 800, ...S.mono }}>{p.leakage}</span>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Alertas Ativos</div>
          {INSIGHTS.slice(0, 4).map(ins => (
            <div key={ins.id} onClick={() => onNav("leakage")} style={{ display: "flex", gap: 10, padding: "10px 12px", background: T.s2, borderRadius: 8, marginBottom: 8, cursor: "pointer", border: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 16 }}>{ins.icon}</span>
              <div style={{ flex: 1 }}><div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{ins.title}</div><div style={{ color: T.muted, fontSize: 11 }}>{fmt.brl(ins.impactMin)}–{fmt.brl(ins.impactMax)}/ano</div></div>
              <SevBadge s={ins.severity} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NOI PAGE ─────────────────────────────────────────────────────────────────
function PageNOI({ PROPS, onProp, onNav, onEdit, onObras, onDelete, onAdd }) {
  const [sortCol, setSortCol] = useState("noi");
  const [sortDir, setSortDir] = useState(-1);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const sorted = useMemo(() => {
    let list = PROPS;
    if (filterType) list = list.filter(p => p.type === filterType);
    if (filterStatus) list = list.filter(p => p.status === filterStatus);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.neighborhood.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => (a[sortCol] - b[sortCol]) * sortDir);
  }, [sortCol, sortDir, filterType, filterStatus, search, PROPS]);
  const toggle = (c) => { if (sortCol === c) setSortDir(d => -d); else { setSortCol(c); setSortDir(-1); } };
  const Th = ({ col, label }) => <th style={{ ...S.th, cursor: "pointer" }} onClick={() => toggle(col)}>{label}{sortCol === col ? (sortDir < 0 ? " ↓" : " ↑") : ""}</th>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>ANÁLISE</div><h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>NOI por Imóvel</h1></div>
        <button style={{ ...S.btn, display: "flex", alignItems: "center", gap: 8 }} onClick={onAdd}>+ Adicionar Imóvel</button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Buscar imóvel, bairro ou endereço..." style={{ ...S.input, maxWidth: 280 }} value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.sel} value={filterType} onChange={e => setFilterType(e.target.value)}><option value="">Todos os tipos</option><option>Residencial</option><option>Comercial</option></select>
        <select style={S.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">Todos os status</option><option>Ocupado</option><option>Vago</option></select>
        <span style={{ color: T.muted, fontSize: 12 }}>{sorted.length} imóveis</span>
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.s2 }}>
              <Th col="id" label="#" /><th style={S.th}>Imóvel / Endereço</th><th style={S.th}>Tipo</th><th style={S.th}>Status</th>
              <Th col="rent" label="Aluguel/mês" /><Th col="noi" label="NOI 12m" /><Th col="noiPct" label="Margem" />
              <Th col="vacancyDays" label="Vacância" /><Th col="leakage" label="Leakage" /><th style={S.th}>Obras</th><th style={S.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const obrasCount = (p.obras || []).length, obrasAtivas = (p.obras || []).filter(o => o.status === "Em andamento").length;
              return (
                <tr key={p.id} style={{ cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = T.s2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...S.td, color: T.dim, ...S.mono, fontSize: 11 }} onClick={() => { onProp(p); onNav("detail"); }}>{String(p.id).padStart(2, "0")}</td>
                  <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><div style={{ color: T.goldBright, fontWeight: 600, fontSize: 13 }}>{p.name}</div><div style={{ color: T.dim, fontSize: 11 }}>{p.address} · {p.neighborhood}</div></td>
                  <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><span style={S.badge(p.type === "Comercial" ? T.blue : T.teal)}>{p.type}</span></td>
                  <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><span style={S.badge(p.status === "Ocupado" ? T.green : T.red)}>{p.status}</span></td>
                  <td style={{ ...S.td, ...S.mono }} onClick={() => { onProp(p); onNav("detail"); }}>{fmt.brl(p.rent)}</td>
                  <td style={{ ...S.td, ...S.mono, color: p.noi > 0 ? T.green : T.red, fontWeight: 700 }} onClick={() => { onProp(p); onNav("detail"); }}>{fmt.brl(p.noi)}</td>
                  <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><span style={{ color: p.noiPct > 0.55 ? T.green : p.noiPct > 0.4 ? T.amber : T.red, fontSize: 12, fontWeight: 700, ...S.mono }}>{fmt.pct(p.noiPct)}</span></td>
                  <td style={{ ...S.td, color: p.vacancyDays > p.vacancyBenchmark ? T.amber : T.muted }} onClick={() => { onProp(p); onNav("detail"); }}>{p.vacancyDays}d</td>
                  <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><span style={{ color: p.leakage > 60 ? T.red : p.leakage > 30 ? T.amber : T.green, fontSize: 13, fontWeight: 800, ...S.mono }}>{p.leakage}</span></td>
                  <td style={S.td}>{obrasCount > 0 ? <span style={S.badge(obrasAtivas > 0 ? T.amber : T.muted)}>🔨 {obrasCount}{obrasAtivas > 0 ? ` (${obrasAtivas} ativ.)` : ""}</span> : <span style={{ color: T.dim, fontSize: 11 }}>—</span>}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button title="Editar" style={{ background: T.s3, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }} onClick={e => { e.stopPropagation(); onEdit(p); }}>✏️</button>
                      <button title="Obras" style={{ background: T.s3, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }} onClick={e => { e.stopPropagation(); onObras(p); }}>🔨</button>
                      <button title="Remover" style={{ background: T.s3, border: `1px solid ${T.redDim}`, color: T.red, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }} onClick={e => { e.stopPropagation(); onDelete(p); }}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {PROPS.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Nenhum imóvel no portfólio</div>
          <div style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Adicione o primeiro imóvel para começar</div>
          <button style={S.btn} onClick={onAdd}>+ Adicionar Imóvel</button>
        </div>
      )}
    </div>
  );
}

// ─── LEAKAGE PAGE ─────────────────────────────────────────────────────────────
function PageLeakage({ PROPS }) {
  const INSIGHTS = buildInsights(PROPS);
  const TOTAL_MIN = INSIGHTS.reduce((s, i) => s + i.impactMin, 0), TOTAL_MAX = INSIGHTS.reduce((s, i) => s + i.impactMax, 0);
  const [expanded, setExpanded] = useState(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div><div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>MOTOR DE INTELIGÊNCIA</div><h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Leakage Finder</h1></div>
      <div style={{ ...S.cardGold, display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
        <div><div style={{ color: T.goldDim, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>PERDA ESTIMADA ANUAL</div><div style={{ color: T.red, fontSize: 36, fontWeight: 900, ...S.mono }}>{fmt.brlK(TOTAL_MIN)}</div><div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>até {fmt.brlK(TOTAL_MAX)}</div></div>
        <div style={{ width: 1, height: 60, background: T.goldDim }} />
        <div><div style={{ color: T.goldDim, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>INSIGHTS ATIVOS</div><div style={{ color: T.gold, fontSize: 36, fontWeight: 900, ...S.mono }}>{INSIGHTS.length}</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {INSIGHTS.map(ins => {
          const open = expanded === ins.id, borderColor = ins.severity === "alta" ? T.red : ins.severity === "média" ? T.amber : T.blue;
          return (
            <div key={ins.id} style={{ background: T.s1, border: `1px solid ${open ? borderColor + "60" : T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: 20, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 16 }} onClick={() => setExpanded(open ? null : ins.id)}>
                <div style={{ fontSize: 22 }}>{ins.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}><span style={{ color: T.text, fontWeight: 800, fontSize: 15 }}>{ins.title}</span><SevBadge s={ins.severity} /></div>
                  <div style={{ color: T.muted, fontSize: 13 }}>{ins.description}</div>
                  {ins.metric && <div style={{ marginTop: 8, padding: "5px 10px", background: T.s2, borderRadius: 6, display: "inline-block" }}><span style={{ color: T.gold, fontSize: 12, fontWeight: 700 }}>{ins.metric}</span></div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ color: T.red, ...S.mono, fontWeight: 900, fontSize: 15 }}>{fmt.brlK(ins.impactMin)}</div><div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>a {fmt.brlK(ins.impactMax)}/ano</div><div style={{ color: T.muted, fontSize: 16, marginTop: 6 }}>{open ? "▲" : "▼"}</div></div>
              </div>
              {open && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: 20, background: T.s0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: ins.props.length > 0 ? "1fr 1fr" : "1fr", gap: 20 }}>
                    {ins.props.length > 0 && (
                      <div>
                        <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>IMÓVEIS AFETADOS</div>
                        {ins.props.map(p => (
                          <div key={p.id} style={{ padding: "10px 14px", background: T.s1, borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <div><div style={{ color: T.goldBright, fontWeight: 600, fontSize: 13 }}>{p.name}</div><div style={{ color: T.dim, fontSize: 11 }}>{p.neighborhood}</div></div>
                              <div style={{ textAlign: "right" }}>
                                
                                {ins.type === "vacancy" && <div style={{ color: T.amber, fontSize: 13, fontWeight: 700 }}>{p.vacancyDays}d</div>}
                                {ins.type === "maintenance" && <div style={{ color: T.amber, fontSize: 13, fontWeight: 700 }}>+{p.maintDelta}%</div>}
                                {ins.type === "noi" && <div style={{ color: T.red, fontSize: 13, fontWeight: 700 }}>{fmt.pct(p.noiPct)}</div>}
                                {ins.type === "aluguel_baixo" && <div style={{ color: T.amber, fontSize: 13, fontWeight: 700 }}>{fmt.brl(p.rent - (p.descontoAluguel||0))}/mês</div>}
                                {ins.type === "aluguel_baixo" && <div style={{ color: T.amber, fontSize: 13, fontWeight: 700 }}>{fmt.brl(p.rent - (p.descontoAluguel||0))}/mês</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>PLANO DE AÇÃO</div>
                      {ins.actions.map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, padding: "10px 14px", background: T.s1, borderRadius: 8 }}>
                          <div style={{ minWidth: 22, height: 22, borderRadius: "50%", background: T.goldGlow, border: `1px solid ${T.goldDim}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                          <span style={{ color: T.text, fontSize: 13, lineHeight: 1.5 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DETAIL PAGE ──────────────────────────────────────────────────────────────
function PageDetail({ prop, onBack, onEdit, onObras, onDelete }) {
  if (!prop) return null;
  const obrasCount = (prop.obras || []).length, obrasEmAndamento = (prop.obras || []).filter(o => o.status === "Em andamento"), totalOrcado = (prop.obras || []).reduce((s, o) => s + (o.orcado || 0), 0), totalExecutado = (prop.obras || []).reduce((s, o) => s + (o.executado || 0), 0);
  const opportunities = [];
  // Verificar aluguel vs valor de mercado
  const vmRef = (prop.marketValueManual > 0 ? prop.marketValueManual : prop.valorMercado > 0 ? prop.valorMercado : 0);
  if (vmRef > 0) {
    const yieldEsperado = prop.type === "Comercial" ? 0.007 : 0.005;
    const aluguelEsperado = vmRef * yieldEsperado;
    const aluguelAtual = prop.rent - (prop.descontoAluguel || 0);
    const defasagem = aluguelEsperado - aluguelAtual;
    if (defasagem > aluguelAtual * 0.08) {
      opportunities.push({ icon: "💰", color: T.amber, title: "Aluguel Abaixo do Potencial de Mercado", desc: `Aluguel atual: ${fmt.brl(aluguelAtual)}/mês. Com rentabilidade de ${prop.type === "Comercial" ? "0,7%" : "0,5%"} sobre ${fmt.brlK(vmRef)}, o esperado seria ${fmt.brl(Math.round(aluguelEsperado))}/mês. Potencial de reajuste: ${fmt.brl(Math.round(defasagem))}/mês (${fmt.brlK(Math.round(defasagem * 12))}/ano).` });
    }
  }
  // IPTU benchmark removido
  if (prop.vacancyDays > prop.vacancyBenchmark) opportunities.push({ icon: "🏠", color: T.red, title: "Vacância Acima da Média", desc: `${prop.vacancyDays} dias vagos vs benchmark ${prop.vacancyBenchmark} dias.` });
  if (prop.maintDelta > 40) opportunities.push({ icon: "🔧", color: T.amber, title: "Manutenção com Custo Anômalo", desc: `R$${prop.maintMonthly}/mês — ${prop.maintDelta}% acima do benchmark.` });
  if (prop.noiPct < 0.5) opportunities.push({ icon: "📉", color: T.red, title: "Margem NOI Abaixo do Padrão", desc: `NOI de ${fmt.pct(prop.noiPct)} abaixo do objetivo de 55%.` });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <button style={{ ...S.btnGhost, padding: "8px 16px", flexShrink: 0 }} onClick={onBack}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>DETALHE DO IMÓVEL</div>
          <h1 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: 0 }}>{prop.name}</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span>{prop.address}</span><span>·</span><span>{prop.neighborhood}, {prop.city}</span><span>·</span><span>{prop.size}m²</span>
            <span style={S.badge(prop.status === "Ocupado" ? T.green : T.red)}>{prop.status}</span>
            <span style={S.badge(prop.type === "Comercial" ? T.blue : T.teal)}>{prop.type}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button style={S.btnGhost} onClick={() => onEdit(prop)}>✏️ Editar</button>
          <button style={S.btnGhost} onClick={() => onObras(prop)}>🔨 Obras {obrasCount > 0 ? `(${obrasCount})` : ""}</button>
          <button style={S.btnDanger} onClick={() => onDelete(prop)}>🗑 Remover</button>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ color: T.muted, fontSize: 11, marginBottom: 4 }}>LEAKAGE</div><div style={{ color: prop.leakage > 60 ? T.red : prop.leakage > 30 ? T.amber : T.green, fontSize: 40, fontWeight: 900, ...S.mono, lineHeight: 1 }}>{prop.leakage}</div></div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KPI label="Receita 12m" value={fmt.brlK(prop.totalIncome)} size="md" />
        <KPI label="Despesas 12m" value={fmt.brlK(prop.totalExpenses)} color={T.red} size="md" />
        <KPI label="NOI 12m" value={fmt.brlK(prop.noi)} sub={`Margem: ${fmt.pct(prop.noiPct)}`} color={prop.noi > 0 ? T.green : T.red} size="md" />
        <KPI label="Vacância" value={`${prop.vacancyDays}d`} sub={`Benchmark: ${prop.vacancyBenchmark}d`} color={prop.vacancyDays > prop.vacancyBenchmark ? T.amber : T.muted} size="md" warn={prop.vacancyDays > prop.vacancyBenchmark} />
      </div>
      {obrasCount > 0 && (
        <div style={{ ...S.card, border: `1px solid ${T.amber}40` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>🔨 Obras & Reformas</div><button style={{ ...S.btnGhost, padding: "6px 14px", fontSize: 12 }} onClick={() => onObras(prop)}>Gerenciar →</button></div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ background: T.s2, borderRadius: 8, padding: "10px 16px" }}><div style={{ color: T.muted, fontSize: 10, letterSpacing: 1 }}>ORÇADO</div><div style={{ color: T.gold, fontSize: 18, fontWeight: 800, ...S.mono }}>{fmt.brlK(totalOrcado)}</div></div>
            <div style={{ background: T.s2, borderRadius: 8, padding: "10px 16px" }}><div style={{ color: T.muted, fontSize: 10, letterSpacing: 1 }}>EXECUTADO</div><div style={{ color: totalExecutado > totalOrcado ? T.red : T.green, fontSize: 18, fontWeight: 800, ...S.mono }}>{fmt.brlK(totalExecutado)}</div></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {prop.obras.slice(0, 3).map(obra => (
              <div key={obra.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: T.s2, borderRadius: 8 }}>
                <div><span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{obra.descricao}</span><span style={{ color: T.dim, fontSize: 11, marginLeft: 8 }}>{obra.tipo}</span></div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {obra.orcado > 0 && <span style={{ color: T.muted, fontSize: 12, ...S.mono }}>{fmt.brl(obra.orcado)}</span>}
                  <span style={S.badge({ "Planejada": T.blue, "Em andamento": T.amber, "Concluída": T.green, "Pausada": T.muted }[obra.status] || T.muted)}>{obra.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Cashflow 2024</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={prop.monthlyData} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="receita" name="Receita" fill={T.blue} radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill={T.red} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 4, fontSize: 15 }}>Benchmark</div>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>Linha dourada = padrão de mercado</div>
          {/* IPTU benchmark removido — varia por valor venal individual */}
          <BenchmarkBar label="Manutenção/mês" value={prop.maintMonthly} benchmark={prop.maintBenchmark} unit="R$" delta={prop.maintDelta} />
        </div>
      </div>
      {opportunities.length > 0 && (
        <div style={S.cardGold}>
          <div style={{ color: T.gold, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>💡 Oportunidades Identificadas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {opportunities.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "12px 16px", background: T.s0, borderRadius: 10, border: `1px solid ${o.color}30` }}>
                <span style={{ fontSize: 18 }}>{o.icon}</span>
                <div><div style={{ color: o.color, fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{o.title}</div><div style={{ color: T.muted, fontSize: 13 }}>{o.desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DECISION PAGES ───────────────────────────────────────────────────────────
const RETROFIT_POTENTIAL = { "Jardins":{ multiplier:1.8, demand:"Alta" }, "Itaim Bibi":{ multiplier:1.9, demand:"Muito Alta" }, "Vila Olímpia":{ multiplier:1.7, demand:"Alta" }, "Pinheiros":{ multiplier:1.6, demand:"Alta" }, "Bela Vista":{ multiplier:1.5, demand:"Média-Alta" }, "Cerqueira César":{ multiplier:1.7, demand:"Alta" }, "Jardim Paulista":{ multiplier:1.8, demand:"Alta" }, "Jardim América":{ multiplier:1.9, demand:"Muito Alta" }, "Jardim Europa":{ multiplier:2.0, demand:"Muito Alta" }, "Morumbi":{ multiplier:1.6, demand:"Alta" }, "Consolação":{ multiplier:1.4, demand:"Média" }, "Vila Nova Conceição":{ multiplier:1.8, demand:"Alta" }, "Cambuí":{ multiplier:1.3, demand:"Média" }, "Centro":{ multiplier:1.1, demand:"Baixa" }, "Nova Campinas":{ multiplier:1.4, demand:"Média" }, "Vila Guiomar":{ multiplier:1.0, demand:"Baixa" } };
const MARKET_APPRECIATION = { "São Paulo":{ Residencial:0.082, Comercial:0.045 }, "Campinas":{ Residencial:0.065, Comercial:0.038 }, "Santo André":{ Residencial:0.055, Comercial:0.030 }, "Americana":{ Residencial:0.028, Comercial:0.022 } };

function buildDecision(prop) {
  const bm=BENCHMARKS[prop.city]?.[prop.type]||BENCHMARKS["São Paulo"][prop.type], retro=RETROFIT_POTENTIAL[prop.neighborhood]||{ multiplier:1.3, demand:"Média" }, appreciation=MARKET_APPRECIATION[prop.city]?.[prop.type]||0.06, marketCapRate=bm.cap_rate;
  const impliedValue=prop.noi/marketCapRate, improvedNOI=prop.noi*1.15, improvedValue=improvedNOI/marketCapRate, saleValue=impliedValue, saleValueOptimistic=impliedValue*1.12, reinvestReturn=saleValue*(marketCapRate+0.01);
  const retroCost=prop.size*(prop.type==="Comercial"?1800:1200), retroRentIncrease=prop.rent*(retro.multiplier-1)*0.6, retroNewNOI=(prop.rent+retroRentIncrease)*12*0.85-prop.totalExpenses*0.9, retroNewValue=retroNewNOI/(marketCapRate-0.005), retroROI=((retroNewValue-impliedValue-retroCost)/retroCost)*100, retroPayback=retroCost/(retroRentIncrease*12);
  const otherType=prop.type==="Residencial"?"Comercial":"Residencial", otherBm=BENCHMARKS[prop.city]?.[otherType]||BENCHMARKS["São Paulo"][otherType], reposRentEstimate=prop.size*(otherType==="Comercial"?85:55), reposNOI=reposRentEstimate*12*0.75, reposValue=reposNOI/otherBm.cap_rate, reposCost=prop.size*600;
  const keepScore=Math.min(95,Math.max(10,50+(prop.noiPct>0.6?25:prop.noiPct>0.5?15:prop.noiPct<0.4?-20:0)+(prop.vacancyDays<bm.vacancy_days?15:prop.vacancyDays>bm.vacancy_days*2?-20:0)+(prop.iptuDelta<10?10:0)+(prop.maintDelta<20?10:0)));
  const sellScore=Math.min(95,Math.max(10,50+(prop.noiPct<0.4?30:prop.noiPct<0.5?15:0)+(prop.vacancyDays>bm.vacancy_days*2?20:0)+(prop.leakage>70?15:0)+(prop.maintDelta>60?10:0)));
  const retroScore=Math.min(95,Math.max(10,40+(retro.demand==="Muito Alta"?30:retro.demand==="Alta"?20:retro.demand==="Média"?5:0)+(prop.type==="Comercial"?15:0)+(prop.size>100?10:0)+(retroROI>30?15:0)+(prop.noiPct<0.5?10:0)));
  const reposScore=Math.min(90,Math.max(10,30+(prop.noiPct<0.45?20:0)+(otherType==="Comercial"&&["Itaim Bibi","Jardins","Pinheiros","Vila Olímpia"].includes(prop.neighborhood)?25:0)+(reposValue>impliedValue*1.2?20:0)));
  const scores=[{ id:"keep",score:keepScore },{ id:"sell",score:sellScore },{ id:"retrofit",score:retroScore },{ id:"reposition",score:reposScore }].sort((a,b)=>b.score-a.score);
  return { keepScore,sellScore,retroScore,reposScore,recommendation:scores[0].id,impliedValue,saleValue,saleValueOptimistic,improvedNOI,improvedValue,reinvestReturn,retroCost,retroRentIncrease,retroNewNOI,retroNewValue,retroROI,retroPayback,reposRentEstimate,reposNOI,reposValue,reposCost,otherType,marketCapRate,retro,appreciation };
}

const DECISION_META = { keep:{ label:"Manter & Otimizar", icon:"📈", color:"#2ECC9A", short:"MANTER" }, sell:{ label:"Vender Agora", icon:"💰", color:"#E85565", short:"VENDER" }, retrofit:{ label:"Retrofitar", icon:"🔨", color:"#F5A623", short:"RETROFIT" }, reposition:{ label:"Reposicionar Uso", icon:"🔄", color:"#4A8CF5", short:"REPOSICIONAR" } };

function ScoreRing({ score, color, size=56 }) {
  const r=(size/2)-6, circ=2*Math.PI*r, filled=circ*(score/100);
  return <svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.s3} strokeWidth={5} /><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} /><text x={size/2} y={size/2+5} textAnchor="middle" fill={color} fontSize={size===56?14:11} fontWeight={800} fontFamily="'DM Mono', monospace">{score}</text></svg>;
}

function PageDecision({ PROPS, onProp, onNav }) {
  const DECISIONS=PROPS.map(p=>({...p,decision:buildDecision(p)}));
  const [selected,setSelected]=useState(null), [filterRec,setFilterRec]=useState(""), [filterType,setFilterType]=useState("");
  const filtered=useMemo(()=>{ let list=DECISIONS; if(filterRec) list=list.filter(p=>p.decision.recommendation===filterRec); if(filterType) list=list.filter(p=>p.type===filterType); return list.sort((a,b)=>b.leakage-a.leakage); },[filterRec,filterType,DECISIONS]);
  const counts={ keep:DECISIONS.filter(p=>p.decision.recommendation==="keep").length, sell:DECISIONS.filter(p=>p.decision.recommendation==="sell").length, retrofit:DECISIONS.filter(p=>p.decision.recommendation==="retrofit").length, reposition:DECISIONS.filter(p=>p.decision.recommendation==="reposition").length };
  if (selected) return <PageDecisionDetail prop={selected} onBack={()=>setSelected(null)} />;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <div><div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:6 }}>MOTOR DE DECISÃO</div><h1 style={{ color:T.text, fontSize:26, fontWeight:800, margin:0 }}>O Que Fazer com Cada Imóvel?</h1></div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {Object.entries(DECISION_META).map(([id,meta])=>(
          <div key={id} onClick={()=>setFilterRec(filterRec===id?"":id)} style={{ ...S.card, flex:1, minWidth:130, cursor:"pointer", border:`1px solid ${filterRec===id?meta.color+"80":T.border}`, background:filterRec===id?meta.color+"12":T.s1 }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{meta.icon}</div><div style={{ color:meta.color, fontSize:28, fontWeight:900, ...S.mono, lineHeight:1 }}>{counts[id]}</div><div style={{ color:T.text, fontSize:13, fontWeight:700, marginTop:4 }}>{meta.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <select style={S.sel} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">Todos os tipos</option><option>Residencial</option><option>Comercial</option></select>
        {filterRec&&<button style={{ ...S.btnGhost, padding:"8px 14px", fontSize:12 }} onClick={()=>setFilterRec("")}>✕ Limpar</button>}
        <span style={{ color:T.muted, fontSize:12 }}>{filtered.length} imóveis</span>
      </div>
      <div style={{ ...S.card, padding:0, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ background:T.s2 }}>{["Imóvel","Tipo","NOI 12m","Manter","Vender","Retrofit","Reposicionar","RECOMENDAÇÃO"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(p=>{ const d=p.decision, rec=DECISION_META[d.recommendation]; return (
              <tr key={p.id} style={{ cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.background=T.s2} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>setSelected(p)}>
                <td style={S.td}><div style={{ color:T.goldBright, fontWeight:600, fontSize:13 }}>{p.name}</div><div style={{ color:T.dim, fontSize:11 }}>{p.neighborhood}</div></td>
                <td style={S.td}><span style={S.badge(p.type==="Comercial"?T.blue:T.teal)}>{p.type}</span></td>
                <td style={{ ...S.td, ...S.mono, color:p.noi>0?T.green:T.red, fontWeight:700 }}>{fmt.brlK(p.noi)}</td>
                {[{ score:d.keepScore,color:T.green },{ score:d.sellScore,color:T.red },{ score:d.retroScore,color:T.amber },{ score:d.reposScore,color:T.blue }].map(({score,color},i)=>(
                  <td key={i} style={{ ...S.td, textAlign:"center" }}><ScoreRing score={score} color={color} size={44} /></td>
                ))}
                <td style={S.td}><span style={{ ...S.badge(rec.color), fontSize:12 }}>{rec.icon} {rec.short}</span></td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageDecisionDetail({ prop, onBack }) {
  const d=buildDecision(prop), rec=DECISION_META[d.recommendation];
  const options=[
    { id:"keep", meta:DECISION_META.keep, score:d.keepScore, headline:`NOI pode chegar a ${fmt.brlK(d.improvedNOI)}/ano`, description:"Imóvel com potencial de melhoria sem desinvestimento.", numbers:[{ label:"NOI Atual",value:fmt.brl(prop.noi),color:T.muted },{ label:"NOI Otimizado",value:fmt.brl(d.improvedNOI),color:T.green },{ label:"Valor Implícito",value:fmt.brlK(d.impliedValue),color:T.muted }], actions:["Revisar IPTU","Resolver vacância com estratégia de preço","Consolidar contratos de manutenção","Negociar reajuste pelo IGPM"] },
    { id:"sell", meta:DECISION_META.sell, score:d.sellScore, headline:`Valor estimado: ${fmt.brlK(d.saleValue)}`, description:"Capital pode ser realocado em ativo de maior retorno.", numbers:[{ label:"Valor (conservador)",value:fmt.brlK(d.saleValue),color:T.red },{ label:"Valor (otimista)",value:fmt.brlK(d.saleValueOptimistic),color:T.amber },{ label:"Retorno Reinvestido",value:fmt.brl(d.reinvestReturn)+"/ano",color:T.green }], actions:["Avaliação formal por corretor","Resolver pendências documentais","Definir estratégia: off-market ou corretora","Avaliar timing fiscal"] },
    { id:"retrofit", meta:DECISION_META.retrofit, score:d.retroScore, headline:`ROI ${d.retroROI.toFixed(0)}% · payback ${d.retroPayback.toFixed(1)} anos`, description:`Alta demanda em ${prop.neighborhood}.`, numbers:[{ label:"Custo Retrofit",value:fmt.brlK(d.retroCost),color:T.amber },{ label:"Aumento Aluguel",value:fmt.brl(d.retroRentIncrease)+"/mês",color:T.green },{ label:"ROI",value:d.retroROI.toFixed(0)+"%",color:T.gold }], actions:["3 orçamentos de construtoras","Arquiteto para laudo técnico","Verificar aprovações na Prefeitura","Calcular vacância durante obra"] },
    { id:"reposition", meta:DECISION_META.reposition, score:d.reposScore, headline:`Como ${d.otherType.toLowerCase()}: ${fmt.brlK(d.reposValue)}`, description:`Mudança de uso pode aumentar NOI significativamente.`, numbers:[{ label:`Aluguel como ${d.otherType}`,value:fmt.brl(d.reposRentEstimate)+"/mês",color:T.blue },{ label:"NOI Projetado",value:fmt.brlK(d.reposNOI),color:T.blue },{ label:"Custo Adequação",value:fmt.brlK(d.reposCost),color:T.amber }], actions:["Verificar zoneamento","Consultar advogado imobiliário","Analisar demanda de mercado","Orçamento obras de adequação"] },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
        <button style={{ ...S.btnGhost, padding:"8px 16px" }} onClick={onBack}>← Voltar</button>
        <div style={{ flex:1 }}><div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:4 }}>ANÁLISE DE DECISÃO</div><h1 style={{ color:T.text, fontSize:22, fontWeight:800, margin:0 }}>{prop.name}</h1><div style={{ color:T.muted, fontSize:13, marginTop:4 }}>{prop.neighborhood} · {prop.city} · {prop.size}m²</div></div>
        <div style={{ ...S.card, background:rec.color+"18", border:`2px solid ${rec.color}60`, textAlign:"center", padding:"14px 20px" }}><div style={{ fontSize:26, marginBottom:4 }}>{rec.icon}</div><div style={{ color:rec.color, fontWeight:900, fontSize:14 }}>{rec.label}</div></div>
      </div>
      <div style={S.card}>
        <div style={{ color:T.text, fontWeight:700, marginBottom:14, fontSize:15 }}>Scores</div>
        <div style={{ display:"flex", gap:28, flexWrap:"wrap" }}>
          {[{ label:"Manter",score:d.keepScore,color:T.green },{ label:"Vender",score:d.sellScore,color:T.red },{ label:"Retrofit",score:d.retroScore,color:T.amber },{ label:"Reposicionar",score:d.reposScore,color:T.blue }].map(({ label,score,color })=>(
            <div key={label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}><ScoreRing score={score} color={color} size={60} /><div style={{ color:T.muted, fontSize:11 }}>{label}</div></div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {options.map(opt=>{ const isRec=opt.id===d.recommendation; return (
          <div key={opt.id} style={{ ...S.card, border:`1px solid ${isRec?opt.meta.color+"60":T.border}`, background:isRec?opt.meta.color+"08":T.s1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <ScoreRing score={opt.score} color={opt.meta.color} size={48} />
              <div><div style={{ display:"flex", gap:8, alignItems:"center" }}><span style={{ fontSize:18 }}>{opt.meta.icon}</span><span style={{ color:T.text, fontWeight:800, fontSize:15 }}>{opt.meta.label}</span>{isRec&&<span style={{ ...S.badge(opt.meta.color), fontSize:10 }}>✓ RECOMENDADO</span>}</div><div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{opt.headline}</div></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ background:T.s0, borderRadius:8, padding:12 }}>{opt.numbers.map((n,i)=><div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:i<opt.numbers.length-1?`1px solid ${T.border}40`:"none" }}><span style={{ color:T.muted, fontSize:11 }}>{n.label}</span><span style={{ color:n.color, fontSize:12, fontWeight:700, ...S.mono }}>{n.value}</span></div>)}</div>
              <div style={{ background:T.s0, borderRadius:8, padding:12 }}>{opt.actions.map((a,i)=><div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}><div style={{ minWidth:18, height:18, borderRadius:"50%", background:opt.meta.color+"22", display:"flex", alignItems:"center", justifyContent:"center", color:opt.meta.color, fontSize:9, fontWeight:800, flexShrink:0 }}>{i+1}</div><span style={{ color:T.text, fontSize:12, lineHeight:1.4 }}>{a}</span></div>)}</div>
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}

// ─── REPORT PAGE ──────────────────────────────────────────────────────────────
function PageReport({ PROPS }) {
  const [done, setDone] = useState(false), [name, setName] = useState("Family Office Exemplar Ltda.");
  const PORT=computePort(PROPS), PORT_MONTHLY=MONTHS.map((m,i)=>({ month:m, receita:PROPS.reduce((s,p)=>s+p.monthlyData[i].receita,0), despesas:PROPS.reduce((s,p)=>s+p.monthlyData[i].despesas,0), noi:PROPS.reduce((s,p)=>s+p.monthlyData[i].noi,0) })), INSIGHTS=buildInsights(PROPS), totalObras=PROPS.reduce((s,p)=>s+(p.obras||[]).length,0);
  const totalValorMercado = PROPS.reduce((s, p) => { const bm=getFipeZAP(p.neighborhood,p.city,p.type); const m2=p.type==="Comercial"?bm.com:bm.res; return s+(p.valorMercado>0?p.valorMercado:m2*p.size); }, 0);
  const download = () => {
    const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${name} — Relatório</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Georgia',serif;color:#1a1a1a;padding:48px;max-width:900px;margin:0 auto}.header{display:flex;justify-content:space-between;padding-bottom:24px;border-bottom:3px solid #C8A84B;margin-bottom:32px}.logo{font-size:22px;font-weight:900;color:#C8A84B}h2{font-size:14px;color:#333;margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid #e5e5e5;text-transform:uppercase;letter-spacing:1px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}.kpi{background:#f8f6f0;border:1px solid #e8e0cc;border-radius:8px;padding:14px}.kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}.kpi-value{font-size:18px;font-weight:700;font-family:'Courier New',monospace}.green{color:#1a8a6a}.red{color:#c0392b}.amber{color:#d4890a}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f0ede4;text-align:left;padding:8px 10px;border:1px solid #ddd;font-size:10px;text-transform:uppercase}td{padding:8px 10px;border:1px solid #eee;font-family:'Courier New',monospace}tr:nth-child(even) td{background:#fafaf8}.footer{margin-top:40px;padding-top:14px;border-top:1px solid #ddd;font-size:10px;color:#999;display:flex;justify-content:space-between}</style></head><body>
<div class="header"><div><div class="logo">GOLDBRIDGE</div><div style="font-size:13px;font-weight:700;margin-top:6px">${name}</div></div><div style="text-align:right;font-size:12px;color:#666"><div>Jan–Dez 2024</div><div>Gerado: ${fmt.date()}</div><div>${PROPS.length} imóveis</div></div></div>
<h2>Resumo Executivo</h2><div class="kpis"><div class="kpi"><div class="kpi-label">Receita Bruta</div><div class="kpi-value">${fmt.brlK(PORT.receita)}</div></div><div class="kpi"><div class="kpi-label">Despesas</div><div class="kpi-value red">${fmt.brlK(PORT.despesas)}</div></div><div class="kpi"><div class="kpi-label">NOI</div><div class="kpi-value green">${fmt.brlK(PORT.noi)}</div></div><div class="kpi"><div class="kpi-label">Valor de Mercado Est.</div><div class="kpi-value amber">${fmt.brlK(totalValorMercado)}</div></div></div>
<h2>NOI Mensal</h2><table><tr><th>Mês</th><th>Receita</th><th>Despesas</th><th>NOI</th><th>Margem</th></tr>${PORT_MONTHLY.map(m=>`<tr><td>${m.month}/2024</td><td>${fmt.brl(m.receita)}</td><td style="color:#c0392b">${fmt.brl(m.despesas)}</td><td style="color:${m.noi>=0?"#1a8a6a":"#c0392b"};font-weight:700">${fmt.brl(m.noi)}</td><td>${fmt.pct(m.noi/m.receita)}</td></tr>`).join("")}</table>
${totalObras>0?`<h2>Obras Cadastradas</h2><table><tr><th>Imóvel</th><th>Obra</th><th>Tipo</th><th>Status</th><th>Orçado</th><th>Executado</th></tr>${PROPS.flatMap(p=>(p.obras||[]).map(o=>`<tr><td>${p.name}</td><td>${o.descricao}</td><td>${o.tipo}</td><td>${o.status}</td><td>${fmt.brl(o.orcado)}</td><td>${fmt.brl(o.executado)}</td></tr>`)).join("")}</table>`:""}
<h2>Alertas</h2>${INSIGHTS.map(ins=>`<div style="margin-bottom:12px;padding:12px;background:#fff9f0;border-left:4px solid #C8A84B;border-radius:6px"><strong>${ins.icon} ${ins.title}</strong><p style="font-size:12px;color:#555;margin-top:4px">${ins.description}</p><p style="font-size:12px;color:#c0392b;font-weight:700;margin-top:2px">Impacto: ${fmt.brl(ins.impactMin)}–${fmt.brl(ins.impactMax)}/ano</p></div>`).join("")}
<div class="footer"><div>Goldbridge Brasil · ${fmt.date()}</div><div>Confidencial</div></div></body></html>`;
    const blob=new Blob([html],{type:"text/html"}), a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`goldbridge-relatorio-${new Date().toISOString().split("T")[0]}.html`; a.click();
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div><div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:6 }}>EXPORTAÇÃO</div><h1 style={{ color:T.text, fontSize:26, fontWeight:800, margin:0 }}>Relatório Bank-Ready</h1></div>
      <div style={S.card}>
        <div style={{ color:T.text, fontWeight:700, marginBottom:14, fontSize:15 }}>Configurar</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12, maxWidth:480 }}>
          <div><div style={S.label}>NOME DO PROPRIETÁRIO</div><input style={S.input} value={name} onChange={e=>setName(e.target.value)} /></div>
          {totalObras>0&&<div style={{ padding:12, background:T.s2, borderRadius:8, color:T.muted, fontSize:12 }}>🔨 O relatório incluirá {totalObras} obra(s) cadastrada(s).</div>}
          <button style={{ ...S.btn, alignSelf:"flex-start", marginTop:8 }} onClick={()=>{ setDone(true); download(); }}>⬇️ Baixar Relatório HTML</button>
        </div>
      </div>
      {done&&<div style={S.cardGold}><div style={{ color:T.gold, fontWeight:800, fontSize:16, marginBottom:2 }}>✅ Relatório gerado!</div><div style={{ color:T.muted, fontSize:13 }}>Verifique sua pasta de Downloads.</div></div>}
    </div>
  );
}


// ─── PAGE IA ──────────────────────────────────────────────────────────────────
function PageIA({ PROPS }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Olá! Sou a IA do Goldbridge. Tenho acesso completo ao seu portfólio de **${0} imóveis** e posso responder perguntas sobre NOI, cap rate, vacância, leakage e muito mais.

Exemplos do que você pode me perguntar:
- "Qual imóvel está me dando mais prejuízo?"
- "Quais imóveis têm vacância acima do benchmark?"
- "Onde estou perdendo mais dinheiro?"
- "Qual bairro tem melhor cap rate?"
- "Quais imóveis devo priorizar para reforma?"`,
      ts: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Substitui o placeholder de contagem ao montar
  useEffect(() => {
    setMessages(prev => prev.map((m, i) => i === 0
      ? { ...m, content: m.content.replace("${0}", PROPS.length) }
      : m
    ));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const buildContext = () => {
    const total = PROPS.length;
    const totalNOI = PROPS.reduce((s, p) => s + p.noi, 0);
    const totalReceita = PROPS.reduce((s, p) => s + p.totalIncome, 0);
    const totalDespesas = PROPS.reduce((s, p) => s + p.totalExpenses, 0);
    const vagos = PROPS.filter(p => p.status === "Vago");
    const altoLeakage = PROPS.filter(p => p.leakage > 60).sort((a,b) => b.leakage - a.leakage);
    const baixoNOI = [...PROPS].sort((a,b) => a.noi - b.noi).slice(0, 5);
    const altoNOI = [...PROPS].sort((a,b) => b.noi - a.noi).slice(0, 5);
    const porBairro = {};
    PROPS.forEach(p => {
      if (!porBairro[p.neighborhood]) porBairro[p.neighborhood] = { count: 0, noi: 0, receita: 0 };
      porBairro[p.neighborhood].count++;
      porBairro[p.neighborhood].noi += p.noi;
      porBairro[p.neighborhood].receita += p.totalIncome;
    });
    const bairrosRanking = Object.entries(porBairro)
      .map(([b, d]) => ({ bairro: b, ...d, noiMedio: d.noi / d.count }))
      .sort((a, b) => b.noiMedio - a.noiMedio);
    const NL = "\n";
    const lines = [
      "Voce e a IA do Goldbridge Brasil, sistema de gestao de portfolio imobiliario.",
      "Responda sempre em portugues brasileiro, de forma direta e analitica. Use dados concretos.",
      NL + "=== RESUMO DO PORTFOLIO ===",
      "Total de imoveis: " + total,
      "NOI anual total: R$ " + totalNOI.toLocaleString("pt-BR"),
      "Receita anual: R$ " + totalReceita.toLocaleString("pt-BR"),
      "Despesas anuais: R$ " + totalDespesas.toLocaleString("pt-BR"),
      "Margem NOI media: " + ((totalNOI/totalReceita)*100).toFixed(1) + "%",
      "Imoveis vagos: " + vagos.length,
      NL + "=== MAIOR LEAKAGE (TOP 5) ===",
      ...altoLeakage.slice(0,5).map(p => p.name + " (" + p.neighborhood + "): Leakage " + p.leakage + "/100, NOI R$" + p.noi.toLocaleString("pt-BR") + "/ano"),
      NL + "=== PIORES NOI ===",
      ...baixoNOI.map(p => p.name + " (" + p.neighborhood + "): NOI R$" + p.noi.toLocaleString("pt-BR") + "/ano, Margem " + (p.noiPct*100).toFixed(1) + "%"),
      NL + "=== MELHORES NOI ===",
      ...altoNOI.map(p => p.name + " (" + p.neighborhood + "): NOI R$" + p.noi.toLocaleString("pt-BR") + "/ano, Aluguel R$" + p.rent.toLocaleString("pt-BR") + "/mes"),
      NL + "=== BAIRROS ===",
      ...bairrosRanking.slice(0,8).map(b => b.bairro + ": " + b.count + " imovel(is), NOI medio R$" + b.noiMedio.toLocaleString("pt-BR") + "/ano"),
      NL + "=== IMOVEIS VAGOS ===",
      vagos.length > 0 ? vagos.map(p => p.name + " (" + p.neighborhood + ")").join(", ") : "Nenhum",
      NL + "=== TODOS OS IMOVEIS ===",
      ...PROPS.map(p => "ID:" + p.id + " | " + p.name + " | " + p.neighborhood + " | " + p.type + " | " + p.status + " | " + p.size + "m2 | R$" + p.rent + "/mes | NOI:R$" + p.noi + "/ano | Margem:" + (p.noiPct*100).toFixed(1) + "% | Leakage:" + p.leakage),
    ];
    return lines.join(NL);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim(), ts: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildContext(),
          messages: [...history, { role: "user", content: input.trim() }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "Erro ao processar resposta.";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: text,
        ts: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão. Tente novamente.", ts: "" }]);
    }
    setLoading(false);
  };

  const SUGESTOES = [
    "Qual imóvel está me dando mais prejuízo?",
    "Quais imóveis têm vacância acima do benchmark?",
    "Onde estou perdendo mais dinheiro?",
    "Qual bairro tem melhor desempenho?",
    "Quais imóveis priorizar para reforma?",
    "Me dê um resumo executivo do portfólio",
  ];

  const renderMsg = (text) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ fontWeight: 800, color: T.goldBright, marginTop: 8 }}>{line.slice(2,-2)}</div>;
      if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ paddingLeft: 12, color: T.text, lineHeight: 1.6 }}>· {line.slice(2)}</div>;
      if (line === "") return <div key={i} style={{ height: 6 }} />;
      return <div key={i} style={{ color: T.text, lineHeight: 1.7 }}>{line}</div>;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", gap: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>INTELIGÊNCIA ARTIFICIAL</div>
          <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>IA do Portfólio</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Análise em linguagem natural · {PROPS.length} imóveis no contexto</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: T.s1, border: `1px solid ${T.green}40`, borderRadius: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
          <span style={{ color: T.green, fontSize: 12, fontWeight: 700 }}>IA Ativa</span>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {m.role === "assistant" && <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.goldGlow, border: `1px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✦</div>}
              <span style={{ color: T.dim, fontSize: 11 }}>{m.role === "assistant" ? "Goldbridge IA" : "Você"} · {m.ts}</span>
            </div>
            <div style={{
              maxWidth: "80%", padding: "14px 18px",
              background: m.role === "user" ? T.goldGlow : T.s1,
              border: `1px solid ${m.role === "user" ? T.gold + "60" : T.border}`,
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              fontSize: 14,
            }}>
              {m.role === "assistant" ? renderMsg(m.content) : <span style={{ color: T.text }}>{m.content}</span>}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.goldGlow, border: `1px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✦</div>
            <div style={{ padding: "12px 18px", background: T.s1, border: `1px solid ${T.border}`, borderRadius: "18px 18px 18px 4px", display: "flex", gap: 6, alignItems: "center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.gold, opacity: 0.6, animation: `pulse 1.2s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugestões */}
      {messages.length <= 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {SUGESTOES.map(s => (
            <button key={s} style={{ background: T.s2, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 20, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'Bricolage Grotesque', sans-serif" }}
              onClick={() => { setInput(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 10, padding: "16px 0 0", borderTop: `1px solid ${T.border}` }}>
        <input
          style={{ ...S.input, flex: 1, fontSize: 14, padding: "14px 18px" }}
          placeholder="Pergunte sobre o seu portfólio..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
        />
        <button
          style={{ ...S.btn, padding: "14px 24px", fontSize: 15, opacity: (!input.trim() || loading) ? 0.5 : 1 }}
          onClick={send}
          disabled={!input.trim() || loading}
        >
          ↑
        </button>
      </div>
      <div style={{ color: T.dim, fontSize: 11, textAlign: "center", marginTop: 8 }}>Enter para enviar · A IA tem acesso a todos os dados do portfólio</div>

      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("gestao@familyoffice.com.br"), [pw, setPw] = useState("");
  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 30% 50%, ${T.goldGlow} 0%, transparent 60%)` }} />
      <div style={{ width:440, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}><div style={{ color:T.gold, fontSize:32, fontWeight:900, letterSpacing:-1 }}>GOLDBRIDGE</div><div style={{ color:T.dim, fontSize:11, letterSpacing:4, marginTop:4 }}>BRASIL · PORTFOLIO INTELLIGENCE</div></div>
        <div style={{ background:T.s1, border:`1px solid ${T.border}`, borderRadius:16, padding:40 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div><div style={S.label}>E-MAIL</div><input style={S.input} value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div><div style={S.label}>SENHA</div><input type="password" placeholder="Qualquer senha para demo" style={S.input} value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin()} /></div>
            <button style={{ ...S.btn, width:"100%", padding:14, fontSize:15, marginTop:8 }} onClick={onLogin}>Entrar no Portfólio</button>
          </div>
          <div style={{ textAlign:"center", color:T.dim, fontSize:11, marginTop:20, lineHeight:1.6 }}>Acesso demonstrativo · {INITIAL_PROPS.length} imóveis<br/>Dados sintéticos baseados em benchmarks reais</div>
        </div>
      </div>
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Visão Executiva",     icon: "◈" },
  { id: "noi",       label: "NOI por Imóvel",      icon: "⊞" },
  { id: "obras",     label: "Obras & Reformas",    icon: "🔨" },
  { id: "mercado",   label: "Valor de Mercado",    icon: "🏦" },
  { id: "leakage",   label: "Leakage Finder",      icon: "◎" },
  { id: "decision",  label: "Decisão por Imóvel",  icon: "⟁" },
  { id: "report",    label: "Relatório Bank-Ready", icon: "⬡" },
  { id: "ia",        label: "IA do Portfólio",      icon: "✦" },
];

// ─── ADD IMOVEL MODAL ─────────────────────────────────────────────────────────
function AddImovelModal({ onSave, onClose, nextId }) {
  const [form, setForm] = useState({
    name: "", address: "", neighborhood: "Itaim Bibi", city: "São Paulo",
    type: "Residencial", status: "Ocupado", size: "", rent: "",
    iptu: "", maintMonthly: "", insurance: "", admin: "", vacancyDays: "0",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const NEIGHBORHOODS = Object.keys(FIPEZAP_M2).filter(k => !k.startsWith("_default"));

  const handleSave = () => {
    if (!form.size || !form.rent) return;
    const bm = BENCHMARKS[form.city]?.[form.type] || BENCHMARKS["São Paulo"][form.type];
    const size = parseFloat(form.size) || 0;
    const rent = parseFloat(form.rent) || 0;
    const iptu = parseFloat(form.iptu) || Math.round(bm.iptu_m2 * size);
    const maintMonthly = parseFloat(form.maintMonthly) || Math.round(bm.maintenance_annual_m2 * size / 12);
    const insurance = parseFloat(form.insurance) || Math.round(rent * 0.025 * 12);
    const admin = parseFloat(form.admin) || Math.round(rent * 0.08);
    const vacancyDays = parseFloat(form.vacancyDays) || 0;
    const annualRent = rent * 12;
    const vacancyCost = Math.round((rent / 30) * vacancyDays);
    const totalIncome = annualRent - vacancyCost;
    const totalExpenses = iptu + maintMonthly * 12 + insurance + admin * 12;
    const noi = totalIncome - totalExpenses;
    const noiPct = noi / (totalIncome || 1);
    const iptuBenchmark = Math.round(bm.iptu_m2 * size);
    const iptuDelta = Math.round(((iptu - iptuBenchmark) / iptuBenchmark) * 100);
    const maintBenchmark = Math.round(bm.maintenance_annual_m2 * size / 12);
    const maintDelta = Math.round(((maintMonthly - maintBenchmark) / maintBenchmark) * 100);
    const vacancyDelta = vacancyDays - bm.vacancy_days;
    let leakage = 0;
    // IPTU leakage removido — benchmark não comparável por imóvel
    if (vacancyDays > bm.vacancy_days) leakage += Math.min(35, vacancyDelta * 0.5);
    if (maintDelta > 30) leakage += Math.min(20, maintDelta * 0.4);
    if (noiPct < 0.5) leakage += 20;
    leakage = Math.min(98, Math.max(2, Math.round(leakage)));
    const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const monthlyData = months.map(m => {
      const exp = Math.round((iptu / 12) + maintMonthly + (insurance / 12) + admin);
      return { month: m, receita: rent, despesas: exp, noi: rent - exp };
    });
    onSave({
      id: nextId, name: form.name || `${form.type === "Comercial" ? "Sala Comercial" : "Apartamento"} ${String(nextId).padStart(3, "0")}`,
      address: form.address, neighborhood: form.neighborhood, city: form.city, state: "SP",
      type: form.type, status: form.status, size, rent, iptu, maintMonthly, insurance, admin,
      vacancyDays, vacancyCost, totalIncome, totalExpenses, noi, noiPct, leakage,
      iptuBenchmark, iptuDelta, maintBenchmark, maintDelta,
      vacancyBenchmark: bm.vacancy_days, vacancyDelta, monthlyData, isProblematic: false,
      obras: [], valorMercado: 0, valorCompra: 0, anoCompra: null,
    });
  };



  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.s1, border: `1px solid ${T.borderMid}`, borderRadius: 18, width: "100%", maxWidth: 660, maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ padding: "24px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: T.s1, zIndex: 1 }}>
          <div>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>NOVO IMÓVEL</div>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 17, marginTop: 2 }}>Adicionar ao Portfólio</div>
          </div>
          <button style={{ background: T.s3, border: "none", color: T.muted, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18 }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>IDENTIFICAÇÃO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}><div><label style={S.label}>NOME DO IMÓVEL</label><input style={S.input} value={form.name} placeholder="Ex: Apartamento Jardins, Sala Faria Lima..." onChange={e=>set("name",e.target.value)} /></div></div>
              <div style={{ gridColumn: "1/-1" }}><div><label style={S.label}>ENDEREÇO</label><input style={S.input} value={form.address} placeholder="Ex: Rua Oscar Freire, 1200" onChange={e=>set("address",e.target.value)} /></div></div>
              <div>
                <label style={S.label}>BAIRRO</label>
                <select style={S.sel} value={form.neighborhood} onChange={e => set("neighborhood", e.target.value)}>
                  {NEIGHBORHOODS.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div><label style={S.label}>CIDADE</label><select style={S.sel} value={form.city} onChange={e=>set("city",e.target.value)}>{["São Paulo","Campinas","Santo André","Americana"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>TIPO</label><select style={S.sel} value={form.type} onChange={e=>set("type",e.target.value)}>{["Residencial","Comercial"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>STATUS</label><select style={S.sel} value={form.status} onChange={e=>set("status",e.target.value)}>{["Ocupado","Vago"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>ÁREA (m²) *</label><input type="number" style={S.input} value={form.size} placeholder="Ex: 85" onChange={e=>set("size",e.target.value)} /></div>
            </div>
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>DADOS FINANCEIROS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={S.label}>ALUGUEL MENSAL (R$) *</label><input type="number" style={S.input} value={form.rent} placeholder="Ex: 4500" onChange={e=>set("rent",e.target.value)} /></div>
              <div><label style={S.label}>DIAS VACÂNCIA/ANO</label><input type="number" style={S.input} value={form.vacancyDays} placeholder="0" onChange={e=>set("vacancyDays",e.target.value)} /></div>
              <div><label style={S.label}>IPTU ANUAL (R$)</label><input type="number" style={S.input} value={form.iptu} placeholder="Calculado automaticamente" onChange={e=>set("iptu",e.target.value)} /></div>
              <div><label style={S.label}>MANUTENÇÃO MENSAL (R$)</label><input type="number" style={S.input} value={form.maintMonthly} placeholder="Calculado automaticamente" onChange={e=>set("maintMonthly",e.target.value)} /></div>
              <div><label style={S.label}>SEGURO ANUAL (R$)</label><input type="number" style={S.input} value={form.insurance} placeholder="Calculado automaticamente" onChange={e=>set("insurance",e.target.value)} /></div>
              <div><label style={S.label}>TAXA ADM. MENSAL (R$)</label><input type="number" style={S.input} value={form.admin} placeholder="Calculado automaticamente" onChange={e=>set("admin",e.target.value)} /></div>
            </div>
          </div>
          <div style={{ padding: 14, background: T.s2, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ color: T.muted, fontSize: 12 }}>
              💡 Campos marcados com * são obrigatórios. Os demais são calculados automaticamente com base nos benchmarks do bairro selecionado.
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 28px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button style={S.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btn, opacity: (!form.size || !form.rent) ? 0.5 : 1 }} onClick={handleSave}>+ Adicionar Imóvel</button>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE CONFIRM MODAL ─────────────────────────────────────────────────────
function DeleteConfirmModal({ prop, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.s1, border: `1px solid ${T.red}40`, borderRadius: 18, width: "100%", maxWidth: 420, padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🗑</div>
        <div style={{ color: T.text, fontWeight: 800, fontSize: 18, textAlign: "center", marginBottom: 8 }}>Remover Imóvel?</div>
        <div style={{ color: T.muted, fontSize: 14, textAlign: "center", marginBottom: 6 }}>{prop.name}</div>
        <div style={{ color: T.dim, fontSize: 12, textAlign: "center", marginBottom: 24 }}>{prop.neighborhood} · {prop.city}</div>
        <div style={{ padding: 12, background: T.s2, borderRadius: 8, marginBottom: 24 }}>
          <div style={{ color: T.amber, fontSize: 12, textAlign: "center" }}>⚠️ Esta ação não pode ser desfeita. Todos os dados incluindo obras serão removidos.</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ ...S.btnGhost, flex: 1 }} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btnDanger, flex: 1, background: T.red + "18" }} onClick={onConfirm}>Sim, remover</button>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
function loadProps() {
  try {
    const saved = localStorage.getItem("goldbridge_props");
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_PROPS;
}

export default function App() {
  const [logged, setLogged] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [selectedProp, setSelectedProp] = useState(null);
  const [props, setPropsState] = useState(loadProps);
  const [editingProp, setEditingProp] = useState(null);
  const [obrasProps, setObrasProps] = useState(null);
  const [addingImovel, setAddingImovel] = useState(false);
  const [deletingProp, setDeletingProp] = useState(null);

  const setProps = (updater) => {
    setPropsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("goldbridge_props", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleAddImovel = (newProp) => {
    setProps(prev => [...prev, newProp]);
    setAddingImovel(false);
  };

  const handleDeleteImovel = (prop) => setDeletingProp(prop);

  const confirmDelete = () => {
    setProps(prev => prev.filter(p => p.id !== deletingProp.id));
    setDeletingProp(null);
    if (selectedProp?.id === deletingProp.id) { setSelectedProp(null); setPage("noi"); }
  };

  if (!logged) return <Login onLogin={() => setLogged(true)} />;

  const nav = (p) => { setPage(p); if (p !== "detail") setSelectedProp(null); };
  const handleEdit = (prop) => setEditingProp(props.find(p => p.id === prop.id) || prop);
  const handleSaveEdit = (updatedProp) => { setProps(prev => prev.map(p => p.id === updatedProp.id ? updatedProp : p)); setEditingProp(null); if (selectedProp?.id === updatedProp.id) setSelectedProp(updatedProp); };
  const handleObras = (prop) => setObrasProps(props.find(p => p.id === prop.id) || prop);
  const handleSaveObras = (updatedProp) => { setProps(prev => prev.map(p => p.id === updatedProp.id ? updatedProp : p)); if (selectedProp?.id === updatedProp.id) setSelectedProp(updatedProp); };
  const nextId = props.length > 0 ? Math.max(...props.map(p => p.id)) + 1 : 1;

  const content = {
    dashboard: <PageDashboard PROPS={props} onNav={nav} onProp={setSelectedProp} />,
    noi:       <PageNOI PROPS={props} onProp={setSelectedProp} onNav={nav} onEdit={handleEdit} onObras={handleObras} onDelete={handleDeleteImovel} onAdd={() => setAddingImovel(true)} />,
    obras:     <PageObras PROPS={props} onUpdateProps={setProps} />,
    mercado:   <PageValorMercado PROPS={props} onUpdateProps={setProps} />,
    leakage:   <PageLeakage PROPS={props} />,
    decision:  <PageDecision PROPS={props} onProp={setSelectedProp} onNav={nav} />,
    detail:    <PageDetail prop={selectedProp} onBack={() => nav("noi")} onEdit={handleEdit} onObras={handleObras} onDelete={handleDeleteImovel} />,
    report:    <PageReport PROPS={props} />,
    ia:        <PageIA PROPS={props} />,
  }[page] || <PageDashboard PROPS={props} onNav={nav} onProp={setSelectedProp} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        body{margin:0;font-family:'Bricolage Grotesque',sans-serif;background:${T.bg};color:${T.text}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        select option{background:${T.s2}}
        input::placeholder{color:${T.dim}}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
      `}</style>

      {editingProp && <EditModal prop={editingProp} onSave={handleSaveEdit} onClose={() => setEditingProp(null)} />}
      {obrasProps && <ObrasModal prop={obrasProps} onSave={handleSaveObras} onClose={() => setObrasProps(null)} />}
      {addingImovel && <AddImovelModal nextId={nextId} onSave={handleAddImovel} onClose={() => setAddingImovel(false)} />}
      {deletingProp && <DeleteConfirmModal prop={deletingProp} onConfirm={confirmDelete} onClose={() => setDeletingProp(null)} />}

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <div style={{ width: 230, background: T.s0, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100 }}>
          <div style={{ padding: "28px 22px 20px" }}>
            <div style={{ color: T.gold, fontSize: 17, fontWeight: 900, letterSpacing: -0.5 }}>GOLDBRIDGE</div>
            <div style={{ color: T.dim, fontSize: 9, letterSpacing: 3, marginTop: 2 }}>PORTFOLIO INTELLIGENCE</div>
          </div>
          <div style={{ margin: "0 12px 16px", padding: "10px 14px", background: T.s1, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>PORTFÓLIO ATIVO</div>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>Family Office SP</div>
            <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{props.length} imóveis · Mix res/com</div>
          </div>
          <nav style={{ flex: 1 }}>
            {NAV.map(n => {
              const active = page === n.id || (n.id === "noi" && page === "detail");
              return (
                <button key={n.id} onClick={() => nav(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 22px", background: active ? T.goldGlow : "transparent", color: active ? T.goldBright : T.muted, border: "none", borderRight: active ? `2px solid ${T.gold}` : "2px solid transparent", cursor: "pointer", fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: active ? 700 : 400, textAlign: "left" }}>
                  <span style={{ fontSize: 14, opacity: active ? 1 : 0.6 }}>{n.icon}</span>
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div style={{ padding: "14px 22px", borderTop: `1px solid ${T.border}` }}>
            <div style={{ color: T.dim, fontSize: 11, marginBottom: 4 }}>gestao@familyoffice.com.br</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button style={{ color: T.dim, fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => setLogged(false)}>Sair →</button>
              <span style={{ color: T.border }}>|</span>
              <button style={{ color: T.redDim, fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => { if(window.confirm("Resetar portfólio para os dados demo?")) { localStorage.removeItem("goldbridge_props"); window.location.reload(); } }}>Reset demo</button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ marginLeft: 230, flex: 1, padding: "32px 36px", minHeight: "100vh", maxWidth: "calc(100vw - 230px)" }}>
          {content}
        </div>
      </div>
    </>
  );
}
