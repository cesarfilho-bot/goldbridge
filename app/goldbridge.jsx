"use client";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
import {
  Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie,
} from "recharts";

const DARK_T = {
  bg: "#09112B", s0: "#0D1835", s1: "#111F40", s2: "#162650", s3: "#1C2E60",
  border: "#243558", borderMid: "#2D4570", gold: "#4A80C8", goldBright: "#6A9FE0",
  goldDim: "#1B3060", goldGlow: "#4A80C833", text: "#E8EEF6", muted: "#7A98C0",
  dim: "#3A5070", green: "#2ECC9A", greenDim: "#1A7A5C", red: "#E85565",
  redDim: "#7A2230", amber: "#F5A623", amberDim: "#7A5212", blue: "#5A9FFF",
  blueDim: "#1E3D7A", teal: "#2EC4B6",
};
const LIGHT_T = {
  bg: "#F2F6FB", s0: "#FFFFFF", s1: "#FFFFFF", s2: "#EBF1F9", s3: "#DDE7F3",
  border: "#C8D6E8", borderMid: "#A3B8CF", gold: "#1B3A6B", goldBright: "#0F2548",
  goldDim: "#C2D5ED", goldGlow: "#1B3A6B1A", text: "#1E2D45", muted: "#5C7A9A",
  dim: "#A0B4C8", green: "#0E7A5A", greenDim: "#D0EEE5", red: "#C0283C",
  redDim: "#FAD5DA", amber: "#B06810", amberDim: "#FCECD4", blue: "#2B6CB0",
  blueDim: "#C5DCF5", teal: "#1A7A8A",
};
let T = { ...LIGHT_T };
// Initialize theme from localStorage immediately (before first render)
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("gb_theme");
  if (saved === "dark") Object.assign(T, DARK_T);
  else Object.assign(T, LIGHT_T);
}

function applyTheme(theme) {
  Object.assign(T, theme);
  const root = document.documentElement;
  Object.entries(theme).forEach(([k, v]) => {
    root.style.setProperty(`--t-${k}`, v);
  });
  root.setAttribute("data-theme", theme.bg === LIGHT_T.bg ? "light" : "dark");
  // Inject global CSS if not already present
  if (!document.getElementById("gb-theme-style")) {
    const style = document.createElement("style");
    style.id = "gb-theme-style";
    style.textContent = `
      [data-theme="light"] { color-scheme: light; }
      [data-theme="dark"] { color-scheme: dark; }
      body { background: var(--t-bg) !important; transition: background 0.2s; }
      * { transition: background-color 0.15s, border-color 0.15s, color 0.15s; }
    `;
    document.head.appendChild(style);
  }
}

// Mapeamento de tipos para categoria de benchmark
const BM_TYPE_MAP = {
  "Apartamento": "Residencial", "Casa": "Residencial", "Studio/Kitnet": "Residencial",
  "Terreno": "Terreno", "Comercial": "Comercial", "Sala Comercial": "Comercial",
  "Galpão/Industrial": "Comercial",
  // legado
  "Residencial": "Residencial",
};

const BENCHMARKS = {
  "São Paulo": {
    Residencial: { iptu_m2: 18, vacancy_days: 32, maintenance_annual_m2: 45, cap_rate: 0.055 },
    Comercial:   { iptu_m2: 28, vacancy_days: 48, maintenance_annual_m2: 65, cap_rate: 0.072 },
    Terreno:     { iptu_m2: 10, vacancy_days: 0,  maintenance_annual_m2: 5,  cap_rate: 0.020 },
  },
  "Campinas": {
    Residencial: { iptu_m2: 12, vacancy_days: 28, maintenance_annual_m2: 38, cap_rate: 0.062 },
    Comercial:   { iptu_m2: 20, vacancy_days: 42, maintenance_annual_m2: 52, cap_rate: 0.078 },
    Terreno:     { iptu_m2: 6,  vacancy_days: 0,  maintenance_annual_m2: 4,  cap_rate: 0.018 },
  },
  "Santo André": {
    Residencial: { iptu_m2: 10, vacancy_days: 35, maintenance_annual_m2: 35, cap_rate: 0.065 },
    Comercial:   { iptu_m2: 16, vacancy_days: 52, maintenance_annual_m2: 48, cap_rate: 0.082 },
    Terreno:     { iptu_m2: 5,  vacancy_days: 0,  maintenance_annual_m2: 3,  cap_rate: 0.016 },
  },
  "Americana": {
    Residencial: { iptu_m2: 8,  vacancy_days: 30, maintenance_annual_m2: 32, cap_rate: 0.068 },
    Comercial:   { iptu_m2: 14, vacancy_days: 45, maintenance_annual_m2: 45, cap_rate: 0.085 },
    Terreno:     { iptu_m2: 4,  vacancy_days: 0,  maintenance_annual_m2: 2,  cap_rate: 0.015 },
  },
};

function getBenchmark(city, type) {
  const cat = BM_TYPE_MAP[type] || "Residencial";
  return (BENCHMARKS[city] || BENCHMARKS["São Paulo"])[cat]
      || BENCHMARKS["São Paulo"].Residencial;
}

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
  "Antônio Zanaga I": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Antônio Zanaga II": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Área Rural de Americana": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Bairro da Lagoa": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Balneário Salto Grande": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Barroca": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Boa Esperança": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Bom Recreio": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Bosque da Saúde": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Bosque dos Ipês": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Brieds": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Campo Limpo": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Campo Verde": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Carioba": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Cariobinha": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Catharina Zanaga": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Cecchino": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Centro": { res: 5000, com: 4500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Chácara Letônia": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Chácara Lucília": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Chácara Machadinho": { res: 3500, com: 2500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Chácara Machadinho I": { res: 3500, com: 2500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Chácara Machadinho II": { res: 3500, com: 2500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Chácara Machado": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Chácara Rodrigues": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Cidade Jardim I": { res: 5000, com: 3700, var12m: 0.032, fonte: "ZAP Americana 2025" },
  "Cidade Jardim II": { res: 5000, com: 3700, var12m: 0.032, fonte: "ZAP Americana 2025" },
  "Conserva": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Fazenda Santa Lúcia": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Fazendinha": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Iate Clube de Americana": { res: 5200, com: 3800, var12m: 0.035, fonte: "ZAP Americana 2025" },
  "Iate Clube de Campinas": { res: 5200, com: 3800, var12m: 0.035, fonte: "ZAP Americana 2025" },
  "Industrial Maria Joana Crivelloni Abrão": { res: 3800, com: 3500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Industrial Sigisfredo Boer": { res: 3800, com: 3500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Jardim Alvorada": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Amélia": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim América": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim América II": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Bela Vista": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Bertoni": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Boer I": { res: 3900, com: 2800, var12m: 0.022, fonte: "ZAP Americana 2025" },
  "Jardim Boer II": { res: 3900, com: 2800, var12m: 0.022, fonte: "ZAP Americana 2025" },
  "Jardim Brasília": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Campo Belo": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim da Balsa I": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim da Balsa II": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim da Mata": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim das Flores": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Dona Judith": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim dos Lírios": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Esplanada": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Girassol": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Glória": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Governador Mário Covas II": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Governador Mário Covas III": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Guanabara": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Helena": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Imperador": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Jacyra": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Lizandra": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Luciane": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Marcia Cristina": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Mirandola": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Miriam": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Nielsen Ville": { res: 4200, com: 3000, var12m: 0.025, fonte: "ZAP Americana 2025" },
  "Jardim Nossa Senhora Aparecida": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Nossa Senhora do Carmo": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Novo Horizonte": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Novo Paraíso": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Pau Brasil": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Paulista": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Jardim Paulistano": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Jardim Paz": { res: 3600, com: 2600, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Jardim Portal da Colina": { res: 4800, com: 3500, var12m: 0.032, fonte: "ZAP Americana 2025" },
  "Jardim Primavera": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Progresso": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Residencial Dona Rosa": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Santa Eliza": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Santa Lúcia": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Santa Mônica": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Santana": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Santo Antônio": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim São Domingos": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim São José": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim São Roque": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim São Vito": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Terramérica III": { res: 5000, com: 3600, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Jardim Thelja": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Trípoli": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Werner Plaas": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Jardim Werner Plaas VII": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Loteamento Industrial 9 de Julho": { res: 3800, com: 3500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Loteamento Industrial Machadinho": { res: 3500, com: 3200, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Loteamento Industrial Nossa Senhora de Fátima": { res: 3800, com: 3500, var12m: 0.020, fonte: "ZAP Americana 2025" },
  "Loteamento Mantovani": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Loteamento Residencial Jardim dos Ipês Amarelos": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Loteamento Residencial Jardim dos Pinheiros": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Loteamento Residencial Jardim Esperança": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Loteamento Residencial Jardim Florbela": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Loteamento Residencial Jardim Villagio": { res: 4800, com: 3500, var12m: 0.032, fonte: "ZAP Americana 2025" },
  "Loteamento Residencial Jardim Villagio II": { res: 4800, com: 3500, var12m: 0.032, fonte: "ZAP Americana 2025" },
  "Monte Carlo": { res: 5000, com: 3700, var12m: 0.032, fonte: "ZAP Americana 2025" },
  "Morada do Sol": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Nossa Senhora de Fátima": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Nova Americana": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Olho D'Água": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Paraíso": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque das Nações": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Dom Pedro II": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Liberdade": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Mangueira": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Nova Carioba": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Novo Mundo": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Primavera": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Parque Residencial Jaguari": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Residencial Tancredi": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Parque São Jerônimo": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Parque Universitário": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Portal dos Nobres": { res: 5200, com: 3800, var12m: 0.035, fonte: "ZAP Americana 2025" },
  "Praia Azul": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Praia dos Namorados": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Recanto": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Recanto Jatobá": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Recanto Vista Alegre": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Residencial Boa Vista": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Residencial Horto Florestal Jacyra": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Residencial Jardim Barra do Cisne": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Residencial Praia dos Namorados": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Residencial Santa Paula": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Residencial Vale das Nogueiras": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Riviera Tamborlim": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Salto Grande": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Santa Cruz": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Santa Sofia": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Santo Antônio": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "São Benedito": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "São José": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "São Luiz": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "São Sebastião": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vale das Paineiras": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Vale do Rio Branco": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Amorim": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Bela": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Belvedere": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Vila Bertini": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Biasi": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Conquista": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Cordenonsi": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Dainese": { res: 4600, com: 3400, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Vila Frezzarin": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Israel": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Louricilda": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Margarida": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Mariana": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Massucheto": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Medon": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Molon": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Nossa Senhora de Fátima": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Omar": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Pavan": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Rehder": { res: 4800, com: 3500, var12m: 0.030, fonte: "ZAP Americana 2025" },
  "Vila Rio Branco": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila San Pietro": { res: 5000, com: 3700, var12m: 0.032, fonte: "ZAP Americana 2025" },
  "Vila Santa Catarina": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Santa Inês": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Santa Maria": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila São Pedro": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Vila Vitória": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "Werner Plaas": { res: 4400, com: 3200, var12m: 0.028, fonte: "ZAP Americana 2025" },
  "_default_Americana":         { res: 4400, com: 3200, var12m: 0.028, fonte: "AgentImóvel Americana dez/2025" },
};


// ─── BAIRROS POR CIDADE ───────────────────────────────────────────────────────
const SP_BAIRROS = ["Itaim Bibi","Pinheiros","Jardins","Cerqueira César","Jardim Paulista","Jardim América","Jardim Europa","Moema","Vila Mariana","Paraíso","Perdizes","Bela Vista","Consolação","Vila Olímpia","Vila Nova Conceição","Vila Madalena","Alto de Pinheiros","Higienópolis","Morumbi","Campo Belo","Brooklin","Santana","Vila Andrade","Centro"];
const CAMPINAS_BAIRROS = ["Cambuí","Nova Campinas","Centro"];
const SANTO_ANDRE_BAIRROS = ["Vila Guiomar","Centro"];
const AMERICANA_BAIRROS = Object.keys(FIPEZAP_M2).filter(k => !k.startsWith("_default") && !SP_BAIRROS.includes(k) && !CAMPINAS_BAIRROS.includes(k) && !SANTO_ANDRE_BAIRROS.includes(k)).sort((a,b) => a.localeCompare(b,"pt-BR"));

const BAIRROS_POR_CIDADE = {
  "São Paulo": SP_BAIRROS.sort((a,b) => a.localeCompare(b,"pt-BR")),
  "Campinas": CAMPINAS_BAIRROS.sort((a,b) => a.localeCompare(b,"pt-BR")),
  "Santo André": SANTO_ANDRE_BAIRROS.sort((a,b) => a.localeCompare(b,"pt-BR")),
  "Americana": AMERICANA_BAIRROS,
};

function NeighborhoodSearch({ city, value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  const options = (BAIRROS_POR_CIDADE[city] || []);
  const filtered = query.length > 0
    ? options.filter(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")))
    : options;

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (n) => { onChange(n); setQuery(n); setOpen(false); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        style={{ ...S.input, paddingRight: 32 }}
        value={query}
        placeholder="Digite para buscar..."
        onChange={e => { setQuery(e.target.value); setOpen(true); if (e.target.value === "") onChange(""); }}
        onFocus={() => setOpen(true)}
      />
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: T.dim, fontSize: 12, pointerEvents: "none" }}>▾</span>
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: T.s1, border: `1px solid ${T.borderMid}`, borderRadius: 10, zIndex: 200, maxHeight: 220, overflow: "auto", boxShadow: "0 8px 24px #00000044" }}>
          {filtered.map(n => (
            <div key={n} onMouseDown={() => select(n)} style={{ padding: "9px 14px", cursor: "pointer", color: n === value ? T.gold : T.text, background: n === value ? T.goldGlow : "transparent", fontSize: 13, borderBottom: `1px solid ${T.border}40` }}
              onMouseEnter={e => e.currentTarget.style.background = T.s2}
              onMouseLeave={e => e.currentTarget.style.background = n === value ? T.goldGlow : "transparent"}
            >{n}</div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: T.s1, border: `1px solid ${T.borderMid}`, borderRadius: 10, zIndex: 200, padding: "12px 14px" }}>
          <div style={{ color: T.dim, fontSize: 13 }}>Nenhum bairro encontrado. Confirmar "{query}"?</div>
          <button style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 12, marginTop: 8 }} onMouseDown={() => select(query)}>Usar "{query}"</button>
        </div>
      )}
    </div>
  );
}

