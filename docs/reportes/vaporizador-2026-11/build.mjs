// Genera el PDF del reporte de producción y merma (28-oct al 17-nov-2026).
// Uso: node docs/reportes/vaporizador-2026-11/build.mjs

import { chromium } from "@playwright/test";

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const previewDir = path.join(process.env.TEMP ?? process.env.TMP ?? dir, "opencode", "reporte-vaporizador");
const pdfPath = path.join(dir, "Reporte-Produccion-y-Merma-28-oct-17-nov-2026.pdf");
const htmlPath = path.join(dir, "reporte.html");

// ---------------------------------------------------------------- datos
const TERMO = 208;
const CILINDRO = 8;

const isoA = {
  nombre: "ISO 28 oct",
  detalle: "cerrado el 4-nov",
  base: 13540,
  cierre: 5173,
  termos: 22,
  cilindros: 382,
};
const isoB = {
  nombre: "ISO 4 nov",
  detalle: "cerrado el 17-nov",
  base: 20350,
  cierre: 4115,
  termos: 41,
  cilindros: 715,
};

for (const iso of [isoA, isoB]) {
  iso.vendido = iso.termos * TERMO + iso.cilindros * CILINDRO;
  iso.merma = iso.base - iso.cierre - iso.vendido;
  iso.mermaPct = (iso.merma / iso.base) * 100;
}
assert.equal(isoA.vendido, 7632);
assert.equal(isoA.merma, 735);
assert.equal(isoB.vendido, 14248);
assert.equal(isoB.merma, 1987);

const total = {
  base: isoA.base + isoB.base,
  termos: isoA.termos + isoB.termos,
  cilindros: isoA.cilindros + isoB.cilindros,
  vendido: isoA.vendido + isoB.vendido,
  merma: isoA.merma + isoB.merma,
};
total.mermaPct = (total.merma / total.base) * 100;
total.consumido = total.vendido + total.merma;
total.mermaConsumidoPct = (total.merma / total.consumido) * 100;
assert.equal(total.vendido, 21880);
assert.equal(total.merma, 2722);

const cierreFoto = 5475;
const mermaFoto = isoA.base - cierreFoto - isoA.vendido;
const mermaFotoPct = (mermaFoto / isoA.base) * 100;
assert.equal(mermaFoto, 433);

// Llenados diarios del ISO 4-nov (5 al 17 de noviembre).
const dias = [
  { fecha: "Jue 5", dia: 5, registro: "2T + 76C + 3T", t: 5, c: 76 },
  { fecha: "Sáb 7", dia: 7, registro: "6T + 114C", t: 6, c: 114 },
  { fecha: "Lun 9", dia: 9, registro: "1T", t: 1, c: 0 },
  { fecha: "Mar 10", dia: 10, registro: "8T + 76C + 38C", t: 8, c: 114 },
  { fecha: "Mié 11", dia: 11, registro: "4T + 76C", t: 4, c: 76 },
  { fecha: "Jue 12", dia: 12, registro: "76C + 5T + 76C", t: 5, c: 152 },
  { fecha: "Vie 13", dia: 13, registro: "4T + 2T", t: 6, c: 0 },
  { fecha: "Sáb 14", dia: 14, registro: "107C", t: 0, c: 107 },
  { fecha: "Lun 16", dia: 16, registro: "3T + 76C + 3T", t: 6, c: 76 },
];
let acumulado = 0;
for (const d of dias) {
  d.kg = d.t * TERMO + d.c * CILINDRO;
  acumulado += d.kg;
  d.acum = acumulado;
  d.pct = (acumulado / isoB.vendido) * 100;
}
assert.equal(
  dias.reduce((s, d) => s + d.t, 0),
  isoB.termos,
);
assert.equal(
  dias.reduce((s, d) => s + d.c, 0),
  isoB.cilindros,
);
assert.equal(acumulado, isoB.vendido);

const kgTermos = total.termos * TERMO;
const kgCilindros = total.cilindros * CILINDRO;

// ---------------------------------------------------------------- formato
const nf = (n, d = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const kg = (n) => `${nf(n)} kg`;
const pct = (n, d = 1) => `${nf(n, d)}\u00A0%`;
const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");

// ---------------------------------------------------------------- SVG helpers
const S = (n) => Number(n.toFixed(1));
const text = (x, y, s, o = {}) =>
  `<text x="${S(x)}" y="${S(y)}" font-size="${o.size ?? 10}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? "#64748B"}" text-anchor="${o.anchor ?? "start"}"${o.ls ? ` letter-spacing="${o.ls}"` : ""}${o.halo ? ' paint-order="stroke" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"' : ""}>${s}</text>`;

const W = 760;

// Gráfico 1: lectura del reloj en el tiempo.
function timeline() {
  const H = 470;
  const L = 70;
  const R = 660;
  const T = 44;
  const B = 430;
  const x = (d) => L + (d / 21) * (R - L);
  const y = (v) => B - (v / 22000) * (B - T);

  const ticks = [0, 4000, 8000, 12000, 16000, 20000];
  const grid = ticks
    .map(
      (v) =>
        `<line x1="${L}" x2="${R}" y1="${S(y(v))}" y2="${S(y(v))}" stroke="#E6EDF4" stroke-width="1"/>` +
        text(L - 10, y(v) + 3.5, nf(v), { anchor: "end", size: 9.5, fill: "#94A3B8" }),
    )
    .join("");

  const xTicks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const xLabels = { 0: "28 oct", 2: "30", 4: "1 nov", 20: "17 nov" };
  const axisX = xTicks
    .map((d) => {
      const lx = x(d);
      const anchor = { 0: "start", 20: "end" }[d] ?? "middle";
      return (
        `<line x1="${S(lx)}" x2="${S(lx)}" y1="${B}" y2="${B + 5}" stroke="#CBD5E1"/>` +
        text(lx, B + 20, xLabels[d] ?? String(d < 4 ? 28 + d : d - 3), {
          anchor,
          size: 9.5,
          fill: xLabels[d] ? "#64748B" : "#94A3B8",
        })
      );
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lectura del reloj del tanque entre el 28 de octubre y el 17 de noviembre">
    <defs>
      <linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0F766E" stop-opacity=".16"/>
        <stop offset="1" stop-color="#0F766E" stop-opacity=".01"/>
      </linearGradient>
      <linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2563EB" stop-opacity=".14"/>
        <stop offset="1" stop-color="#2563EB" stop-opacity=".01"/>
      </linearGradient>
    </defs>

    <rect x="${S(x(0))}" y="${T}" width="${S(x(7) - x(0))}" height="${B - T}" fill="#0F766E" opacity=".025"/>
    <rect x="${S(x(7))}" y="${T}" width="${S(x(20.9) - x(7))}" height="${B - T}" fill="#2563EB" opacity=".025"/>

    ${grid}
    <line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="#CBD5E1"/>
    ${axisX}

    <path d="M ${S(x(0))} ${S(y(isoA.base))} L ${S(x(7))} ${S(y(isoA.cierre))} L ${S(x(7))} ${B} L ${S(x(0))} ${B} Z" fill="url(#fillA)"/>
    <path d="M ${S(x(7))} ${S(y(isoB.base))} L ${S(x(20.485))} ${S(y(isoB.cierre))} L ${S(x(20.485))} ${B} L ${S(x(7))} ${B} Z" fill="url(#fillB)"/>

    <line x1="${S(x(0))}" y1="${B}" x2="${S(x(7))}" y2="${S(y(isoA.cierre))}" stroke="#0F766E" stroke-width="2.6" stroke-linecap="round"/>
    <line x1="${S(x(7))}" y1="${S(y(isoB.base))}" x2="${S(x(20.485))}" y2="${S(y(isoB.cierre))}" stroke="#2563EB" stroke-width="2.6" stroke-linecap="round"/>

    <line x1="${S(x(7))}" y1="${S(y(isoA.cierre))}" x2="${S(x(7))}" y2="${S(y(isoB.base))}" stroke="#94A3B8" stroke-width="1.6" stroke-dasharray="4 4"/>
    <line x1="${S(x(20.485))}" y1="${S(y(isoB.cierre))}" x2="${S(x(20.705))}" y2="${S(y(20330))}" stroke="#94A3B8" stroke-width="1.6" stroke-dasharray="4 4"/>

    <line x1="${S(x(0.55))}" y1="${T}" x2="${S(x(0.55))}" y2="${B}" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="5 4" opacity=".85"/>
    <circle cx="${S(x(0.55))}" cy="${S(y(isoA.base))}" r="4.5" fill="#DC2626" stroke="#fff" stroke-width="2"/>
    <rect x="${S(x(0.55) + 10)}" y="10" width="190" height="24" rx="12" fill="#FEF2F2" stroke="#FECACA"/>
    ${text(x(0.55) + 24, 26, "Vaporizador dañado · 28 oct", { size: 10, fill: "#B91C1C", weight: 600 })}

    <circle cx="${S(x(0))}" cy="${S(y(isoA.base))}" r="4" fill="#0F766E" stroke="#fff" stroke-width="2"/>
    <circle cx="${S(x(7))}" cy="${S(y(isoA.cierre))}" r="4" fill="#0F766E" stroke="#fff" stroke-width="2"/>
    <circle cx="${S(x(7))}" cy="${S(y(isoB.base))}" r="4" fill="#2563EB" stroke="#fff" stroke-width="2"/>
    <circle cx="${S(x(20.485))}" cy="${S(y(isoB.cierre))}" r="4" fill="#2563EB" stroke="#fff" stroke-width="2"/>
    <circle cx="${S(x(20.705))}" cy="${S(y(20330))}" r="4" fill="#94A3B8" stroke="#fff" stroke-width="2"/>

    ${text(x(0) + 22, y(isoA.base) - 22, "Base ISO 28-oct", { size: 9.5, fill: "#0F766E", weight: 600, halo: true })}
    ${text(x(0) + 22, y(isoA.base) - 8, kg(isoA.base), { size: 12, fill: "#0B1B2B", weight: 700, halo: true })}

    ${text(x(7) - 16, y(isoA.cierre) + 40, "Cierre 4-nov", { size: 9.5, fill: "#0F766E", weight: 600, anchor: "end", halo: true })}
    ${text(x(7) - 16, y(isoA.cierre) + 54, kg(isoA.cierre), { size: 11, fill: "#0B1B2B", weight: 700, anchor: "end", halo: true })}

    ${text(x(7) - 10, y(isoB.base) + 2, "Base ISO 4-nov · 20.350 kg", { size: 10.5, fill: "#1E40AF", weight: 700, anchor: "end" })}

    ${text(x(20.485) - 8, y(isoB.cierre) + 22, "Cierre 17-nov · 11:39", { size: 9.5, fill: "#1D4ED8", weight: 600, anchor: "end" })}
    ${text(x(20.485) - 8, y(isoB.cierre) + 36, kg(isoB.cierre), { size: 11, fill: "#0B1B2B", weight: 700, anchor: "end" })}

    <line x1="${S(x(20.705))}" y1="${S(y(20330) - 5)}" x2="${S(x(20.705))}" y2="38" stroke="#94A3B8" stroke-width="1"/>
    ${text(x(20.705) - 4, 34, "17-nov 16:51 · nuevo ISO 20.330 kg", { size: 9.5, fill: "#475569", weight: 600, anchor: "end" })}

  </svg>`;
}

// Gráfico 2: merma por ISO frente al rango histórico.
function mermaBand() {
  const H = 150;
  const L = 118;
  const R = 690;
  const x = (p) => L + (p / 20) * (R - L);
  const rows = [
    { label: "ISO 28 oct", value: isoA.mermaPct, color: "#0F766E", y: 50 },
    { label: "ISO 4 nov", value: isoB.mermaPct, color: "#2563EB", y: 80 },
    { label: "Período", value: total.mermaPct, color: "#0B1B2B", y: 110 },
  ];
  const ticks = [0, 5, 10, 15, 20];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Merma de cada ISO frente al rango histórico de 12 a 17 por ciento">
    <rect x="${S(x(12))}" y="32" width="${S(x(17) - x(12))}" height="92" fill="#E2E8F0" opacity=".7" rx="3"/>
    ${text(x(14.5), 26, "Rango histórico ago–oct · 12–17 %", { size: 9.5, fill: "#64748B", weight: 600, anchor: "middle" })}
    <line x1="${L}" x2="${R}" y1="124" y2="124" stroke="#E2E8F0"/>
    ${ticks
      .map(
        (t) =>
          `<line x1="${S(x(t))}" x2="${S(x(t))}" y1="124" y2="128" stroke="#CBD5E1"/>` +
          text(x(t), 144, `${t} %`, { anchor: "middle", size: 9, fill: "#94A3B8" }),
      )
      .join("")}
    ${rows
      .map((r) => {
        return (
          text(L - 14, r.y + 4, r.label, { anchor: "end", size: 10, fill: "#475569", weight: 600 }) +
          `<line x1="${L}" x2="${R}" y1="${r.y}" y2="${r.y}" stroke="#F1F5F9"/>` +
          `<line x1="${S(x(0))}" x2="${S(x(r.value))}" y1="${r.y}" y2="${r.y}" stroke="${r.color}" stroke-width="2" opacity=".25"/>` +
          `<circle cx="${S(x(r.value))}" cy="${r.y}" r="6" fill="${r.color}" stroke="#fff" stroke-width="2.5"/>` +
          text(x(r.value) + 12, r.y + 4, pct(r.value), {
            size: 11,
            fill: r.color,
            weight: 700,
          })
        );
      })
      .join("")}
  </svg>`;
}

// Gráfico 3: kilogramos vendidos por día (eje continuo, 5 al 17 de noviembre).
function dailyBars() {
  const H = 300;
  const L = 58;
  const R = 742;
  const T = 26;
  const B = 238;
  const max = 3000;
  const x = (d) => L + ((d - 4.6) / (17.4 - 4.6)) * (R - L);
  const y = (v) => B - (v / max) * (B - T);
  const bw = 26;
  const ticks = [0, 1000, 2000, 3000];
  const maxDia = dias.reduce((a, b) => (b.kg > a.kg ? b : a));
  const dayLabels = { 5: "5 nov", 17: "17 nov" };
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilogramos vendidos por día entre el 5 y el 17 de noviembre">
    ${ticks
      .map(
        (v) =>
          `<line x1="${L}" x2="${R}" y1="${S(y(v))}" y2="${S(y(v))}" stroke="#E6EDF4"/>` +
          text(L - 10, y(v) + 3.5, nf(v), { anchor: "end", size: 9.5, fill: "#94A3B8" }),
      )
      .join("")}
    <line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="#CBD5E1"/>
    <line x1="${L}" x2="${R}" y1="${S(y(1042))}" y2="${S(y(1042))}" stroke="#D97706" stroke-width="1.4" stroke-dasharray="6 4"/>
    ${dias
      .map((d) => {
        const bx = x(d.dia) - bw / 2;
        const by = y(d.kg);
        const bh = B - by;
        const nearAvg = Math.abs(by - 8 - y(1042)) < 14;
        return (
          `<rect x="${S(bx)}" y="${S(by)}" width="${bw}" height="${S(bh)}" rx="2.5" fill="#2563EB" opacity="${d === maxDia ? "1" : ".82"}"/>` +
          (nearAvg
            ? `<rect x="${S(x(d.dia) - 18)}" y="${S(by - 21)}" width="36" height="15" rx="3" fill="#FFFFFF"/>`
            : "") +
          text(x(d.dia), by - 8, nf(d.kg), {
            anchor: "middle",
            size: 9,
            fill: "#1E3A8A",
            weight: 700,
            halo: true,
          })
        );
      })
      .join("")}
    ${[6, 8, 15].map((d) => `<circle cx="${S(x(d))}" cy="${B - 3}" r="2.5" fill="#CBD5E1"/>`).join("")}
    ${[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
      .map((d) =>
        text(x(d), B + 20, dayLabels[d] ?? String(d), {
          anchor: "middle",
          size: 9.5,
          fill: [6, 8, 15].includes(d) ? "#CBD5E1" : "#64748B",
        }),
      )
      .join("")}
  </svg>`;
}

// ---------------------------------------------------------------- páginas
const rowIso = (iso) => `
  <tr>
    <td>
      <span class="cell-strong">${iso.nombre}</span>
      <span class="cell-sub">${iso.detalle}</span>
    </td>
    <td class="num">${nf(iso.base)}</td>
    <td class="num">${nf(iso.cierre)}</td>
    <td class="num">${nf(iso.termos)}</td>
    <td class="num">${nf(iso.cilindros)}</td>
    <td class="num">${nf(iso.vendido)}</td>
    <td class="num">${nf(iso.merma)}</td>
    <td class="num cell-pct">${pct(iso.mermaPct)}</td>
  </tr>`;

const page1 = `
<section class="page">
  <div class="masthead">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
        <rect width="44" height="44" rx="10" fill="#0B1B2B"/>
        <circle cx="22" cy="22" r="11.5" fill="none" stroke="#14B8A6" stroke-width="2.4"/>
        <text x="22" y="26.8" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff" font-family="Segoe UI, Arial">O₂</text>
      </svg>
      <div>
        <div class="brand-name">MEDOXIGAS</div>
        <div class="brand-sub">ALC, SRL · Planta de oxígeno medicinal</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="meta-strong">Reporte interno</div>
      <div>Operaciones · 17 de noviembre de 2026</div>
    </div>
  </div>

  <div class="eyebrow"><span class="eyebrow-rule"></span>Producción y merma · período del daño del vaporizador</div>
  <h1>Reporte de Producción<br>y Merma</h1>
  <p class="lede">28 de octubre – 17 de noviembre de 2026 · ISOs del 28-oct y 4-nov · 21 días de operación</p>
  <p class="intro">Reconstrucción del ciclo del tanque de LOX (oxígeno líquido) con las lecturas del reloj, los cierres de ISO y los llenados diarios, para medir si la merma aumentó tras el daño del vaporizador.</p>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Base acumulada</div>
      <div class="kpi-value">${nf(total.base)}<span class="unit">kg</span></div>
      <div class="kpi-note">Bases de ambos ISO</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Vendido</div>
      <div class="kpi-value">${nf(total.vendido)}<span class="unit">kg</span></div>
      <div class="kpi-note">${total.termos} termos · ${nf(total.cilindros)} cilindros</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Merma</div>
      <div class="kpi-value">${nf(total.merma)}<span class="unit">kg</span></div>
      <div class="kpi-note">${nf(isoA.merma)} kg + ${nf(isoB.merma)} kg</div>
    </div>
    <div class="kpi kpi-good">
      <div class="kpi-label">Merma del período</div>
      <div class="kpi-value">${nf(total.mermaPct, 1)}<span class="unit">%</span></div>
      <div class="kpi-note"><span class="dot-ok"></span>Por debajo del 12–17 %</div>
    </div>
  </div>

  <div class="block-head">
    <h2>Producción y merma por ISO</h2>
    <span>Cifras en kilogramos · 1 termo = 208 kg · 1 cilindro = 8 kg</span>
  </div>
  <table class="data">
    <thead>
      <tr>
        <th>ISO</th>
        <th class="num">Base</th>
        <th class="num">Cierre</th>
        <th class="num">Termos</th>
        <th class="num">Cilindros</th>
        <th class="num">Vendido</th>
        <th class="num">Merma</th>
        <th class="num">Merma %</th>
      </tr>
    </thead>
    <tbody>
      ${rowIso(isoA)}
      ${rowIso(isoB)}
    </tbody>
    <tfoot>
      <tr>
        <td><span class="cell-strong">Total del período</span><span class="cell-sub">21 días · 28-oct al 17-nov</span></td>
        <td class="num">${nf(total.base)}</td>
        <td class="num muted">—</td>
        <td class="num">${nf(total.termos)}</td>
        <td class="num">${nf(total.cilindros)}</td>
        <td class="num">${nf(total.vendido)}</td>
        <td class="num">${nf(total.merma)}</td>
        <td class="num cell-pct">${pct(total.mermaPct)}</td>
      </tr>
    </tfoot>
  </table>
  <p class="table-note">El cierre del ISO 28-oct usa el registro de la aplicación (5.173 kg); la última foto del reloj leía 5.475 kg. Ver el análisis de sensibilidad en la página 4.</p>

  <div class="conclusion">
    <div class="conclusion-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="#14B8A6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="conclusion-text">
      <div class="conclusion-label">Conclusión del análisis</div>
      <div class="conclusion-title">El daño del vaporizador no aumentó la merma.</div>
      <p>Ambos cierres quedaron por debajo del rango histórico de 12–17 %: el ISO 28-oct, activo al momento del daño, registró <strong>${pct(isoA.mermaPct)}</strong> —el valor más bajo documentado— y el ISO 4-nov, <strong>${pct(isoB.mermaPct)}</strong>. La producción continuó con normalidad hasta el 16-nov.</p>
    </div>
    <div class="conclusion-metric">
      <div class="metric-big">${nf(total.mermaPct, 1)}<span>%</span></div>
      <div class="metric-cap">merma del período</div>
      <div class="metric-vs">vs. 12–17 % histórico</div>
    </div>
  </div>

  <div class="band-block">
    <div class="block-head tight">
      <h2>Merma por ISO frente al rango histórico</h2>
      <span>Porcentaje de la base de cada ISO</span>
    </div>
    ${mermaBand()}
  </div>

  <footer class="foot">
    <span>MEDOXIGAS ALC, SRL · Documento interno</span>
    <span>Producción y merma · 28 oct – 17 nov 2026</span>
    <span>Página 1 de 4</span>
  </footer>
</section>`;

const page2 = `
<section class="page">
  <div class="runhead">
    <div class="rbrand">
      <span class="rlogo">O₂</span>
      <span>MEDOXIGAS</span>
    </div>
    <span>Reporte de Producción y Merma · 28 oct – 17 nov 2026</span>
  </div>

  <div class="section-head">
    <div class="section-num">01</div>
    <div>
      <div class="eyebrow small">Lectura del tanque</div>
      <h2 class="section-title">El reloj, día por día</h2>
      <p class="section-sub">Kilogramos de LOX en el tanque según las lecturas registradas. El cambio de ISO se ve como un salto vertical: el tanque se rellena y vuelve a arrancar el conteo.</p>
    </div>
  </div>

  <div class="chart-card">
    <div class="chart-head">
      <div>
        <div class="chart-title">Lectura del reloj del tanque</div>
        <div class="chart-sub">28 de octubre – 17 de noviembre de 2026</div>
      </div>
      <div class="legend">
        <span><i class="sw sw-a"></i>ISO 28 oct</span>
        <span><i class="sw sw-b"></i>ISO 4 nov</span>
        <span><i class="sw sw-event"></i>Vaporizador dañado</span>
      </div>
    </div>
    ${timeline()}
  </div>

  <div class="mini-grid">
    <div class="mini">
      <div class="mini-label">ISO 28-oct</div>
      <div class="mini-value">13.540 <span>→</span> 5.173</div>
      <div class="mini-note">Base − cierre: 8.367 kg</div>
    </div>
    <div class="mini">
      <div class="mini-label">Cambio de ISO · 4-nov</div>
      <div class="mini-value">5.173 <span>→</span> 20.350</div>
      <div class="mini-note">Entrada de 15.177 kg de LOX</div>
    </div>
    <div class="mini">
      <div class="mini-label">ISO 4-nov</div>
      <div class="mini-value">20.350 <span>→</span> 4.115</div>
      <div class="mini-note">Base − cierre: 16.235 kg</div>
    </div>
  </div>

  <div class="recon">
    <div class="block-head tight">
      <h2>Conciliación del tanque</h2>
      <span>Base = vendido + merma + cierre</span>
    </div>
    <div class="recon-legend">
      <span><i class="sw sw-sold"></i>Vendido</span>
      <span><i class="sw sw-loss"></i>Merma</span>
      <span><i class="sw sw-rest"></i>Cierre (queda en el tanque)</span>
    </div>
    ${[
      ["ISO 28 oct", isoA],
      ["ISO 4 nov", isoB],
    ]
      .map(([nombre, iso]) => {
        const vendidoPct = (iso.vendido / iso.base) * 100;
        const mermaPct = (iso.merma / iso.base) * 100;
        const cierrePct = (iso.cierre / iso.base) * 100;
        return `<div class="recon-row">
          <div class="recon-name">${nombre}</div>
          <div class="recon-track">
            <span class="seg seg-sold" style="width:${vendidoPct}%"><b>${nf(iso.vendido)}</b><em>vendido</em></span>
            <span class="seg seg-loss" style="width:${mermaPct}%"><b>${nf(iso.merma)}</b></span>
            <span class="seg seg-rest" style="width:${cierrePct}%"><b>${nf(iso.cierre)}</b><em>cierre</em></span>
          </div>
          <div class="recon-total"><b>${nf(iso.base)}</b><span>base</span></div>
        </div>`;
      })
      .join("")}
    <p class="recon-note">La barra representa la base de cada ISO (100 %). La merma es la diferencia que no se vendió ni quedó en el tanque al cerrar. Ambas conciliaciones cuadran al kilogramo.</p>
  </div>

  <footer class="foot">
    <span>MEDOXIGAS ALC, SRL · Documento interno</span>
    <span>Nota: la unión entre lecturas es lineal; no reconstruye el consumo diario.</span>
    <span>Página 2 de 4</span>
  </footer>
</section>`;

const page3 = `
<section class="page">
  <div class="runhead">
    <div class="rbrand">
      <span class="rlogo">O₂</span>
      <span>MEDOXIGAS</span>
    </div>
    <span>Reporte de Producción y Merma · 28 oct – 17 nov 2026</span>
  </div>

  <div class="section-head">
    <div class="section-num">02</div>
    <div>
      <div class="eyebrow small">Llenados diarios</div>
      <h2 class="section-title">El ritmo de despacho del ISO 4-nov</h2>
      <p class="section-sub">Del 5 al 17 de noviembre se despacharon ${isoB.termos} termos y ${nf(isoB.cilindros)} cilindros: ${kg(isoB.vendido)}. El ISO 28-oct no tiene detalle diario; se registra como bloque de ${kg(isoA.vendido)} entre el 28-oct y el 4-nov.</p>
    </div>
  </div>

  <div class="chart-card">
    <div class="chart-head">
      <div>
        <div class="chart-title">Kilogramos vendidos por día</div>
        <div class="chart-sub">Eje continuo del 5 al 17 de noviembre · los días sin barra no registraron llenados</div>
      </div>
      <div class="legend">
        <span><i class="sw sw-b"></i>ISO 4 nov</span>
        <span><i class="sw sw-avg"></i>Promedio 1.042 kg/día</span>
      </div>
    </div>
    ${dailyBars()}
  </div>

  <div class="block-head">
    <h2>Detalle de llenados</h2>
    <span>Registro original · conversión a kilogramos</span>
  </div>
  <table class="data compact">
    <thead>
      <tr>
        <th>Fecha (nov)</th>
        <th>Registro</th>
        <th class="num">Termos</th>
        <th class="num">Cilindros</th>
        <th class="num">Vendido kg</th>
        <th class="num">Acumulado kg</th>
        <th class="num">Acum. %</th>
      </tr>
    </thead>
    <tbody>
      ${dias
        .map(
          (d) => `<tr>
            <td class="cell-strong">${d.fecha}</td>
            <td class="cell-mono">${esc(d.registro)}</td>
            <td class="num">${d.t || "—"}</td>
            <td class="num">${d.c || "—"}</td>
            <td class="num">${nf(d.kg)}</td>
            <td class="num">${nf(d.acum)}</td>
            <td class="num cell-pct-soft">${nf(d.pct)}</td>
          </tr>`,
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr>
        <td><span class="cell-strong">ISO 4-nov</span></td>
        <td class="cell-mono muted">9 días con llenado</td>
        <td class="num">${isoB.termos}</td>
        <td class="num">${nf(isoB.cilindros)}</td>
        <td class="num">${nf(isoB.vendido)}</td>
        <td class="num">${nf(isoB.vendido)}</td>
        <td class="num cell-pct-soft">100</td>
      </tr>
    </tfoot>
  </table>

  <div class="mini-grid four">
    <div class="mini">
      <div class="mini-label">Promedio con llenado</div>
      <div class="mini-value">${nf(isoB.vendido / dias.length)}<span> kg/día</span></div>
      <div class="mini-note">${dias.length} días · ISO 4-nov</div>
    </div>
    <div class="mini">
      <div class="mini-label">Día máximo</div>
      <div class="mini-value">2.576<span> kg</span></div>
      <div class="mini-note">10-nov · 8 T + 114 C</div>
    </div>
    <div class="mini">
      <div class="mini-label">Días sin llenado</div>
      <div class="mini-value">4<span> días</span></div>
      <div class="mini-note">6, 8, 15 y 17-nov</div>
    </div>
    <div class="mini">
      <div class="mini-label">Reparto por peso</div>
      <div class="mini-value">${nf((kgTermos / total.vendido) * 100)} / ${nf((kgCilindros / total.vendido) * 100)}<span> %</span></div>
      <div class="mini-note">termos / cilindros</div>
    </div>
  </div>

  <div class="mixbar" aria-hidden="true">
    <span class="mix-a" style="width:${(kgTermos / total.vendido) * 100}%">Termos · ${kg(kgTermos)}</span>
    <span class="mix-b" style="width:${(kgCilindros / total.vendido) * 100}%">Cilindros · ${kg(kgCilindros)}</span>
  </div>

  <footer class="foot">
    <span>MEDOXIGAS ALC, SRL · Documento interno</span>
    <span>Conversiones: 1 termo = 208 kg · 1 cilindro = 8 kg</span>
    <span>Página 3 de 4</span>
  </footer>
</section>`;

const page4 = `
<section class="page">
  <div class="runhead">
    <div class="rbrand">
      <span class="rlogo">O₂</span>
      <span>MEDOXIGAS</span>
    </div>
    <span>Reporte de Producción y Merma · 28 oct – 17 nov 2026</span>
  </div>

  <div class="section-head">
    <div class="section-num">03</div>
    <div>
      <div class="eyebrow small">Hallazgos y recomendaciones</div>
      <h2 class="section-title">Lo que dicen los números</h2>
      <p class="section-sub">Cuatro lecturas del período y las acciones sugeridas para que el próximo cierre de ISO sea verificable sin discusiones.</p>
    </div>
  </div>

  <div class="findings">
    <article class="finding">
      <div class="fnum">01</div>
      <h3>La merma no subió por el vaporizador</h3>
      <p>El ISO activo al momento del daño cerró en <strong>${pct(isoA.mermaPct)}</strong>, el registro más bajo del que se tiene evidencia. El ISO siguiente cerró en <strong>${pct(isoB.mermaPct)}</strong>.</p>
    </article>
    <article class="finding">
      <div class="fnum">02</div>
      <h3>Ambos ISO, debajo del histórico</h3>
      <p>El rango documentado de agosto a octubre es <strong>12–17 %</strong>. Los dos cierres del período quedaron por debajo del piso de ese rango.</p>
    </article>
    <article class="finding">
      <div class="fnum">03</div>
      <h3>La operación siguió a ritmo normal</h3>
      <p>${kg(total.vendido)} vendidos en 21 días (<strong>1.042 kg/día</strong>). El último llenado registrado, el 16-nov, fue de 1.856 kg.</p>
    </article>
    <article class="finding">
      <div class="fnum">04</div>
      <h3>El cierre del 28-oct depende del registro</h3>
      <p>La app registra 5.173 kg; la última foto del reloj leía 5.475 kg. Con la foto, la merma sería <strong>433 kg (3,2 %)</strong>.</p>
    </article>
  </div>

  <div class="sens">
    <div class="sens-head">
      <div>
        <div class="s-label">Sensibilidad · cierre del ISO 28 oct</div>
        <div class="s-title">La conclusión se mantiene con cualquiera de las dos lecturas</div>
      </div>
      <div class="s-badge">Ambas &lt; 12 %</div>
    </div>
    <div class="sens-grid">
      <div class="sens-cell">
        <div class="s-k">Cierre según la app</div>
        <div class="s-v">5.173 kg</div>
        <div class="s-r">735 kg de merma · ${pct(isoA.mermaPct)}</div>
      </div>
      <div class="sens-arrow">→</div>
      <div class="sens-cell">
        <div class="s-k">Cierre según la última foto</div>
        <div class="s-v">5.475 kg</div>
        <div class="s-r">433 kg de merma · ${pct(mermaFotoPct)}</div>
      </div>
      <div class="sens-note">302 kg de diferencia entre ambos registros. No cambian el sentido del análisis: la merma sigue por debajo del 12 %.</div>
    </div>
  </div>

  <div class="block-head tight">
    <h2>Recomendaciones</h2>
    <span>Para el próximo período</span>
  </div>
  <ol class="recs">
    <li><span class="rn">1</span><div><strong>Fijar hora y frecuencia de la foto.</strong> Una lectura diaria y una segunda el día de llenado, con el mismo ángulo y el reloj completo en el encuadre.</div></li>
    <li><span class="rn">2</span><div><strong>Registrar la hora exacta del cambio de ISO</strong> y la lectura antes y después de la descarga. Es el dato que evita el salto “huérfano” del gráfico.</div></li>
    <li><span class="rn">3</span><div><strong>Documentar la reparación del vaporizador</strong> (fecha, diagnóstico y repuestos). No está en estos datos y es la pieza que falta para atribuir la merma.</div></li>
    <li><span class="rn">4</span><div><strong>Conciliar base − vendido − merma = cierre en cada cierre de ISO.</strong> Si no cuadra, buscar la lectura faltante antes de abrir el ISO siguiente.</div></li>
    <li><span class="rn">5</span><div><strong>Conservar la foto del último reloj como respaldo del cierre.</strong> El caso 5.173 vs 5.475 muestra por qué la app y la foto deben coincidir.</div></li>
  </ol>

  <div class="method">
    <div class="m-title">Método y fuentes</div>
    <div class="m-grid">
      <div><span class="m-k">Fórmula</span><span class="m-v">merma = (base − cierre − vendido) / base × 100</span></div>
      <div><span class="m-k">Conversiones</span><span class="m-v">1 termo = 208 kg · 1 cilindro = 8 kg</span></div>
      <div><span class="m-k">Fuente</span><span class="m-v">Lecturas del reloj, cierres de ISO y llenados del 28-oct al 17-nov-2026</span></div>
      <div><span class="m-k">Criterio del total</span><span class="m-v">% sobre la suma de bases (33.890 kg). Sobre LOX consumido (24.602 kg) sería ${pct(total.mermaConsumidoPct)}; ambos criterios quedan bajo 12 %</span></div>
      <div><span class="m-k">Alcance</span><span class="m-v">No incluye el nuevo ISO cargado el 17-nov a las 16:51 ni la merma posterior</span></div>
    </div>
  </div>

  <div class="verdict">
    <div class="v-label">Dictamen</div>
    <p>Con la evidencia disponible, el daño del vaporizador <strong>no explica un aumento de la merma</strong>: ambos ISO cerraron por debajo del piso del rango histórico (12&nbsp;%).</p>
  </div>

  <div class="sign">
    <div class="sign-cell"><span>Elaborado por</span><i></i></div>
    <div class="sign-cell"><span>Revisado por</span><i></i></div>
    <div class="sign-cell"><span>Fecha</span><i></i></div>
    <div class="sign-stamp">MEDOXIGAS<br><b>Operaciones</b></div>
  </div>

  <footer class="foot">
    <span>MEDOXIGAS ALC, SRL · Documento interno</span>
    <span>Elaborado el 17 de noviembre de 2026 · Datos del período 28-oct al 17-nov</span>
    <span>Página 4 de 4</span>
  </footer>
</section>`;

// ---------------------------------------------------------------- CSS
const css = `
@page{size:A4;margin:0}
:root{
  --ink:#0B1B2B; --ink-2:#1E293B; --muted:#64748B; --soft:#94A3B8;
  --line:#E2E8F0; --paper:#FFFFFF; --wash:#F8FAFC;
  --teal:#0F766E; --teal-2:#14B8A6; --teal-wash:#F0FDFA;
  --blue:#2563EB; --amber:#B45309; --red:#DC2626;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{
  background:#fff;color:var(--ink);
  font-family:"Segoe UI","Segoe UI Variable Text",system-ui,-apple-system,Arial,sans-serif;
  font-size:9.5pt;line-height:1.45;font-variant-numeric:tabular-nums;
}
.page{
  position:relative;width:210mm;height:297mm;padding:14mm 15mm 10mm;
  background:var(--paper);display:flex;flex-direction:column;overflow:hidden;
  page-break-after:always;break-after:page;
}
.page:last-child{page-break-after:auto;break-after:auto}
.page::before{content:"";position:absolute;top:0;left:0;right:0;height:2mm;background:var(--ink)}
.page::after{content:"";position:absolute;top:0;left:0;width:42mm;height:2mm;background:var(--teal-2)}

/* cabecera de portada */
.masthead{display:flex;justify-content:space-between;align-items:center;padding-bottom:4mm;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:3.5mm}
.brand-mark{width:11mm;height:11mm;display:block}
.brand-name{font-size:14pt;font-weight:700;letter-spacing:.12em;line-height:1.1}
.brand-sub{font-size:7.5pt;color:var(--muted);margin-top:.6mm}
.doc-meta{text-align:right;font-size:7.5pt;color:var(--muted);line-height:1.5}
.meta-strong{font-size:8pt;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:.12em}

.eyebrow{display:flex;align-items:center;gap:2.5mm;margin-top:7mm;font-size:7.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--teal)}
.eyebrow.small{margin-top:0;font-size:7pt;color:var(--teal)}
.eyebrow-rule{display:inline-block;width:7mm;height:1.4px;background:var(--teal-2)}
h1{font-size:27pt;line-height:1.12;letter-spacing:-.02em;font-weight:700;margin-top:2.4mm}
.lede{margin-top:2.2mm;font-size:10.5pt;font-weight:600;color:#334155}
.intro{margin-top:2.4mm;font-size:9pt;color:var(--muted);max-width:158mm;line-height:1.5}

/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-top:5mm}
.kpi{border:1px solid var(--line);border-radius:3mm;padding:3.4mm 3.6mm 3.2mm;background:#fff}
.kpi-label{font-size:6.8pt;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
.kpi-value{margin-top:1.2mm;font-size:16.5pt;font-weight:700;letter-spacing:-.02em;line-height:1.1}
.kpi-value .unit{font-size:8.5pt;font-weight:600;color:var(--muted);margin-left:1.2mm;letter-spacing:0}
.kpi-note{margin-top:1mm;font-size:7pt;color:var(--muted);line-height:1.35}
.kpi-good{background:var(--teal-wash);border-color:#99F6E4}
.kpi-good .kpi-value{color:var(--teal)}
.dot-ok{display:inline-block;width:1.6mm;height:1.6mm;border-radius:50%;background:#10B981;margin-right:1mm;vertical-align:.2mm}

/* encabezados de bloque */
.block-head{display:flex;justify-content:space-between;align-items:baseline;gap:6mm;margin:5.5mm 0 2.2mm}
.block-head.tight{margin-top:5mm;margin-bottom:1.6mm}
.block-head h2{font-size:11.5pt;font-weight:700;letter-spacing:-.01em}
.block-head span{font-size:7.2pt;color:var(--soft);text-align:right}

/* tabla contable */
table.data{width:100%;border-collapse:collapse;font-size:8.6pt}
table.data thead th{
  padding:1.7mm 2mm 1.7mm;text-align:left;font-size:6.8pt;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted);border-top:1.2px solid var(--ink);border-bottom:1px solid var(--ink);
  white-space:nowrap;
}
table.data tbody td{padding:2.3mm 2mm;border-bottom:1px solid var(--line);vertical-align:middle}
table.data tbody tr:nth-child(even){background:#FBFDFE}
table.data tfoot td{padding:2.4mm 2mm;border-top:1.2px solid var(--ink);font-weight:700;background:#F8FAFC}
table.data .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
table.data .cell-strong{display:block;font-weight:600}
table.data .cell-sub{display:block;font-size:7pt;color:var(--soft);font-weight:400;margin-top:.2mm}
table.data .cell-pct{font-weight:700;color:var(--teal)}
table.data .cell-pct-soft{font-weight:600;color:#475569}
table.data .muted{color:var(--soft)}
table.data .cell-mono{font-family:Consolas,"Cascadia Mono",monospace;font-size:7.8pt;color:#475569;letter-spacing:.01em}
table.data.compact tbody td{padding:1.65mm 2mm}
table.data.compact tfoot td{padding:1.9mm 2mm}
.table-note{margin-top:2.2mm;font-size:6.9pt;color:var(--soft);line-height:1.45}

/* conclusión */
.conclusion{
  margin-top:4mm;background:var(--ink);color:#fff;border-radius:3mm;padding:4.6mm 5mm;
  display:flex;align-items:flex-start;gap:4mm;position:relative;overflow:hidden;
}
.conclusion-icon{flex:none;width:8.5mm;height:8.5mm;border-radius:50%;border:1.4px solid rgba(20,184,166,.55);display:flex;align-items:center;justify-content:center;margin-top:.3mm;background:rgba(20,184,166,.12)}
.conclusion-icon svg{width:4.6mm;height:4.6mm}
.conclusion-text{flex:1;min-width:0}
.conclusion-label{font-size:6.8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#5EEAD4}
.conclusion-title{font-size:13pt;font-weight:700;letter-spacing:-.01em;margin-top:.8mm;line-height:1.2}
.conclusion-text p{margin-top:1.4mm;font-size:8.5pt;line-height:1.45;color:#CBD5E1;max-width:118mm}
.conclusion-text strong{color:#fff;font-weight:700}
.conclusion-metric{flex:none;text-align:right;padding-left:5mm;border-left:1px solid rgba(255,255,255,.16);position:relative;z-index:1}
.metric-big{font-size:21pt;font-weight:700;color:#5EEAD4;line-height:1;letter-spacing:-.02em}
.metric-big span{font-size:10pt;margin-left:.4mm}
.metric-cap{font-size:6.6pt;text-transform:uppercase;letter-spacing:.1em;color:#94A3B8;margin-top:1.2mm}
.metric-vs{font-size:6.8pt;color:#64748B;margin-top:.8mm}

/* banda histórica */
.band-block{margin-top:4.5mm}
.band-block .block-head{margin-top:0;margin-bottom:1mm}
.band-block svg{width:100%;height:auto;display:block}

/* cabecera de páginas interiores */
.runhead{display:flex;justify-content:space-between;align-items:center;padding-bottom:3mm;border-bottom:1px solid var(--line);font-size:7.2pt;color:var(--soft);letter-spacing:.04em}
.rbrand{display:flex;align-items:center;gap:2mm;font-weight:700;color:var(--ink);letter-spacing:.14em;font-size:8pt}
.rlogo{width:6.4mm;height:6.4mm;border-radius:1.6mm;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-size:6pt;font-weight:700;letter-spacing:0;border:1.2px solid var(--teal-2)}

.section-head{display:flex;gap:4.5mm;align-items:flex-start;margin-top:6.5mm}
.section-num{font-size:9pt;font-weight:700;color:var(--teal-2);border:1.2px solid #99F6E4;background:var(--teal-wash);border-radius:2mm;padding:1.2mm 2mm;line-height:1;margin-top:.6mm}
.section-title{font-size:19pt;line-height:1.15;letter-spacing:-.02em;font-weight:700;margin-top:1mm}
.section-sub{font-size:8.6pt;color:var(--muted);margin-top:1.6mm;max-width:156mm;line-height:1.5}

/* tarjeta de gráfico */
.chart-card{border:1px solid var(--line);border-radius:3mm;padding:3.6mm 4.5mm 2.6mm;margin-top:4.5mm;background:#fff}
.chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:5mm;margin-bottom:1mm}
.chart-title{font-size:10pt;font-weight:700}
.chart-sub{font-size:7.2pt;color:var(--soft);margin-top:.6mm}
.legend{display:flex;gap:4.5mm;font-size:7.2pt;color:var(--muted);flex-wrap:wrap;justify-content:flex-end}
.legend span{display:inline-flex;align-items:center;gap:1.4mm;white-space:nowrap}
.sw{width:3.4mm;height:1.4mm;border-radius:1mm;display:inline-block}
.sw-a{background:var(--teal)}
.sw-b{background:var(--blue)}
.sw-event{background:repeating-linear-gradient(90deg,#DC2626 0 1mm,transparent 1mm 2mm);height:.9mm}
.sw-sold{background:var(--teal)}
.sw-loss{background:var(--red)}
.sw-rest{background:#CBD5E1}
.sw-avg{background:repeating-linear-gradient(90deg,#D97706 0 1mm,transparent 1mm 2mm);height:.9mm}
.chart-card svg{width:100%;height:auto;display:block}

/* mini tarjetas */
.mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:4mm}
.mini-grid.four{grid-template-columns:repeat(4,1fr);margin-top:3.6mm}
.mini{border:1px solid var(--line);border-radius:2.6mm;padding:2.8mm 3.2mm;background:var(--wash)}
.mini-label{font-size:6.6pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.mini-value{font-size:12pt;font-weight:700;letter-spacing:-.01em;margin-top:.8mm;line-height:1.15}
.mini-value span{font-size:8pt;color:var(--muted);font-weight:600}
.mini-note{font-size:6.8pt;color:var(--soft);margin-top:.7mm}

/* conciliación */
.recon{margin-top:5mm}
.recon-legend{display:flex;gap:5mm;font-size:7pt;color:var(--muted);margin-bottom:2.2mm}
.recon-legend span{display:inline-flex;align-items:center;gap:1.4mm}
.recon-row{display:grid;grid-template-columns:24mm 1fr 22mm;align-items:center;gap:3mm;margin-bottom:2.4mm}
.recon-name{font-size:8pt;font-weight:600;color:#334155}
.recon-track{display:flex;height:8.2mm;border-radius:1.6mm;overflow:hidden;background:#F1F5F9}
.seg{display:flex;align-items:center;gap:1mm;padding:0 2mm;overflow:hidden;white-space:nowrap;font-size:7pt}
.seg b{font-weight:700}
.seg em{font-style:normal;font-size:6.4pt;opacity:.85}
.seg-sold{background:var(--teal);color:#fff}
.seg-loss{background:var(--red);color:#fff;justify-content:center;padding:0}
.seg-rest{background:#E2E8F0;color:#334155;justify-content:flex-end}
.recon-total{text-align:right;line-height:1.15}
.recon-total b{display:block;font-size:10pt}
.recon-total span{font-size:6.4pt;text-transform:uppercase;letter-spacing:.08em;color:var(--soft)}
.recon-note{font-size:7pt;color:var(--soft);margin-top:1.4mm;line-height:1.5;max-width:160mm}

/* hallazgos */
.findings{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:5mm}
.finding{border:1px solid var(--line);border-radius:2.6mm;padding:3.6mm 4mm;position:relative;background:#fff}
.finding:nth-child(1){border-top:2px solid var(--teal-2)}
.fnum{position:absolute;top:3.4mm;right:4mm;font-size:8pt;font-weight:700;color:#CBD5E1;letter-spacing:.06em}
.finding h3{font-size:10pt;font-weight:700;line-height:1.25;padding-right:8mm}
.finding p{font-size:8pt;color:var(--muted);margin-top:1.6mm;line-height:1.5}
.finding strong{color:var(--ink);font-weight:700}

/* sensibilidad */
.sens{margin-top:4mm;border:1px solid #BAE6FD;border-radius:3mm;background:#F0F9FF;padding:3.8mm 4.4mm}
.sens-head{display:flex;justify-content:space-between;align-items:flex-start;gap:5mm}
.s-label{font-size:6.6pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0369A1}
.s-title{font-size:9.6pt;font-weight:700;margin-top:.6mm}
.s-badge{font-size:6.8pt;font-weight:700;color:#047857;background:#D1FAE5;border:1px solid #A7F3D0;border-radius:10mm;padding:1mm 2.6mm;white-space:nowrap}
.sens-grid{display:flex;align-items:center;gap:4mm;margin-top:2.8mm}
.sens-cell{flex:1;background:#fff;border:1px solid #E0F2FE;border-radius:2.2mm;padding:2.2mm 3mm}
.s-k{font-size:6.6pt;color:#0369A1;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.s-v{font-size:12pt;font-weight:700;margin-top:.4mm}
.s-r{font-size:7pt;color:var(--muted);margin-top:.2mm}
.sens-arrow{color:#7DD3FC;font-size:12pt;font-weight:700}
.sens-note{flex:1.1;font-size:7.2pt;color:#0C4A6E;line-height:1.5}

/* recomendaciones */
ol.recs{list-style:none;counter-reset:none;display:flex;flex-direction:column;gap:2.2mm}
ol.recs li{display:flex;gap:2.8mm;align-items:flex-start;font-size:8.1pt;color:var(--muted);line-height:1.45}
ol.recs li strong{color:var(--ink);font-weight:600}
.rn{flex:none;width:4.6mm;height:4.6mm;border-radius:50%;background:var(--teal-wash);border:1px solid #99F6E4;color:var(--teal);font-size:6.6pt;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:.2mm}

/* método */
.method{margin-top:4.5mm;border-top:1px solid var(--line);padding-top:3mm}
.m-title{font-size:7pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:2mm}
.m-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.6mm 8mm}
.m-grid > div{display:flex;gap:2.4mm;font-size:7.2pt;line-height:1.4}
.m-k{flex:none;width:25mm;color:var(--soft);font-weight:600}
.m-v{color:#475569}

/* dictamen */
.verdict{margin-top:4mm;border-left:2.6px solid var(--teal-2);background:var(--wash);padding:2.6mm 4mm 2.8mm;border-radius:0 2mm 2mm 0}
.v-label{font-size:6.6pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--teal)}
.verdict p{font-size:8.4pt;color:#475569;margin-top:.8mm;line-height:1.45}
.verdict strong{color:var(--ink);font-weight:700}

/* firma */
.sign{display:flex;align-items:flex-end;gap:8mm;margin-top:auto;padding-top:5mm}.sign-cell{flex:1}
.sign-cell span{display:block;font-size:6.6pt;text-transform:uppercase;letter-spacing:.1em;color:var(--soft)}
.sign-cell i{display:block;border-bottom:1px solid #CBD5E1;height:7mm}
.sign-stamp{flex:none;text-align:right;font-size:6.4pt;letter-spacing:.12em;color:var(--soft);line-height:1.4}
.sign-stamp b{display:block;font-size:7.2pt;color:var(--muted);letter-spacing:.14em}

/* mix */
.mixbar{display:flex;height:8mm;border-radius:1.6mm;overflow:hidden;margin-top:3.2mm;font-size:7pt;font-weight:600;color:#fff}
.mixbar span{display:flex;align-items:center;padding:0 3mm}
.mix-a{background:var(--teal)}
.mix-b{background:var(--blue)}

/* pie */
.foot{margin-top:auto;padding-top:3mm;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:5mm;font-size:6.6pt;color:var(--soft);line-height:1.35}
.foot span:nth-child(2){text-align:center}

@media print{body{background:#fff}}
`;

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte de Producción y Merma — Período del daño del vaporizador (28 oct – 17 nov 2026)</title>
<meta name="author" content="MEDOXIGAS ALC, SRL">
<meta name="description" content="Producción y merma de LOX durante el período del daño del vaporizador (28-oct al 17-nov-2026).">
<style>${css}</style>
</head>
<body>
${page1}
${page2}
${page3}
${page4}
</body>
</html>`;

await mkdir(dir, { recursive: true });
await mkdir(previewDir, { recursive: true });
await writeFile(htmlPath, html, "utf8");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto(`file:///${htmlPath.replaceAll("\\", "/")}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  const pages = page.locator(".page");
  const count = await pages.count();
  for (let i = 0; i < count; i++) {
    await pages.nth(i).screenshot({ path: path.join(previewDir, `page-${i + 1}.png`) });
  }

  await page.pdf({
    path: pdfPath,
    printBackground: true,
    preferCSSPageSize: true,
  });
} finally {
  await browser.close();
}

const size = (await readFile(pdfPath)).length;
const out = [
  `HTML: ${htmlPath}`,
  `PDF:  ${pdfPath} (${(size / 1024).toFixed(0)} KB)`,
  `Previews: ${previewDir}`,
  `Resumen: vendido ${nf(total.vendido)} kg · merma ${nf(total.merma)} kg (${pct(total.mermaPct)}) · sobre consumido ${pct(total.mermaConsumidoPct)}`,
];
process.stdout.write(`${out.join("\n")}\n`);