function getFipeZAP(neighborhood, city, type) {
  const data = FIPEZAP_M2[neighborhood] || FIPEZAP_M2[`_default_${city}`] || FIPEZAP_M2["_default_São Paulo"];
  // Terrenos: ~60% do valor residencial
  if (type === "Terreno") return { ...data, res: Math.round(data.res * 0.6), com: Math.round(data.com * 0.6) };
  return data;
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
    const bm = getBenchmark(addr.city, type);
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
  brlK: (v) => v >= 1000000 ? `R$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : fmt.brl(v),
  pct: (v) => `${((v || 0) * 100).toFixed(1)}%`,
  num: (v) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0)),
  date: () => new Date().toLocaleDateString("pt-BR"),
};

function computePort(props) {
  const PORT = {
    receita: props.reduce((s, p) => s + p.totalIncome, 0),
    despesas: props.reduce((s, p) => s + p.totalExpenses, 0),
    noi: props.reduce((s, p) => s + p.noi, 0),
    vacancyCost: props.reduce((s, p) => s + (p.vacancyCostMonthly || 0), 0),
    occupied: props.filter(p => p.status === "Ocupado").length,
    total: props.length,
  };
  PORT.noiPct = PORT.noi / PORT.receita;
  PORT.lucroLiquido = props.reduce((s, p) => s + (p.lucroLiquido||p.noi), 0);
  PORT.lucroLiquidoPct = PORT.lucroLiquido / (PORT.receita || 1);
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
    insights.push({ id: 2, type: "vacancy", severity: "alta", icon: "", title: "Vacância Crônica Acima da Média", description: `${vacProblems.length} imóveis com vacância superior a 1,5× o benchmark.`, metric: `Custo total: ${fmt.brl(totalCost)}/ano`, props: vacProblems.slice(0, 5), impactMin: Math.round(totalCost * 0.6), impactMax: totalCost, actions: ["Revisar preço de aluguel", "Contratar corretora especializada por tipo", "Verificar condições do imóvel", "Avaliar flexibilização de garantias"], benchmark: "Fonte: FipeZap, SECOVI-SP 2024" });
  }
  const maintProblems = PROPS.filter(p => p.maintDelta > 40).sort((a, b) => b.maintDelta - a.maintDelta);
  if (maintProblems.length > 0) {
    const totalWaste = maintProblems.reduce((s, p) => s + (p.maintMonthly - p.maintBenchmark) * 12, 0);
    insights.push({ id: 3, type: "maintenance", severity: "média", icon: "", title: "Manutenção com Custo Anômalo", description: `${maintProblems.length} imóveis com custo de manutenção acima de 140% do benchmark.`, metric: `Excesso anual: ${fmt.brl(totalWaste)}`, props: maintProblems.slice(0, 5), impactMin: Math.round(totalWaste * 0.5), impactMax: Math.round(totalWaste * 0.9), actions: ["Solicitar laudo técnico para imóveis com manutenção recorrente", "Comparar custo de reforma preventiva vs manutenção contínua", "Revisar contratos com prestadores", "Implantar check-list de vistoria semestral"], benchmark: "Fonte: ABNT NBR 5674 2024" });
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
    insights.push({ id: 5, type: "aluguel_baixo", severity: "alta", icon: "", title: "Aluguel Abaixo do Potencial de Mercado", description: `${aluguelBaixo.length} imóvel(is) com aluguel defasado em relação ao valor de mercado informado.`, metric: `Receita adicional potencial: ${fmt.brlK(totalPotencial)}/ano`, props: aluguelBaixo.slice(0, 5), impactMin: Math.round(totalPotencial * 0.5), impactMax: Math.round(totalPotencial), actions: ["Revisar valor do aluguel na próxima renovação de contrato", "Verificar índice de reajuste aplicado (IGPM acumulado)", "Negociar reajuste gradual com o inquilino", "Considerar rescisão e novo contrato a valor de mercado"], benchmark: "Rentabilidade bruta: 0,5% residencial · 0,7% comercial" });
  }

  const noiProblems = PROPS.filter(p => p.noiPct < 0.45 && p.totalIncome > 0).sort((a, b) => a.noiPct - b.noiPct);
  if (noiProblems.length > 0) {
    insights.push({ id: 4, type: "noi", severity: "alta", icon: "", title: "Margem Baixa (abaixo de 45%)", description: `${noiProblems.length} imóveis com margem operacional insuficiente.`, metric: `NOI médio do grupo: ${fmt.pct(noiProblems.reduce((s,p) => s + p.noiPct, 0) / noiProblems.length)}`, props: noiProblems.slice(0, 5), impactMin: Math.round(noiProblems.reduce((s, p) => s + p.noi * 0.1, 0)), impactMax: Math.round(noiProblems.reduce((s, p) => s + p.noi * 0.25, 0)), actions: ["Análise detalhada por imóvel", "Revisar reajuste de aluguel pelo IGPM acumulado", "Renegociar contratos de serviço", "Avaliar desinvestimento em imóveis com NOI < 40% por 12+ meses"], benchmark: "Padrão: NOI entre 55–70% (ABRAII 2024)" });
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
  return <span style={S.badge(map[s] || T.blue)}>{s.toUpperCase()}</span>;
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
function EditModal({ prop, onSave, onClose, userId }) {
  const [editTab, setEditTab] = useState("dados"); // "dados" | "documentos"
  const [showValorSection, setShowValorSection] = useState(!!(prop.marketValueManual));
  const [docs, setDocs] = useState(prop.documentos || []);
  const [docUploading, setDocUploading] = useState(false);
  const [docMsg, setDocMsg] = useState("");

  const handleDocUpload = async (file) => {
    if (!file) return;
    setDocUploading(true);
    setDocMsg("Enviando documento...");
    try {
      const uid = userId || "anon";
      const path = `${uid}/${prop.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("documentos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(path);
      const newDoc = { nome: file.name, path, url: urlData.publicUrl, tipo: file.type, data: new Date().toLocaleDateString("pt-BR"), size: file.size };
      const newDocs = [...docs, newDoc];
      setDocs(newDocs);
      await supabase.from("imoveis").update({ documentos: newDocs }).eq("id", prop.id);
      setDocMsg("Documento salvo com sucesso!");
    } catch(e) {
      setDocMsg("Erro ao enviar: " + e.message);
    }
    setDocUploading(false);
  };

  const handleDocDelete = async (idx) => {
    const doc = docs[idx];
    try {
      await supabase.storage.from("documentos").remove([doc.path]);
    } catch {}
    const newDocs = docs.filter((_,i) => i !== idx);
    setDocs(newDocs);
    await supabase.from("imoveis").update({ documentos: newDocs }).eq("id", prop.id);
  };
  const [form, setForm] = useState({
    name: prop.name || "", address: prop.address || "", neighborhood: prop.neighborhood || "",
    city: prop.city || "Americana", type: prop.type || "Apartamento", status: prop.status || "Ocupado", size: prop.size ?? 0,
    rent: prop.rent ?? 0, iptu: prop.iptu ?? 0, maintMonthly: prop.maintMonthly ?? 0,
    insurance: prop.insurance ?? 0, admin: prop.admin ?? 0, vacancyDays: prop.vacancyDays ?? 0,
    adminPct: prop.adminPct != null ? prop.adminPct : 8,
    hasCondominio: prop.hasCondominio || false,
    condoFee: prop.condoFee ?? 0,
    fundoReserva: prop.fundoReserva ?? 0,
    chamadaExtra: prop.chamadaExtra ?? 0,
    chamadaExtraParcelas: prop.chamadaExtraParcelas ?? 0,
    chamadaExtraParcelaAtual: prop.chamadaExtraParcelaAtual ?? 0,
    condoPagoPor: prop.condoPagoPor || "proprietario",
    descontoAluguel: prop.descontoAluguel ?? 0,
    contratoAnos: prop.contratoAnos ?? 12,
    contratoInicio: prop.contratoInicio || "",
    indiceReajuste: prop.indiceReajuste || "IGPM",
    iptuVencimento: prop.iptuVencimento || "",
    iptuParcelas: prop.iptuParcelas || 10,
    viaImobiliaria: prop.viaImobiliaria || false,
    imobiliariaName: prop.imobiliariaName || "",
    locatarioNome: prop.locatarioNome || "",
    locatarioCPF: prop.locatarioCPF || "",
    locatarioTelefone: prop.locatarioTelefone || "",
    locatarioEmail: prop.locatarioEmail || "",
    locatarioGarantia: prop.locatarioGarantia || "Fiador",
    contratoVencimento: prop.contratoVencimento || "",
    clausula12Meses: prop.clausula12Meses || false,
    marketValueManual: prop.marketValueManual ?? 0,
    regimeFiscal: prop.regimeFiscal || "PF",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const num = (k, v) => set(k, parseFloat(v) || 0);
  const handleSave = () => {
    const bm = getBenchmark(form.city, form.type);
    const annualRent = form.rent * 12;
    const vacancyCost = Math.round((form.rent / 30) * form.vacancyDays);
    const descontoAnual = Number(form.descontoAluguel) * 12;
    const totalIncome = annualRent - vacancyCost - descontoAnual;
    const condoAnnual = form.hasCondominio ? ((Number(form.fundoReserva)||0) + (Number(form.chamadaExtra)||0)) * 12 : 0;
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
    const adminFromPct = Math.round((Number(form.rent) - (Number(form.descontoAluguel)||0)) * (Number(form.adminPct)||0) / 100);
    onSave({ ...prop, ...form, size: Number(form.size), rent: Number(form.rent), iptu: Number(form.iptu), maintMonthly: Number(form.maintMonthly), insurance: Number(form.insurance), admin: adminFromPct, adminPct: Number(form.adminPct), vacancyDays: Number(form.vacancyDays), condoFee: Number(form.condoFee), fundoReserva: Number(form.fundoReserva), chamadaExtra: Number(form.chamadaExtra), chamadaExtraParcelas: Number(form.chamadaExtraParcelas)||0, chamadaExtraParcelaAtual: Number(form.chamadaExtraParcelaAtual)||0, condoPagoPor: form.condoPagoPor, descontoAluguel: Number(form.descontoAluguel), contratoAnos: Number(form.contratoAnos), contratoVencimento: form.contratoVencimento, clausula12Meses: form.clausula12Meses, vacancyCost, totalIncome, totalExpenses, noi, noiPct, iptuBenchmark, iptuDelta, maintBenchmark, maintDelta, vacancyBenchmark: bm.vacancy_days, vacancyDelta, leakage, proximoReajuste, marketValueManual: Number(form.marketValueManual), regimeFiscal: form.regimeFiscal, indiceReajuste: form.indiceReajuste, iptuVencimento: form.iptuVencimento, iptuParcelas: Number(form.iptuParcelas)||10, viaImobiliaria: form.viaImobiliaria, imobiliariaName: form.imobiliariaName, locatarioNome: form.locatarioNome, locatarioCPF: form.locatarioCPF, locatarioTelefone: form.locatarioTelefone, locatarioEmail: form.locatarioEmail, locatarioGarantia: form.locatarioGarantia });
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

        {/* ABAS EditModal */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, padding: "0 28px" }}>
          {[["dados","Dados do imóvel"],["documentos",`Documentos${docs.length > 0 ? " ("+docs.length+")" : ""}`]].map(([id, label]) => (
            <button key={id} onClick={() => setEditTab(id)} style={{ background: "none", border: "none", borderBottom: editTab===id ? `2px solid ${T.gold}` : "2px solid transparent", color: editTab===id ? T.gold : T.muted, fontWeight: editTab===id ? 700 : 400, fontSize: 13, padding: "12px 18px", cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>{label}</button>
          ))}
        </div>

        {/* ABA DOCUMENTOS */}
        {editTab === "documentos" && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ border: `2px dashed ${T.border}`, borderRadius: 12, padding: "24px", textAlign: "center", cursor: "pointer", display: "block", background: T.s2 }}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: "none" }} onChange={e => e.target.files[0] && handleDocUpload(e.target.files[0])} />
              <div style={{ color: T.text, fontWeight: 600 }}>{docUploading ? "Enviando..." : "Clique para anexar documento"}</div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>PDF, imagem, Word — contratos, boletos, vistoria, escritura</div>
            </label>
            {docMsg && <div style={{ padding: "12px 16px", background: docMsg.includes("sucesso") ? T.green+"22" : T.redDim+"33", borderRadius: 10, color: docMsg.includes("sucesso") ? T.green : T.red, fontSize: 13 }}>{docMsg}</div>}
            {docs.length === 0 ? (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Nenhum documento anexado ainda.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: T.s2, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: T.text, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</div>
                      <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>{d.data} · {d.size ? Math.round(d.size/1024) + " KB" : ""}</div>
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer" style={{ color: T.gold, fontSize: 12, fontWeight: 600, textDecoration: "none", padding: "6px 12px", border: `1px solid ${T.gold}40`, borderRadius: 8 }}>Abrir</a>
                    <button onClick={() => handleDocDelete(i)} style={{ background: "none", border: `1px solid ${T.redDim}`, color: T.red, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {editTab === "dados" && (
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>IDENTIFICAÇÃO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}><div><label style={S.label}>NOME</label><input style={S.input} value={form.name} onChange={e=>set("name",e.target.value)} /></div></div>
              <div style={{ gridColumn: "1/-1" }}><div><label style={S.label}>ENDEREÇO</label><input style={S.input} value={form.address} onChange={e=>set("address",e.target.value)} /></div></div>
              <div><label style={S.label}>CIDADE</label><select style={S.sel} value={form.city} onChange={e=>set("city",e.target.value)}>{["São Paulo","Campinas","Santo André","Americana"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>BAIRRO</label><NeighborhoodSearch city={form.city} value={form.neighborhood} onChange={v=>set("neighborhood",v)} /></div>
              <div><label style={S.label}>TIPO</label><select style={S.sel} value={form.type} onChange={e=>set("type",e.target.value)}>{["Apartamento","Casa","Casa de Condomínio","Sala Comercial","Industrial","Loja","Galpão","Salão Comercial","Terreno"].map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>STATUS</label><select style={S.sel} value={form.status} onChange={e=>set("status",e.target.value)}>{["Ocupado","Em desocupação","Vago"].map(o=><option key={o}>{o}</option>)}</select></div>
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
              <div>
                <label style={S.label}>TAXA ADM. (%)</label>
                <div style={{ position: "relative" }}>
                  <input type="number" style={{ ...S.input, paddingRight: 32 }} value={form.adminPct} placeholder="8" min="0" max="20" step="0.5" onChange={e=>{ set("adminPct",e.target.value); set("admin", Math.round((parseFloat(form.rent)||0)*(parseFloat(e.target.value)||0)/100)); }} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 14, fontWeight: 700 }}>%</span>
                </div>
                {form.rent && <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>= {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Math.round((parseFloat(form.rent)||0)*(parseFloat(form.adminPct)||0)/100))}/mês</div>}
              </div>
              <div><label style={S.label}>DIAS DE VACÂNCIA/ANO</label><input type="number" style={S.input} value={form.vacancyDays} onChange={e=>set("vacancyDays",e.target.value)} /></div>
            </div>
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>CONDOMÍNIO</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <input type="checkbox" id="hasCondominio" checked={form.hasCondominio} onChange={e => set("hasCondominio", e.target.checked)} style={{ width: 16, height: 16, accentColor: T.gold, cursor: "pointer" }} />
              <label htmlFor="hasCondominio" style={{ color: T.muted, fontSize: 13, cursor: "pointer" }}>Este imóvel tem condomínio</label>
            </div>
            {form.hasCondominio && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ color:T.green, fontSize:11, padding:"8px 10px", background:T.green+"11", borderRadius:6 }}>
                  ✓ Condomínio mensal pago pelo inquilino — não entra nas suas despesas.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={S.label}>COND. MENSAL (R$)</label><input type="number" style={S.input} value={form.condoFee} onChange={e=>set("condoFee",e.target.value)} /></div>
                  <div>
                    <label style={S.label}>FUNDO DE RESERVA (R$/mês)</label>
                    <input type="number" style={S.input} value={form.fundoReserva} onChange={e=>set("fundoReserva",e.target.value)} />
                    <div style={{ color:T.dim, fontSize:10, marginTop:3 }}>Sempre do proprietário</div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>CHAMADA EXTRA (R$/mês)</label>
                    <input type="number" style={S.input} value={form.chamadaExtra} onChange={e=>set("chamadaExtra",e.target.value)} />
                    <div style={{ color:T.dim, fontSize:10, marginTop:3 }}>Sempre do proprietário</div>
                    {Number(form.chamadaExtra) > 0 && (
                      <div style={{ display:"flex", gap:8, marginTop:8 }}>
                        <div style={{ flex:1 }}>
                          <label style={S.label}>TOTAL DE PARCELAS</label>
                          <input type="number" style={S.input} value={form.chamadaExtraParcelas||""} placeholder="Ex: 24" min="0" onChange={e=>set("chamadaExtraParcelas",e.target.value)} />
                        </div>
                        <div style={{ flex:1 }}>
                          <label style={S.label}>PARCELA ATUAL</label>
                          <input type="number" style={S.input} value={form.chamadaExtraParcelaAtual||""} placeholder="Ex: 10" min="0" onChange={e=>set("chamadaExtraParcelaAtual",e.target.value)} />
                        </div>
                      </div>
                    )}
                    {Number(form.chamadaExtraParcelas) > 0 && Number(form.chamadaExtraParcelaAtual) > 0 && (
                      <div style={{ color:T.amber, fontSize:11, marginTop:6 }}>
                        Parcela {form.chamadaExtraParcelaAtual}/{form.chamadaExtraParcelas} · restam {Number(form.chamadaExtraParcelas) - Number(form.chamadaExtraParcelaAtual)} meses · total restante: {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(form.chamadaExtraParcelas) - Number(form.chamadaExtraParcelaAtual)) * (Number(form.chamadaExtra)||0))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
          <div>
            <button style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", color: T.muted, fontSize: 12, fontFamily: "inherit", width: "100%" }} onClick={() => setShowValorSection(v => !v)}>
              <span style={{ color: T.gold, fontWeight: 700 }}>Informações de valor</span>
              <span style={{ color: T.dim, fontWeight: 400 }}>(opcional)</span>
              <span style={{ marginLeft: "auto" }}>{showValorSection ? "▲" : "▼"}</span>
            </button>
            {showValorSection && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div><label style={S.label}>VALOR DE MERCADO (R$)</label><input type="number" style={S.input} value={form.marketValueManual} placeholder="Ex: 650.000" onChange={e=>set("marketValueManual",e.target.value)} /></div>
              </div>
            )}
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>REGIME FISCAL</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[["PF","Pessoa Física","IRPF até 27,5%"],["PJ","Pessoa Jurídica","Lucro Presumido ~14%"]].map(([val, title, sub]) => (
                <button key={val} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${(form.regimeFiscal||"PF") === val ? T.gold : T.border}`, background: (form.regimeFiscal||"PF") === val ? T.goldGlow : T.s2, color: (form.regimeFiscal||"PF") === val ? T.gold : T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: (form.regimeFiscal||"PF") === val ? 700 : 400, textAlign: "center" }} onClick={() => set("regimeFiscal", val)}>
                  {title}<div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>CONTRATO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={S.label}>DURAÇÃO DO CONTRATO (meses)</label><input type="number" style={S.input} value={form.contratoAnos} onChange={e=>set("contratoAnos",e.target.value)} /></div>
              <div><label style={S.label}>DATA DE INÍCIO DO CONTRATO</label><input type="date" style={S.input} value={form.contratoInicio} onChange={e=>set("contratoInicio",e.target.value)} /></div>
              {form.status === "Ocupado" && (
                <div><label style={S.label}>VENCIMENTO DO CONTRATO</label><input type="date" style={S.input} value={form.contratoVencimento} onChange={e=>set("contratoVencimento",e.target.value)} /></div>
              )}
              <div>
                <label style={S.label}>ÍNDICE DE REAJUSTE</label>
                <div style={{ display:"flex", gap:6, marginTop:6 }}>
                  {["IGPM","IPCA","INPC","Fixo"].map(idx => (
                    <button key={idx} style={{ flex:1, padding:"8px 4px", borderRadius:8, border:`1px solid ${(form.indiceReajuste||"IGPM")===idx?T.gold:T.border}`, background:(form.indiceReajuste||"IGPM")===idx?T.goldGlow:T.s2, color:(form.indiceReajuste||"IGPM")===idx?T.gold:T.muted, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:(form.indiceReajuste||"IGPM")===idx?700:400 }} onClick={()=>set("indiceReajuste",idx)}>{idx}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:12 }}>
                <div style={{ flex:2 }}><label style={S.label}>COMPETÊNCIA IPTU (ano)</label><input type="number" style={S.input} value={form.iptuVencimento||""} placeholder={new Date().getFullYear().toString()} min="2000" max="2099" onChange={e=>set("iptuVencimento",e.target.value)} /><div style={{ color:T.dim, fontSize:10, marginTop:4 }}>Ano de competência do IPTU</div></div>
                <div style={{ flex:1 }}><label style={S.label}>PARCELAS IPTU</label><select style={S.sel} value={form.iptuParcelas||10} onChange={e=>set("iptuParcelas",Number(e.target.value))}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}x</option>)}</select></div>
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:T.s2, borderRadius:8, border:`1px solid ${T.border}` }}>
                <input type="checkbox" checked={form.clausula12Meses||false} onChange={e=>set("clausula12Meses",e.target.checked)} style={{ width:16, height:16, accentColor:T.gold, cursor:"pointer" }} />
                <div>
                  <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>Contrato tem cláusula de dispensa de multa após 12 meses?</div>
                  <div style={{ color:T.dim, fontSize:11, marginTop:2 }}>Se ativado: sem multa rescisória após 12 meses de locação</div>
                </div>
              </div>
            </div>
            {form.contratoInicio && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: T.s3, borderRadius: 8, color: T.muted, fontSize: 12 }}>
                Próximo reajuste: <span style={{ color: T.gold, fontWeight: 700 }}>
                  {(() => { const d = new Date(form.contratoInicio); const now = new Date(); let y = now.getFullYear(); if (new Date(y, d.getMonth(), d.getDate()) <= now) y++; return new Date(y, d.getMonth(), d.getDate()).toLocaleDateString("pt-BR"); })()}
                </span> · Normalmente pelo IGPM acumulado
              </div>
            )}
          </div>
          <div>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
              LOCATÁRIO <span style={{ color: T.dim, fontWeight: 400, fontSize: 11, textTransform: "none", letterSpacing: 0 }}>{form.viaImobiliaria ? "(opcional)" : "(recomendado)"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, background: T.s1, borderRadius: 10, padding: "10px 14px", border: `1px solid ${T.border}` }}>
              <input type="checkbox" checked={form.viaImobiliaria} onChange={e=>set("viaImobiliaria",e.target.checked)} style={{ width:16, height:16, accentColor:T.gold, cursor:"pointer" }} />
              <div>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>Gerenciado por imobiliária</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Os dados do locatário são opcionais quando gerenciado por imobiliária</div>
              </div>
            </div>
            {form.viaImobiliaria && (
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>NOME DA IMOBILIÁRIA</label>
                <input style={S.input} value={form.imobiliariaName} placeholder="Ex: Imobiliária XYZ" onChange={e=>set("imobiliariaName",e.target.value)} />
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}><label style={S.label}>NOME DO LOCATÁRIO</label><input style={S.input} value={form.locatarioNome} placeholder="Nome completo" onChange={e=>set("locatarioNome",e.target.value)} /></div>
              <div><label style={S.label}>CPF / CNPJ</label><input style={S.input} value={form.locatarioCPF} placeholder="000.000.000-00" onChange={e=>set("locatarioCPF",e.target.value)} /></div>
              <div><label style={S.label}>TELEFONE</label><input style={S.input} value={form.locatarioTelefone} placeholder="(11) 99999-9999" onChange={e=>set("locatarioTelefone",e.target.value)} /></div>
              <div style={{ gridColumn: "1/-1" }}><label style={S.label}>EMAIL</label><input style={S.input} value={form.locatarioEmail} placeholder="email@exemplo.com" onChange={e=>set("locatarioEmail",e.target.value)} /></div>
              <div><label style={S.label}>GARANTIA</label><select style={S.sel} value={form.locatarioGarantia} onChange={e=>set("locatarioGarantia",e.target.value)}>{["Fiador","Seguro Fiança","Caução","Título de Capitalização","Sem garantia"].map(o=><option key={o}>{o}</option>)}</select></div>
            </div>
          </div>
        </div>
        )} {/* end editTab === dados */}

        <div style={{ padding: "16px 28px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button style={S.btnGhost} onClick={onClose}>Cancelar</button>
          {editTab === "dados" && <button style={S.btn} onClick={handleSave}>Salvar Alterações</button>}
          {editTab === "documentos" && <button style={S.btnGhost} onClick={onClose}>Fechar</button>}
        </div>
      </div>
    </div>
  );
}

// ─── OBRAS MODAL ─────────────────────────────────────────────────────────────
const OBRA_TIPOS = ["Corretiva", "Preventiva", "Retrofit", "Estrutural", "Acabamento", "Elétrica", "Hidráulica"];
const OBRA_STATUS_OPTS = ["Planejada", "Em andamento", "Concluída", "Pausada"];

const OBRA_BM = {
  pintura:              { label:"Pintura Simples",       emoji:"", desc:"Massa corrida + 2 demãos.",                                                  r_min:60,   r_max:100,  r_ref:80,   mat:0.35, mao:0.60, aux:0.05, dias100:7,  imp_alug:0.04, vac_reduz:15 },
  reforma_simples:      { label:"Reforma Simples",       emoji:"", desc:"Pintura + troca de piso + reparos pontuais.",                                 r_min:800,  r_max:1200, r_ref:1000, mat:0.50, mao:0.45, aux:0.05, dias100:30, imp_alug:0.08, vac_reduz:20 },
  reforma_intermediaria:{ label:"Reforma Intermediária", emoji:"", desc:"Elétrica + hidráulica parcial + porcelanato + louças.",                      r_min:1200, r_max:2600, r_ref:1800, mat:0.52, mao:0.43, aux:0.05, dias100:60, imp_alug:0.15, vac_reduz:30 },
  retrofit_completo:    { label:"Retrofit Completo",     emoji:"", desc:"Elétrica + hidráulica completas + piso + forro + automação básica.",          r_min:2000, r_max:4200, r_ref:3000, mat:0.55, mao:0.40, aux:0.05, dias100:90, imp_alug:0.25, vac_reduz:45 },
  estrutural:           { label:"Obra Estrutural",       emoji:"", desc:"Reforço de laje, fundações, alvenaria. Exige ART.",                          r_min:1500, r_max:3500, r_ref:2500, mat:0.45, mao:0.50, aux:0.05, dias100:90, imp_alug:0.05, vac_reduz:0  },
  eletrica:             { label:"Instalação Elétrica",   emoji:"", desc:"Troca completa de fiação, disjuntores, tomadas.",                             r_min:150,  r_max:400,  r_ref:250,  mat:0.30, mao:0.65, aux:0.05, dias100:15, imp_alug:0.06, vac_reduz:10 },
  hidraulica:           { label:"Instalação Hidráulica", emoji:"", desc:"Troca de tubulações, registros, torneiras, chuveiros.",                      r_min:120,  r_max:350,  r_ref:200,  mat:0.35, mao:0.60, aux:0.05, dias100:10, imp_alug:0.04, vac_reduz:10 },
  alto_padrao:          { label:"Alto Padrão",           emoji:"", desc:"Projeto completo, forro de gesso, automação, mármores, marcenaria.",          r_min:2800, r_max:5500, r_ref:3500, mat:0.57, mao:0.38, aux:0.05, dias100:120,imp_alug:0.35, vac_reduz:60 },
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
          <div style={{ color:T.muted, fontSize:13, marginTop:4 }}>Orçado × Real · Material × Mão de Obra · Impacto no Resultado</div>
        </div>
        <button style={{ ...S.btn, display:"flex", alignItems:"center", gap:8 }} onClick={() => setView("estimador")}>Estimador de Custo</button>
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
        <div style={S.card}><div style={{ color:T.muted, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:6 }}>LUCRO LÍQUIDO ANUAL</div><div style={{ color:(prop.lucroLiquido||prop.noi)>0?T.green:T.red, fontSize:22, fontWeight:800, ...S.mono }}>{fmt.brlK(prop.lucroLiquido||prop.noi)}</div><div style={{ color:T.dim, fontSize:11, marginTop:4 }}>Margem: {fmt.pct(prop.noiPct)}</div></div>
        <div style={S.card}><div style={{ color:T.muted, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:6 }}>TOTAL ORÇADO</div><div style={{ color:T.gold, fontSize:22, fontWeight:800, ...S.mono }}>{fmt.brlK(totalOrc)}</div><div style={{ color:T.dim, fontSize:11, marginTop:4 }}>{obras.length} obra(s)</div></div>
        <div style={{ ...S.card, border:`1px solid ${varTotal>0?T.red+"40":T.border}` }}><div style={{ color:T.muted, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:6 }}>VARIAÇÃO</div><div style={{ color:varTotal>0?T.red:T.green, fontSize:22, fontWeight:800, ...S.mono }}>{varTotal>0?"+":""}{fmt.brlK(varTotal)}</div><div style={{ color:T.dim, fontSize:11, marginTop:4 }}>{totalOrc>0?`${((varTotal/totalOrc)*100).toFixed(1)}% do orçado`:"—"}</div></div>
      </div>
      <div style={{ display:"flex", gap:8, borderBottom:`1px solid ${T.border}`, paddingBottom:0 }}>
        {[{ id:"obras", label:"Obras" }, { id:"prestadores", label:"Prestadores" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t.id?T.gold:"transparent"}`, color:tab===t.id?T.gold:T.muted, fontWeight:700, fontSize:13, padding:"8px 18px", cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>
      {tab === "obras" && <>
        {obras.filter(o=>(o.orcado||0)>0).length>0 && <MatMaoCard obras={obras} bmForTipo={bmForTipo} />}
        {obras.length===0&&!adding&&(
          <div style={{ ...S.card, textAlign:"center", padding:"40px 20px" }}><div style={{ color:T.text, fontSize:15, fontWeight:600, marginBottom:6 }}>Nenhuma obra cadastrada</div></div>
        )}
        {obras.map(obra => <ObraCard key={obra.id} obra={obra} prop={prop} bmForTipo={bmForTipo} onUpd={(k,v)=>upd(obra.id,k,v)} onRem={()=>rem(obra.id)} />)}
        {adding && <NovaObraForm form={newO} setForm={setNewO} onAdd={addObra} onCancel={()=>setAdding(false)} propSize={prop.size} bmForTipo={bmForTipo} />}
        {!adding && <button style={{ ...S.btnGhost, width:"100%", padding:14 }} onClick={()=>setAdding(true)}>+ Adicionar Obra / Reforma</button>}
      </>}
      {tab === "prestadores" && <>
        {prestadores.length === 0 && !addingPrest && (
          <div style={{ ...S.card, textAlign:"center", padding:"40px 20px" }}><div style={{ color:T.text, fontSize:15, fontWeight:600, marginBottom:6 }}>Nenhum prestador cadastrado</div><div style={{ color:T.muted, fontSize:13 }}>Adicione eletricistas, pintores, encanadores e outros prestadores de serviço.</div></div>
        )}
        {prestadores.map(p => (
          <div key={p.id} style={{ ...S.card, border:`1px solid ${T.borderMid}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ color:T.text, fontWeight:700, fontSize:15, marginBottom:4 }}>{p.nome}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                  <span style={S.badge(T.blue)}>{p.especialidade}</span>
                  {p.avaliacao && <span style={S.badge(T.gold)}>{p.avaliacao}/5</span>}
                </div>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                  {p.telefone && <div style={{ color:T.muted, fontSize:12 }}>{p.telefone}</div>}
                  {p.email && <div style={{ color:T.muted, fontSize:12 }}>{p.email}</div>}
                </div>
                {p.notas && <div style={{ color:T.dim, fontSize:12, marginTop:8, padding:"8px 12px", background:T.s3, borderRadius:8 }}>{p.notas}</div>}
              </div>
              <button style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:16 }} onClick={() => remPrest(p.id)}>✕</button>
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
          <button style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:16 }} onClick={onRem}>✕</button>
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
      <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:12 }}>IMPACTO NO RESULTADO</div>
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
          <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:10 }}>REFERÊNCIA DE CUSTO — SINAPI/SP 2026</div>
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
          {obras.length===0&&!adding&&<div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}><div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>Nenhuma obra cadastrada</div></div>}
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
                  <button style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:18, padding:"0 4px" }} onClick={()=>removeObra(obra.id)}>✕</button>
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

  const anoAtualVM = new Date().getFullYear();
  const propsComValor = PROPS.map(p => {
    const bm = getFipeZAP(p.neighborhood, p.city, p.type);
    const m2ref = p.type === "Comercial" ? bm.com : bm.res;
    const valorEstimado = p.valorMercado > 0 ? p.valorMercado : m2ref * p.size;
    const valorCompra = p.valorCompra || 0;
    const ganhoCapital = valorCompra > 0 ? valorEstimado - valorCompra : null;
    const ganhoCapitalPct = valorCompra > 0 ? ganhoCapital / valorCompra : null;
    const capRate = valorEstimado > 0 ? (p.lucroLiquido || p.noi) / valorEstimado : 0;
    // Valorização real baseada nos dados cadastrados
    const temValTotal = valorCompra > 0 && p.valorMercado > 0;
    const valorizacaoTotalPct = temValTotal ? ((p.valorMercado - valorCompra) / valorCompra) * 100 : null;
    const anosDesdeCompra = (temValTotal && p.anoCompra && (anoAtualVM - Number(p.anoCompra)) > 0)
      ? anoAtualVM - Number(p.anoCompra) : null;
    const valorizacaoCAGR = anosDesdeCompra
      ? (Math.pow(p.valorMercado / valorCompra, 1 / anosDesdeCompra) - 1) * 100 : null;
    return { ...p, m2ref, valorEstimado, valorCompra, ganhoCapital, ganhoCapitalPct, capRate, fonteM2: bm.fonte, isManual: p.valorMercado > 0, valorizacaoTotalPct, valorizacaoCAGR, anosDesdeCompra };
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
  const comValorCompra = propsComValor.filter(p => p.valorCompra > 0).length;
  const totalGanho     = propsComValor.filter(p => p.valorCompra > 0).reduce((s, p) => s + (p.ganhoCapital || 0), 0);
  // Valorização real média ponderada pelo valor de mercado (só imóveis com dados completos)
  const comValorizacaoReal = propsComValor.filter(p => p.valorizacaoTotalPct !== null);
  const valorizacaoMediaPonderada = comValorizacaoReal.length > 0
    ? comValorizacaoReal.reduce((s, p) => s + p.valorizacaoTotalPct * p.valorMercado, 0) /
      comValorizacaoReal.reduce((s, p) => s + p.valorMercado, 0)
    : null;

  const saveEdit = () => {
    const vm = parseFloat(editForm.valorMercado) || 0;
    const newProps = PROPS.map(p => {
      if (p.id !== editingId) return p;
      // Append to avaliacoes history if value changed and non-zero
      const avaliacoes = p.avaliacoes || [];
      const novaAvaliacao = vm > 0 ? {
        data: editForm.dataAvaliacao || new Date().toISOString().slice(0,10),
        valor: vm,
        fonte: editForm.fonteAvaliacao || "Manual",
        obs: editForm.obsAvaliacao || "",
      } : null;
      const newAvaliacoes = novaAvaliacao ? [...avaliacoes.filter(a => a.data !== novaAvaliacao.data), novaAvaliacao] : avaliacoes;
      return { ...p, valorMercado: vm, valorCompra: parseFloat(editForm.valorCompra)||0, anoCompra: editForm.anoCompra||null, avaliacoes: newAvaliacoes };
    });
    onUpdateProps(newProps);
    setEditingId(null);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      valorMercado: p.valorMercado || "",
      valorCompra: p.valorCompra || "",
      anoCompra: p.anoCompra || "",
      dataAvaliacao: new Date().toISOString().slice(0,10),
      fonteAvaliacao: "Manual",
      obsAvaliacao: "",
    });
  };


  // top 12 para o gráfico
  const top12 = [...propsComValor].sort((a, b) => b.valorEstimado - a.valorEstimado).slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>INTELIGÊNCIA DE MERCADO</div>
          <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Valor da Carteira</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>FipeZAP por bairro · Cap Rate · Valorização · Ganho de Capital</div>
        </div>
        <div style={{ color: T.dim, fontSize: 11, textAlign: "right" }}>
          FipeZAP dez/2025<br />Média SP: R$11.915/m² · +4,56% a.a.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {[
          { label: "VALOR TOTAL EST.",  value: fmt.brlK(totalValor),  sub: `${PROPS.length} imóveis`,               color: T.gold },
          { label: "CAP RATE MÉDIO",    value: fmt.pct(capRateMedio), sub: "aluguel líquido ÷ valor mercado",        color: capRateMedio > 0.06 ? T.green : T.amber },
          ...(valorizacaoMediaPonderada !== null ? [{ label: "VALORIZAÇÃO MÉDIA", value: `+${valorizacaoMediaPonderada.toFixed(1)}%`, sub: `${comValorizacaoReal.length} imóvel(is) com dados reais`, color: T.teal }] : []),
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
          <option>Todos</option><option>Apartamento</option><option>Casa</option><option>Terreno</option><option>Comercial</option><option>Sala Comercial</option><option>Galpão/Industrial</option><option>Studio/Kitnet</option>
        </select>
        <select style={S.sel} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="valor_desc">↓ Maior valor</option>
          <option value="valor_asc">↑ Menor valor</option>
          <option value="caprate_desc">↓ Maior cap rate</option>
          <option value="ganho_desc">↓ Maior ganho de capital</option>
        </select>
        <div style={{ color: T.muted, fontSize: 12, marginLeft: "auto" }}>{filtered.length} imóveis · clique em ✎ para inserir valor real</div>
      </div>

      {/* Tabela */}
      <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.s2 }}>
              {["Imóvel", "Bairro", "m²", "R$/m² ref.", "Valor Est.", "Valor Compra", "Ganho Capital", "Cap Rate", "Valorização Real", ""].map(h => (
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="number" style={{ ...S.input, padding: "6px 10px", fontSize: 12, flex: 1 }}
                            value={editForm.valorMercado}
                            onChange={e => setEditForm(f => ({ ...f, valorMercado: e.target.value }))}
                            placeholder={`~${fmt.brlK(p.m2ref * p.size)}`}
                          />

                        </div>
                        <input type="date" style={{ ...S.input, padding: "6px 10px", fontSize: 11 }}
                          value={editForm.dataAvaliacao}
                          onChange={e => setEditForm(f => ({ ...f, dataAvaliacao: e.target.value }))}
                        />
                        <select style={{ ...S.sel, padding: "6px 10px", fontSize: 11 }}
                          value={editForm.fonteAvaliacao}
                          onChange={e => setEditForm(f => ({ ...f, fonteAvaliacao: e.target.value }))}>
                          {["Manual","ZAP Imóveis","VivaReal","Imobiliária","ITBI","Avaliação formal"].map(o=><option key={o}>{o}</option>)}
                        </select>
                        <input style={{ ...S.input, padding: "6px 10px", fontSize: 11 }}
                          value={editForm.obsAvaliacao} placeholder="Observação (opcional)"
                          onChange={e => setEditForm(f => ({ ...f, obsAvaliacao: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <div>
                        <div style={{ color: T.gold, fontWeight: 700 }}>{fmt.brlK(p.valorEstimado)}</div>
                        <div style={{ color: T.dim, fontSize: 10 }}>
                          {p.isManual ? (
                            <span>✎ manual
                              {p.avaliacoes && p.avaliacoes.length > 0 && (
                                <span style={{ marginLeft: 4, color: T.teal }}>· {p.avaliacoes.length} aval.</span>
                              )}
                            </span>
                          ) : `auto · ${fmt.num(p.m2ref)}/m²`}
                        </div>
                        {p.avaliacoes && p.avaliacoes.length > 0 && (
                          <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>
                            última: {p.avaliacoes[p.avaliacoes.length-1].data}
                          </div>
                        )}
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

                  {/* Valorização real */}
                  <td style={{ ...S.td, ...S.mono }}>
                    {p.valorizacaoTotalPct !== null ? (
                      <div>
                        <div style={{ color: p.valorizacaoTotalPct >= 0 ? T.teal : T.red, fontWeight: 700 }}>
                          {p.valorizacaoTotalPct >= 0 ? "+" : ""}{p.valorizacaoTotalPct.toFixed(1)}% total
                        </div>
                        {p.valorizacaoCAGR !== null && (
                          <div style={{ color: T.dim, fontSize: 10 }}>
                            {p.valorizacaoCAGR >= 0 ? "+" : ""}{p.valorizacaoCAGR.toFixed(1)}% a.a. desde {p.anoCompra}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: T.dim, fontSize: 11 }}>—</div>
                    )}
                  </td>

                  <td style={S.td}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...S.btn, padding: "6px 14px", fontSize: 12 }} onClick={saveEdit}>✓</button>
                        <button style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 12 }} onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                        <button style={{ ...S.btnGhost, padding: "6px 14px", fontSize: 12 }} onClick={() => startEdit(p)}>✎ Editar</button>
                        <a href={`https://wa.me/5519997010594?text=${encodeURIComponent("Olá! Gostaria de solicitar um estudo de mercado para o imóvel: " + p.name + (p.neighborhood ? " - " + p.neighborhood : "") + (p.city ? ", " + p.city : "") + ".")}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ padding: "6px 10px", background: "#25D366", border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", cursor: "pointer", textAlign: "center" }}>
                          Pedir Estudo
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Histórico de avaliações */}
      {(() => {
        const comAval = PROPS.filter(p => p.avaliacoes && p.avaliacoes.length > 0);
        if (comAval.length === 0) return null;
        const todasAval = comAval.flatMap(p => p.avaliacoes.map(a => ({ ...a, imovel: p.name, id: p.id })))
          .sort((a, b) => b.data.localeCompare(a.data));
        return (
          <div style={{ background: T.s1, borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>HISTÓRICO DE AVALIAÇÕES</div>
              <div style={{ color: T.dim, fontSize: 11 }}>{todasAval.length} registro{todasAval.length !== 1 ? "s" : ""} em {comAval.length} imóvel{comAval.length !== 1 ? "is" : ""}</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.s2 }}>
                    {["DATA","IMÓVEL","VALOR","FONTE","OBSERVAÇÃO"].map(h => (
                      <th key={h} style={{ ...S.th, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todasAval.map((a, i) => (
                    <tr key={i} style={{ background: i%2===0 ? T.s0 : T.s1, borderBottom: `1px solid ${T.border}40` }}>
                      <td style={{ ...S.td, color: T.muted, whiteSpace: "nowrap" }}>{a.data}</td>
                      <td style={{ ...S.td, color: T.goldBright, fontWeight: 600 }}>{a.imovel}</td>
                      <td style={{ ...S.td, ...S.mono, color: T.gold, fontWeight: 700 }}>{fmt.brl(a.valor)}</td>
                      <td style={{ ...S.td, color: T.muted }}>{a.fonte}</td>
                      <td style={{ ...S.td, color: T.dim }}>{a.obs || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Nota metodologia */}
      <div style={{ padding: "12px 16px", background: T.s1, borderRadius: 10, border: `1px solid ${T.border}` }}>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Metodologia</div>
        <div style={{ color: T.dim, fontSize: 11, lineHeight: 1.6 }}>
          Estimativas baseadas no Índice FipeZAP dez/2025 por bairro (residencial e comercial separados).
          Média SP residencial: <strong style={{ color: T.gold }}>R$11.915/m²</strong> · Valorização 12m: <strong style={{ color: T.teal }}>+4,56%</strong>.
          Cap rate = receita anual líquida ÷ valor de mercado. Meta de mercado SP: 5–8% residencial.
          Clique em ✎ para inserir valor de mercado real, data, fonte e observação — o histórico é salvo automaticamente.
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function PageDashboard({ PROPS, onNav, onProp, onAdd }) {
  // Empty state
  if (PROPS.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 24, textAlign: "center" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 28, fontWeight: 900, margin: "0 0 12px" }}>Bem-vindo ao Rently</h1>
          <div style={{ color: T.muted, fontSize: 16, maxWidth: 400, lineHeight: 1.6 }}>Cadastre seu primeiro imóvel para começar a acompanhar seus aluguéis, despesas e rentabilidade.</div>
        </div>
        <button style={{ ...S.btn, padding: "16px 32px", fontSize: 16, borderRadius: 14 }} onClick={onAdd}>
          + Adicionar meu primeiro imóvel
        </button>
        <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
          {["Controle de recebimentos","Análise de rentabilidade","Alertas de reajuste"].map((label) => (
            <div key={label} style={{ color: T.dim, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }

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
          <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Visão Geral</h1>
        </div>
        <div style={{ color: T.dim, fontSize: 12 }}>{fmt.date()}</div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {(() => {
          const receitaAnual = PROPS.filter(p => p.status === "Ocupado").reduce((s, p) => s + (p.rent - (p.descontoAluguel||0)) * 12, 0);
          const receitaMensal = Math.round(receitaAnual / 12);
          return (
            <div style={{ ...S.card, flex: 1, minWidth: 150 }}>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Receita Bruta</div>
              <div style={{ color: T.gold, fontSize: 26, fontWeight: 800, ...S.mono, lineHeight: 1 }}>{fmt.brl(receitaMensal)}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>/mês</span></div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>{fmt.brlK(receitaAnual)}/ano</div>
            </div>
          );
        })()}
        {(() => {
          const lucroMensal = PROPS.reduce((s, p) => s + (p.aluguelLiquido || 0), 0);
          const lucroAnual = lucroMensal * 12;
          return (
            <div style={{ ...S.card, flex: 1, minWidth: 150 }}>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Lucro Líquido</div>
              <div style={{ color: lucroMensal >= 0 ? T.green : T.red, fontSize: 26, fontWeight: 800, ...S.mono, lineHeight: 1 }}>{fmt.brl(lucroMensal)}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>/mês</span></div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>{fmt.brlK(lucroAnual)}/ano · margem {fmt.pct(PORT.lucroLiquidoPct||PORT.noiPct)}</div>
            </div>
          );
        })()}
        {(() => {
          const vagos = PROPS.filter(p => p.status === "Vago").length;
          return (
            <div style={{ ...S.card, flex: 1, minWidth: 150, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.red}, ${T.amber})` }} />
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Custo Vacância</div>
              <div style={{ color: T.amber, fontSize: 26, fontWeight: 800, ...S.mono, lineHeight: 1 }}>{fmt.brl(PORT.vacancyCost)}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>/mês</span></div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>{fmt.brlK(PORT.vacancyCost * 12)}/ano · {vagos} imóvel(is) vago(s)</div>
            </div>
          );
        })()}
        {(() => {
          const comVM = PROPS.filter(p => (p.valorMercado||0) > 0);
          const totalVM = comVM.reduce((s,p) => s+(p.valorMercado||0), 0);
          return (
            <div style={{ ...S.card, minWidth: 180, flex: 1, cursor: "pointer" }} onClick={() => onNav("mercado")}>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>VALOR DE MERCADO</div>
              {totalVM > 0 ? (
                <>
                  <div style={{ color: T.gold, fontSize: 28, fontWeight: 800, ...S.mono, lineHeight: 1 }}>{fmt.brlK(totalVM)}</div>
                  <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>{comVM.length}/{PROPS.length} imóveis avaliados · ver análise →</div>
                </>
              ) : (
                <>
                  <div style={{ color: T.dim, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>—</div>
                  <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>Cadastre o valor de mercado dos imóveis →</div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {totalObras > 0 && (
        <div style={{ padding: "12px 18px", background: T.s2, borderRadius: 10, border: `1px solid ${T.amber}40`, display: "flex", gap: 16, alignItems: "center" }}>
          <div><span style={{ color: T.text, fontWeight: 600 }}>{totalObras} obra{totalObras > 1 ? "s" : ""} cadastrada{totalObras > 1 ? "s" : ""}</span>{obrasEmAndamento > 0 && <span style={{ color: T.amber, marginLeft: 8 }}>· {obrasEmAndamento} em andamento</span>}</div>
          <button style={{ ...S.btnGhost, marginLeft: "auto", padding: "6px 14px", fontSize: 12 }} onClick={() => onNav("noi")}>Ver imóveis →</button>
        </div>
      )}

      <div style={{ maxWidth: 380 }}>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Despesas</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={44} outerRadius={70} dataKey="value" paddingAngle={4}>{costBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={v => fmt.brl(v)} /></PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {costBreakdown.filter(c => c.value > 0).map(c => {
              const mensal = Math.round(c.value / 12);
              return (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} />
                    <span style={{ color: T.muted, fontSize: 11 }}>{c.name}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: T.text, fontSize: 12, fontWeight: 700, ...S.mono }}>{fmt.brl(mensal)}/mês</div>
                    <div style={{ color: T.dim, fontSize: 10, ...S.mono }}>{fmt.brlK(c.value)}/ano</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <div style={{ color: T.text, fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Top 5 — Maior Risco</div>
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
  const [expandedId, setExpandedId] = useState(null);
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
        <div><div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>ANÁLISE</div><h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Imóveis</h1></div>
        <button style={{ ...S.btn, display: "flex", alignItems: "center", gap: 8 }} onClick={onAdd}>+ Adicionar Imóvel</button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Buscar imóvel, bairro ou endereço..." style={{ ...S.input, maxWidth: 280 }} value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.sel} value={filterType} onChange={e => setFilterType(e.target.value)}><option value="">Todos os tipos</option><option>Apartamento</option><option>Casa</option><option>Casa de Condomínio</option><option>Sala Comercial</option><option>Industrial</option><option>Loja</option><option>Galpão</option><option>Salão Comercial</option><option>Terreno</option></select>
        <select style={S.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">Todos os status</option><option>Ocupado</option><option>Vago</option></select>
        <span style={{ color: T.muted, fontSize: 12 }}>{sorted.length} imóveis</span>
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.s2 }}>
              <Th col="id" label="#" /><th style={S.th}>Imóvel / Endereço</th><th style={S.th}>Tipo</th><th style={S.th}>Status</th>
              <Th col="rent" label="Aluguel bruto" /><Th col="totalExpenses" label="Despesas/ano" /><Th col="ir" label="IR/ano" /><Th col="aluguelLiquido" label="Aluguel líquido" /><Th col="aluguelLiquido" label="Aluguel Líquido/ano" /><Th col="noiPct" label="Margem" />
              <Th col="vacancyDays" label="Vacância" /><th style={S.th}>Obras</th><th style={S.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const obrasCount = (p.obras || []).length, obrasAtivas = (p.obras || []).filter(o => o.status === "Em andamento").length;
              const isExpanded = expandedId === p.id;
              const condoAnnual = p.hasCondominio ? ((p.fundoReserva||0)+(p.chamadaExtra||0))*12 : 0;
              return (
                <>
                  <tr key={p.id} style={{ cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = T.s2} onMouseLeave={e => e.currentTarget.style.background = isExpanded ? T.s2 : "transparent"}>
                    <td style={{ ...S.td, color: T.dim, ...S.mono, fontSize: 11 }} onClick={() => { onProp(p); onNav("detail"); }}>{String(p.id).padStart(2, "0")}</td>
                    <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><div style={{ color: T.goldBright, fontWeight: 600, fontSize: 13 }}>{p.name}</div><div style={{ color: T.dim, fontSize: 11 }}>{p.address} · {p.neighborhood}</div></td>
                    <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><span style={S.badge(p.type === "Comercial" ? T.blue : T.teal)}>{p.type}</span></td>
                    <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><span style={S.badge(p.status === "Ocupado" ? T.green : T.red)}>{p.status}</span></td>
                    <td style={{ ...S.td, ...S.mono }} onClick={() => { onProp(p); onNav("detail"); }}>
                      {fmt.brl(p.rent)}
                      {(p.descontoAluguel||0) > 0 && <div style={{ color:T.dim, fontSize:10 }}>desc. {fmt.brl(p.descontoAluguel)}</div>}
                    </td>
                    <td style={{ ...S.td, ...S.mono, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      <span style={{ color: T.amber, fontWeight: 600 }}>{fmt.brl(p.totalExpenses)}</span>
                      <div style={{ color: T.dim, fontSize: 10 }}>{fmt.brl(Math.round(p.totalExpenses/12))}/mês {isExpanded ? "▲" : "▼"}</div>
                    </td>
                    <td style={{ ...S.td, ...S.mono, color: T.red }} onClick={() => { onProp(p); onNav("detail"); }}>{p.ir > 0 ? fmt.brl(p.ir) : <span style={{ color: T.dim }}>—</span>}</td>
                    <td style={{ ...S.td, ...S.mono, color: T.green }} onClick={() => { onProp(p); onNav("detail"); }}>
                      {fmt.brl(p.aluguelLiquido || (p.rent-(p.descontoAluguel||0)))}
                      {p.viaImobiliaria && <div style={{ color:T.dim, fontSize:10 }}>via imob.</div>}
                    </td>
                    <td style={{ ...S.td, ...S.mono, color: (p.aluguelLiquido || (p.rent-(p.descontoAluguel||0))) > 0 ? T.green : T.red, fontWeight: 700 }} onClick={() => { onProp(p); onNav("detail"); }}>{fmt.brl((p.aluguelLiquido || (p.rent-(p.descontoAluguel||0))) * 12)}</td>
                    <td style={S.td} onClick={() => { onProp(p); onNav("detail"); }}><span style={{ color: (p.lucroLiquidoPct||p.noiPct) > 0.45 ? T.green : (p.lucroLiquidoPct||p.noiPct) > 0.3 ? T.amber : T.red, fontSize: 12, fontWeight: 700, ...S.mono }}>{fmt.pct(p.lucroLiquidoPct||p.noiPct)}</span></td>
                    <td style={{ ...S.td, color: p.vacancyDays > p.vacancyBenchmark ? T.amber : T.muted }} onClick={() => { onProp(p); onNav("detail"); }}>{p.vacancyDays}d</td>
                    <td style={S.td}>{obrasCount > 0 ? <span style={S.badge(obrasAtivas > 0 ? T.amber : T.muted)}>{obrasCount}{obrasAtivas > 0 ? ` (${obrasAtivas} ativ.)` : ""}</span> : <span style={{ color: T.dim, fontSize: 11 }}>—</span>}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button title="Editar" style={{ background: T.s3, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }} onClick={e => { e.stopPropagation(); onEdit(p); }}>Editar</button>
                        <button title="Obras" style={{ background: T.s3, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }} onClick={e => { e.stopPropagation(); onObras(p); }}>Obras</button>
                        <button title="Remover" style={{ background: T.s3, border: `1px solid ${T.redDim}`, color: T.red, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }} onClick={e => { e.stopPropagation(); onDelete(p); }}>Remover</button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`exp-${p.id}`} style={{ background: T.s0 }}>
                      <td colSpan={13} style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, alignSelf: "center", minWidth: 80 }}>DESPESAS</div>
                            {(() => {
                              const adminAnual = (p.adminRecalc || p.admin || 0) * 12;
                              const condoA = p.condoAnnual || condoAnnual;
                              const itens = [
                                ...(p.status !== "Ocupado" ? [{ label: "IPTU", anual: p.iptu||0, mensal: Math.round((p.iptu||0)/12), note: "sem inquilino", noteColor: T.dim }] : []),
                                { label: "Manutenção", anual: (p.maintMonthly||0)*12, mensal: p.maintMonthly||0 },
                                { label: "Seguro", anual: p.insurance||0, mensal: Math.round((p.insurance||0)/12) },
                                { label: "Administração", anual: adminAnual, mensal: Math.round(adminAnual/12) },
                                ...(condoA > 0 ? [{ label: "Fundo/Chamada", anual: condoA, mensal: Math.round(condoA/12), note: "sempre proprietário" }] : []),
                                ...(p.hasCondominio ? [{ label: "Cond. mensal", anual: 0, mensal: 0, note: "pago pelo inquilino", noteColor: T.green }] : []),
                              ];
                              return itens.map(({ label, anual, mensal, note, noteColor }) => (
                                <div key={label} style={{ background: T.s2, padding: "8px 14px", borderRadius: 8 }}>
                                  <div style={{ color: T.dim, fontSize: 10, marginBottom: 4 }}>{label}</div>
                                  {anual > 0 && <div style={{ color: T.amber, fontWeight: 700, fontSize: 13 }}>{fmt.brl(anual)}<span style={{ color:T.dim, fontSize:9, marginLeft:3 }}>ano</span></div>}
                                  {mensal > 0 && <div style={{ color: T.muted, fontSize: 11 }}>{fmt.brl(mensal)}<span style={{ color:T.dim, fontSize:9, marginLeft:3 }}>/mês</span></div>}
                                  {note && <div style={{ color: noteColor||T.dim, fontSize: 10, marginTop: 2 }}>{note}</div>}
                                </div>
                              ));
                            })()}
                            <div style={{ background: T.s2, padding: "8px 14px", borderRadius: 8, borderLeft: `2px solid ${T.red}` }}>
                              <div style={{ color: T.dim, fontSize: 10, marginBottom: 2 }}>IR ({p.regimeFiscal || "PF"})</div>
                              <div style={{ color: T.red, fontWeight: 700, fontSize: 13 }}>{fmt.brl(p.ir||0)}</div>
                              <div style={{ color: T.dim, fontSize: 10 }}>anual</div>
                            </div>
                            <div style={{ background: T.s2, padding: "8px 14px", borderRadius: 8, borderLeft: `2px solid ${T.green}` }}>
                              <div style={{ color: T.dim, fontSize: 10, marginBottom: 2 }}>Lucro Líquido</div>
                              <div style={{ color: T.green, fontWeight: 700, fontSize: 13 }}>{fmt.brl(p.lucroLiquido||p.noi)}</div>
                              <div style={{ color: T.dim, fontSize: 10 }}>{fmt.brl(Math.round((p.lucroLiquido||p.noi)/12))}/mês</div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {PROPS.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "60px 20px" }}>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Nenhum imóvel no portfólio</div>
          <div style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Adicione o primeiro imóvel para começar</div>
          <button style={S.btn} onClick={onAdd}>+ Adicionar Imóvel</button>
        </div>
      )}
    </div>
  );
}

// ─── LEAKAGE PAGE ─────────────────────────────────────────────────────────────
function PageLeakage({ PROPS, onNavPagamentos }) {
  const INSIGHTS = buildInsights(PROPS);
  const TOTAL_MIN = INSIGHTS.reduce((s, i) => s + i.impactMin, 0), TOTAL_MAX = INSIGHTS.reduce((s, i) => s + i.impactMax, 0);
  const [expanded, setExpanded] = useState(1);
  const emDesocupacao = PROPS.filter(p => p.status === "Em desocupação");
  const hoje = new Date();

  // Inadimplentes: ocupados com mês atual atrasado ou mês anterior sem pagamento
  const getDiaVencLeakage = (p) => p.contratoInicio ? new Date(p.contratoInicio + "T12:00").getDate() : (p.diaVencimento || 10);
  const isAtrasadoLeakage = (p, ano, mes) => {
    const pag = (p.pagamentos || {})[`${ano}_${mes}`];
    if (pag?.status === "pago") return false;
    if (pag?.status) return false;
    const diaVenc = getDiaVencLeakage(p);
    const dataVenc = new Date(ano, mes, diaVenc);
    const contratoAtivo = p.contratoInicio ? new Date(p.contratoInicio + "T12:00") <= dataVenc : true;
    if (!contratoAtivo) return false;
    return dataVenc < hoje;
  };
  const mesAtualL = hoje.getMonth(), anoAtualL = hoje.getFullYear();
  const prevMesL = mesAtualL === 0 ? 11 : mesAtualL - 1;
  const prevAnoL = mesAtualL === 0 ? anoAtualL - 1 : anoAtualL;
  const inadimplentes = PROPS.filter(p =>
    p.status === "Ocupado" && (isAtrasadoLeakage(p, anoAtualL, mesAtualL) || isAtrasadoLeakage(p, prevAnoL, prevMesL))
  ).map(p => ({
    ...p,
    mesAtualAtraso: isAtrasadoLeakage(p, anoAtualL, mesAtualL),
    mesAnteriorAtraso: isAtrasadoLeakage(p, prevAnoL, prevMesL),
  }));

  const alertasVencContrato = PROPS.filter(p => {
    if (!p.contratoVencimento) return false;
    const venc = new Date(p.contratoVencimento+"T12:00");
    const dias = Math.round((venc - hoje) / (1000 * 60 * 60 * 24));
    return dias >= 0 && dias <= 60;
  }).map(p => {
    const venc = new Date(p.contratoVencimento+"T12:00");
    const dias = Math.round((venc - hoje) / (1000 * 60 * 60 * 24));
    return { ...p, diasVenc: dias, dataVencFmt: venc.toLocaleDateString("pt-BR") };
  }).sort((a, b) => a.diasVenc - b.diasVenc);

  const contratosVencidos = PROPS.filter(p => {
    if (!p.contratoVencimento || p.status !== "Ocupado") return false;
    const venc = new Date(p.contratoVencimento+"T12:00");
    return venc < hoje;
  }).map(p => {
    const venc = new Date(p.contratoVencimento+"T12:00");
    const diasVencido = Math.round((hoje - venc) / (1000 * 60 * 60 * 24));
    const mesesVencido = Math.floor(diasVencido / 30);
    const tempoVencido = mesesVencido >= 2
      ? `${mesesVencido} meses`
      : diasVencido === 1 ? "1 dia" : `${diasVencido} dias`;
    return { ...p, diasVencido, tempoVencido, dataVencFmt: venc.toLocaleDateString("pt-BR") };
  }).sort((a, b) => b.diasVencido - a.diasVencido);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div><div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>DIAGNÓSTICO</div><h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Alertas</h1></div>

      {emDesocupacao.length > 0 && (
        <div style={{ background: T.amber+"18", border: `1px solid ${T.amber}55`, borderRadius: 14, padding: 20 }}>
          <div style={{ color: T.amber, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>IMÓVEIS EM DESOCUPAÇÃO ({emDesocupacao.length})</div>
          {emDesocupacao.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.amber}22` }}>
              <div>
                <div style={{ color: T.text, fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{p.neighborhood} · Entrega prevista: {p.desocupacaoDataEntrega ? new Date(p.desocupacaoDataEntrega+"-01").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}) : "a definir"}</div>
              </div>
              <span style={S.badge(T.amber)}>Em desocupação</span>
            </div>
          ))}
        </div>
      )}
      {inadimplentes.length > 0 && (
        <div style={{ background: T.amber+"11", border: `1px solid ${T.amber}55`, borderRadius: 14, padding: 20 }}>
          <div style={{ color: T.amber, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>INADIMPLÊNCIA ({inadimplentes.length})</div>
          {inadimplentes.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.amber}22` }}>
              <div>
                <div style={{ color: T.text, fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                  {p.neighborhood}
                  {p.mesAtualAtraso && <span style={{ color: T.amber, marginLeft: 8 }}>· mês atual em aberto</span>}
                  {p.mesAnteriorAtraso && <span style={{ color: T.red, marginLeft: 8 }}>· {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][prevMesL]}/{prevAnoL} sem pagamento</span>}
                </div>
              </div>
              {onNavPagamentos && (
                <button
                  style={{ background: T.amber+"22", border: `1px solid ${T.amber}55`, color: T.amber, borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                  onClick={() => onNavPagamentos(p.id)}
                >Ver em Pagamentos →</button>
              )}
            </div>
          ))}
        </div>
      )}
      {alertasVencContrato.length > 0 && (
        <div style={{ background: T.red+"11", border: `1px solid ${T.red}40`, borderRadius: 14, padding: 20 }}>
          <div style={{ color: T.red, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>CONTRATOS VENCENDO ({alertasVencContrato.length})</div>
          {alertasVencContrato.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.red}22` }}>
              <div>
                <div style={{ color: T.text, fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                  {p.neighborhood} · Vence em <span style={{ color: p.diasVenc <= 15 ? T.red : T.amber, fontWeight: 700 }}>{p.diasVenc} dia{p.diasVenc !== 1 ? "s" : ""}</span> · {p.dataVencFmt}
                </div>
              </div>
              <span style={S.badge(p.diasVenc <= 15 ? T.red : T.amber)}>Reajuste/Renovação</span>
            </div>
          ))}
        </div>
      )}
      {contratosVencidos.length > 0 && (
        <div style={{ background: T.amber+"11", border: `1px solid ${T.amber}55`, borderRadius: 14, padding: 20 }}>
          <div style={{ color: T.amber, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>CONTRATO VENCIDO — LOCAÇÃO POR PRAZO INDETERMINADO ({contratosVencidos.length})</div>
          {contratosVencidos.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.amber}22` }}>
              <div>
                <div style={{ color: T.text, fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                  {p.neighborhood} · Venceu em <span style={{ color: T.amber, fontWeight: 700 }}>{p.dataVencFmt}</span> · vencido há <span style={{ color: T.amber, fontWeight: 700 }}>{p.tempoVencido}</span>
                </div>
              </div>
              <span style={S.badge(T.amber)}>Prazo indeterminado</span>
            </div>
          ))}
        </div>
      )}

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
function PageDetail({ prop, onBack, onEdit, onObras, onDelete, onCancelarContrato }) {
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
      opportunities.push({ icon: "", color: T.amber, title: "Aluguel Abaixo do Potencial de Mercado", desc: `Aluguel atual: ${fmt.brl(aluguelAtual)}/mês. Com rentabilidade de ${prop.type === "Comercial" ? "0,7%" : "0,5%"} sobre ${fmt.brlK(vmRef)}, o esperado seria ${fmt.brl(Math.round(aluguelEsperado))}/mês. Potencial de reajuste: ${fmt.brl(Math.round(defasagem))}/mês (${fmt.brlK(Math.round(defasagem * 12))}/ano).` });
    }
  }
  // IPTU benchmark removido
  if (prop.vacancyDays > prop.vacancyBenchmark) opportunities.push({ icon: "", color: T.red, title: "Vacância Acima da Média", desc: `${prop.vacancyDays} dias vagos vs benchmark ${prop.vacancyBenchmark} dias.` });
  if (prop.maintDelta > 40) opportunities.push({ icon: "", color: T.amber, title: "Manutenção com Custo Anômalo", desc: `R$${prop.maintMonthly}/mês — ${prop.maintDelta}% acima do benchmark.` });
  if (prop.noiPct < 0.5) opportunities.push({ icon: "", color: T.red, title: "Margem Operacional Abaixo do Padrão", desc: `NOI de ${fmt.pct(prop.noiPct)} abaixo do objetivo de 55%.` });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <button style={{ ...S.btnGhost, padding: "8px 16px", flexShrink: 0 }} onClick={onBack}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>DETALHE DO IMÓVEL</div>
          <h1 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: 0 }}>{prop.name}</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span>{prop.address}</span><span>·</span><span>{prop.neighborhood}, {prop.city}</span><span>·</span><span>{prop.size}m²</span>
            <span style={S.badge(prop.status === "Ocupado" ? T.green : prop.status === "Em desocupação" ? T.amber : T.red)}>{prop.status}</span>
            <span style={S.badge(prop.type === "Comercial" ? T.blue : T.teal)}>{prop.type}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button style={S.btnGhost} onClick={() => onEdit(prop)}>Editar</button>
          <button style={S.btnGhost} onClick={() => onObras(prop)}>Obras {obrasCount > 0 ? `(${obrasCount})` : ""}</button>
          <a href={"https://wa.me/5519997010594?text=" + encodeURIComponent("Olá! Gostaria de solicitar um estudo de mercado para o imóvel: " + prop.name + (prop.neighborhood ? " - " + prop.neighborhood : "") + (prop.city ? ", " + prop.city : "") + ".")}
            target="_blank" rel="noopener noreferrer"
            style={{ ...S.btnGhost, background: "#25D36618", borderColor: "#25D366", color: "#25D366", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Pedir Estudo de Mercado
          </a>
          {prop.status === "Ocupado" && <button style={{ ...S.btnDanger, borderColor: T.amber, color: T.amber }} onClick={() => onCancelarContrato(prop)}>Cancelar Contrato</button>}
          {prop.status === "Em desocupação" && <button style={{ ...S.btnGhost, borderColor: T.green, color: T.green }} onClick={() => onCancelarContrato(prop)}>Registrar Entrega</button>}
          <button style={S.btnDanger} onClick={() => onDelete(prop)}>Remover</button>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ color: T.muted, fontSize: 11, marginBottom: 4 }}>LEAKAGE</div><div style={{ color: prop.leakage > 60 ? T.red : prop.leakage > 30 ? T.amber : T.green, fontSize: 40, fontWeight: 900, ...S.mono, lineHeight: 1 }}>{prop.leakage}</div></div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KPI label="Receita 12m" value={fmt.brlK(prop.totalIncome)} size="md" />
        <div style={{ ...S.card, flex: 1, minWidth: 150 }}>
          <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Despesas 12m</div>
          <div style={{ color: T.red, fontSize: 22, fontWeight: 800, ...S.mono, marginBottom: 4, lineHeight: 1 }}>{fmt.brlK(prop.totalExpenses)}</div>
          {prop.ir > 0 && (
            <div style={{ color: T.red, fontSize: 11, marginTop: 8, opacity: 0.85 }}>
              IR ({prop.regimeFiscal || "PF"}): {fmt.brl(prop.ir)}
            </div>
          )}
        </div>
        <KPI label="Lucro Líquido 12m" value={fmt.brlK(prop.lucroLiquido||prop.noi)} sub={`Margem líq.: ${fmt.pct(prop.lucroLiquidoPct||prop.noiPct)}`} color={(prop.lucroLiquido||prop.noi) > 0 ? T.green : T.red} size="md" />
        <KPI label="Vacância" value={`${prop.vacancyDays}d`} sub={`Benchmark: ${prop.vacancyBenchmark}d`} color={prop.vacancyDays > prop.vacancyBenchmark ? T.amber : T.muted} size="md" warn={prop.vacancyDays > prop.vacancyBenchmark} />
      </div>
      {prop.hasCondominio && (prop.chamadaExtra > 0 || prop.fundoReserva > 0) && (
        <div style={{ ...S.card, border: `1px solid ${T.amber}30` }}>
          <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>CONDOMÍNIO</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {prop.condoFee > 0 && (
              <div style={{ background: T.s2, borderRadius: 8, padding: "10px 16px" }}>
                <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>COND. MENSAL</div>
                <div style={{ color: T.muted, fontSize: 16, fontWeight: 700, ...S.mono }}>{fmt.brl(prop.condoFee)}/mês</div>
                <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>Pago pelo inquilino</div>
              </div>
            )}
            {prop.fundoReserva > 0 && (
              <div style={{ background: T.s2, borderRadius: 8, padding: "10px 16px" }}>
                <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>FUNDO DE RESERVA</div>
                <div style={{ color: T.amber, fontSize: 16, fontWeight: 700, ...S.mono }}>{fmt.brl(prop.fundoReserva)}/mês</div>
                <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>Despesa do proprietário</div>
              </div>
            )}
            {prop.chamadaExtra > 0 && (
              <div style={{ background: T.s2, borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 200 }}>
                <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>CHAMADA EXTRA</div>
                <div style={{ color: T.amber, fontSize: 16, fontWeight: 700, ...S.mono }}>{fmt.brl(prop.chamadaExtra)}/mês</div>
                {prop.chamadaExtraParcelas > 0 && prop.chamadaExtraParcelaAtual > 0 ? (() => {
                  const restam = prop.chamadaExtraParcelas - prop.chamadaExtraParcelaAtual;
                  const pct = Math.round((prop.chamadaExtraParcelaAtual / prop.chamadaExtraParcelas) * 100);
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ color: T.muted, fontSize: 11 }}>Parcela {prop.chamadaExtraParcelaAtual}/{prop.chamadaExtraParcelas}</span>
                        <span style={{ color: restam <= 3 ? T.green : T.amber, fontSize: 11, fontWeight: 700 }}>{restam} restante{restam !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ height: 6, background: T.s3, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: restam <= 3 ? T.green : T.amber, borderRadius: 3 }} />
                      </div>
                      <div style={{ color: T.dim, fontSize: 10, marginTop: 4 }}>
                        Total restante: {fmt.brl(restam * prop.chamadaExtra)} · termina em {restam} {restam === 1 ? "mês" : "meses"}
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>Despesa do proprietário</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {obrasCount > 0 && (
        <div style={{ ...S.card, border: `1px solid ${T.amber}40` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Obras & Reformas</div><button style={{ ...S.btnGhost, padding: "6px 14px", fontSize: 12 }} onClick={() => onObras(prop)}>Gerenciar →</button></div>
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
      {opportunities.length > 0 && (
        <div style={S.cardGold}>
          <div style={{ color: T.gold, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Oportunidades Identificadas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {opportunities.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "12px 16px", background: T.s0, borderRadius: 10, border: `1px solid ${o.color}30` }}>
                <div><div style={{ color: o.color, fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{o.title}</div><div style={{ color: T.muted, fontSize: 13 }}>{o.desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {prop.contratoVencimento && (() => {
        const hoje = new Date();
        const venc = new Date(prop.contratoVencimento+"T12:00");
        const mesesRestantes = Math.max(0, Math.round((venc - hoje) / (1000 * 60 * 60 * 24 * 30.44)));
        let mesesDecorridos = 0;
        if (prop.contratoInicio) {
          const inicio = new Date(prop.contratoInicio+"T12:00");
          mesesDecorridos = Math.max(0, Math.round((hoje - inicio) / (1000 * 60 * 60 * 24 * 30.44)));
        }
        const aluguel = prop.rent - (prop.descontoAluguel || 0);
        let multa = 0;
        let multaDesc = "";
        if (!prop.clausula12Meses) {
          multa = Math.round(3 * aluguel * (mesesRestantes / 36));
          multaDesc = "3 aluguéis × meses restantes / 36";
        } else if (mesesDecorridos >= 12) {
          multa = 0;
          multaDesc = "Sem multa — cláusula de dispensa após 12 meses ativa";
        } else {
          multa = Math.round(3 * aluguel * (mesesRestantes / 36));
          multaDesc = "3 aluguéis × meses restantes / 36 (locatário < 12 meses)";
        }
        const jaVenceu = venc < hoje;
        return (
          <div style={{ ...S.card, border:`1px solid ${T.amber}40` }}>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>MULTA RESCISÓRIA</div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>
              <div>
                <div style={{ color:T.dim, fontSize:11, letterSpacing:1, marginBottom:4 }}>VENCIMENTO DO CONTRATO</div>
                <div style={{ color: jaVenceu ? T.red : T.text, fontWeight:700, fontSize:15 }}>{venc.toLocaleDateString("pt-BR")}{jaVenceu ? " (vencido)" : ""}</div>
              </div>
              {!jaVenceu && <div>
                <div style={{ color:T.dim, fontSize:11, letterSpacing:1, marginBottom:4 }}>MESES RESTANTES</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:15 }}>{mesesRestantes}</div>
              </div>}
              <div>
                <div style={{ color:T.dim, fontSize:11, letterSpacing:1, marginBottom:4 }}>MULTA ESTIMADA</div>
                <div style={{ color: multa > 0 ? T.amber : T.green, fontWeight:800, fontSize:18, ...S.mono }}>{multa > 0 ? fmt.brl(multa) : "Sem multa"}</div>
              </div>
            </div>
            <div style={{ color:T.dim, fontSize:11, marginTop:10 }}>{multaDesc}</div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── DECISION PAGES ───────────────────────────────────────────────────────────
const RETROFIT_POTENTIAL = { "Jardins":{ multiplier:1.8, demand:"Alta" }, "Itaim Bibi":{ multiplier:1.9, demand:"Muito Alta" }, "Vila Olímpia":{ multiplier:1.7, demand:"Alta" }, "Pinheiros":{ multiplier:1.6, demand:"Alta" }, "Bela Vista":{ multiplier:1.5, demand:"Média-Alta" }, "Cerqueira César":{ multiplier:1.7, demand:"Alta" }, "Jardim Paulista":{ multiplier:1.8, demand:"Alta" }, "Jardim América":{ multiplier:1.9, demand:"Muito Alta" }, "Jardim Europa":{ multiplier:2.0, demand:"Muito Alta" }, "Morumbi":{ multiplier:1.6, demand:"Alta" }, "Consolação":{ multiplier:1.4, demand:"Média" }, "Vila Nova Conceição":{ multiplier:1.8, demand:"Alta" }, "Cambuí":{ multiplier:1.3, demand:"Média" }, "Centro":{ multiplier:1.1, demand:"Baixa" }, "Nova Campinas":{ multiplier:1.4, demand:"Média" }, "Vila Guiomar":{ multiplier:1.0, demand:"Baixa" } };
const MARKET_APPRECIATION = { "São Paulo":{ Residencial:0.082, Comercial:0.045 }, "Campinas":{ Residencial:0.065, Comercial:0.038 }, "Santo André":{ Residencial:0.055, Comercial:0.030 }, "Americana":{ Residencial:0.028, Comercial:0.022 } };

function buildDecision(prop) {
  const bm=getBenchmark(prop.city,prop.type), retro=RETROFIT_POTENTIAL[prop.neighborhood]||{ multiplier:1.3, demand:"Média" }, appreciation=MARKET_APPRECIATION[prop.city]?.[prop.type]||0.06, marketCapRate=bm.cap_rate;
  const impliedValue=prop.noi/marketCapRate, improvedNOI=prop.noi*1.15, improvedValue=improvedNOI/marketCapRate, saleValue=impliedValue, saleValueOptimistic=impliedValue*1.12, reinvestReturn=saleValue*(marketCapRate+0.01);
  const retroCost=prop.size*(prop.type==="Comercial"?1800:1200), retroRentIncrease=prop.rent*(retro.multiplier-1)*0.6, retroNewNOI=(prop.rent+retroRentIncrease)*12*0.85-prop.totalExpenses*0.9, retroNewValue=retroNewNOI/(marketCapRate-0.005), retroROI=((retroNewValue-impliedValue-retroCost)/retroCost)*100, retroPayback=retroCost/(retroRentIncrease*12);
  const otherType=(BM_TYPE_MAP[prop.type]==="Comercial")?"Residencial":"Comercial", otherBm=getBenchmark(prop.city,otherType), reposRentEstimate=prop.size*(otherType==="Comercial"?85:55), reposNOI=reposRentEstimate*12*0.75, reposValue=reposNOI/otherBm.cap_rate, reposCost=prop.size*600;
  const keepScore=Math.min(95,Math.max(10,50+(prop.noiPct>0.6?25:prop.noiPct>0.5?15:prop.noiPct<0.4?-20:0)+(prop.vacancyDays<bm.vacancy_days?15:prop.vacancyDays>bm.vacancy_days*2?-20:0)+(prop.iptuDelta<10?10:0)+(prop.maintDelta<20?10:0)));
  const sellScore=Math.min(95,Math.max(10,50+(prop.noiPct<0.4?30:prop.noiPct<0.5?15:0)+(prop.vacancyDays>bm.vacancy_days*2?20:0)+(prop.leakage>70?15:0)+(prop.maintDelta>60?10:0)));
  const retroScore=Math.min(95,Math.max(10,40+(retro.demand==="Muito Alta"?30:retro.demand==="Alta"?20:retro.demand==="Média"?5:0)+(prop.type==="Comercial"?15:0)+(prop.size>100?10:0)+(retroROI>30?15:0)+(prop.noiPct<0.5?10:0)));
  const reposScore=Math.min(90,Math.max(10,30+(prop.noiPct<0.45?20:0)+(otherType==="Comercial"&&["Itaim Bibi","Jardins","Pinheiros","Vila Olímpia"].includes(prop.neighborhood)?25:0)+(reposValue>impliedValue*1.2?20:0)));
  const scores=[{ id:"keep",score:keepScore },{ id:"sell",score:sellScore },{ id:"retrofit",score:retroScore },{ id:"reposition",score:reposScore }].sort((a,b)=>b.score-a.score);
  return { keepScore,sellScore,retroScore,reposScore,recommendation:scores[0].id,impliedValue,saleValue,saleValueOptimistic,improvedNOI,improvedValue,reinvestReturn,retroCost,retroRentIncrease,retroNewNOI,retroNewValue,retroROI,retroPayback,reposRentEstimate,reposNOI,reposValue,reposCost,otherType,marketCapRate,retro,appreciation };
}

const DECISION_META = { keep:{ label:"Manter & Otimizar", icon:"", color:"#2ECC9A", short:"MANTER" }, sell:{ label:"Vender Agora", icon:"", color:"#E85565", short:"VENDER" }, retrofit:{ label:"Retrofitar", icon:"", color:"#F5A623", short:"RETROFIT" }, reposition:{ label:"Reposicionar Uso", icon:"", color:"#4A8CF5", short:"REPOSICIONAR" } };

function ScoreRing({ score, color, size=56 }) {
  const r=(size/2)-6, circ=2*Math.PI*r, filled=circ*(score/100);
  return <svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.s3} strokeWidth={5} /><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} /><text x={size/2} y={size/2+5} textAnchor="middle" fill={color} fontSize={size===56?14:11} fontWeight={800} fontFamily="'DM Mono', monospace">{score}</text></svg>;
}

function PageDecision({ PROPS }) {
  const TIPOS_COM = ["Sala Comercial", "Industrial", "Loja", "Galpão", "Salão Comercial", "Terreno"];
  const [filterRec, setFilterRec] = useState("");

  const propsComVM = PROPS.filter(p => (p.marketValueManual || 0) > 0);
  const mediaRentabilidade = propsComVM.length > 0
    ? propsComVM.reduce((s, p) => s + ((p.rent - (p.descontoAluguel||0)) / p.marketValueManual) * 100, 0) / propsComVM.length
    : null;
  const mediaVacancia = PROPS.length > 0
    ? PROPS.reduce((s, p) => s + (p.vacancyDays || 0), 0) / PROPS.length
    : 0;

  const analise = PROPS.map(p => {
    const temVM = (p.marketValueManual || 0) > 0;
    const rentBrutaMensal = temVM ? ((p.rent - (p.descontoAluguel||0)) / p.marketValueManual) * 100 : null;
    const isCom = TIPOS_COM.includes(p.type);
    const bmMin = isCom ? 0.6 : 0.4;
    const bmMax = isCom ? 0.8 : 0.5;
    const rentAbaixoBm = rentBrutaMensal !== null ? rentBrutaMensal < bmMin : null;
    const vacAcimaMed = (p.vacancyDays || 0) > mediaVacancia;
    let recomendacao;
    if (rentAbaixoBm === null) {
      recomendacao = vacAcimaMed ? "atencao" : "manter";
    } else if (!rentAbaixoBm && !vacAcimaMed) {
      recomendacao = "manter";
    } else if (rentAbaixoBm && vacAcimaMed) {
      recomendacao = "revisar";
    } else {
      recomendacao = "atencao";
    }
    return { ...p, rentBrutaMensal, bmMin, bmMax, isCom, rentAbaixoBm, vacAcimaMed, recomendacao, temVM };
  });

  const REC_META = {
    manter:  { label: "Manter",  cor: T.green, icone: "🟢" },
    atencao: { label: "Atenção", cor: T.amber, icone: "🟡" },
    revisar: { label: "Revisar", cor: T.red,   icone: "🔴" },
  };

  const filtered = filterRec ? analise.filter(p => p.recomendacao === filterRec) : analise;
  const counts = { manter: analise.filter(p=>p.recomendacao==="manter").length, atencao: analise.filter(p=>p.recomendacao==="atencao").length, revisar: analise.filter(p=>p.recomendacao==="revisar").length };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>ANÁLISE DE PORTFÓLIO</div>
        <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Decisão por Imóvel</h1>
      </div>

      {/* Nota metodológica */}
      <div style={{ padding: "14px 18px", background: T.goldGlow, border: `1px solid ${T.gold}40`, borderRadius: 12 }}>
        <div style={{ color: T.gold, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Como funciona esta análise</div>
        <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
          A comparação de portfólio é feita entre os imóveis da sua própria carteira.
          O benchmark de rentabilidade (<strong>0,4%–0,5%/mês residencial · 0,6%–0,8%/mês comercial</strong>) é uma referência geral do mercado brasileiro.
          {mediaVacancia > 0 && <span> Vacância média da carteira: <strong>{mediaVacancia.toFixed(0)} dias</strong>.</span>}
          {mediaRentabilidade !== null && <span> Rentabilidade bruta média da carteira: <strong>{mediaRentabilidade.toFixed(2)}%/mês</strong>.</span>}
        </div>
      </div>

      {/* Filtros por recomendação */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Object.entries(REC_META).map(([id, meta]) => (
          <div key={id} onClick={() => setFilterRec(filterRec === id ? "" : id)} style={{ ...S.card, flex: 1, minWidth: 130, cursor: "pointer", border: `1px solid ${filterRec === id ? meta.cor+"80" : T.border}`, background: filterRec === id ? meta.cor+"12" : T.s1 }}>
            <div style={{ color: meta.cor, fontSize: 28, fontWeight: 900, ...S.mono, lineHeight: 1 }}>{counts[id]}</div>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginTop: 4 }}>{meta.icone} {meta.label}</div>
          </div>
        ))}
        {filterRec && <button style={{ ...S.btnGhost, alignSelf: "center", padding: "8px 14px", fontSize: 12 }} onClick={() => setFilterRec("")}>✕ Limpar</button>}
      </div>

      {/* Lista de imóveis */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => {
          const meta = REC_META[p.recomendacao];
          return (
            <div key={p.id} style={{ background: T.s1, border: `1px solid ${meta.cor}30`, borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                {/* Info imóvel */}
                <div style={{ flex: 2, minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{meta.icone}</span>
                    <span style={{ color: T.goldBright, fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                    <span style={S.badge(p.type && TIPOS_COM.includes(p.type) ? T.blue : T.teal)}>{p.type}</span>
                  </div>
                  <div style={{ color: T.muted, fontSize: 12 }}>{p.neighborhood} · Aluguel: {fmt.brl(p.rent)}/mês · Vacância: {p.vacancyDays}d</div>
                </div>

                {/* Rentabilidade */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>RENT. BRUTA MENSAL</div>
                  {p.temVM ? (
                    <>
                      <div style={{ color: p.rentAbaixoBm ? T.amber : T.green, fontSize: 18, fontWeight: 800, ...S.mono }}>
                        {p.rentBrutaMensal.toFixed(2)}%
                      </div>
                      <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>
                        Benchmark: {p.bmMin}%–{p.bmMax}%/mês
                        {p.rentAbaixoBm
                          ? <span style={{ color: T.amber }}> · abaixo</span>
                          : <span style={{ color: T.green }}> · dentro/acima</span>}
                      </div>
                    </>
                  ) : (
                    <div>
                      <div style={{ color: T.dim, fontSize: 13 }}>—</div>
                      <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>Cadastre o valor de mercado para ver o benchmark</div>
                    </div>
                  )}
                </div>

                {/* Vacância vs média */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>VACÂNCIA VS MÉDIA</div>
                  <div style={{ color: p.vacAcimaMed ? T.amber : T.green, fontSize: 18, fontWeight: 800, ...S.mono }}>
                    {p.vacancyDays}d
                  </div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>
                    Média carteira: {mediaVacancia.toFixed(0)}d
                    {p.vacAcimaMed
                      ? <span style={{ color: T.amber }}> · acima</span>
                      : <span style={{ color: T.green }}> · abaixo/igual</span>}
                  </div>
                </div>

                {/* Recomendação */}
                <div style={{ alignSelf: "center" }}>
                  <span style={{ ...S.badge(meta.cor), fontSize: 12, padding: "6px 14px" }}>{meta.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageDecisionDetail({ prop, onBack }) {
  const d=buildDecision(prop), rec=DECISION_META[d.recommendation];
  const options=[
    { id:"keep", meta:DECISION_META.keep, score:d.keepScore, headline:`Lucro Op. pode chegar a ${fmt.brlK(d.improvedNOI)}/ano`, description:"Imóvel com potencial de melhoria sem desinvestimento.", numbers:[{ label:"Lucro Op. Atual",value:fmt.brl(prop.noi),color:T.muted },{ label:"Lucro Op. Otimizado",value:fmt.brl(d.improvedNOI),color:T.green },{ label:"Valor Implícito",value:fmt.brlK(d.impliedValue),color:T.muted }], actions:["Revisar IPTU","Resolver vacância com estratégia de preço","Consolidar contratos de manutenção","Negociar reajuste pelo IGPM"] },
    { id:"sell", meta:DECISION_META.sell, score:d.sellScore, headline:`Valor estimado: ${fmt.brlK(d.saleValue)}`, description:"Capital pode ser realocado em ativo de maior retorno.", numbers:[{ label:"Valor (conservador)",value:fmt.brlK(d.saleValue),color:T.red },{ label:"Valor (otimista)",value:fmt.brlK(d.saleValueOptimistic),color:T.amber },{ label:"Retorno Reinvestido",value:fmt.brl(d.reinvestReturn)+"/ano",color:T.green }], actions:["Avaliação formal por corretor","Resolver pendências documentais","Definir estratégia: off-market ou corretora","Avaliar timing fiscal"] },
    { id:"retrofit", meta:DECISION_META.retrofit, score:d.retroScore, headline:`ROI ${d.retroROI.toFixed(0)}% · payback ${d.retroPayback.toFixed(1)} anos`, description:`Alta demanda em ${prop.neighborhood}.`, numbers:[{ label:"Custo Retrofit",value:fmt.brlK(d.retroCost),color:T.amber },{ label:"Aumento Aluguel",value:fmt.brl(d.retroRentIncrease)+"/mês",color:T.green },{ label:"ROI",value:d.retroROI.toFixed(0)+"%",color:T.gold }], actions:["3 orçamentos de construtoras","Arquiteto para laudo técnico","Verificar aprovações na Prefeitura","Calcular vacância durante obra"] },
    { id:"reposition", meta:DECISION_META.reposition, score:d.reposScore, headline:`Como ${d.otherType.toLowerCase()}: ${fmt.brlK(d.reposValue)}`, description:`Mudança de uso pode aumentar NOI significativamente.`, numbers:[{ label:`Aluguel como ${d.otherType}`,value:fmt.brl(d.reposRentEstimate)+"/mês",color:T.blue },{ label:"Lucro Op. Projetado",value:fmt.brlK(d.reposNOI),color:T.blue },{ label:"Custo Adequação",value:fmt.brlK(d.reposCost),color:T.amber }], actions:["Verificar zoneamento","Consultar advogado imobiliário","Analisar demanda de mercado","Orçamento obras de adequação"] },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
        <button style={{ ...S.btnGhost, padding:"8px 16px" }} onClick={onBack}>← Voltar</button>
        <div style={{ flex:1 }}><div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:4 }}>ANÁLISE DE DECISÃO</div><h1 style={{ color:T.text, fontSize:22, fontWeight:800, margin:0 }}>{prop.name}</h1><div style={{ color:T.muted, fontSize:13, marginTop:4 }}>{prop.neighborhood} · {prop.city} · {prop.size}m²</div></div>
        <div style={{ ...S.card, background:rec.color+"18", border:`2px solid ${rec.color}60`, textAlign:"center", padding:"14px 20px" }}><div style={{ color:rec.color, fontWeight:900, fontSize:14 }}>{rec.label}</div></div>
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
              <div><div style={{ display:"flex", gap:8, alignItems:"center" }}><span style={{ color:T.text, fontWeight:800, fontSize:15 }}>{opt.meta.label}</span>{isRec&&<span style={{ ...S.badge(opt.meta.color), fontSize:10 }}>✓ RECOMENDADO</span>}</div><div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{opt.headline}</div></div>
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
<div class="header"><div><div class="logo">RENTLY</div><div style="font-size:13px;font-weight:700;margin-top:6px">${name}</div></div><div style="text-align:right;font-size:12px;color:#666"><div>Jan–Dez 2024</div><div>Gerado: ${fmt.date()}</div><div>${PROPS.length} imóveis</div></div></div>
<h2>Resumo Executivo</h2><div class="kpis"><div class="kpi"><div class="kpi-label">Receita Bruta</div><div class="kpi-value">${fmt.brlK(PORT.receita)}</div></div><div class="kpi"><div class="kpi-label">Despesas</div><div class="kpi-value red">${fmt.brlK(PORT.despesas)}</div></div><div class="kpi"><div class="kpi-label">Lucro Líquido</div><div class="kpi-value green">${fmt.brlK(PORT.noi)}</div></div><div class="kpi"><div class="kpi-label">Valor da Carteira Est.</div><div class="kpi-value amber">${fmt.brlK(totalValorMercado)}</div></div></div>
<h2>Lucro Operacional Mensal</h2><table><tr><th>Mês</th><th>Receita</th><th>Despesas</th><th>NOI</th><th>Margem</th></tr>${PORT_MONTHLY.map(m=>`<tr><td>${m.month}/2024</td><td>${fmt.brl(m.receita)}</td><td style="color:#c0392b">${fmt.brl(m.despesas)}</td><td style="color:${m.noi>=0?"#1a8a6a":"#c0392b"};font-weight:700">${fmt.brl(m.noi)}</td><td>${fmt.pct(m.noi/m.receita)}</td></tr>`).join("")}</table>
${totalObras>0?`<h2>Obras Cadastradas</h2><table><tr><th>Imóvel</th><th>Obra</th><th>Tipo</th><th>Status</th><th>Orçado</th><th>Executado</th></tr>${PROPS.flatMap(p=>(p.obras||[]).map(o=>`<tr><td>${p.name}</td><td>${o.descricao}</td><td>${o.tipo}</td><td>${o.status}</td><td>${fmt.brl(o.orcado)}</td><td>${fmt.brl(o.executado)}</td></tr>`)).join("")}</table>`:""}
<h2>Alertas</h2>${INSIGHTS.map(ins=>`<div style="margin-bottom:12px;padding:12px;background:#fff9f0;border-left:4px solid #C8A84B;border-radius:6px"><strong>${ins.title}</strong><p style="font-size:12px;color:#555;margin-top:4px">${ins.description}</p><p style="font-size:12px;color:#c0392b;font-weight:700;margin-top:2px">Impacto: ${fmt.brl(ins.impactMin)}–${fmt.brl(ins.impactMax)}/ano</p></div>`).join("")}
<div class="footer"><div>Rently Brasil · ${fmt.date()}</div><div>Confidencial</div></div></body></html>`;
    const blob=new Blob([html],{type:"text/html"}), a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`goldbridge-relatorio-${new Date().toISOString().split("T")[0]}.html`; a.click();
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div><div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:6 }}>EXPORTAÇÃO</div><h1 style={{ color:T.text, fontSize:26, fontWeight:800, margin:0 }}>Relatórios</h1></div>
      <div style={S.card}>
        <div style={{ color:T.text, fontWeight:700, marginBottom:14, fontSize:15 }}>Configurar</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12, maxWidth:480 }}>
          <div><div style={S.label}>NOME DO PROPRIETÁRIO</div><input style={S.input} value={name} onChange={e=>setName(e.target.value)} /></div>
          {totalObras>0&&<div style={{ padding:12, background:T.s2, borderRadius:8, color:T.muted, fontSize:12 }}>O relatório incluirá {totalObras} obra(s) cadastrada(s).</div>}
          <button style={{ ...S.btn, alignSelf:"flex-start", marginTop:8 }} onClick={()=>{ setDone(true); download(); }}>Baixar Relatório HTML</button>
        </div>
      </div>
      {done&&<div style={S.cardGold}><div style={{ color:T.gold, fontWeight:800, fontSize:16, marginBottom:2 }}>Relatório gerado!</div><div style={{ color:T.muted, fontSize:13 }}>Verifique sua pasta de Downloads.</div></div>}
    </div>
  );
}


// ─── PAGE IA ──────────────────────────────────────────────────────────────────
function PageIA({ PROPS }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Olá! Sou a IA do Rently. Tenho acesso completo ao seu portfólio de **${0} imóveis** e posso responder perguntas sobre NOI, cap rate, vacância, leakage e muito mais.

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
    const brl = v => "R$ " + (v||0).toLocaleString("pt-BR", {minimumFractionDigits:0,maximumFractionDigits:0});
    const pct = v => ((v||0)*100).toFixed(1) + "%";
    const total = PROPS.length;
    const ocupados = PROPS.filter(p => p.status === "Ocupado");
    const vagos = PROPS.filter(p => p.status === "Vago");
    const desocupando = PROPS.filter(p => p.status === "Em desocupação");
    const totalReceita = PROPS.reduce((s,p) => s+(p.totalIncome||0), 0);
    const totalDespesas = PROPS.reduce((s,p) => s+(p.totalExpenses||0), 0);
    const totalNOI = PROPS.reduce((s,p) => s+(p.noi||0), 0);
    const totalIR = PROPS.reduce((s,p) => s+(p.ir||0), 0);
    const totalLiquido = PROPS.reduce((s,p) => s+(p.lucroLiquido||p.noi||0), 0);
    const margemLiquida = totalLiquido / (totalReceita||1);
    const altoLeakage = [...PROPS].filter(p=>p.leakage>60).sort((a,b)=>b.leakage-a.leakage);
    const porBairro = {};
    PROPS.forEach(p => {
      if (!porBairro[p.neighborhood]) porBairro[p.neighborhood] = {count:0,noi:0,liquido:0,receita:0};
      porBairro[p.neighborhood].count++;
      porBairro[p.neighborhood].noi += p.noi||0;
      porBairro[p.neighborhood].liquido += p.lucroLiquido||p.noi||0;
      porBairro[p.neighborhood].receita += p.totalIncome||0;
    });
    const bairros = Object.entries(porBairro).map(([b,d])=>({b,...d,liqMedio:d.liquido/d.count})).sort((a,z)=>z.liqMedio-a.liqMedio);
    const NL = "\n";
    const fmt = (p) => {
      const vm = p.valorMercado > 0 ? p.valorMercado : (p.marketValueManual||0);
      const capRate = vm > 0 ? (p.lucroLiquido||p.noi||0)/vm : 0;
      const lastAval = p.avaliacoes && p.avaliacoes.length > 0 ? p.avaliacoes[p.avaliacoes.length-1] : null;
      return [
        p.name + " | " + (p.neighborhood||"") + " | " + (p.city||"") + " | " + (p.type||"") + " | " + p.status,
        "  Área: " + (p.size||0) + "m² | Aluguel: " + brl(p.rent) + "/mês | Taxa ADM: " + (p.adminPct||0) + "%",
        "  Receita anual: " + brl(p.totalIncome) + " | Despesas: " + brl(p.totalExpenses) + " | NOI: " + brl(p.noi) + " | IR: " + brl(p.ir) + " | Lucro líquido: " + brl(p.lucroLiquido||p.noi),
        "  Margem líquida: " + pct((p.lucroLiquido||p.noi||0)/(p.totalIncome||1)) + " | Leakage: " + p.leakage + "/100" + (capRate>0 ? " | Cap rate: " + pct(capRate) : ""),
        "  IPTU: " + brl(p.iptu) + "/ano | Manutenção: " + brl(p.maintMonthly) + "/mês | Seguro: " + brl(p.insurance) + "/ano",
        p.hasCondominio ? "  Condomínio: " + brl(p.condoFee) + "/mês (pago pelo: " + (p.condoPagoPor||"?") + ")" : "",
        "  Regime fiscal: " + (p.regimeFiscal||"PF") + " | Índice reajuste: " + (p.indiceReajuste||"IGPM"),
        p.locatarioNome ? "  Locatário: " + p.locatarioNome + (p.contratoInicio ? " | Contrato desde: " + p.contratoInicio : "") + (p.contratoAnos ? " (" + p.contratoAnos + " meses)" : "") : (p.viaImobiliaria ? "  Gerenciado por imobiliária" : ""),
        vm > 0 ? "  Valor de mercado: " + brl(vm) + (lastAval ? " (avaliado em "+lastAval.data+" via "+lastAval.fonte+")" : "") : "",
        p.valorCompra > 0 ? "  Valor de compra: " + brl(p.valorCompra) + (p.anoCompra ? " ("+p.anoCompra+")" : "") + (vm>0 ? " | Ganho capital: " + brl(vm-p.valorCompra) : "") : "",
        p.obras && p.obras.length > 0 ? "  Obras: " + p.obras.map(o=>o.label||o.tipo+" ("+o.status+", R$"+(o.executado||o.orcado||0)+")").join("; ") : "",
      ].filter(Boolean).join(NL);
    };
    return [
      "Você é a IA do Rently, sistema brasileiro de gestão de portfólio imobiliário.",
      "Responda sempre em português brasileiro. Seja direto, analítico e use os dados concretos abaixo.",
      "Quando identificar problemas, aponte a causa e sugira ação específica.",
      NL+"=== PORTFÓLIO — RESUMO ===",
      "Imóveis: "+total+" ("+ocupados.length+" ocupados, "+vagos.length+" vagos, "+desocupando.length+" em desocupação)",
      "Receita anual bruta: "+brl(totalReceita),
      "Despesas anuais: "+brl(totalDespesas),
      "NOI anual: "+brl(totalNOI)+" | IR estimado: "+brl(totalIR)+" | Lucro líquido: "+brl(totalLiquido),
      "Margem líquida média: "+pct(margemLiquida),
      NL+"=== RANKING POR BAIRRO ===",
      ...bairros.slice(0,8).map(b=>b.b+": "+b.count+" imóvel(is), lucro líquido médio "+brl(b.liqMedio)+"/ano"),
      NL+"=== IMÓVEIS COM ALTO LEAKAGE (>60) ===",
      altoLeakage.length > 0 ? altoLeakage.slice(0,5).map(p=>p.name+" — Leakage "+p.leakage+"/100").join(NL) : "Nenhum",
      NL+"=== TODOS OS IMÓVEIS ===",
      ...PROPS.map(fmt),
    ].join(NL);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim(), ts: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const history = newMessages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: buildContext(),
          messages: history,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content?.[0]?.text || "Erro ao processar resposta.";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: text,
        ts: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão: " + e.message, ts: "" }]);
    }
    setLoading(false);
  };

  const SUGESTOES = [
    "Me dê um resumo executivo do portfólio",
    "Qual imóvel tem o maior lucro líquido?",
    "Onde estou perdendo mais dinheiro?",
    "Qual bairro tem melhor cap rate?",
    "Quais imóveis devo priorizar para reforma?",
    "Como está minha carga de IR? Tem como reduzir?",
    "Quais imóveis têm margem líquida abaixo de 40%?",
    "Me explica o leakage dos imóveis mais críticos",
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
              <span style={{ color: T.dim, fontSize: 11 }}>{m.role === "assistant" ? "Rently IA" : "Você"} · {m.ts}</span>
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
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message);
    else onLogin(data.user);
    setLoading(false);
  };
  const handleRegister = async () => {
    if (!name) { setError("Digite seu nome."); return; }
    if (password.length < 6) { setError("Senha deve ter no mínimo 6 caracteres."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) setError(error.message);
    else if (data.user && !data.user.confirmed_at) setSuccess("Verifique seu email para confirmar a conta.");
    else onLogin(data.user);
    setLoading(false);
  };
  const handleForgot = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setError(error.message);
    else setSuccess("Email de recuperação enviado!");
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", padding:24 }}>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 30% 50%, ${T.goldGlow} 0%, transparent 60%)` }} />
      <div style={{ width:"100%", maxWidth:420, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ color:T.gold, fontSize:32, fontWeight:900, letterSpacing:-1 }}>RENTLY</div>
          <div style={{ color:T.dim, fontSize:11, letterSpacing:4, marginTop:4 }}>BRASIL · PORTFOLIO INTELLIGENCE</div>
        </div>
        <div style={{ background:T.s1, border:`1px solid ${T.borderMid}`, borderRadius:18, padding:"32px 28px" }}>
          <div style={{ color:T.text, fontSize:20, fontWeight:800, marginBottom:4 }}>
            {mode==="login"?"Entrar":mode==="register"?"Criar conta":"Recuperar senha"}
          </div>
          <div style={{ color:T.muted, fontSize:13, marginBottom:24 }}>
            {mode==="login"?"Acesse seu portfólio":mode==="register"?"Comece a gerenciar seus imóveis":"Enviaremos um link para seu email"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {mode==="register" && <input style={S.input} placeholder="Seu nome" value={name} onChange={e=>setName(e.target.value)} />}
            <input style={S.input} placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
            {mode!=="forgot" && <input style={S.input} placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())} />}
            {error && <div style={{ color:T.red, fontSize:13, padding:"10px 14px", background:T.redDim+"33", borderRadius:8 }}>{error}</div>}
            {success && <div style={{ color:T.green, fontSize:13, padding:"10px 14px", background:T.green+"22", borderRadius:8 }}>{success}</div>}
            <button style={{ ...S.btn, width:"100%", padding:14, fontSize:15, opacity:loading?0.7:1 }} onClick={mode==="login"?handleLogin:mode==="register"?handleRegister:handleForgot} disabled={loading}>
              {loading?"Aguarde...":mode==="login"?"Entrar":mode==="register"?"Criar conta":"Enviar email"}
            </button>
          </div>
          <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:10, alignItems:"center" }}>
            {mode==="login" && <>
              <button style={{ background:"none", border:"none", color:T.muted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>{setMode("forgot");setError("");setSuccess("");}}>Esqueci minha senha</button>
              <div style={{ color:T.dim, fontSize:13 }}>Não tem conta?{" "}
                <button style={{ background:"none", border:"none", color:T.gold, fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }} onClick={()=>{setMode("register");setError("");setSuccess("");}}>Criar conta gratuita</button>
              </div>
            </>}
            {mode!=="login" && <button style={{ background:"none", border:"none", color:T.muted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>{setMode("login");setError("");setSuccess("");}}>← Voltar para login</button>}
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:20, color:T.dim, fontSize:11 }}>Seus dados são privados e criptografados.</div>
      </div>
    </div>
  );
}

// ─── PAGE PAGAMENTOS ──────────────────────────────────────────────────────────
function PagePagamentos({ PROPS, onUpdateProps, highlightPropId }) {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const [mesSel, setMesSel] = useState(mesAtual);
  const [anoSel, setAnoSel] = useState(anoAtual);
  const [detalheProp, setDetalheProp] = useState(null);
  const [busca, setBusca] = useState("");
  const [pagDataModal, setPagDataModal] = useState(null); // { prop }
  const [pagDataInput, setPagDataInput] = useState(new Date().toISOString().slice(0,10));
  const [highlighted, setHighlighted] = useState(highlightPropId || null);

  // Scroll + highlight when highlightPropId is passed (coming from Alertas)
  React.useEffect(() => {
    if (!highlightPropId) return;
    setHighlighted(highlightPropId);
    const el = document.getElementById(`prop-card-${highlightPropId}`);
    if (el) { setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100); }
    const timer = setTimeout(() => setHighlighted(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightPropId]);

  // Helper: dia de vencimento a partir de contratoInicio
  const getDiaVenc = (p) => p.contratoInicio ? new Date(p.contratoInicio + "T12:00").getDate() : (p.diaVencimento || 10);

  // Helper: is a given month/year "atrasado" for a prop (no payment and contract was active)
  const isAtrasadoMes = (p, ano, mes) => {
    const pagKey = `${ano}_${mes}`;
    const pag = p.pagamentos?.[pagKey];
    if (pag?.status === "pago") return false;
    if (pag?.status) return false; // atrasado/nao_pago already manually set
    const diaVenc = getDiaVenc(p);
    const dataVenc = new Date(ano, mes, diaVenc);
    const contratoAtivo = p.contratoInicio ? new Date(p.contratoInicio + "T12:00") <= dataVenc : true;
    if (!contratoAtivo) return false;
    return dataVenc < hoje;
  };

  // Helpers para ler/salvar pagamentos no prop
  const getKey = (propId, ano, mes) => `pag_${propId}_${ano}_${mes}`;
  const getPag = (prop, ano, mes) => (prop.pagamentos || {})[`${ano}_${mes}`] || null;
  const setPag = (prop, ano, mes, dados) => {
    const pagamentos = { ...(prop.pagamentos || {}), [`${ano}_${mes}`]: dados };
    return { ...prop, pagamentos };
  };

  const confirmarPago = (prop, dataStr) => {
    const bruto = prop.rent - (prop.descontoAluguel||0);
    const condoFeeM = prop.hasCondominio ? (prop.condoFee||0) : 0;
    let valor;
    if (prop.viaImobiliaria) {
      const adm = prop.adminRecalc || Math.round(bruto * ((prop.adminPct||8)/100));
      const iptuM = Math.round((prop.iptu||0) / (prop.iptuParcelas||10));
      const condoM = (prop.fundoReserva||0) + (prop.chamadaExtra||0);
      valor = bruto - adm - condoM + iptuM + condoFeeM;
    } else {
      valor = bruto + condoFeeM;
    }
    const dataBR = dataStr ? new Date(dataStr+"T12:00").toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
    const updated = setPag(prop, anoSel, mesSel, {
      status: "pago",
      valor,
      data: dataBR,
      dataPagamento: dataBR,
      vencimento: prop.diaVencimento || 10,
    });
    onUpdateProps(PROPS.map(p => p.id === prop.id ? updated : p));
    setPagDataModal(null);
  };

  const handleMarcar = (prop, status) => {
    if (status === "pago") {
      setPagDataInput(new Date().toISOString().slice(0,10));
      setPagDataModal({ prop });
      return;
    }
    const bruto = prop.rent - (prop.descontoAluguel||0);
    const condoFeeM = prop.hasCondominio ? (prop.condoFee||0) : 0;
    let valor;
    if (prop.viaImobiliaria) {
      const adm = prop.adminRecalc || Math.round(bruto * ((prop.adminPct||8)/100));
      const iptuM = Math.round((prop.iptu||0) / (prop.iptuParcelas||10));
      const condoM = (prop.fundoReserva||0) + (prop.chamadaExtra||0);
      valor = bruto - adm - condoM + iptuM + condoFeeM;
    } else {
      valor = bruto + condoFeeM;
    }
    const updated = setPag(prop, anoSel, mesSel, {
      status,
      valor,
      data: null,
      vencimento: prop.diaVencimento || 10,
    });
    onUpdateProps(PROPS.map(p => p.id === prop.id ? updated : p));
  };

  const imovelOcupado = PROPS.filter(p => p.status === "Ocupado");

  // Alertas de vencimento de contrato (próximos 90 dias)
  const alertasContrato = PROPS.filter(p => {
    if (!p.contratoInicio || !p.contratoAnos) return false;
    const inicio = new Date(p.contratoInicio);
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + Number(p.contratoAnos));
    const diasRestantes = Math.round((fim - hoje) / (1000 * 60 * 60 * 24));
    return diasRestantes >= 0 && diasRestantes <= 90;
  }).map(p => {
    const inicio = new Date(p.contratoInicio);
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + Number(p.contratoAnos));
    const diasRestantes = Math.round((fim - hoje) / (1000 * 60 * 60 * 24));
    return { ...p, fimContrato: fim.toLocaleDateString("pt-BR"), diasRestantes };
  }).sort((a, b) => a.diasRestantes - b.diasRestantes);

  // Alertas de chamada extra quase terminando (últimas 3 parcelas)
  const alertasChamadaExtra = PROPS.filter(p =>
    p.hasCondominio && p.chamadaExtra > 0 && p.chamadaExtraParcelas > 0 && p.chamadaExtraParcelaAtual > 0 &&
    (p.chamadaExtraParcelas - p.chamadaExtraParcelaAtual) <= 3
  );

  // Alertas de reajuste (próximos 60 dias)
  const alertasReajuste = PROPS.filter(p => {
    if (!p.contratoInicio) return false;
    const d = new Date(p.contratoInicio);
    let y = anoAtual;
    let aniv = new Date(y, d.getMonth(), d.getDate());
    if (aniv < hoje) { aniv = new Date(y + 1, d.getMonth(), d.getDate()); }
    const dias = Math.round((aniv - hoje) / (1000 * 60 * 60 * 24));
    return dias >= 0 && dias <= 60;
  }).map(p => {
    const d = new Date(p.contratoInicio);
    let y = anoAtual;
    let aniv = new Date(y, d.getMonth(), d.getDate());
    if (aniv < hoje) aniv = new Date(y + 1, d.getMonth(), d.getDate());
    const dias = Math.round((aniv - hoje) / (1000 * 60 * 60 * 24));
    // IGPM estimado (hardcoded por ora, 6.2% acumulado 12m)
    const igpm = 0.062;
    const ipca = 0.048; // IPCA estimado 4.8%
    const indice = p.indiceReajuste || "IGPM";
    const taxa = indice === "IPCA" ? ipca : indice === "Fixo" ? 0.05 : igpm;
    const aluguelAtual = p.rent - (p.descontoAluguel || 0);
    const aluguelReajustado = Math.round(aluguelAtual * (1 + taxa));
    return { ...p, diasReajuste: dias, dataReajuste: aniv.toLocaleDateString("pt-BR"), igpm: taxa, indice, aluguelAtual, aluguelReajustado };
  }).sort((a, b) => a.diasReajuste - b.diasReajuste);

  // Resumo do mês selecionado
  const pagMes = imovelOcupado.map(p => ({ ...p, pag: getPag(p, anoSel, mesSel) }));
  const pagos = pagMes.filter(p => p.pag?.status === "pago").length;
  const atrasados = pagMes.filter(p => {
    if (p.pag?.status === "atrasado") return true;
    if (!p.pag?.status && isAtrasadoMes(p, anoSel, mesSel)) return true;
    return false;
  }).length;
  const naoPagos = pagMes.filter(p => p.pag?.status === "nao_pago").length;
  const pendentes = pagMes.filter(p => !p.pag?.status && !isAtrasadoMes(p, anoSel, mesSel)).length;
  const calcAluguel = (p) => {
    const bruto = p.rent - (p.descontoAluguel||0);
    const condoFeeM = p.hasCondominio ? (p.condoFee||0) : 0;
    if (p.viaImobiliaria) {
      const adm = p.adminRecalc || Math.round(bruto * ((p.adminPct||8)/100));
      const iptuM = Math.round((p.iptu||0) / (p.iptuParcelas||10));
      const condoM = (p.fundoReserva||0) + (p.chamadaExtra||0);
      // IPTU e condo entram como receita (inquilino paga e imob. repassa); fundo/chamada são descontados pela imob.
      return bruto - adm - condoM + iptuM + condoFeeM;
    }
    return bruto + condoFeeM;
  };
  const totalRecebido = pagMes.filter(p => p.pag?.status === "pago").reduce((s, p) => s + calcAluguel(p), 0);
  const totalEsperado = imovelOcupado.reduce((s, p) => s + calcAluguel(p), 0);

  // Histórico de um imóvel
  const getHistorico = (prop) => {
    const hist = [];
    for (let a = anoAtual; a >= anoAtual - 1; a--) {
      for (let m = 11; m >= 0; m--) {
        if (a === anoAtual && m > mesAtual) continue;
        const pag = getPag(prop, a, m);
        hist.push({ ano: a, mes: m, label: `${MESES[m]}/${a}`, pag });
      }
    }
    return hist.slice(0, 12);
  };

  const STATUS_COR = { pago: T.green, atrasado: T.amber, nao_pago: T.red };
  const STATUS_LABEL = { pago: "Pago", atrasado: "Atrasado", nao_pago: "Não pago" };

  if (detalheProp) {
    const hist = getHistorico(detalheProp);
    const pagosCnt = hist.filter(h => h.pag?.status === "pago").length;
    const atrasadosCnt = hist.filter(h => h.pag?.status === "atrasado").length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button style={{ ...S.btnGhost, padding: "8px 16px" }} onClick={() => setDetalheProp(null)}>← Pagamentos</button>
          <div>
            <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>HISTÓRICO DE PAGAMENTOS</div>
            <h1 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: "4px 0 0" }}>{detalheProp.name}</h1>
            <div style={{ color: T.muted, fontSize: 13 }}>{detalheProp.neighborhood} · Aluguel: {fmt.brl(detalheProp.rent - (detalheProp.descontoAluguel || 0))}/mês</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={S.card}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>PAGOS EM DIA</div><div style={{ color: T.green, fontSize: 26, fontWeight: 900 }}>{pagosCnt}<span style={{ fontSize: 14, color: T.dim }}>/12</span></div></div>
          <div style={S.card}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>ATRASOS</div><div style={{ color: atrasadosCnt > 0 ? T.amber : T.green, fontSize: 26, fontWeight: 900 }}>{atrasadosCnt}</div></div>
          <div style={S.card}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>RECEBIDO 12M</div><div style={{ color: T.gold, fontSize: 22, fontWeight: 900, ...S.mono }}>{fmt.brlK(pagosCnt * (detalheProp.rent - (detalheProp.descontoAluguel || 0)))}</div></div>
          <div style={S.card}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>CONFIABILIDADE</div><div style={{ color: pagosCnt >= 10 ? T.green : pagosCnt >= 7 ? T.amber : T.red, fontSize: 26, fontWeight: 900 }}>{hist.filter(h=>h.pag).length > 0 ? Math.round((pagosCnt / hist.filter(h=>h.pag).length) * 100) : "—"}{hist.filter(h=>h.pag).length > 0 ? "%" : ""}</div></div>
        </div>
        <div style={{ ...S.card, border: `1px solid ${T.borderMid}` }}>
          <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 16 }}>ÚLTIMOS 12 MESES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hist.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.s2, borderRadius: 8 }}>
                <div style={{ width: 70, color: T.muted, fontSize: 13, fontWeight: 600 }}>{h.label}</div>
                {h.pag ? (
                  <>
                    <span style={{ ...S.badge(STATUS_COR[h.pag.status]), fontSize: 11 }}>{STATUS_LABEL[h.pag.status]}</span>
                    {h.pag.valor && <div style={{ color: T.text, fontSize: 13, ...S.mono }}>{fmt.brl(h.pag.valor)}</div>}
                    {h.pag.data && <div style={{ color: T.dim, fontSize: 11 }}>em {h.pag.data}</div>}
                  </>
                ) : (
                  <span style={{ color: T.dim, fontSize: 12 }}>{h.ano < anoAtual || (h.ano === anoAtual && h.mes < mesAtual) ? "Não registrado" : "Pendente"}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div><div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>GESTÃO FINANCEIRA</div><h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Pagamentos</h1></div>

      {/* Alertas de contrato, reajuste e chamada extra */}
      {(alertasContrato.length > 0 || alertasReajuste.length > 0 || alertasChamadaExtra.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alertasChamadaExtra.map(p => {
            const restam = p.chamadaExtraParcelas - p.chamadaExtraParcelaAtual;
            return (
              <div key={`chamada-${p.id}`} style={{ padding: "14px 18px", background: restam === 0 ? T.green+"22" : T.amber+"22", border: `1px solid ${restam === 0 ? T.green : T.amber}44`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 22 }}>{restam === 0 ? "✓" : "!"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
                    {p.name} — Chamada extra {restam === 0 ? "termina este mês!" : `termina em ${restam} mês${restam > 1 ? "es" : ""}`}
                  </div>
                  <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                    Parcela {p.chamadaExtraParcelaAtual}/{p.chamadaExtraParcelas} · {fmt.brl(p.chamadaExtra)}/mês · economia futura: {fmt.brl(p.chamadaExtra)}/mês
                  </div>
                </div>
              </div>
            );
          })}
          {alertasContrato.map(p => (
            <div key={p.id} style={{ padding: "14px 18px", background: T.redDim + "44", border: `1px solid ${T.red}44`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{p.name} — Contrato vence em <span style={{ color: T.red }}>{p.diasRestantes} dias</span></div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>Vencimento: {p.fimContrato} · {p.neighborhood}</div>
              </div>
            </div>
          ))}
          {alertasReajuste.map(p => (
            <div key={p.id} style={{ padding: "14px 18px", background: T.amberDim + "44", border: `1px solid ${T.amber}44`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{p.name} — Reajuste em <span style={{ color: T.amber }}>{p.diasReajuste} dias</span></div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                  {p.indice||"IGPM"} estimado: {(p.igpm * 100).toFixed(1)}% · {fmt.brl(p.aluguelAtual)} → <span style={{ color: T.green, fontWeight: 700 }}>{fmt.brl(p.aluguelReajustado)}/mês</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Seletor de mês */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button style={{ ...S.btnGhost, padding: "8px 14px" }} onClick={() => { if (mesSel === 0) { setMesSel(11); setAnoSel(a => a - 1); } else setMesSel(m => m - 1); }}>←</button>
        <div style={{ color: T.text, fontWeight: 800, fontSize: 18, minWidth: 160, textAlign: "center" }}>{MESES_FULL[mesSel]} {anoSel}</div>
        <button style={{ ...S.btnGhost, padding: "8px 14px" }} onClick={() => { if (mesSel === 11) { setMesSel(0); setAnoSel(a => a + 1); } else setMesSel(m => m + 1); }} disabled={anoSel === anoAtual && mesSel === mesAtual}>→</button>
        <button style={{ ...S.btnGhost, padding: "8px 14px", marginLeft: 8, fontSize: 12 }} onClick={() => { setMesSel(mesAtual); setAnoSel(anoAtual); }}>Hoje</button>
      </div>

      {/* KPIs do mês */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={S.card}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>RECEBIDO</div><div style={{ color: T.green, fontSize: 22, fontWeight: 900, ...S.mono }}>{fmt.brl(totalRecebido)}</div><div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>{pagos} imóvel(is)</div></div>
        <div style={S.card}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>ESPERADO</div><div style={{ color: T.gold, fontSize: 22, fontWeight: 900, ...S.mono }}>{fmt.brl(totalEsperado)}</div><div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>{imovelOcupado.length} imóvel(is)</div></div>
        <div
          style={{ ...S.card, border: `1px solid ${atrasados > 0 ? T.amber + "60" : T.border}`, cursor: atrasados > 0 ? "pointer" : "default" }}
          onClick={atrasados > 0 ? () => {
            const first = pagMes.find(p => p.pag?.status === "atrasado" || (!p.pag?.status && isAtrasadoMes(p, anoSel, mesSel)));
            if (first) document.getElementById(`prop-card-${first.id}`)?.scrollIntoView({ behavior:"smooth", block:"center" });
          } : undefined}
        ><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>ATRASADOS</div><div style={{ color: atrasados > 0 ? T.amber : T.green, fontSize: 22, fontWeight: 900 }}>{atrasados}</div>{atrasados > 0 && <div style={{ color:T.dim, fontSize:10, marginTop:2 }}>clique para ver</div>}</div>
        <div style={{ ...S.card, border: `1px solid ${naoPagos > 0 ? T.red + "60" : T.border}` }}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>NÃO PAGOS</div><div style={{ color: naoPagos > 0 ? T.red : T.green, fontSize: 22, fontWeight: 900 }}>{naoPagos}</div></div>
        <div style={S.card}><div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>PENDENTES</div><div style={{ color: pendentes > 0 ? T.muted : T.green, fontSize: 22, fontWeight: 900 }}>{pendentes}</div></div>
      </div>

      {/* Lista de imóveis com controle de pagamento */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>IMÓVEIS OCUPADOS — {MESES_FULL[mesSel].toUpperCase()} {anoSel}</div>
          <input
            style={{ ...S.input, flex:1, fontSize:13, padding:"8px 14px" }}
            placeholder="Buscar por nome, endereço, bairro ou locatário..."
            value={busca}
            onChange={e=>setBusca(e.target.value)}
          />
        </div>
        {imovelOcupado.length === 0 && <div style={{ ...S.card, textAlign: "center", color: T.muted, padding: 40 }}>Nenhum imóvel ocupado cadastrado.</div>}
        {pagMes.filter(p => {
          if (!busca.trim()) return true;
          const q = busca.toLowerCase();
          return (p.name||"").toLowerCase().includes(q) || (p.address||"").toLowerCase().includes(q) || (p.neighborhood||"").toLowerCase().includes(q) || (p.locatarioNome||"").toLowerCase().includes(q);
        }).map(p => {
          const pagStatus = p.pag?.status;
          const isAutoAtrasado = !pagStatus && isAtrasadoMes(p, anoSel, mesSel);
          // Also check if previous month is missing (and we're in current month view)
          const prevMes = mesSel === 0 ? 11 : mesSel - 1;
          const prevAno = mesSel === 0 ? anoSel - 1 : anoSel;
          const mesAnteriorAtrasado = mesSel === mesAtual && anoSel === anoAtual && isAtrasadoMes(p, prevAno, prevMes);
          const status = pagStatus || (isAutoAtrasado ? "atrasado" : null);
          const aluguelBruto = p.rent - (p.descontoAluguel || 0); // rent - desconto
          const adminMensal = p.adminRecalc || Math.round(aluguelBruto * ((p.adminPct||8)/100));
          const iptuMensal = Math.round((p.iptu||0) / (p.iptuParcelas||10));
          const maintM = p.maintMonthly || 0;
          const seguroM = Math.round((p.insurance||0)/12);
          const condoM = (p.fundoReserva||0) + (p.chamadaExtra||0);
          const condoFeeM = p.hasCondominio ? (p.condoFee||0) : 0;
          // Com imobiliária: bolso = bruto - adm - fundo/chamada + iptu + condo (inquilino paga, imob. repassa)
          // Sem imobiliária: aluguel - desconto + condo (inquilino reembolsa)
          const bolsoBruto = p.viaImobiliaria
            ? aluguelBruto - adminMensal - condoM + iptuMensal + condoFeeM
            : aluguelBruto + condoFeeM;
          const borderC = status === "pago" ? T.green + "40" : status === "atrasado" ? T.amber + "40" : status === "nao_pago" ? T.red + "40" : T.border;
          const isHighlighted = highlighted === p.id;
          return (
            <div key={p.id} id={`prop-card-${p.id}`} style={{ background: T.s1, border: `2px solid ${isHighlighted ? T.amber : borderC}`, borderRadius: 14, padding: "16px 20px", transition: "border-color 0.3s", boxShadow: isHighlighted ? `0 0 0 3px ${T.amber}33` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <div style={{ color: T.goldBright, fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                    {p.viaImobiliaria && p.imobiliariaName && (
                      <button
                        title="Clique para copiar o nome da imobiliária"
                        style={{ background:T.s2, border:`1px solid ${T.border}`, color:T.muted, borderRadius:6, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                        onClick={() => { navigator.clipboard.writeText(p.imobiliariaName); }}
                      >{p.imobiliariaName}</button>
                    )}
                  </div>
                  <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                    {p.neighborhood} ·{" "}
                    <span style={{ color: p.viaImobiliaria ? T.green : T.text, fontWeight: 700, ...S.mono }}>{fmt.brl(bolsoBruto)}/mês</span>
                    {p.viaImobiliaria
                      ? <span style={{ color: T.dim, fontSize: 10, marginLeft: 6 }}>no bolso · bruto {fmt.brl(aluguelBruto)}</span>
                      : (p.descontoAluguel||0) > 0 && <span style={{ color: T.dim, fontSize: 10, marginLeft: 6 }}>bruto {fmt.brl(p.rent)} − desc. {fmt.brl(p.descontoAluguel)}</span>
                    }
                  </div>
                  {p.locatarioNome && <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Locatário: {p.locatarioNome}</div>}
                  {p.proximoReajuste && <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Próximo reajuste: {p.proximoReajuste}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {status && (
                    <span style={{ ...S.badge(STATUS_COR[status]), cursor: status === "atrasado" ? "pointer" : "default" }}
                      onClick={status === "atrasado" ? () => document.getElementById(`prop-card-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }) : undefined}
                    >{STATUS_LABEL[status]}{p.pag?.data ? ` · ${p.pag.data}` : ""}{isAutoAtrasado ? " (auto)" : ""}</span>
                  )}
                  <button style={{ ...S.btn, padding: "7px 14px", fontSize: 12, background: status === "pago" ? T.greenDim : T.goldGlow, border: `1px solid ${status === "pago" ? T.green : T.gold}`, color: status === "pago" ? T.green : T.gold }} onClick={() => handleMarcar(p, "pago")}>Pago</button>
                  <button style={{ background: "transparent", border: `1px solid ${T.amberDim}`, color: T.amber, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }} onClick={() => handleMarcar(p, "atrasado")}>⏰ Atrasado</button>
                  <button style={{ background: "transparent", border: `1px solid ${T.redDim}`, color: T.red, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }} onClick={() => handleMarcar(p, "nao_pago")}>✕ Não pago</button>
                  <button style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setDetalheProp(p)}>Histórico →</button>
                </div>
              </div>
              {/* Aviso: mês anterior em aberto */}
              {mesAnteriorAtrasado && (
                <div style={{ marginTop: 8, padding: "6px 12px", background: T.amber+"18", borderRadius: 8, border: `1px solid ${T.amber}44`, fontSize: 11, color: T.amber, fontWeight: 600 }}>
                  ⚠ {MESES[prevMes]}/{prevAno} sem pagamento registrado
                </div>
              )}
              {/* Com imobiliária: breakdown de todas as despesas */}
              {p.viaImobiliaria && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginRight: 4 }}>DEDUÇÕES:</div>
                  <div style={{ background: T.s2, borderRadius: 6, padding: "3px 9px" }}><span style={{ color: T.dim, fontSize: 10 }}>Adm. </span><span style={{ color: T.amber, fontSize: 12, fontWeight: 700 }}>{fmt.brl(adminMensal)}</span></div>
                  {condoM > 0 && <div style={{ background: T.s2, borderRadius: 6, padding: "3px 9px" }}><span style={{ color: T.dim, fontSize: 10 }}>Fundo/Cond. </span><span style={{ color: T.amber, fontSize: 12, fontWeight: 700 }}>{fmt.brl(condoM)}</span></div>}
                  <div style={{ marginLeft: "auto", background: bolsoBruto >= 0 ? T.green+"22" : T.red+"22", borderRadius: 6, padding: "4px 12px", border: `1px solid ${bolsoBruto >= 0 ? T.green : T.red}40` }}>
                    <span style={{ color: T.dim, fontSize: 10 }}>No bolso </span>
                    <span style={{ color: bolsoBruto >= 0 ? T.green : T.red, fontSize: 13, fontWeight: 800, ...S.mono }}>{fmt.brl(bolsoBruto)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de data de pagamento */}
      {pagDataModal && (
        <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:T.s1, border:`1px solid ${T.borderMid}`, borderRadius:16, width:"100%", maxWidth:360, padding:28 }}>
            <div style={{ color:T.text, fontWeight:800, fontSize:16, marginBottom:6 }}>Data do Pagamento</div>
            <div style={{ color:T.muted, fontSize:13, marginBottom:18 }}>{pagDataModal.prop.name}</div>
            <input type="date" style={{ ...S.input, width:"100%", marginBottom:20 }} value={pagDataInput} onChange={e=>setPagDataInput(e.target.value)} />
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={S.btnGhost} onClick={() => setPagDataModal(null)}>Cancelar</button>
              <button style={S.btn} onClick={() => confirmarPago(pagDataModal.prop, pagDataInput)}>Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAGE IPTU & CONDOMÍNIO ───────────────────────────────────────────────────
function PageIPTU({ PROPS, onUpdateProps }) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const imoveis = PROPS.filter(p => (p.iptu||0) > 0 || (p.hasCondominio && (p.condoFee||0) > 0));

  const toggleIPTUParcela = (prop, idx) => {
    const pagas = prop.iptuParcelasPagas || [];
    const novas = pagas.includes(idx) ? pagas.filter(i => i !== idx) : [...pagas, idx];
    onUpdateProps(PROPS.map(p => p.id === prop.id ? { ...p, iptuParcelasPagas: novas } : p));
  };

  const toggleCondoMes = (prop, idx) => {
    const pagos = prop.condoMesesPagos || [];
    const novos = pagos.includes(idx) ? pagos.filter(i => i !== idx) : [...pagos, idx];
    onUpdateProps(PROPS.map(p => p.id === prop.id ? { ...p, condoMesesPagos: novos } : p));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>GESTÃO FINANCEIRA</div>
        <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>IPTU & Condomínio</h1>
      </div>

      {imoveis.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "60px 20px", color: T.muted }}>
          Nenhum imóvel com IPTU ou condomínio cadastrado.
        </div>
      )}

      {imoveis.map(p => {
        const parcelas = p.iptuParcelas || 10;
        const iptuAnual = p.iptu || 0;
        const iptuParcela = Math.round(iptuAnual / parcelas);
        const iptuPagas = p.iptuParcelasPagas || [];
        const iptuPagasCount = iptuPagas.length;
        const iptuPagoTotal = iptuPagasCount * iptuParcela;

        let iptuAlerta = null;
        if (p.iptuVencimento) {
          const anoIPTU = parseInt(p.iptuVencimento);
          if (anoIPTU < anoAtual) iptuAlerta = "vencido";
          else if (anoIPTU === anoAtual && mesAtual >= 10) iptuAlerta = "vencendo";
        }

        const condoFeeM = p.condoFee || 0;
        const condoFeeAnual = condoFeeM * 12;
        const condoPagos = p.condoMesesPagos || [];
        const condoPagosCount = condoPagos.length;
        const condoPagoTotal = condoPagosCount * condoFeeM;

        const temIPTU = iptuAnual > 0;
        const temCondo = p.hasCondominio && condoFeeM > 0;

        return (
          <div key={p.id} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ color: T.goldBright, fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{p.name}</div>
            <div style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>{p.neighborhood}{p.city ? ` · ${p.city}` : ""}</div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {/* Card IPTU */}
              {temIPTU && (
                <div style={{ flex: 1, minWidth: 280, background: T.s2, borderRadius: 12, padding: 18, border: `1px solid ${iptuAlerta === "vencido" ? T.red+"55" : iptuAlerta === "vencendo" ? T.amber+"55" : T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>IPTU</div>
                      <div style={{ color: T.text, fontSize: 20, fontWeight: 900, ...S.mono }}>{fmt.brl(iptuAnual)}<span style={{ color: T.dim, fontSize: 11, fontWeight: 400 }}>/ano</span></div>
                      <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{fmt.brl(iptuParcela)}/parcela · {parcelas}x</div>
                    </div>
                    {iptuAlerta && (
                      <span style={S.badge(iptuAlerta === "vencido" ? T.red : T.amber)}>
                        {iptuAlerta === "vencido" ? "Competência vencida" : "Vencendo"}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {Array.from({ length: parcelas }, (_, i) => {
                      const pago = iptuPagas.includes(i);
                      return (
                        <button key={i} onClick={() => toggleIPTUParcela(p, i)} style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                          background: pago ? T.green+"22" : T.s1,
                          border: `1px solid ${pago ? T.green+"66" : T.border}`,
                          color: pago ? T.green : T.muted, fontSize: 11, fontWeight: pago ? 700 : 400,
                          minWidth: 40,
                        }}>
                          <span>{MESES[i % 12]}</span>
                          <span style={{ fontSize: 9, marginTop: 2 }}>{pago ? "✓" : "○"}</span>
                        </button>
                      );
                    })}
                  </div>
                  {parcelas > 0 && (
                    <div style={{ marginBottom: 10, height: 4, background: T.s3, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(iptuPagasCount / parcelas) * 100}%`, background: iptuPagasCount === parcelas ? T.green : T.amber, borderRadius: 2, transition: "width 0.2s" }} />
                    </div>
                  )}
                  <div style={{ color: T.muted, fontSize: 12 }}>
                    <span style={{ color: iptuPagasCount === parcelas ? T.green : T.text, fontWeight: 700 }}>{iptuPagasCount}</span>
                    {" de "}{parcelas} parcelas pagas ·{" "}
                    <span style={{ color: T.gold, fontWeight: 700, ...S.mono }}>{fmt.brl(iptuPagoTotal)}</span>
                    {" pago de "}<span style={{ ...S.mono }}>{fmt.brl(iptuAnual)}</span>
                  </div>
                </div>
              )}

              {/* Card Condomínio */}
              {temCondo && (
                <div style={{ flex: 1, minWidth: 280, background: T.s2, borderRadius: 12, padding: 18, border: `1px solid ${T.border}` }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>CONDOMÍNIO</div>
                    <div style={{ color: T.text, fontSize: 20, fontWeight: 900, ...S.mono }}>{fmt.brl(condoFeeM)}<span style={{ color: T.dim, fontSize: 11, fontWeight: 400 }}>/mês</span></div>
                    <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{fmt.brl(condoFeeAnual)}/ano</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {MESES.map((mes, i) => {
                      const pago = condoPagos.includes(i);
                      return (
                        <button key={i} onClick={() => toggleCondoMes(p, i)} style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                          background: pago ? T.green+"22" : T.s1,
                          border: `1px solid ${pago ? T.green+"66" : T.border}`,
                          color: pago ? T.green : T.muted, fontSize: 11, fontWeight: pago ? 700 : 400,
                          minWidth: 40,
                        }}>
                          <span>{mes}</span>
                          <span style={{ fontSize: 9, marginTop: 2 }}>{pago ? "✓" : "○"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginBottom: 10, height: 4, background: T.s3, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(condoPagosCount / 12) * 100}%`, background: condoPagosCount === 12 ? T.green : T.amber, borderRadius: 2, transition: "width 0.2s" }} />
                  </div>
                  <div style={{ color: T.muted, fontSize: 12 }}>
                    <span style={{ color: condoPagosCount === 12 ? T.green : T.text, fontWeight: 700 }}>{condoPagosCount}</span>
                    {" de 12 meses pagos · "}
                    <span style={{ color: T.gold, fontWeight: 700, ...S.mono }}>{fmt.brl(condoPagoTotal)}</span>
                    {" pago de "}<span style={{ ...S.mono }}>{fmt.brl(condoFeeAnual)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PAGE LOCATÁRIOS ──────────────────────────────────────────────────────────
function PageLocatarios({ PROPS, onUpdateProps }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [form, setForm] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const prop = selectedId ? PROPS.find(p => p.id === selectedId) : null;
  const locatarios = prop?.locatarios || [];

  const GARANTIAS = ["Fiador","Seguro Fiança","Título de Capitalização","Depósito Caução","Sem Garantia"];

  const openForm = (idx = null) => {
    if (idx !== null) setForm({ ...locatarios[idx] });
    else setForm({ nome:"", cpf:"", telefone:"", email:"", garantia:"Fiador", garantiaObs:"", dataEntrada:"", dataSaida:"", ativo:true, obs:"" });
    setEditingIdx(idx);
    setShowForm(true);
  };

  const saveLocatario = () => {
    const updated = [...locatarios];
    if (editingIdx !== null) updated[editingIdx] = form;
    else updated.push({ ...form, id: Date.now() });
    const updatedProp = { ...prop, locatarios: updated };
    onUpdateProps(PROPS.map(p => p.id === prop.id ? updatedProp : p));
    setShowForm(false);
  };

  const removeLocatario = (idx) => {
    if (!window.confirm("Remover locatário?")) return;
    const updated = locatarios.filter((_, i) => i !== idx);
    onUpdateProps(PROPS.map(p => p.id === prop.id ? { ...prop, locatarios: updated } : p));
  };

  // Lista de todos os locatários ativos por imóvel
  const todosAtivos = PROPS.flatMap(p => (p.locatarios||[]).filter(l => l.ativo).map(l => ({ ...l, imovel: p.name, neighborhood: p.neighborhood })));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div>
        <div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:6 }}>CADASTRO</div>
        <h1 style={{ color:T.text, fontSize:26, fontWeight:800, margin:0 }}>Locatários</h1>
      </div>

      {/* Selecionar imóvel */}
      <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
        <select style={{ ...S.sel, minWidth:280 }} value={selectedId||""} onChange={e => setSelectedId(Number(e.target.value)||null)}>
          <option value="">— Selecione um imóvel —</option>
          {PROPS.map(p => <option key={p.id} value={p.id}>{p.name} · {p.neighborhood}</option>)}
        </select>
        {prop && <button style={S.btn} onClick={() => openForm()}>+ Adicionar Locatário</button>}
      </div>

      {/* Locatários do imóvel selecionado */}
      {prop && (
        <div style={{ ...S.card }}>
          <div style={{ color:T.gold, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:16 }}>{prop.name} — HISTÓRICO DE LOCATÁRIOS</div>
          {locatarios.length === 0 ? (
            <div style={{ color:T.dim, fontSize:13, padding:"20px 0", textAlign:"center" }}>Nenhum locatário cadastrado ainda.</div>
          ) : locatarios.map((l, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:T.s3, display:"flex", alignItems:"center", justifyContent:"center", color:T.gold, fontWeight:800, fontSize:16 }}>{l.nome?.[0]?.toUpperCase()||"?"}</div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:T.text, fontWeight:700 }}>{l.nome||"—"}</span>
                    <span style={S.badge(l.ativo?T.green:T.dim)}>{l.ativo?"Ativo":"Encerrado"}</span>
                  </div>
                  <div style={{ color:T.muted, fontSize:12, marginTop:2 }}>
                    {l.cpf && <span>{l.cpf} · </span>}{l.telefone && <span>{l.telefone} · </span>}{l.email && <span>{l.email}</span>}
                  </div>
                  <div style={{ color:T.dim, fontSize:11, marginTop:2 }}>
                    {l.garantia && <span>Garantia: {l.garantia} · </span>}
                    {l.dataEntrada && <span>Entrada: {l.dataEntrada}</span>}
                    {l.dataSaida && <span> · Saída: {l.dataSaida}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ background:T.s3, border:`1px solid ${T.border}`, color:T.muted, borderRadius:7, padding:"5px 10px", cursor:"pointer" }} onClick={() => openForm(i)}>Editar</button>
                <button style={{ background:T.s3, border:`1px solid ${T.redDim}`, color:T.red, borderRadius:7, padding:"5px 10px", cursor:"pointer" }} onClick={() => removeLocatario(i)}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visão geral de todos ativos */}
      {!prop && todosAtivos.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ color:T.gold, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:16 }}>TODOS OS LOCATÁRIOS ATIVOS</div>
          {todosAtivos.map((l, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
              <div>
                <span style={{ color:T.text, fontWeight:600 }}>{l.nome||"—"}</span>
                <span style={{ color:T.dim, fontSize:12, marginLeft:10 }}>{l.imovel} · {l.neighborhood}</span>
              </div>
              <div style={{ color:T.muted, fontSize:12 }}>{l.garantia} · {l.telefone||l.email||"—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de form */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:T.s1, border:`1px solid ${T.borderMid}`, borderRadius:18, width:"100%", maxWidth:540, maxHeight:"90vh", overflow:"auto" }}>
            <div style={{ padding:"20px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ color:T.text, fontWeight:800, fontSize:16 }}>{editingIdx !== null ? "Editar" : "Novo"} Locatário</div>
              <button style={{ background:T.s3, border:"none", color:T.muted, borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:18 }} onClick={() => setShowForm(false)}>×</button>
            </div>
            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ gridColumn:"1/-1" }}><label style={S.label}>NOME COMPLETO</label><input style={S.input} value={form.nome||""} onChange={e=>set("nome",e.target.value)} placeholder="Nome do locatário" autoFocus /></div>
                <div><label style={S.label}>CPF</label><input style={S.input} value={form.cpf||""} onChange={e=>set("cpf",e.target.value)} placeholder="000.000.000-00" /></div>
                <div><label style={S.label}>TELEFONE</label><input style={S.input} value={form.telefone||""} onChange={e=>set("telefone",e.target.value)} placeholder="(11) 99999-9999" /></div>
                <div style={{ gridColumn:"1/-1" }}><label style={S.label}>EMAIL</label><input style={S.input} value={form.email||""} onChange={e=>set("email",e.target.value)} placeholder="email@exemplo.com" /></div>
                <div><label style={S.label}>GARANTIA</label><select style={S.sel} value={form.garantia||"Fiador"} onChange={e=>set("garantia",e.target.value)}>{GARANTIAS.map(g=><option key={g}>{g}</option>)}</select></div>
                <div><label style={S.label}>DETALHES DA GARANTIA</label><input style={S.input} value={form.garantiaObs||""} onChange={e=>set("garantiaObs",e.target.value)} placeholder="Ex: João Silva, CPF..." /></div>
                <div><label style={S.label}>DATA DE ENTRADA</label><input type="date" style={S.input} value={form.dataEntrada||""} onChange={e=>set("dataEntrada",e.target.value)} /></div>
                <div><label style={S.label}>DATA DE SAÍDA</label><input type="date" style={S.input} value={form.dataSaida||""} onChange={e=>set("dataSaida",e.target.value)} /></div>
                <div style={{ gridColumn:"1/-1" }}><label style={S.label}>OBSERVAÇÕES</label><input style={S.input} value={form.obs||""} onChange={e=>set("obs",e.target.value)} placeholder="Observações adicionais" /></div>
                <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:10 }}>
                  <input type="checkbox" checked={form.ativo!==false} onChange={e=>set("ativo",e.target.checked)} style={{ width:16, height:16, accentColor:T.gold }} />
                  <span style={{ color:T.muted, fontSize:13 }}>Locatário ativo no imóvel</span>
                </div>
              </div>
            </div>
            <div style={{ padding:"14px 24px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={S.btnGhost} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={S.btn} onClick={saveLocatario}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAGE FLUXO DE CAIXA ─────────────────────────────────────────────────────
function PageFluxoCaixa({ PROPS }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [visao, setVisao] = useState("carteira"); // "carteira" | "imovel"
  const [imovelId, setImovelId] = useState(null);
  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  // Helper: compute fluxo for a list of props (supports both full portfolio and single prop)
  const computeFluxo = (props) => MESES.map((mes, i) => {
    const dataRef = new Date(ano, i, 1);
    const chave = `${ano}_${i}`;
    let entradaAluguel = 0, entradaIPTU = 0, entradaCondo = 0;
    let saidaIPTU = 0, saidaCondoPago = 0, saidaFundoChamada = 0, saidaMaint = 0, saidaSeguro = 0, saidaAdmin = 0;
    let iptuPrevisto = false, condoPrevisto = false, inadimplentes = 0;

    props.forEach(p => {
      const aluguelBruto = p.rent - (p.descontoAluguel||0);
      const adminMensal = p.adminRecalc || Math.round(aluguelBruto * ((p.adminPct||8)/100));

      if (p.status === "Ocupado") {
        const pag = p.pagamentos?.[chave];
        if (pag?.status === "pago") entradaAluguel += aluguelBruto;
        else if (pag?.status === "atrasado") inadimplentes += aluguelBruto;
        else if (dataRef < hoje) inadimplentes += aluguelBruto;
      }

      // IPTU: usa parcelas pagas se disponível, senão distribui automaticamente (previsto)
      const iptu = p.iptu || 0;
      const parcelas = p.iptuParcelas || 10;
      const competencia = p.iptuVencimento ? parseInt(p.iptuVencimento) : null;
      const parcelasPagas = p.iptuParcelasPagas || [];
      const temParcelasMarcadas = parcelasPagas.length > 0;
      const valorParcela = iptu > 0 ? Math.round(iptu / parcelas) : 0;

      if (iptu > 0) {
        if (temParcelasMarcadas) {
          if (competencia === ano || !competencia) {
            if (parcelasPagas.includes(i)) {
              saidaIPTU += valorParcela;
              if (p.status === "Ocupado") entradaIPTU += valorParcela;
            }
          }
        } else {
          iptuPrevisto = true;
          if (competencia === ano) {
            if (parcelas === 1) {
              if (i === 0) { saidaIPTU += iptu; if (p.status === "Ocupado") entradaIPTU += iptu; }
            } else {
              if (i < parcelas) { saidaIPTU += valorParcela; if (p.status === "Ocupado") entradaIPTU += valorParcela; }
            }
          } else if (!competencia) {
            saidaIPTU += Math.round(iptu / 12);
            if (p.status === "Ocupado") entradaIPTU += Math.round(iptu / 12);
          }
        }
      }

      // Condomínio: restituição do inquilino (entrada) e pagamento pelo proprietário (saída)
      if (p.hasCondominio && (p.condoFee||0) > 0) {
        const condoMesesPagos = p.condoMesesPagos || [];
        const temMesesMarcados = condoMesesPagos.length > 0;
        const condoFeeM = p.condoFee || 0;
        if (p.status === "Ocupado") {
          if (temMesesMarcados) {
            if (condoMesesPagos.includes(i)) {
              entradaCondo += condoFeeM;
              saidaCondoPago += condoFeeM;
            }
          } else {
            condoPrevisto = true;
            entradaCondo += condoFeeM;
            saidaCondoPago += condoFeeM;
          }
        } else {
          // Vago: proprietário paga o condo sem restituição
          if (temMesesMarcados) {
            if (condoMesesPagos.includes(i)) saidaCondoPago += condoFeeM;
          } else {
            condoPrevisto = true;
            saidaCondoPago += condoFeeM;
          }
        }
        // Fundo/chamada sempre do proprietário
        saidaFundoChamada += (p.fundoReserva||0) + (p.chamadaExtra||0);
      }

      saidaAdmin += adminMensal;
      saidaMaint += p.maintMonthly || 0;
      saidaSeguro += Math.round((p.insurance||0)/12);
    });

    const entradas = entradaAluguel + entradaIPTU + entradaCondo;
    const saidas = saidaMaint + saidaSeguro + saidaAdmin + saidaIPTU + saidaCondoPago + saidaFundoChamada;
    const saldo = entradas - saidas;
    return { mes, mesNum: i, entradas, saidas, saldo, inadimplentes, entradaAluguel, entradaIPTU, entradaCondo, saidaIPTU, iptuPrevisto, condoPrevisto, saidaMaint, saidaSeguro, saidaAdmin, saidaCondoPago, saidaFundoChamada };
  });

  const propsVisao = visao === "imovel" && imovelId ? PROPS.filter(p => p.id === imovelId) : PROPS;
  const fluxo = computeFluxo(propsVisao);

  const totalEntradas = fluxo.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas = fluxo.reduce((s, m) => s + m.saidas, 0);
  const totalSaldo = totalEntradas - totalSaidas;
  const saldoAcumulado = fluxo.reduce((acc, m, i) => {
    const prev = i === 0 ? 0 : acc[i-1];
    acc.push(prev + m.saldo);
    return acc;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>FINANCEIRO</div>
          <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Fluxo de Caixa</h1>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:0, border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
            {[["carteira","Carteira completa"],["imovel","Por imóvel"]].map(([id, label]) => (
              <button key={id} onClick={() => setVisao(id)} style={{ background: visao===id ? T.goldGlow : T.s2, border:"none", borderRight:`1px solid ${T.border}`, color: visao===id ? T.gold : T.muted, fontWeight: visao===id ? 700 : 400, fontSize:12, padding:"8px 14px", cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
            ))}
          </div>
          {visao === "imovel" && (
            <select style={{ ...S.sel, width:"auto" }} value={imovelId||""} onChange={e => setImovelId(Number(e.target.value)||null)}>
              <option value="">— Selecione um imóvel —</option>
              {PROPS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select style={{ ...S.sel, width: "auto" }} value={ano} onChange={e => setAno(Number(e.target.value))}>
            {[hoje.getFullYear()-1, hoje.getFullYear(), hoje.getFullYear()+1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      {(() => {
        const totalAluguel = fluxo.reduce((s,m) => s+m.entradaAluguel, 0);
        const totalIPTUentrada = fluxo.reduce((s,m) => s+m.entradaIPTU, 0);
        const totalCondoEntrada = fluxo.reduce((s,m) => s+m.entradaCondo, 0);
        const totalIPTUsaida = fluxo.reduce((s,m) => s+m.saidaIPTU, 0);
        const totalCondoPago = fluxo.reduce((s,m) => s+m.saidaCondoPago, 0);
        const totalFundoChamada = fluxo.reduce((s,m) => s+m.saidaFundoChamada, 0);
        const totalMaint = fluxo.reduce((s,m) => s+m.saidaMaint, 0);
        return (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div style={{ ...S.card, flex: 1, minWidth: 160 }}>
                <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>FATURAMENTO BRUTO</div>
                <div style={{ color: T.green, fontSize: 22, fontWeight: 800, ...S.mono }}>{fmt.brlK(totalEntradas)}</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>Aluguel {fmt.brlK(totalAluguel)} + IPTU {fmt.brlK(totalIPTUentrada)} + Condo {fmt.brlK(totalCondoEntrada)}</div>
              </div>
              <div style={{ ...S.card, flex: 1, minWidth: 160 }}>
                <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>TOTAL DESPESAS</div>
                <div style={{ color: T.red, fontSize: 22, fontWeight: 800, ...S.mono }}>{fmt.brlK(totalSaidas)}</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>IPTU {fmt.brlK(totalIPTUsaida)} · Condo {fmt.brlK(totalCondoPago)} · Fundo {fmt.brlK(totalFundoChamada)} · Maint. {fmt.brlK(totalMaint)}</div>
              </div>
              <div style={{ ...S.card, flex: 1, minWidth: 160, border: `1px solid ${totalSaldo >= 0 ? T.green+"40" : T.red+"40"}` }}>
                <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>SALDO LÍQUIDO</div>
                <div style={{ color: totalSaldo >= 0 ? T.green : T.red, fontSize: 22, fontWeight: 800, ...S.mono }}>{fmt.brlK(totalSaldo)}</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>{fmt.brl(Math.round(totalSaldo/12))}/mês médio</div>
              </div>
              <div style={{ ...S.card, flex: 1, minWidth: 160 }}>
                <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>IMÓVEIS ATIVOS</div>
                <div style={{ color: T.gold, fontSize: 22, fontWeight: 800 }}>{propsVisao.filter(p => p.status === "Ocupado").length}</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>de {propsVisao.length} {visao === "imovel" ? "selecionado" : "total"}</div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Gráfico de barras */}
      <div style={{ ...S.card }}>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Entradas × Saídas por Mês</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={fluxo.map((m, i) => ({ ...m, saldoAcum: saldoAcumulado[i] }))} barGap={2} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="entradas" name="Entradas" fill={T.green} radius={[4,4,0,0]} opacity={0.85} />
            <Bar dataKey="saidas" name="Saídas" fill={T.red} radius={[4,4,0,0]} opacity={0.75} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:20, marginTop:8, justifyContent:"center" }}>
          {[["Entradas", T.green], ["Saídas", T.red]].map(([l,c]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:c }} />
              <span style={{ color:T.muted, fontSize:11 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela mensal */}
      <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.s2 }}>
              {["MÊS","ALUGUEL","IPTU rest.","COND. rest.","= ENTRADAS","MANUTENÇÃO","SEGURO","ADMIN","IPTU","COND. pago","FUNDO/CHAM.","= SAÍDAS","SALDO","SALDO ACUM."].map(h => <th key={h} style={{ ...S.th, fontSize: 10, padding: "8px 10px" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {fluxo.map((m, i) => {
              const isFuture = new Date(ano, m.mesNum, 1) > hoje;
              return (
                <tr key={m.mes} style={{ opacity: isFuture ? 0.5 : 1, fontSize: 11 }} onMouseEnter={e => e.currentTarget.style.background = T.s2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...S.td, fontWeight: 700, fontSize: 12 }}>{MESES_FULL[i].slice(0,3)}{isFuture && <span style={{ color: T.dim, fontSize: 9, marginLeft: 4 }}>prev.</span>}</td>
                  <td style={{ ...S.td, ...S.mono, color: T.green, fontSize: 11 }}>{m.entradaAluguel > 0 ? fmt.brl(m.entradaAluguel) : <span style={{color:T.dim}}>—</span>}</td>
                  <td style={{ ...S.td, ...S.mono, color: T.teal, fontSize: 11 }}>
                    {m.entradaIPTU > 0 ? <span title="IPTU restituído pelo inquilino">{fmt.brl(m.entradaIPTU)}{m.iptuPrevisto && <span style={{color:T.dim,fontSize:9,marginLeft:3}}>prev.</span>}</span> : <span style={{color:T.dim}}>—</span>}
                  </td>
                  <td style={{ ...S.td, ...S.mono, color: T.teal, fontSize: 11 }}>
                    {m.entradaCondo > 0 ? <span title="Condomínio restituído pelo inquilino">{fmt.brl(m.entradaCondo)}{m.condoPrevisto && <span style={{color:T.dim,fontSize:9,marginLeft:3}}>prev.</span>}</span> : <span style={{color:T.dim}}>—</span>}
                  </td>
                  <td style={{ ...S.td, ...S.mono, color: T.green, fontWeight: 700 }}>{fmt.brl(m.entradas)}</td>
                  <td style={{ ...S.td, ...S.mono, color: T.amber, fontSize: 11 }}>{m.saidaMaint > 0 ? fmt.brl(m.saidaMaint) : <span style={{color:T.dim}}>—</span>}</td>
                  <td style={{ ...S.td, ...S.mono, color: T.amber, fontSize: 11 }}>{m.saidaSeguro > 0 ? fmt.brl(m.saidaSeguro) : <span style={{color:T.dim}}>—</span>}</td>
                  <td style={{ ...S.td, ...S.mono, color: T.amber, fontSize: 11 }}>{m.saidaAdmin > 0 ? fmt.brl(m.saidaAdmin) : <span style={{color:T.dim}}>—</span>}</td>
                  <td style={{ ...S.td, ...S.mono, color: m.saidaIPTU > 0 ? (m.iptuPrevisto ? T.amber : T.red) : T.dim, fontWeight: m.saidaIPTU > 0 ? 700 : 400, fontSize: 11 }}>
                    {m.saidaIPTU > 0 ? <>{fmt.brl(m.saidaIPTU)}{m.iptuPrevisto && <span style={{color:T.dim,fontSize:9,marginLeft:3}}>prev.</span>}</> : "—"}
                  </td>
                  <td style={{ ...S.td, ...S.mono, color: m.saidaCondoPago > 0 ? (m.condoPrevisto ? T.amber : T.red) : T.dim, fontWeight: m.saidaCondoPago > 0 ? 700 : 400, fontSize: 11 }}>
                    {m.saidaCondoPago > 0 ? <>{fmt.brl(m.saidaCondoPago)}{m.condoPrevisto && <span style={{color:T.dim,fontSize:9,marginLeft:3}}>prev.</span>}</> : "—"}
                  </td>
                  <td style={{ ...S.td, ...S.mono, color: T.amber, fontSize: 11 }}>{m.saidaFundoChamada > 0 ? fmt.brl(m.saidaFundoChamada) : <span style={{color:T.dim}}>—</span>}</td>
                  <td style={{ ...S.td, ...S.mono, color: T.red, fontWeight: 700 }}>{fmt.brl(m.saidas)}</td>
                  <td style={{ ...S.td, ...S.mono, color: m.saldo >= 0 ? T.green : T.red, fontWeight: 800 }}>{fmt.brl(m.saldo)}</td>
                  <td style={{ ...S.td, ...S.mono, color: saldoAcumulado[i] >= 0 ? T.gold : T.red }}>{fmt.brl(saldoAcumulado[i])}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: T.s2, fontWeight: 800 }}>
              <td style={{ ...S.td, color: T.text, fontWeight: 800 }}>TOTAL</td>
              <td style={{ ...S.td, ...S.mono, color: T.green, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.entradaAluguel,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.teal, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.entradaIPTU,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.teal, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.entradaCondo,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.green, fontWeight: 800 }}>{fmt.brl(totalEntradas)}</td>
              <td style={{ ...S.td, ...S.mono, color: T.amber, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.saidaMaint,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.amber, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.saidaSeguro,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.amber, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.saidaAdmin,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.red, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.saidaIPTU,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.red, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.saidaCondoPago,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.amber, fontWeight: 800 }}>{fmt.brl(fluxo.reduce((s,m)=>s+m.saidaFundoChamada,0))}</td>
              <td style={{ ...S.td, ...S.mono, color: T.red, fontWeight: 800 }}>{fmt.brl(totalSaidas)}</td>
              <td style={{ ...S.td, ...S.mono, color: totalSaldo >= 0 ? T.green : T.red, fontWeight: 800 }}>{fmt.brl(totalSaldo)}</td>
              <td style={S.td}>—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Despesas por categoria */}
      <div style={{ ...S.card }}>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Composição das Saídas Mensais (média)</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            ["IPTU", propsVisao.reduce((s,p) => s+(p.iptu||0),0)/12, T.amber],
            ["Manutenção", propsVisao.reduce((s,p) => s+(p.maintMonthly||0),0), T.blue],
            ["Seguros", propsVisao.reduce((s,p) => s+(p.insurance||0),0)/12, T.teal],
            ["Administração", propsVisao.filter(p=>p.viaImobiliaria).reduce((s,p)=>s+(p.adminRecalc||Math.round((p.rent-(p.descontoAluguel||0))*((p.adminPct||8)/100))),0), T.gold],
            ["Cond. mensal", propsVisao.filter(p=>p.hasCondominio).reduce((s,p)=>s+(p.condoFee||0),0), T.teal],
            ["Fundo/Chamada", propsVisao.filter(p=>p.hasCondominio).reduce((s,p)=>s+(p.fundoReserva||0)+(p.chamadaExtra||0),0), T.muted],
          ].map(([label, val, color]) => (
            <div key={label} style={{ flex: 1, minWidth: 120, background: T.s2, padding: "12px 16px", borderRadius: 10 }}>
              <div style={{ color: T.dim, fontSize: 11, marginBottom: 4 }}>{label}</div>
              <div style={{ color, fontWeight: 700, fontSize: 15, ...S.mono }}>{fmt.brl(Math.round(val))}<span style={{ color: T.dim, fontSize: 10 }}>/mês</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Top inadimplentes no mês atual */}
      {(() => {
        const mesKey = `${hoje.getFullYear()}_${hoje.getMonth()}`;
        const inadimplentes = propsVisao.filter(p => p.status === "Ocupado" && (p.pagamentos?.[mesKey]?.status === "atrasado" || p.pagamentos?.[mesKey]?.status === "nao_pago" || (!p.pagamentos?.[mesKey] && new Date(ano, hoje.getMonth(), p.diaVencimento||10) < hoje)));
        if (inadimplentes.length === 0) return null;
        return (
          <div style={{ ...S.card, border:`1px solid ${T.red}40` }}>
            <div style={{ color: T.red, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Inadimplência — Mês Atual</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {inadimplentes.map(p => (
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:T.s2, borderRadius:8 }}>
                  <div>
                    <div style={{ color:T.text, fontWeight:600 }}>{p.name}</div>
                    <div style={{ color:T.muted, fontSize:12 }}>{p.neighborhood}</div>
                  </div>
                  <div style={{ color:T.red, fontWeight:700, ...S.mono }}>{fmt.brl(p.rent - (p.descontoAluguel||0))}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}


// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",  label: "Visão Geral",      icon: "◈" },
  { id: "noi",        label: "Imóveis",           icon: "⊞" },
  { id: "pagamentos", label: "Pagamentos",         icon: "" },
  { id: "iptu",       label: "IPTU & Cond.",       icon: "🏛" },
  { id: "fluxo",      label: "Fluxo de Caixa",    icon: "" },
  { id: "mercado",    label: "Valor da Carteira",  icon: "🏦" },
  { id: "leakage",    label: "Alertas",            icon: "◎" },
  { id: "decision",   label: "Decisão por Imóvel", icon: "⟁" },
];

// ─── PAGE HISTÓRICO DO IMÓVEL ─────────────────────────────────────────────────
function PageHistorico({ PROPS, onUpdateProps }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [editingIdx, setEditingIdx] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const prop = selectedId ? PROPS.find(p => p.id === selectedId) : null;
  const historico = prop?.historico || [];

  const TIPOS_EVENTO = ["Compra","Reforma/CAPEX","Início de Locação","Rescisão de Contrato","Valorização/Avaliação","Venda","Sinistro","Outro"];
  const CORES = { "Compra":T.gold, "Reforma/CAPEX":T.amber, "Início de Locação":T.green, "Rescisão de Contrato":T.red, "Valorização/Avaliação":T.blue, "Venda":T.teal, "Sinistro":T.red, "Outro":T.muted };

  const openForm = (idx = null) => {
    if (idx !== null) setForm({ ...historico[idx] });
    else setForm({ tipo:"Compra", data:"", titulo:"", descricao:"", valor:0 });
    setEditingIdx(idx);
    setShowForm(true);
  };

  const saveEvento = () => {
    const updated = [...historico];
    if (editingIdx !== null) updated[editingIdx] = form;
    else updated.push({ ...form, id: Date.now() });
    updated.sort((a, b) => new Date(a.data) - new Date(b.data));
    onUpdateProps(PROPS.map(p => p.id === prop.id ? { ...prop, historico: updated } : p));
    setShowForm(false);
  };

  const removeEvento = (idx) => {
    if (!window.confirm("Remover evento?")) return;
    const updated = historico.filter((_, i) => i !== idx);
    onUpdateProps(PROPS.map(p => p.id === prop.id ? { ...prop, historico: updated } : p));
  };

  const todosEventos = PROPS.flatMap(p => (p.historico||[]).map(ev => ({ ...ev, imovel: p.name }))).sort((a,b) => new Date(b.data) - new Date(a.data));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div>
        <div style={{ color:T.muted, fontSize:11, letterSpacing:2, fontWeight:700, marginBottom:6 }}>PATRIMÔNIO</div>
        <h1 style={{ color:T.text, fontSize:26, fontWeight:800, margin:0 }}>Histórico do Imóvel</h1>
      </div>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <select style={{ ...S.sel, minWidth:280 }} value={selectedId||""} onChange={e => setSelectedId(Number(e.target.value)||null)}>
          <option value="">— Selecione um imóvel —</option>
          {PROPS.map(p => <option key={p.id} value={p.id}>{p.name} · {p.neighborhood}</option>)}
        </select>
        {prop && <button style={S.btn} onClick={() => openForm()}>+ Adicionar Evento</button>}
      </div>
      {prop && (
        <div style={{ ...S.card }}>
          <div style={{ color:T.gold, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:20 }}>{prop.name} — LINHA DO TEMPO</div>
          {historico.length === 0 ? (
            <div style={{ color:T.dim, fontSize:13, padding:"20px 0", textAlign:"center" }}>Nenhum evento cadastrado. Comece pela compra do imóvel.</div>
          ) : (
            <div style={{ position:"relative", paddingLeft:32 }}>
              <div style={{ position:"absolute", left:10, top:0, bottom:0, width:2, background:T.border }} />
              {historico.map((ev, i) => {
                const cor = CORES[ev.tipo] || T.muted;
                return (
                  <div key={i} style={{ position:"relative", marginBottom:24 }}>
                    <div style={{ position:"absolute", left:-28, width:16, height:16, borderRadius:"50%", background:cor, border:"2px solid "+T.bg, top:2 }} />
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                          <span style={S.badge(cor)}>{ev.tipo}</span>
                          {ev.auto && <span style={{ fontSize:10, color:T.teal, border:"1px solid "+T.teal, borderRadius:4, padding:"1px 5px" }}>auto</span>}
                          <span style={{ color:T.dim, fontSize:12 }}>{ev.data ? new Date(ev.data+"T12:00").toLocaleDateString("pt-BR") : "—"}</span>
                        </div>
                        <div style={{ color:T.text, fontWeight:600 }}>{ev.titulo||ev.tipo}</div>
                        {ev.descricao && <div style={{ color:T.muted, fontSize:13, marginTop:4 }}>{ev.descricao}</div>}
                        {ev.valor > 0 && <div style={{ color:T.gold, fontSize:13, marginTop:4, fontWeight:700, ...S.mono }}>{fmt.brl(ev.valor)}</div>}
                      </div>
                      {!ev.auto && (
                        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                          <button style={{ background:T.s3, border:"1px solid "+T.border, color:T.muted, borderRadius:7, padding:"4px 8px", cursor:"pointer" }} onClick={() => openForm(i)}>Editar</button>
                          <button style={{ background:T.s3, border:"1px solid "+T.redDim, color:T.red, borderRadius:7, padding:"4px 8px", cursor:"pointer" }} onClick={() => removeEvento(i)}>Remover</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {!prop && todosEventos.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ color:T.gold, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:16 }}>EVENTOS RECENTES — TODOS OS IMÓVEIS</div>
          {todosEventos.slice(0,15).map((ev, i) => {
            const cor = CORES[ev.tipo] || T.muted;
            return (
              <div key={i} style={{ display:"flex", gap:14, alignItems:"center", padding:"10px 0", borderBottom:"1px solid "+T.border }}>
                <span style={S.badge(cor)}>{ev.tipo}</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>{ev.titulo||ev.tipo}</div>
                  <div style={{ color:T.dim, fontSize:12 }}>{ev.imovel}</div>
                </div>
                {ev.valor > 0 && <div style={{ color:T.gold, fontSize:13, fontWeight:700, ...S.mono }}>{fmt.brl(ev.valor)}</div>}
                <div style={{ color:T.dim, fontSize:12 }}>{ev.data ? new Date(ev.data+"T12:00").toLocaleDateString("pt-BR") : ""}</div>
              </div>
            );
          })}
        </div>
      )}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:T.s1, border:"1px solid "+T.borderMid, borderRadius:18, width:"100%", maxWidth:500 }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid "+T.border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ color:T.text, fontWeight:800, fontSize:16 }}>{editingIdx !== null ? "Editar" : "Novo"} Evento</div>
              <button style={{ background:T.s3, border:"none", color:T.muted, borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:18 }} onClick={() => setShowForm(false)}>×</button>
            </div>
            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label style={S.label}>TIPO DE EVENTO</label><select style={S.sel} value={form.tipo||"Compra"} onChange={e=>set("tipo",e.target.value)}>{TIPOS_EVENTO.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={S.label}>DATA</label><input type="date" style={S.input} value={form.data||""} onChange={e=>set("data",e.target.value)} /></div>
                <div style={{ gridColumn:"1/-1" }}><label style={S.label}>TÍTULO</label><input style={S.input} value={form.titulo||""} onChange={e=>set("titulo",e.target.value)} placeholder="Ex: Compra do imóvel, Reforma da cozinha..." autoFocus /></div>
                <div style={{ gridColumn:"1/-1" }}><label style={S.label}>DESCRIÇÃO</label><input style={S.input} value={form.descricao||""} onChange={e=>set("descricao",e.target.value)} placeholder="Detalhes do evento" /></div>
                <div><label style={S.label}>VALOR (R$)</label><input type="number" style={S.input} value={form.valor||""} onChange={e=>set("valor",parseFloat(e.target.value)||0)} placeholder="0" /></div>
              </div>
            </div>
            <div style={{ padding:"14px 24px", borderTop:"1px solid "+T.border, display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={S.btnGhost} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={S.btn} onClick={saveEvento}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── ADD IMOVEL MODAL ─────────────────────────────────────────────────────────
function AddImovelModal({ onSave, onClose, nextId, userId }) {
  const NEIGHBORHOODS = Object.keys(FIPEZAP_M2).filter(k => !k.startsWith("_default")).sort((a,b) => a.localeCompare(b, "pt-BR"));
  const [tab, setTab] = useState("manual"); // "manual" | "pdf"
  const [showValorSection, setShowValorSection] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");
  const [pdfExtracted, setPdfExtracted] = useState(false);

  const handlePdfUpload = async (file) => {
    if (!file || !file.type.includes("pdf")) { setPdfMsg("Selecione um arquivo PDF."); return; }
    setPdfFile(file);
    setPdfLoading(true);
    setPdfMsg("Lendo documento com IA...");
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(",")[1];
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "",
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1500,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
                { type: "text", text: `Extraia os dados deste documento imobiliário e retorne SOMENTE um JSON válido, sem nenhum texto antes ou depois, com estes campos (use null para campos não encontrados):
{
  "name": "nome descritivo do imóvel (ex: Apto 72 - Rua das Flores)",
  "address": "endereço completo",
  "neighborhood": "bairro",
  "city": "cidade",
  "type": "Apartamento|Casa|Comercial|Sala Comercial|Galpão/Industrial|Studio/Kitnet|Terreno",
  "size": número em m2,
  "rent": valor mensal do aluguel em reais,
  "iptu": valor anual do IPTU em reais,
  "contratoInicio": "YYYY-MM-DD",
  "contratoAnos": número de meses do contrato,
  "locatarioNome": "nome do locatário",
  "locatarioCPF": "CPF do locatário",
  "locatarioTelefone": "telefone",
  "locatarioEmail": "email",
  "locatarioGarantia": "Fiador|Seguro fiança|Caução|Depósito",
  "adminPct": percentual de administração (número),
  "indiceReajuste": "IGPM|IPCA|Fixo",
  "valorCompra": valor de compra em reais
}` }
              ]
            }]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const text = data.content?.[0]?.text || "";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        // Fill form with extracted data
        Object.entries(parsed).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== "") {
            set(k, String(v));
          }
        });
        if (parsed.rent > 0 || parsed.locatarioNome) set("status", "Ocupado");
        setPdfExtracted(true);
        setPdfMsg("Dados extraídos! Revise os campos abaixo e salve.");
        setTab("manual");
        setPdfLoading(false);
      };
      reader.readAsDataURL(file);
    } catch(e) {
      setPdfMsg("Erro ao processar PDF: " + e.message);
      setPdfLoading(false);
    }
  };

  const [form, setForm] = useState({
    name: "", address: "", neighborhood: "Itaim Bibi", city: "São Paulo",
    type: "Apartamento", status: "Vago", size: "",
    iptu: "", maintMonthly: "", insurance: "", valorCompra: "", valorMercado: "",
    iptuVencimento: "",
    iptuParcelas: 10,
    // Aluguel (só se ocupado)
    rent: "", adminPct: "8", descontoAluguel: "0", contratoAnos: "12",
    contratoInicio: "", indiceReajuste: "IGPM",
    hasCondominio: false, condoFee: "0", fundoReserva: "0", chamadaExtra: "0", chamadaExtraParcelas: "0", chamadaExtraParcelaAtual: "0", condoPagoPor: "proprietario",
    regimeFiscal: "PF",
    // Locatário
    locatarioNome: "", locatarioCPF: "", locatarioTelefone: "", locatarioEmail: "", locatarioGarantia: "Fiador", viaImobiliaria: false,
    imobiliariaName: "", contratoVencimento: "", clausula12Meses: false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const alugado = form.status === "Ocupado";
  const canSave = form.name.trim() !== "";

  const handleSave = () => {
    if (!canSave) return;
    const bm = getBenchmark(form.city, form.type);
    const size = parseFloat(form.size) || 0;
    const rent = alugado ? (parseFloat(form.rent) || 0) : 0;
    const adminPct = form.adminPct !== "" ? (parseFloat(form.adminPct) || 0) : 8;
    const descontoAluguel = parseFloat(form.descontoAluguel) || 0;
    const admin = Math.round((rent - descontoAluguel) * adminPct / 100);
    const iptu = form.iptu !== "" ? (parseFloat(form.iptu) || 0) : Math.round(bm.iptu_m2 * size);
    const maintMonthly = form.maintMonthly !== "" ? (parseFloat(form.maintMonthly) || 0) : Math.round(bm.maintenance_annual_m2 * size / 12);
    const insurance = form.insurance !== "" ? (parseFloat(form.insurance) || 0) : Math.round(rent * 0.025 * 12);
    const vacancyDays = alugado ? 0 : 30;
    const vacancyCost = Math.round((rent / 30) * vacancyDays);
    const annualRent = rent * 12;
    const descontoAnual = descontoAluguel * 12;
    const condoAnnual = form.hasCondominio ? ((parseFloat(form.fundoReserva)||0) + (parseFloat(form.chamadaExtra)||0)) * 12 : 0;
    const totalIncome = annualRent - vacancyCost - descontoAnual;
    const totalExpenses = iptu + maintMonthly * 12 + insurance + admin * 12 + condoAnnual;
    const noi = totalIncome - totalExpenses;
    const noiPct = noi / (totalIncome || 1);
    const iptuBenchmark = Math.round(bm.iptu_m2 * size);
    const iptuDelta = iptuBenchmark ? Math.round(((iptu - iptuBenchmark) / iptuBenchmark) * 100) : 0;
    const maintBenchmark = Math.round(bm.maintenance_annual_m2 * size / 12);
    const maintDelta = maintBenchmark ? Math.round(((maintMonthly - maintBenchmark) / maintBenchmark) * 100) : 0;
    const vacancyDelta = vacancyDays - bm.vacancy_days;
    let leakage = 0;
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
      id: nextId, name: form.name, address: form.address,
      neighborhood: form.neighborhood, city: form.city, state: "SP",
      type: form.type, status: form.status, size, rent, iptu, maintMonthly,
      insurance, admin, adminPct, vacancyDays, vacancyCost, totalIncome, totalExpenses,
      noi, noiPct, leakage, iptuBenchmark, iptuDelta, maintBenchmark, maintDelta,
      vacancyBenchmark: bm.vacancy_days, vacancyDelta, monthlyData, isProblematic: false,
      obras: [], prestadores: [], pagamentos: {}, valorMercado: parseFloat(form.valorMercado)||0,
      valorCompra: parseFloat(form.valorCompra)||0, anoCompra: null,
      indiceReajuste: form.indiceReajuste, iptuVencimento: form.iptuVencimento, iptuParcelas: Number(form.iptuParcelas)||10,
      descontoAluguel, contratoAnos: parseFloat(form.contratoAnos)||1,
      contratoInicio: form.contratoInicio, hasCondominio: form.hasCondominio,
      condoFee: parseFloat(form.condoFee)||0, fundoReserva: parseFloat(form.fundoReserva)||0,
      chamadaExtra: parseFloat(form.chamadaExtra)||0, chamadaExtraParcelas: parseFloat(form.chamadaExtraParcelas)||0, chamadaExtraParcelaAtual: parseFloat(form.chamadaExtraParcelaAtual)||0, condoPagoPor: form.condoPagoPor,
      regimeFiscal: form.regimeFiscal,
      viaImobiliaria: form.viaImobiliaria, imobiliariaName: form.imobiliariaName,
      locatarioNome: form.locatarioNome, locatarioCPF: form.locatarioCPF,
      locatarioTelefone: form.locatarioTelefone, locatarioEmail: form.locatarioEmail,
      locatarioGarantia: form.locatarioGarantia, contratoVencimento: form.contratoVencimento, clausula12Meses: form.clausula12Meses,
      locatarios: [], historico: [], documentos: [],
    });
  };

  const Section = ({ title }) => (
    <div style={{ color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, marginTop: 4, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>{title}</div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.s1, border: `1px solid ${T.borderMid}`, borderRadius: 18, width: "100%", maxWidth: 600, maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ padding: "22px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: T.s1, zIndex: 1 }}>
          <div>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>NOVO IMÓVEL</div>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 17, marginTop: 2 }}>Adicionar ao Portfólio</div>
          </div>
          <button style={{ background: T.s3, border: "none", color: T.muted, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18 }} onClick={onClose}>×</button>
        </div>

        {/* ABAS */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, padding: "0 28px" }}>
          {[["manual","Preencher manualmente"],["pdf","Importar documento"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab===id ? `2px solid ${T.gold}` : "2px solid transparent", color: tab===id ? T.gold : T.muted, fontWeight: tab===id ? 700 : 400, fontSize: 13, padding: "12px 18px", cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>{label}</button>
          ))}
          {pdfExtracted && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.green, padding: "0 8px" }}>PDF importado</div>}
        </div>

        {/* ABA PDF */}
        {tab === "pdf" && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
              Faça upload do contrato de locação ou boleto de IPTU. A IA vai extrair os dados automaticamente e preencher o formulário para você revisar.
            </div>
            <label style={{ border: `2px dashed ${T.border}`, borderRadius: 14, padding: "36px 24px", textAlign: "center", cursor: "pointer", display: "block", background: T.s2 }}>
              <input type="file" accept=".pdf" style={{ display: "none" }} onChange={e => e.target.files[0] && handlePdfUpload(e.target.files[0])} />
              <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>{pdfFile ? pdfFile.name : "Clique para selecionar ou arraste o PDF"}</div>
              <div style={{ color: T.dim, fontSize: 12 }}>Contratos, boletos, escrituras — qualquer documento PDF do imóvel</div>
            </label>
            {pdfLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: T.s2, borderRadius: 12 }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${T.gold}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ color: T.gold, fontSize: 14 }}>{pdfMsg}</span>
              </div>
            )}
            {!pdfLoading && pdfMsg && (
              <div style={{ padding: "14px 18px", background: pdfExtracted ? T.green+"22" : T.redDim+"33", border: `1px solid ${pdfExtracted ? T.green : T.red}44`, borderRadius: 10, color: pdfExtracted ? T.green : T.red, fontSize: 13 }}>{pdfMsg}</div>
            )}
          </div>
        )}

        <div style={{ display: tab === "pdf" ? "none" : "block" }}>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* DADOS DO IMÓVEL */}
          <div>
            <Section title="DADOS DO IMÓVEL" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>NOME DO IMÓVEL *</label>
                <input style={S.input} value={form.name} placeholder="Ex: Apartamento Jardins, Sala Faria Lima..." onChange={e=>set("name",e.target.value)} autoFocus />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>ENDEREÇO</label>
                <input style={S.input} value={form.address} placeholder="Ex: Rua Oscar Freire, 1200" onChange={e=>set("address",e.target.value)} />
              </div>
              <div>
                <label style={S.label}>CIDADE</label>
                <select style={S.sel} value={form.city} onChange={e=>set("city",e.target.value)}>
                  {["São Paulo","Campinas","Santo André","Americana"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>BAIRRO</label>
                <NeighborhoodSearch city={form.city} value={form.neighborhood} onChange={v=>set("neighborhood",v)} />
              </div>
              <div>
                <label style={S.label}>TIPO</label>
                <select style={S.sel} value={form.type} onChange={e=>set("type",e.target.value)}>
                  {["Apartamento","Casa","Casa de Condomínio","Sala Comercial","Industrial","Loja","Galpão","Salão Comercial","Terreno"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>ÁREA (m²)</label>
                <input type="number" style={S.input} value={form.size} placeholder="Ex: 85" onChange={e=>set("size",e.target.value)} />
              </div>
              <div>
                <label style={S.label}>IPTU ANUAL (R$)</label>
                <input type="number" style={S.input} value={form.iptu} placeholder="Automático" onChange={e=>set("iptu",e.target.value)} />
              </div>
              <div>
                <label style={S.label}>COMPETÊNCIA IPTU (ano)</label>
                <div style={{ display:"flex", gap:10 }}>
                  <input type="number" style={{ ...S.input, flex:2 }} value={form.iptuVencimento} placeholder={new Date().getFullYear().toString()} min="2000" max="2099" onChange={e=>set("iptuVencimento",e.target.value)} />
                  <select style={{ ...S.sel, flex:1 }} value={form.iptuParcelas||10} onChange={e=>set("iptuParcelas",Number(e.target.value))}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}x</option>)}</select>
                </div>
              </div>
              <div>
                <label style={S.label}>MANUTENÇÃO MENSAL (R$)</label>
                <input type="number" style={S.input} value={form.maintMonthly} placeholder="Automático" onChange={e=>set("maintMonthly",e.target.value)} />
              </div>
              <div>
                <label style={S.label}>SEGURO ANUAL (R$)</label>
                <input type="number" style={S.input} value={form.insurance} placeholder="Automático" onChange={e=>set("insurance",e.target.value)} />
              </div>
            </div>
            {/* Collapsible: valor de compra e mercado */}
            <div style={{ marginTop: 12 }}>
              <button style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", color: T.muted, fontSize: 12, fontFamily: "inherit", width: "100%" }} onClick={() => setShowValorSection(v => !v)}>
                <span style={{ color: T.gold, fontWeight: 700 }}>Informações de valor</span>
                <span style={{ color: T.dim, fontWeight: 400 }}>(opcional)</span>
                <span style={{ marginLeft: "auto" }}>{showValorSection ? "▲" : "▼"}</span>
              </button>
              {showValorSection && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div>
                    <label style={S.label}>VALOR DE COMPRA (R$)</label>
                    <input type="number" style={S.input} value={form.valorCompra} placeholder="Ex: 500.000" onChange={e=>set("valorCompra",e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>VALOR DE MERCADO ATUAL (R$)</label>
                    <input type="number" style={S.input} value={form.valorMercado} placeholder="Ex: 650.000" onChange={e=>set("valorMercado",e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STATUS */}
          <div>
            <Section title="STATUS DO IMÓVEL" />
            <div style={{ display: "flex", gap: 10 }}>
              {[["Vago","Vago"],["Ocupado","Alugado"]].map(([val, label]) => (
                <button key={val} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${form.status === val ? T.gold : T.border}`, background: form.status === val ? T.goldGlow : T.s2, color: form.status === val ? T.gold : T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: form.status === val ? 700 : 400 }} onClick={() => set("status", val)}>{label}</button>
              ))}
            </div>
          </div>

          {/* DADOS DO ALUGUEL — só se ocupado */}
          {alugado && (
            <div style={{ background: T.s2, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
              <Section title="DADOS DO ALUGUEL" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>ALUGUEL MENSAL (R$) *</label>
                  <input type="number" style={S.input} value={form.rent} placeholder="Ex: 4.500" onChange={e=>set("rent",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>TAXA DE ADM. (%)</label>
                  <div style={{ position: "relative" }}>
                    <input type="number" style={{ ...S.input, paddingRight: 32 }} value={form.adminPct} placeholder="8" min="0" max="20" step="0.5" onChange={e=>set("adminPct",e.target.value)} />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 14, fontWeight: 700 }}>%</span>
                  </div>
                  {form.rent && <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>= {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Math.round((parseFloat(form.rent)||0)*(parseFloat(form.adminPct)||0)/100))}/mês</div>}
                </div>
                <div>
                  <label style={S.label}>DESCONTO NO ALUGUEL (R$/mês)</label>
                  <input type="number" style={S.input} value={form.descontoAluguel} placeholder="0" onChange={e=>set("descontoAluguel",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>DURAÇÃO DO CONTRATO (meses)</label>
                  <input type="number" style={S.input} value={form.contratoAnos} placeholder="1" onChange={e=>set("contratoAnos",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>INÍCIO DO CONTRATO</label>
                  <input type="date" style={S.input} value={form.contratoInicio} onChange={e=>set("contratoInicio",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>VENCIMENTO DO CONTRATO</label>
                  <input type="date" style={S.input} value={form.contratoVencimento} onChange={e=>set("contratoVencimento",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>ÍNDICE DE REAJUSTE</label>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {["IGPM","IPCA","INPC","Fixo"].map(idx => (
                      <button key={idx} style={{ flex:1, padding:"8px 4px", borderRadius:8, border:`1px solid ${form.indiceReajuste===idx?T.gold:T.border}`, background:form.indiceReajuste===idx?T.goldGlow:T.s1, color:form.indiceReajuste===idx?T.gold:T.muted, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:form.indiceReajuste===idx?700:400 }} onClick={()=>set("indiceReajuste",idx)}>{idx}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Locatário */}
              <div style={{ marginTop: 16 }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
                  LOCATÁRIO <span style={{ color: T.dim, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{form.viaImobiliaria ? "(opcional)" : "(recomendado)"}</span>
                </div>
                {/* Toggle imobiliária */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, background: T.s1, borderRadius: 10, padding: "10px 14px", border: `1px solid ${T.border}` }}>
                  <input type="checkbox" checked={form.viaImobiliaria} onChange={e=>set("viaImobiliaria",e.target.checked)} style={{ width:16, height:16, accentColor:T.gold, cursor:"pointer" }} />
                  <div>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>Gerenciado por imobiliária</div>
                    <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Os dados do locatário são opcionais quando gerenciado por imobiliária</div>
                  </div>
                </div>
                {form.viaImobiliaria && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={S.label}>NOME DA IMOBILIÁRIA</label>
                    <input style={S.input} value={form.imobiliariaName} placeholder="Ex: Imobiliária XYZ" onChange={e=>set("imobiliariaName",e.target.value)} />
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={S.label}>NOME COMPLETO</label>
                    <input style={S.input} value={form.locatarioNome} placeholder="Nome do locatário" onChange={e=>set("locatarioNome",e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>CPF / CNPJ</label>
                    <input style={S.input} value={form.locatarioCPF} placeholder="000.000.000-00" onChange={e=>set("locatarioCPF",e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>TELEFONE</label>
                    <input style={S.input} value={form.locatarioTelefone} placeholder="(11) 99999-9999" onChange={e=>set("locatarioTelefone",e.target.value)} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={S.label}>EMAIL</label>
                    <input style={S.input} value={form.locatarioEmail} placeholder="email@exemplo.com" onChange={e=>set("locatarioEmail",e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>GARANTIA</label>
                    <select style={S.sel} value={form.locatarioGarantia} onChange={e=>set("locatarioGarantia",e.target.value)}>
                      {["Fiador","Seguro Fiança","Caução","Título de Capitalização","Sem garantia"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:14, padding:"10px 14px", background:T.s1, borderRadius:8, border:`1px solid ${T.border}` }}>
                  <input type="checkbox" checked={form.clausula12Meses||false} onChange={e=>set("clausula12Meses",e.target.checked)} style={{ width:16, height:16, accentColor:T.gold, cursor:"pointer" }} />
                  <div>
                    <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>Contrato tem cláusula de dispensa de multa após 12 meses?</div>
                    <div style={{ color:T.dim, fontSize:11, marginTop:2 }}>Se ativado: sem multa rescisória após 12 meses de locação</div>
                  </div>
                </div>
              </div>

              {/* Condomínio */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: form.hasCondominio ? 12 : 0 }}>
                  <input type="checkbox" checked={form.hasCondominio} onChange={e=>set("hasCondominio",e.target.checked)} style={{ width:16, height:16, accentColor:T.gold, cursor:"pointer" }} />
                  <span style={{ color: T.muted, fontSize: 13, cursor: "pointer" }}>Este imóvel tem condomínio</span>
                </div>
                {form.hasCondominio && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={S.label}>COND. MENSAL (R$)</label>
                        <input type="number" style={S.input} value={form.condoFee} onChange={e=>set("condoFee",e.target.value)} />
                        <div style={{ color:T.dim, fontSize:10, marginTop:3 }}>Pago pelo inquilino</div>
                      </div>
                      <div>
                        <label style={S.label}>FUNDO DE RESERVA (R$/mês)</label>
                        <input type="number" style={S.input} value={form.fundoReserva} onChange={e=>set("fundoReserva",e.target.value)} />
                        <div style={{ color:T.dim, fontSize:10, marginTop:3 }}>Sempre do proprietário</div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={S.label}>CHAMADA EXTRA (R$/mês)</label>
                        <input type="number" style={S.input} value={form.chamadaExtra} onChange={e=>set("chamadaExtra",e.target.value)} />
                        <div style={{ color:T.dim, fontSize:10, marginTop:3 }}>Sempre do proprietário</div>
                        {Number(form.chamadaExtra) > 0 && (
                          <div style={{ display:"flex", gap:8, marginTop:8 }}>
                            <div style={{ flex:1 }}>
                              <label style={S.label}>TOTAL DE PARCELAS</label>
                              <input type="number" style={S.input} value={form.chamadaExtraParcelas||""} placeholder="Ex: 24" min="0" onChange={e=>set("chamadaExtraParcelas",e.target.value)} />
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={S.label}>PARCELA ATUAL</label>
                              <input type="number" style={S.input} value={form.chamadaExtraParcelaAtual||""} placeholder="Ex: 10" min="0" onChange={e=>set("chamadaExtraParcelaAtual",e.target.value)} />
                            </div>
                          </div>
                        )}
                        {Number(form.chamadaExtraParcelas) > 0 && Number(form.chamadaExtraParcelaAtual) > 0 && (
                          <div style={{ color:T.amber, fontSize:11, marginTop:6 }}>
                            Parcela {form.chamadaExtraParcelas}/{form.chamadaExtraParcelas} · restam {Number(form.chamadaExtraParcelas) - Number(form.chamadaExtraParcelaAtual)} meses · total restante: {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(form.chamadaExtraParcelas) - Number(form.chamadaExtraParcelaAtual)) * (Number(form.chamadaExtra)||0))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ color:T.green, fontSize:11, padding:"8px 10px", background:T.green+"11", borderRadius:6 }}>
                      ✓ Condomínio mensal pago pelo inquilino — não entra nas suas despesas. Fundo de reserva e chamada extra são sempre do proprietário.
                    </div>
                  </div>
                )}
              </div>

              {/* Regime fiscal */}
              <div style={{ marginTop: 16 }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>REGIME FISCAL</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[["PF","Pessoa Física","IRPF até 27,5%"],["PJ","Pessoa Jurídica","Lucro Presumido ~14%"]].map(([val,title,sub]) => (
                    <button key={val} style={{ flex:1, padding:"10px", borderRadius:8, border:`1px solid ${form.regimeFiscal===val?T.gold:T.border}`, background:form.regimeFiscal===val?T.goldGlow:T.s1, color:form.regimeFiscal===val?T.gold:T.muted, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:form.regimeFiscal===val?700:400, textAlign:"center" }} onClick={()=>set("regimeFiscal",val)}>
                      {title}<div style={{ fontSize:10, marginTop:2, opacity:0.7 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: 12, background: T.s2, borderRadius: 8 }}>
            <div style={{ color: T.dim, fontSize: 12 }}>Despesas não preenchidas são calculadas automaticamente com base nos benchmarks do bairro.</div>
          </div>
        </div>
        </div> {/* end manual tab wrapper */}

        <div style={{ padding: "16px 28px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 12, justifyContent: "flex-end", position: "sticky", bottom: 0, background: T.s1 }}>
          <button style={S.btnGhost} onClick={onClose}>Cancelar</button>
          {tab === "pdf" && !pdfExtracted && (
            <button style={{ ...S.btn, background: T.s3, color: T.muted, cursor: "not-allowed", opacity: 0.6 }} disabled>Faça upload do PDF primeiro</button>
          )}
          {(tab === "manual" || pdfExtracted) && (
            <button style={{ ...S.btn, opacity: !canSave ? 0.5 : 1 }} onClick={handleSave} disabled={!canSave}>+ Adicionar Imóvel</button>
          )}
        </div>
      </div>
    </div>
  );
}


function CancelarContratoModal({ prop, onConfirm, onClose }) {
  const hoje = new Date();
  const isDesocupando = prop.status === "Em desocupação";

  let multaMeses = 0, multaValor = 0;
  if (prop.contratoInicio && prop.contratoAnos && !isDesocupando) {
    const inicio = new Date(prop.contratoInicio);
    const mesesTotais = (prop.contratoAnos || 12);
    const mesesDecorridos = Math.max(0, Math.floor((hoje - inicio) / (1000 * 60 * 60 * 24 * 30.44)));
    // Sem multa se o inquilino ficou mais de 12 meses
    if (mesesDecorridos < 12) {
      multaMeses = Math.max(0, mesesTotais - mesesDecorridos);
      multaValor = Math.round((prop.rent || 0) * multaMeses);
    }
  }

  const [dataEntrega, setDataEntrega] = React.useState("");
  const [vistoria, setVistoria] = React.useState({
    paredes: false, pisos: false, hidraulica: false, eletrica: false,
    janelas: false, portas: false, chaves: false,
  });
  const vistoriaLabels = {
    paredes: "Paredes e pintura", pisos: "Pisos e revestimentos",
    hidraulica: "Hidráulica", eletrica: "Elétrica",
    janelas: "Janelas e esquadrias", portas: "Portas e fechaduras",
    chaves: "Chaves entregues",
  };
  const vistoriaCompleta = Object.values(vistoria).every(Boolean);

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:T.s1, border:`1px solid ${T.borderMid}`, borderRadius:18, width:"100%", maxWidth:500, maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ padding:"22px 28px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:T.amber, fontSize:11, fontWeight:700, letterSpacing:1 }}>{isDesocupando ? "REGISTRAR ENTREGA" : "CANCELAR CONTRATO"}</div>
            <div style={{ color:T.text, fontWeight:800, fontSize:17, marginTop:2 }}>{prop.name}</div>
          </div>
          <button style={{ background:T.s3, border:"none", color:T.muted, borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:18 }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
          {!isDesocupando && (
            <>
              {multaMeses > 0 ? (
                <div style={{ padding:16, background:T.amber+"18", border:`1px solid ${T.amber}44`, borderRadius:12 }}>
                  <div style={{ color:T.amber, fontWeight:700, fontSize:13, marginBottom:8 }}>Multa por rescisão antecipada</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <div><div style={{ color:T.dim, fontSize:11 }}>MESES RESTANTES</div><div style={{ color:T.text, fontWeight:700, fontSize:18 }}>{multaMeses}x</div></div>
                    <div><div style={{ color:T.dim, fontSize:11 }}>VALOR DA MULTA</div><div style={{ color:T.amber, fontWeight:800, fontSize:18, fontFamily:"'DM Mono',monospace" }}>{fmt.brl(multaValor)}</div></div>
                  </div>
                  <div style={{ color:T.dim, fontSize:11, marginTop:8 }}>Aluguel: {fmt.brl(prop.rent)} × {multaMeses} meses restantes</div>
                </div>
              ) : (
                <div style={{ padding:14, background:T.s2, borderRadius:10 }}>
                  <div style={{ color:T.muted, fontSize:13 }}>Contrato no prazo — sem multa de rescisão calculada.</div>
                </div>
              )}
              <div>
                <label style={S.label}>DATA PREVISTA DE ENTREGA DAS CHAVES</label>
                <input type="date" style={S.input} value={dataEntrega} onChange={e=>setDataEntrega(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div style={{ padding:12, background:T.s2, borderRadius:8 }}>
                <div style={{ color:T.muted, fontSize:12 }}>O imóvel passará para <strong>Em desocupação</strong>. Quando as chaves forem entregues, registre a entrega para marcar como <strong>Vago</strong>.</div>
              </div>
            </>
          )}
          <div>
            <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:12 }}>
              {isDesocupando ? "CHECKLIST DE VISTORIA *" : "CHECKLIST DE VISTORIA (opcional)"}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {Object.entries(vistoriaLabels).map(([k, label]) => (
                <div key={k} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:T.s2, borderRadius:8, cursor:"pointer" }} onClick={() => setVistoria(v=>({...v,[k]:!v[k]}))}>
                  <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${vistoria[k]?T.green:T.border}`, background:vistoria[k]?T.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {vistoria[k] && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ color:vistoria[k]?T.text:T.muted, fontSize:13 }}>{label}</span>
                </div>
              ))}
            </div>
            {isDesocupando && !vistoriaCompleta && (
              <div style={{ color:T.amber, fontSize:11, marginTop:8 }}>Complete toda a vistoria antes de registrar a entrega.</div>
            )}
          </div>
          {isDesocupando && (
            <div>
              <label style={S.label}>DATA DE ENTREGA DAS CHAVES</label>
              <input type="date" style={S.input} value={dataEntrega} onChange={e=>setDataEntrega(e.target.value)} />
            </div>
          )}
        </div>
        <div style={{ padding:"14px 24px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={S.btnGhost} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...S.btn, background: isDesocupando ? (vistoriaCompleta ? `linear-gradient(135deg,${T.green},#1A9E72)` : T.s3) : `linear-gradient(135deg,${T.amber},#E07010)`, color: isDesocupando ? "#fff" : "#1A0A00", opacity: isDesocupando && !vistoriaCompleta ? 0.5 : 1 }}
            onClick={() => onConfirm({ dataEntrega, vistoria, multaValor, multaMeses })}
            disabled={isDesocupando && !vistoriaCompleta}
          >
            {isDesocupando ? "Confirmar Entrega" : "Iniciar Desocupação"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ prop, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.s1, border: `1px solid ${T.red}40`, borderRadius: 18, width: "100%", maxWidth: 420, padding: 32 }}>
        <div style={{ color: T.text, fontWeight: 800, fontSize: 18, textAlign: "center", marginBottom: 8 }}>Remover Imóvel?</div>
        <div style={{ color: T.muted, fontSize: 14, textAlign: "center", marginBottom: 6 }}>{prop.name}</div>
        <div style={{ color: T.dim, fontSize: 12, textAlign: "center", marginBottom: 24 }}>{prop.neighborhood} · {prop.city}</div>
        <div style={{ padding: 12, background: T.s2, borderRadius: 8, marginBottom: 24 }}>
          <div style={{ color: T.amber, fontSize: 12, textAlign: "center" }}>Esta ação não pode ser desfeita. Todos os dados incluindo obras serão removidos.</div>
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
function calcIR(totalIncome, totalExpenses, regimeFiscal, deducoes) {
  if (regimeFiscal === "PJ") {
    // Lucro Presumido: 14% sobre receita bruta
    return Math.round(totalIncome * 0.14);
  }
  // PF: tabela progressiva IRPF com deduções
  const baseCalculo = Math.max(0, totalIncome - deducoes);
  const mensal = baseCalculo / 12;
  let aliquota = 0;
  if (mensal <= 2259.20) aliquota = 0;
  else if (mensal <= 2826.65) aliquota = 0.075;
  else if (mensal <= 3751.05) aliquota = 0.15;
  else if (mensal <= 4664.68) aliquota = 0.225;
  else aliquota = 0.275;
  return Math.round(baseCalculo * aliquota);
}


// ─── AUTO HISTÓRICO ──────────────────────────────────────────────────────────
// Gera entradas automáticas no histórico baseado em mudanças detectadas
function autoHistorico(oldProp, newProp) {
  const hoje = new Date().toISOString().split("T")[0];
  const hist = [...(newProp.historico || [])];
  const existeId = (id) => hist.some(h => h.id === id);

  // 1. Obras concluídas — gera entrada quando status muda para Concluída
  const oldObras = oldProp?.obras || [];
  const newObras = newProp.obras || [];
  newObras.forEach(obra => {
    if (obra.status === "Concluída") {
      const obraid = "obra_" + obra.id;
      if (!existeId(obraid)) {
        hist.push({
          id: obraid, tipo: "Reforma/CAPEX",
          data: obra.fim || hoje,
          titulo: obra.label || obra.tipo || "Obra concluída",
          descricao: [obra.descricao, obra.executado ? "Custo: R$ " + Number(obra.executado).toLocaleString("pt-BR") : null].filter(Boolean).join(" — "),
          valor: Number(obra.executado) || Number(obra.orcado) || 0,
          auto: true,
        });
      }
    }
  });

  // 2. Troca de locatário — detecta mudança no nome
  const oldNome = oldProp?.locatarioNome || "";
  const newNome = newProp.locatarioNome || "";
  if (newNome && newNome !== oldNome) {
    const locid = "loc_" + newNome.replace(/\s+/g,"_").toLowerCase() + "_" + hoje;
    if (!existeId(locid)) {
      hist.push({
        id: locid, tipo: "Início de Locação",
        data: newProp.contratoInicio || hoje,
        titulo: "Novo locatário: " + newNome,
        descricao: [
          newProp.rent ? "Aluguel: " + new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(newProp.rent) + "/mês" : null,
          newProp.contratoAnos ? "Contrato: " + newProp.contratoAnos + " mês(es)" : null,
          newProp.locatarioGarantia ? "Garantia: " + newProp.locatarioGarantia : null,
        ].filter(Boolean).join(" · "),
        valor: (newProp.rent || 0) * 12,
        auto: true,
      });
    }
  }

  // 3. Avaliação de mercado — quando valorMercado muda
  const oldVM = oldProp?.valorMercado || 0;
  const newVM = newProp.valorMercado || 0;
  if (newVM > 0 && newVM !== oldVM) {
    const avalid = "aval_" + hoje;
    if (!existeId(avalid)) {
      hist.push({
        id: avalid, tipo: "Valorização/Avaliação",
        data: hoje,
        titulo: "Avaliação de mercado registrada",
        descricao: "Valor: " + new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(newVM) +
          (oldVM > 0 ? " (anterior: " + new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(oldVM) + ")" : ""),
        valor: newVM,
        auto: true,
      });
    }
  }

  // 4. Compra do imóvel — se valorCompra foi preenchido pela primeira vez
  const oldVC = oldProp?.valorCompra || 0;
  const newVC = newProp.valorCompra || 0;
  if (newVC > 0 && oldVC === 0) {
    const compraid = "compra_" + (newProp.anoCompra || hoje);
    if (!existeId(compraid)) {
      hist.push({
        id: compraid, tipo: "Compra",
        data: newProp.anoCompra ? newProp.anoCompra + "-01-01" : hoje,
        titulo: "Imóvel adquirido",
        descricao: "Valor de compra: " + new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(newVC),
        valor: newVC,
        auto: true,
      });
    }
  }

  return { ...newProp, historico: hist.sort((a,b) => b.data.localeCompare(a.data)) };
}

function recalcProp(prop, BENCHMARKS) {
  const bm = getBenchmark(prop.city, prop.type) || BENCHMARKS["São Paulo"]["Residencial"];
  const annualRent = (prop.rent || 0) * 12;
  const descontoAnual = (prop.descontoAluguel || 0) * 12;
  const vacancyCost = Math.round(((prop.rent || 0) / 30) * (prop.vacancyDays || 0));
  const totalIncome = annualRent - vacancyCost - descontoAnual; // receita bruta ajustada

  // Custo mensal real de vacância: tudo que o proprietário perde/continua pagando sem receber
  const vacancyCostMonthly = prop.status === "Vago"
    ? Math.round(
        (prop.rent || 0) +
        (prop.iptu || 0) / (prop.iptuParcelas || 1) +
        (prop.maintMonthly || 0) +
        (prop.insurance || 0) / 12 +
        (prop.fundoReserva || 0) +
        (prop.chamadaExtra || 0) +
        (prop.hasCondominio ? (prop.condoFee || 0) : 0)
      )
    : 0;

  // Condomínio: fundo + chamada sempre do proprietário; condo mensal sempre inquilino
  const condoAnnual = prop.hasCondominio ? ((prop.fundoReserva||0) + (prop.chamadaExtra||0)) * 12 : 0;

  // Admin calculado sobre aluguel líquido (após desconto)
  const adminRecalc = prop.adminPct != null
    ? Math.round(((prop.rent||0) - (prop.descontoAluguel||0)) * (prop.adminPct / 100))
    : (prop.admin || 0);

  // IPTU: despesa do proprietário (paga à vista), restituído pelo inquilino
  // Aqui no anual: saída = iptu, entrada = restituição pelo inquilino (se ocupado)
  const iptuSaida = prop.iptu || 0;
  const iptuEntrada = (prop.status === "Ocupado") ? (prop.iptu || 0) : 0; // 100% restituído se ocupado

  const totalExpenses = iptuSaida + (prop.maintMonthly||0)*12 + (prop.insurance||0) + adminRecalc*12 + condoAnnual;
  const receitaBruta = totalIncome + iptuEntrada; // inclui restituição IPTU
  const noi = receitaBruta - totalExpenses;
  const noiPct = noi / (receitaBruta || 1);

  // IR: deduções PF = admin + IPTU + condomínio pago pelo proprietário
  const deducoesPF = adminRecalc*12 + iptuSaida + condoAnnual;
  const ir = calcIR(receitaBruta, totalExpenses, prop.regimeFiscal || "PF", deducoesPF);
  const lucroLiquido = noi - ir;

  // Aluguel líquido: valor mensal real no bolso após todas as deduções
  const iptuMensal = (prop.iptu||0) / (prop.iptuParcelas||1);
  const aluguelLiquido = prop.viaImobiliaria
    ? (prop.rent||0) - (prop.descontoAluguel||0) - adminRecalc - iptuMensal - (prop.maintMonthly||0) - (prop.insurance||0)/12 - ((prop.fundoReserva||0) + (prop.chamadaExtra||0)) - ir/12
    : (prop.rent||0) - (prop.descontoAluguel||0) - iptuMensal - (prop.maintMonthly||0) - (prop.insurance||0)/12 - ((prop.fundoReserva||0) + (prop.chamadaExtra||0)) - ir/12;
  const lucroLiquidoPct = lucroLiquido / (receitaBruta || 1);
  const iptuBenchmark = Math.round(bm.iptu_m2 * (prop.size||0));
  const iptuDelta = iptuBenchmark > 0 ? Math.round(((prop.iptu||0) - iptuBenchmark) / iptuBenchmark * 100) : 0;
  const maintBenchmark = Math.round(bm.maintenance_annual_m2 * (prop.size||0) / 12);
  const maintDelta = maintBenchmark > 0 ? Math.round(((prop.maintMonthly||0) - maintBenchmark) / maintBenchmark * 100) : 0;
  const vacancyDelta = (prop.vacancyDays||0) - bm.vacancy_days;
  let leakage = 0;
  if (prop.vacancyDays > bm.vacancy_days) leakage += Math.min(35, vacancyDelta * 0.5);
  if (maintDelta > 30) leakage += Math.min(20, maintDelta * 0.4);
  if (noiPct < 0.5) leakage += 20;
  leakage = Math.min(98, Math.max(2, Math.round(leakage)));
  return { ...prop, vacancyCost, vacancyCostMonthly, totalIncome, receitaBruta, aluguelLiquido, adminRecalc, condoAnnual, totalExpenses, noi, noiPct, ir, lucroLiquido, lucroLiquidoPct, iptuBenchmark, iptuDelta, maintBenchmark, maintDelta, vacancyBenchmark: bm.vacancy_days, vacancyDelta, leakage };
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged
  const [page, setPage] = useState("dashboard");
  const [selectedProp, setSelectedProp] = useState(null);
  const [highlightPagPropId, setHighlightPagPropId] = useState(null);
  const [props, setPropsRaw] = useState([]);
  const [portfolioId, setPortfolioId] = useState(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [obrasProps, setObrasProps] = useState(null);
  const [addingImovel, setAddingImovel] = useState(false);
  const [deletingProp, setDeletingProp] = useState(null);
  const [cancelandoProp, setCancelandoProp] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gb_theme") === "dark";
    return false;
  });
  const [themeKey, setThemeKey] = useState(0);
  // Apply theme globally on every render
  Object.assign(T, darkMode ? DARK_T : LIGHT_T);
  useEffect(() => { applyTheme(darkMode ? DARK_T : LIGHT_T); }, [darkMode]);

  // Check session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data when user logs in
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!user || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      setDbLoading(true);
      // Get or create portfolio — always use the oldest one
      let { data: ports } = await supabase.from("portfolios").select("id").eq("user_id", user.id).order("created_at").limit(1);
      let port = ports?.[0] || null;
      if (!port) {
        const { data: newPort, error: createErr } = await supabase.from("portfolios").insert({ user_id: user.id, name: "Meu Portfólio" }).select("id").maybeSingle();
        if (createErr) { console.error("Erro ao criar portfólio:", createErr); setDbLoading(false); return; }
        port = newPort;
      }
      if (!port) { setDbLoading(false); return; }
      setPortfolioId(port.id);
      // Load imoveis
      const { data: rows, error: loadErr } = await supabase.from("imoveis").select("*").eq("portfolio_id", port.id).eq("user_id", user.id).order("created_at");
      if (loadErr) { console.error("Erro ao carregar imóveis:", loadErr); setDbLoading(false); return; }
      if (rows && rows.length > 0) {
        const mapped = rows.map(r => recalcProp({
          id: r.id, name: r.name, address: r.address||"", neighborhood: r.neighborhood||"",
          city: r.city||"São Paulo", type: r.type||"Residencial", status: r.status||"Ocupado",
          size: r.size||0, rent: r.rent||0, iptu: r.iptu||0, maintMonthly: r.maint_monthly||0,
          insurance: r.insurance||0, admin: r.admin||0, vacancyDays: r.vacancy_days||0,
          hasCondominio: r.has_condominio||false, condoFee: r.condo_fee||0,
          fundoReserva: r.fundo_reserva||0, chamadaExtra: r.chamada_extra||0, chamadaExtraParcelas: r.chamada_extra_parcelas||0, chamadaExtraParcelaAtual: r.chamada_extra_parcela_atual||0,
          descontoAluguel: r.desconto_aluguel||0, contratoAnos: r.contrato_anos||1,
          contratoInicio: r.contrato_inicio||"", marketValueManual: r.market_value_manual||0,
          valorMercado: r.valor_mercado||0, valorCompra: r.valor_compra||0, anoCompra: r.ano_compra||null,
          obras: r.obras||[], prestadores: r.prestadores||[], pagamentos: r.pagamentos||{},
          monthlyData: r.monthly_data||[], diaVencimento: r.dia_vencimento||10,
          proximoReajuste: r.proximo_reajuste||"",
          condoPagoPor: r.condo_pago_por||"proprietario",
          regimeFiscal: r.regime_fiscal||"PF",
          locatarios: r.locatarios||[], historico: r.historico||[],
          iptuVencimento: r.iptu_vencimento||"", iptuParcelas: r.iptu_parcelas||10, indiceReajuste: r.indice_reajuste||"IGPM", adminPct: r.admin_pct != null ? r.admin_pct : 8,
          iptuParcelasPagas: r.iptu_parcelas_pagas||[], condoMesesPagos: r.condo_meses_pagos||[],
          avaliacoes: r.avaliacoes||[], documentos: r.documentos||[], viaImobiliaria: r.via_imobiliaria||false, locatarioNome: r.locatario_nome||"", locatarioCPF: r.locatario_cpf||"", locatarioTelefone: r.locatario_telefone||"", locatarioEmail: r.locatario_email||"", locatarioGarantia: r.locatario_garantia||"Fiador",
        }, BENCHMARKS));
        setPropsRaw(mapped);
      }
      setDbLoading(false);
    })();
  }, [user]);

  const toDB = (prop) => ({
    portfolio_id: portfolioId, user_id: user.id,
    name: prop.name, address: prop.address, neighborhood: prop.neighborhood,
    city: prop.city, type: prop.type, status: prop.status, size: prop.size,
    rent: prop.rent, iptu: prop.iptu, maint_monthly: prop.maintMonthly,
    insurance: prop.insurance, admin: prop.admin, vacancy_days: prop.vacancyDays,
    has_condominio: prop.hasCondominio||false, condo_fee: prop.condoFee||0,
    fundo_reserva: prop.fundoReserva||0, chamada_extra: prop.chamadaExtra||0, chamada_extra_parcelas: prop.chamadaExtraParcelas||0, chamada_extra_parcela_atual: prop.chamadaExtraParcelaAtual||0,
    desconto_aluguel: prop.descontoAluguel||0, contrato_anos: prop.contratoAnos||1,
    contrato_inicio: prop.contratoInicio||null, market_value_manual: prop.marketValueManual||0,
    valor_mercado: prop.valorMercado||0, valor_compra: prop.valorCompra||0, ano_compra: prop.anoCompra||null,
    obras: prop.obras||[], prestadores: prop.prestadores||[], pagamentos: prop.pagamentos||{},
    monthly_data: prop.monthlyData||[], dia_vencimento: prop.diaVencimento||10,
    condo_pago_por: prop.condoPagoPor||"proprietario", regime_fiscal: prop.regimeFiscal||"PF", admin_pct: prop.adminPct != null ? Number(prop.adminPct) : 8,
    indice_reajuste: prop.indiceReajuste||"IGPM", iptu_vencimento: prop.iptuVencimento||null, iptu_parcelas: prop.iptuParcelas||10,
    avaliacoes: prop.avaliacoes||[], documentos: prop.documentos||[], via_imobiliaria: prop.viaImobiliaria||false, locatario_nome: prop.locatarioNome||"", locatario_cpf: prop.locatarioCPF||"", locatario_telefone: prop.locatarioTelefone||"", locatario_email: prop.locatarioEmail||"", locatario_garantia: prop.locatarioGarantia||"Fiador",
    locatarios: prop.locatarios||[], historico: prop.historico||[],
    iptu_parcelas_pagas: prop.iptuParcelasPagas||[], condo_meses_pagos: prop.condoMesesPagos||[],
  });

  const setProps = useCallback((updater) => {
    setPropsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  }, []);

  const handleAddImovel = async (newProp) => {
    if (!portfolioId || !user) { alert("portfolioId=" + portfolioId + " user=" + (user?.id||"null")); setAddingImovel(false); return; }
    const dbData = toDB({ ...newProp, avaliacoes: newProp.avaliacoes||[] });
    console.log("Inserting with portfolio_id:", dbData.portfolio_id, "user_id:", dbData.user_id);
    const { data, error } = await supabase.from("imoveis").insert(dbData).select().single();
    if (error) { console.error("Erro ao adicionar imóvel:", error); alert("Erro ao salvar: " + error.message + " | portfolio_id=" + dbData.portfolio_id); setAddingImovel(false); return; }
    if (data) {
      const withId = recalcProp({ ...newProp, id: data.id }, BENCHMARKS);
      setPropsRaw(prev => [...prev, withId]);
    }
    setAddingImovel(false);
  };

  const handleDeleteImovel = (prop) => setDeletingProp(prop);

  const handleCancelarContrato = (prop) => setCancelandoProp(prop);

  const confirmCancelarContrato = async ({ dataEntrega, vistoria, multaValor, multaMeses }) => {
    const prop = cancelandoProp;
    const isDesocupando = prop.status === "Em desocupação";
    const novoStatus = isDesocupando ? "Vago" : "Em desocupação";
    const eventoHistorico = isDesocupando
      ? { id: Date.now(), tipo: "Rescisão de Contrato", data: dataEntrega || new Date().toISOString().split("T")[0], titulo: "Entrega das chaves", descricao: `Vistoria concluída. Imóvel desocupado.`, valor: 0 }
      : { id: Date.now(), tipo: "Rescisão de Contrato", data: new Date().toISOString().split("T")[0], titulo: "Cancelamento de contrato", descricao: `Multa: ${multaMeses} meses (${fmt.brl(multaValor)}). Entrega prevista: ${dataEntrega || "a definir"}.`, valor: multaValor };
    const updated = {
      ...prop,
      status: novoStatus,
      desocupacaoDataEntrega: isDesocupando ? (dataEntrega || new Date().toISOString().split("T")[0]) : dataEntrega,
      desocupacaoVistoria: vistoria,
      historico: [...(prop.historico || []), eventoHistorico],
      ...(isDesocupando ? { locatarioNome: "", locatarioCPF: "", locatarioTelefone: "", locatarioEmail: "" } : {}),
    };
    await handleUpdateProps(props.map(p => p.id === prop.id ? updated : p));
    setCancelandoProp(null);
    if (isDesocupando) nav("noi");
  };

  const confirmDelete = async () => {
    await supabase.from("imoveis").delete().eq("id", deletingProp.id).eq("user_id", user.id);
    setPropsRaw(prev => prev.filter(p => p.id !== deletingProp.id));
    setDeletingProp(null);
    if (selectedProp?.id === deletingProp.id) { setSelectedProp(null); setPage("noi"); }
  };

  const handleSaveEdit = async (updatedProp) => {
    const oldProp = props.find(p => p.id === updatedProp.id);
    const withHist = autoHistorico(oldProp, updatedProp);
    const recalced = recalcProp(withHist, BENCHMARKS);
    await supabase.from("imoveis").update(toDB(recalced)).eq("id", recalced.id).eq("user_id", user.id);
    setPropsRaw(prev => prev.map(p => p.id === recalced.id ? recalced : p));
    setEditingProp(null);
    if (selectedProp?.id === recalced.id) setSelectedProp(recalced);
  };

  const handleSaveObras = async (updatedProp) => {
    const oldProp = props.find(p => p.id === updatedProp.id);
    const withHist = autoHistorico(oldProp, updatedProp);
    await supabase.from("imoveis").update({ obras: withHist.obras||[], prestadores: withHist.prestadores||[], historico: withHist.historico||[] }).eq("id", withHist.id).eq("user_id", user.id);
    setPropsRaw(prev => prev.map(p => p.id === withHist.id ? withHist : p));
    if (selectedProp?.id === withHist.id) setSelectedProp(withHist);
  };

  const handleUpdateProps = async (newPropsOrUpdater) => {
    const newProps = typeof newPropsOrUpdater === "function" ? newPropsOrUpdater(props) : newPropsOrUpdater;
    // Find changed props and save to Supabase
    newProps.forEach(async np => {
      const old = props.find(p => p.id === np.id);
      if (!old) return;
      if (JSON.stringify(old.pagamentos) !== JSON.stringify(np.pagamentos)) {
        await supabase.from("imoveis").update({ pagamentos: np.pagamentos }).eq("id", np.id).eq("user_id", user.id);
      }
      if (old.valorMercado !== np.valorMercado || old.valorCompra !== np.valorCompra || old.anoCompra !== np.anoCompra) {
        const withHistVM = autoHistorico(old, np);
        await supabase.from("imoveis").update({ valor_mercado: withHistVM.valorMercado||0, valor_compra: withHistVM.valorCompra||0, ano_compra: withHistVM.anoCompra||null, historico: withHistVM.historico||[], avaliacoes: withHistVM.avaliacoes||[] }).eq("id", np.id).eq("user_id", user.id);
        np.historico = withHistVM.historico;
      }
      if (JSON.stringify(old.locatarios) !== JSON.stringify(np.locatarios)) {
        await supabase.from("imoveis").update({ locatarios: np.locatarios||[] }).eq("id", np.id).eq("user_id", user.id);
      }
      if (JSON.stringify(old.historico) !== JSON.stringify(np.historico)) {
        await supabase.from("imoveis").update({ historico: np.historico||[] }).eq("id", np.id).eq("user_id", user.id);
      }
      if (JSON.stringify(old.iptuParcelasPagas) !== JSON.stringify(np.iptuParcelasPagas) ||
          JSON.stringify(old.condoMesesPagos) !== JSON.stringify(np.condoMesesPagos)) {
        await supabase.from("imoveis").update({ iptu_parcelas_pagas: np.iptuParcelasPagas||[], condo_meses_pagos: np.condoMesesPagos||[] }).eq("id", np.id).eq("user_id", user.id);
      }
    });
    setPropsRaw(newProps);
  };

  // Loading state
  if (user === undefined) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:T.gold, fontSize:22, fontWeight:800 }}>RENTLY</div>
    </div>
  );

  if (!user) return <Login onLogin={(u) => setUser(u)} />;

  if (dbLoading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ color:T.gold, fontSize:22, fontWeight:800 }}>RENTLY</div>
      <div style={{ color:T.muted, fontSize:14 }}>Carregando seu portfólio...</div>
    </div>
  );

  const nav = (p) => { setPage(p); if (p !== "detail") setSelectedProp(null); if (p !== "pagamentos") setHighlightPagPropId(null); };
  const handleEdit = (prop) => setEditingProp(props.find(p => p.id === prop.id) || prop);
  const nextId = props.length > 0 ? Math.max(...props.map(p => p.id)) + 1 : 1;

  const content = {
    dashboard: <PageDashboard PROPS={props} onNav={nav} onProp={setSelectedProp} onAdd={() => setAddingImovel(true)} />,
    noi:       <PageNOI PROPS={props} onProp={setSelectedProp} onNav={nav} onEdit={handleEdit} onObras={(prop) => setObrasProps(props.find(p => p.id === prop.id) || prop)} onDelete={handleDeleteImovel} onAdd={() => setAddingImovel(true)} />,
    obras:     <PageObras PROPS={props} onUpdateProps={handleUpdateProps} />,
    mercado:   <PageValorMercado PROPS={props} onUpdateProps={handleUpdateProps} />,
    leakage:   <PageLeakage PROPS={props} onNavPagamentos={(propId) => { setHighlightPagPropId(propId); nav("pagamentos"); }} />,
    decision:  <PageDecision PROPS={props} onProp={setSelectedProp} onNav={nav} />,
    detail:    <PageDetail prop={selectedProp} onBack={() => nav("noi")} onEdit={handleEdit} onObras={(prop) => setObrasProps(props.find(p => p.id === prop.id) || prop)} onDelete={handleDeleteImovel} onCancelarContrato={handleCancelarContrato} />,
    report:    <PageReport PROPS={props} />,
    ia:        <PageIA PROPS={props} />,
    pagamentos: <PagePagamentos PROPS={props} onUpdateProps={handleUpdateProps} highlightPropId={highlightPagPropId} />,
    iptu:      <PageIPTU PROPS={props} onUpdateProps={handleUpdateProps} />,
    fluxo:     <PageFluxoCaixa PROPS={props} />,
    locatarios: <PageLocatarios PROPS={props} onUpdateProps={handleUpdateProps} />,
    historico:  <PageHistorico PROPS={props} onUpdateProps={handleUpdateProps} />,
  }[page] || <PageDashboard PROPS={props} onNav={nav} onProp={setSelectedProp} onAdd={() => setAddingImovel(true)} />;

  return (
    <React.Fragment key={themeKey}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        body{margin:0;font-family:'Bricolage Grotesque',sans-serif;background:${T.bg};color:${T.text}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        select option{background:${T.s2}}
        input::placeholder{color:${T.dim}}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
      `}</style>

      {editingProp && <EditModal prop={editingProp} onSave={handleSaveEdit} onClose={() => setEditingProp(null)} userId={user?.id} />}
      {obrasProps && <ObrasModal prop={obrasProps} onSave={handleSaveObras} onClose={() => setObrasProps(null)} />}
      {addingImovel && <AddImovelModal nextId={nextId} onSave={handleAddImovel} onClose={() => setAddingImovel(false)} userId={user?.id} />}
      {deletingProp && <DeleteConfirmModal prop={deletingProp} onConfirm={confirmDelete} onClose={() => setDeletingProp(null)} />}
      {cancelandoProp && <CancelarContratoModal prop={cancelandoProp} onConfirm={confirmCancelarContrato} onClose={() => setCancelandoProp(null)} />}

      <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
        {/* Sidebar */}
        <div style={{ width: 230, background: T.s0, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100 }}>
          <div style={{ padding: "28px 22px 20px" }}>
            <div style={{ color: T.gold, fontSize: 17, fontWeight: 900, letterSpacing: -0.5 }}>RENTLY</div>
            <div style={{ color: T.dim, fontSize: 9, letterSpacing: 3, marginTop: 2 }}>PORTFOLIO INTELLIGENCE</div>
          </div>
          <div style={{ margin: "0 12px 16px", padding: "10px 14px", background: T.s1, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>PORTFÓLIO ATIVO</div>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{user?.user_metadata?.full_name || "Meu Portfólio"}</div>
            <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{props.length} imóveis</div>
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
            <div style={{ color: T.dim, fontSize: 11, marginBottom: 6 }}>{user?.email}</div>
            <button
              style={{ width: "100%", marginBottom: 8, padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.s2, color: T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onClick={() => { const next = !darkMode; const theme = next ? DARK_T : LIGHT_T; Object.assign(T, theme); applyTheme(theme); localStorage.setItem("gb_theme", next ? "dark" : "light"); setDarkMode(next); setThemeKey(k => k + 1); }}
            >
              <span>{darkMode ? "Modo Escuro" : "Modo Claro"}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>trocar</span>
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button style={{ color: T.dim, fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => supabase.auth.signOut()}>Sair →</button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ marginLeft: 230, flex: 1, padding: "32px 36px", minHeight: "100vh", maxWidth: "calc(100vw - 230px)" }}>
          {content}
        </div>
      </div>
    </React.Fragment>
  );
}
// cache bust Thu Mar 12 16:15:30 -03 2026
