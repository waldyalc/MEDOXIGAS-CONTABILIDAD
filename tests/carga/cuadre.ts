import type { SupabaseClient } from "@supabase/supabase-js";

import { cargarEntorno, clientesAutenticados, escribir } from "./_comun";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Prueba 3 — cuadre contable. Réplica EXACTA de docs/pruebas/cuadre.sql
// (15 chequeos: A1-A7 absolutos, D1-D6 delta, I1-I2 informativos) pero vía
// PostgREST: se bajan las tablas y se calcula en JS. Solo lectura.
// I2 (pg_database_size) no existe en la API de datos: queda "no medible por API"
// y la corrida autoritativa la hace Waldy en el SQL Editor de Supabase.
//
// Dinero: todas las columnas son numeric(14,2); se convierten a centavos
// enteros (Math.round(Number(x)*100)) antes de sumar para no arrastrar
// errores de flotante. round(x,2) del SQL equivale a comparar centavos.

const TAM_PAGINA = 1000;
const LIMITE_ASIENTO_LINEAS = 400_000;

const CLAVES = ["cxc", "cxp", "inventario", "itbis_por_pagar", "itbis_adelantado"] as const;
type Clave = (typeof CLAVES)[number];

interface RespuestaConsulta<T> {
  data: T[] | null;
  error: { message: string } | null;
}

async function paginar<T>(
  fn: (desde: number, hasta: number) => PromiseLike<RespuestaConsulta<T>>,
  etiqueta: string,
): Promise<T[]> {
  const todo: T[] = [];
  for (let d = 0; ; d += TAM_PAGINA) {
    const { data, error } = await fn(d, d + TAM_PAGINA - 1);
    if (error) throw new Error(`${etiqueta}: ${error.message}`);
    const filas = data ?? [];
    todo.push(...filas);
    if (filas.length < TAM_PAGINA) break;
    if (todo.length % (TAM_PAGINA * 20) === 0) escribir(`${etiqueta}: ${todo.length} filas...`);
  }
  return todo;
}

async function conteoExacto(cli: SupabaseClient, tabla: string): Promise<number> {
  const { count, error } = await cli.from(tabla).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${tabla}: ${error.message}`);
  return count ?? 0;
}

function centavos(x: number | string | null | undefined): number {
  if (x === null || x === undefined) return 0;
  return Math.round(Number(x) * 100);
}

// Unidades con 2 decimales a partir de centavos; null se propaga (el SQL
// devuelve NULL cuando la clave no está en config_contable).
function aUnidades(c: number | null): number | null {
  if (c === null) return null;
  const u = c / 100;
  return u === 0 ? 0 : u;
}

function sumarNulo(a: number | null, b: number): number | null {
  return a === null ? null : a + b;
}

function restarNulo(a: number | null, b: number): number | null {
  return a === null ? null : a - b;
}

interface ConfigRow {
  clave: string;
  cuenta_id: string;
}

interface ReversaRow {
  id: string;
  anula_asiento_id: string | null;
}

interface LineaRow {
  asiento_id: string;
  cuenta_id: string;
  debito: number | string;
  credito: number | string;
}

interface FacturaRow {
  id: string;
  estado: string;
  ncf: string;
  contacto_id: string;
  asiento_id: string | null;
  notas: string | null;
  total: number | string;
  pagado: number | string;
  credito: number | string;
  retenido: number | string;
  itbis: number | string;
}

interface FacturaProvRow {
  id: string;
  estado: string;
  total: number | string;
  pagado: number | string;
  credito: number | string;
  retenido: number | string;
  itbis: number | string;
}

interface ProductoRow {
  id: string;
  nombre: string;
  cantidad: number | string;
  costo: number | string;
  inventariable: boolean;
}

interface ExistenciaRow {
  producto_id: string;
  cantidad: number | string;
}

interface NotaCreditoRow {
  estado: string;
  itbis: number | string;
}

interface ContactoRow {
  id: string;
  nombre: string;
}

interface GrupoNcf {
  min: bigint;
  max: bigint;
  valores: Set<bigint>;
}

async function main() {
  const raiz = resolve(__dirname, "..", "..");
  const entorno = cargarEntorno(raiz);
  const [cli] = await clientesAutenticados(entorno);
  if (!cli) throw new Error("sin cliente");

  // -- 0. Conteos exactos (head) antes de bajar nada ------------------------
  const tablas = [
    "config_contable",
    "asientos",
    "asiento_lineas",
    "facturas",
    "facturas_proveedor",
    "productos",
    "existencias",
    "notas_credito_venta",
    "contactos",
  ] as const;
  const entradas = await Promise.all(tablas.map(async (t) => [t, await conteoExacto(cli, t)] as const));
  const conteos = Object.fromEntries(entradas) as Record<(typeof tablas)[number], number>;
  for (const t of tablas) escribir(`count ${t}: ${conteos[t]}`);

  // Counts con los MISMOS filtros que las descargas (subconjuntos): sirven
  // para verificar que la paginación no se truncó ni duplicó filas.
  const [nConfigClaves, nReversas, nContactosZz] = await Promise.all([
    cli
      .from("config_contable")
      .select("*", { count: "exact", head: true })
      .in("clave", [...CLAVES]),
    cli.from("asientos").select("*", { count: "exact", head: true }).not("anula_asiento_id", "is", null),
    cli.from("contactos").select("*", { count: "exact", head: true }).like("nombre", "ZZTEST-%"),
  ]);
  for (const [nombre, res] of [
    ["config_contable(claves)", nConfigClaves],
    ["asientos(anula no nulo)", nReversas],
    ["contactos ZZTEST-%", nContactosZz],
  ] as const) {
    if (res.error) throw new Error(`count ${nombre}: ${res.error.message}`);
    escribir(`count ${nombre}: ${res.count ?? 0}`);
  }
  const conteosFiltrados = {
    config_contable: nConfigClaves.count ?? 0,
    asientos_reversas: nReversas.count ?? 0,
    contactos_zztest: nContactosZz.count ?? 0,
  };

  const nLineas = conteos.asiento_lineas;
  if (nLineas > LIMITE_ASIENTO_LINEAS) {
    const salida = {
      abortado: true,
      motivo: `asiento_lineas tiene ${nLineas} filas (> ${LIMITE_ASIENTO_LINEAS}); no se baja la tabla sin avisar`,
      conteos,
    };
    const dir = resolve(raiz, "docs", "pruebas", "resultados");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "cuadre-despues.json"), `${JSON.stringify(salida, null, 2)}\n`);
    escribir(`ABORTADO: ${salida.motivo}`);
    process.exit(2);
  }

  // -- 1. Descargas (solo lectura, paginadas de a 1000) ---------------------
  const [config, reversas, contactosZz, lineas, facturas, compras, productos, existencias, notasCredito] =
    await Promise.all([
      paginar<ConfigRow>(
        (d, h) =>
          cli
            .from("config_contable")
            .select("clave, cuenta_id")
            .in("clave", [...CLAVES])
            .order("clave")
            .range(d, h),
        "config_contable",
      ),
      paginar<ReversaRow>(
        (d, h) =>
          cli
            .from("asientos")
            .select("id, anula_asiento_id")
            .not("anula_asiento_id", "is", null)
            .order("id")
            .range(d, h),
        "asientos(anula_asiento_id no nulo)",
      ),
      paginar<ContactoRow>(
        (d, h) => cli.from("contactos").select("id, nombre").like("nombre", "ZZTEST-%").order("id").range(d, h),
        "contactos ZZTEST-%",
      ),
      paginar<LineaRow>(
        (d, h) => cli.from("asiento_lineas").select("asiento_id, cuenta_id, debito, credito").order("id").range(d, h),
        "asiento_lineas",
      ),
      paginar<FacturaRow>(
        (d, h) =>
          cli
            .from("facturas")
            .select("id, estado, ncf, contacto_id, asiento_id, notas, total, pagado, credito, retenido, itbis")
            .order("id")
            .range(d, h),
        "facturas",
      ),
      paginar<FacturaProvRow>(
        (d, h) =>
          cli
            .from("facturas_proveedor")
            .select("id, estado, total, pagado, credito, retenido, itbis")
            .order("id")
            .range(d, h),
        "facturas_proveedor",
      ),
      paginar<ProductoRow>(
        (d, h) => cli.from("productos").select("id, nombre, cantidad, costo, inventariable").order("id").range(d, h),
        "productos",
      ),
      paginar<ExistenciaRow>(
        (d, h) =>
          cli.from("existencias").select("producto_id, cantidad").order("producto_id").order("almacen_id").range(d, h),
        "existencias",
      ),
      paginar<NotaCreditoRow>(
        (d, h) => cli.from("notas_credito_venta").select("estado, itbis").order("id").range(d, h),
        "notas_credito_venta",
      ),
    ]);

  // Verificación: lo descargado debe coincidir con el count exacto (la base
  // está quieta: las pruebas de carga ya terminaron). Si no cuadra, los
  // números no son confiables y se aborta.
  const filasPorTabla: Record<string, number> = {
    config_contable_5_claves: config.length,
    asientos_con_reverso: reversas.length,
    contactos_zztest: contactosZz.length,
    asiento_lineas: lineas.length,
    facturas: facturas.length,
    facturas_proveedor: compras.length,
    productos: productos.length,
    existencias: existencias.length,
    notas_credito_venta: notasCredito.length,
  };
  const avisos: string[] = [];
  const esperadas: [string, number | undefined, number][] = [
    ["config_contable", conteosFiltrados.config_contable, config.length],
    ["asientos_reversas", conteosFiltrados.asientos_reversas, reversas.length],
    ["contactos_zztest", conteosFiltrados.contactos_zztest, contactosZz.length],
    ["asiento_lineas", conteos.asiento_lineas, lineas.length],
    ["facturas", conteos.facturas, facturas.length],
    ["facturas_proveedor", conteos.facturas_proveedor, compras.length],
    ["productos", conteos.productos, productos.length],
    ["existencias", conteos.existencias, existencias.length],
    ["notas_credito_venta", conteos.notas_credito_venta, notasCredito.length],
  ];
  for (const [t, esperado, real] of esperadas) {
    if (esperado !== undefined && real !== esperado) avisos.push(`${t}: count=${esperado} descargadas=${real}`);
  }
  if (avisos.length > 0) throw new Error(`descarga incompleta o duplicada: ${avisos.join("; ")}`);

  // -- 2. Cálculo de los 15 chequeos ---------------------------------------

  // Mayor por cuenta y A1 (asientos descuadrados), en centavos.
  const saldoPorAsiento = new Map<string, number>();
  const saldoPorCuenta = new Map<string, number>();
  for (const l of lineas) {
    const d = centavos(l.debito) - centavos(l.credito);
    saldoPorAsiento.set(l.asiento_id, (saldoPorAsiento.get(l.asiento_id) ?? 0) + d);
    saldoPorCuenta.set(l.cuenta_id, (saldoPorCuenta.get(l.cuenta_id) ?? 0) + d);
  }
  let A1 = 0;
  for (const s of saldoPorAsiento.values()) {
    if (s !== 0) A1++;
  }

  // Saldos del mayor por clave de config_contable (null si la clave no existe).
  const cuentasPorClave = new Map<Clave, string[]>();
  for (const c of config) {
    if ((CLAVES as readonly string[]).includes(c.clave)) {
      const k = c.clave as Clave;
      cuentasPorClave.set(k, [...(cuentasPorClave.get(k) ?? []), c.cuenta_id]);
    }
  }
  const saldoMayor = new Map<Clave, number | null>();
  for (const k of CLAVES) {
    const ids = cuentasPorClave.get(k);
    saldoMayor.set(k, ids === undefined ? null : ids.reduce((acc, id) => acc + (saldoPorCuenta.get(id) ?? 0), 0));
  }
  const saldo = (k: Clave): number | null => saldoMayor.get(k) ?? null;

  // Asientos de reverso (anula_asiento_id) para A5.
  const reversos = new Set<string>();
  for (const r of reversas) {
    if (r.anula_asiento_id !== null) reversos.add(r.anula_asiento_id);
  }

  // Contactos ZZTEST-% para I1 (equivale al JOIN + LIKE del SQL).
  const contactosZzIds = new Set(contactosZz.map((c) => c.id));

  let A2 = 0;
  let A4 = 0;
  let A5 = 0;
  let A7 = 0;
  let I1 = 0;
  let saldoFacCents = 0;
  let itbisFacCents = 0;
  const a2PorEstado = new Map<string, number>();
  let a2Zztest = 0;
  let a2SinPago = 0;
  const a2Muestras: {
    id: string;
    ncf: string;
    estado: string;
    notas: string | null;
    zztest: boolean;
    saldo: number;
    total: number;
    pagado: number;
    credito: number;
    retenido: number;
  }[] = [];
  const ncfVeces = new Map<string, number>();
  const ncfB = new Map<string, GrupoNcf>();

  for (const f of facturas) {
    const saldoFac = centavos(f.total) - centavos(f.pagado) - centavos(f.credito) - centavos(f.retenido);
    const noAnulada = f.estado !== "anulada";
    if (noAnulada) {
      if (saldoFac < 0) {
        A2++;
        a2PorEstado.set(f.estado, (a2PorEstado.get(f.estado) ?? 0) + 1);
        const esZz = contactosZzIds.has(f.contacto_id);
        if (esZz) a2Zztest++;
        if (f.notas?.includes("SINPAGO")) a2SinPago++;
        if (a2Muestras.length < 8) {
          a2Muestras.push({
            id: f.id,
            ncf: f.ncf,
            estado: f.estado,
            notas: f.notas === null ? null : f.notas.slice(0, 80),
            zztest: esZz,
            saldo: saldoFac / 100,
            total: centavos(f.total) / 100,
            pagado: centavos(f.pagado) / 100,
            credito: centavos(f.credito) / 100,
            retenido: centavos(f.retenido) / 100,
          });
        }
      }
      if ((f.estado === "pagada" && saldoFac > 0) || (f.estado === "abierta" && saldoFac <= 0)) A4++;
      saldoFacCents += saldoFac;
      itbisFacCents += centavos(f.itbis);
    }
    if (f.estado === "anulada" && f.asiento_id !== null && !reversos.has(f.asiento_id)) A5++;
    if (contactosZzIds.has(f.contacto_id)) I1++;

    // A7: cuenta valores de ncf repetidos (todas las facturas, como el SQL).
    ncfVeces.set(f.ncf, (ncfVeces.get(f.ncf) ?? 0) + 1);

    // D1: ncf ~ '^B[0-9]{2}[0-9]+$'; prefijo = 3 chars, n = resto como entero.
    if (/^B[0-9]{2}[0-9]+$/.test(f.ncf)) {
      const prefijo = f.ncf.slice(0, 3);
      const n = BigInt(f.ncf.slice(3));
      const g = ncfB.get(prefijo) ?? { min: n, max: n, valores: new Set<bigint>() };
      if (n < g.min) g.min = n;
      if (n > g.max) g.max = n;
      g.valores.add(n);
      ncfB.set(prefijo, g);
    }
  }
  for (const veces of ncfVeces.values()) {
    if (veces > 1) A7++;
  }
  let huecosNcf = BigInt(0);
  for (const g of ncfB.values()) {
    huecosNcf += g.max - g.min + BigInt(1) - BigInt(g.valores.size);
  }
  const D1 = Number(huecosNcf);

  let A3 = 0;
  let saldoFpCents = 0;
  let itbisFpCents = 0;
  for (const p of compras) {
    if (p.estado === "anulada") continue;
    const saldoComp = centavos(p.total) - centavos(p.pagado) - centavos(p.credito) - centavos(p.retenido);
    if (saldoComp < 0) A3++;
    saldoFpCents += saldoComp;
    itbisFpCents += centavos(p.itbis);
  }

  let itbisNcvCents = 0;
  for (const n of notasCredito) {
    if (n.estado !== "anulada") itbisNcvCents += centavos(n.itbis);
  }

  // A6 y D6 (inventariable). cantidad/costo son numeric(14,2) → centavos.
  // existencias.cantidad también es numeric(14,2): la diferencia en centavos
  // equivale a round(...,4) <> 0 del SQL (los datos tienen 2 decimales).
  const existenciasPorProducto = new Map<string, number>();
  for (const e of existencias) {
    existenciasPorProducto.set(e.producto_id, (existenciasPorProducto.get(e.producto_id) ?? 0) + centavos(e.cantidad));
  }
  let A6 = 0;
  let nInventariables = 0;
  let valorInventario1e4 = BigInt(0); // suma(cantidad*costo) en unidades de 1e-4
  const topInventario: { nombre: string; cantidad: number; costo: number; valor: number }[] = [];
  for (const p of productos) {
    if (!p.inventariable) continue;
    nInventariables++;
    const cant = centavos(p.cantidad);
    const costoC = centavos(p.costo);
    const enAlmacen = existenciasPorProducto.get(p.id) ?? 0;
    if (cant - enAlmacen !== 0) A6++;
    // cantidad(unid)=cant/100, costo(unid)=cc/100 → producto= cant*cc/1e4.
    const prod1e4 = BigInt(cant) * BigInt(costoC);
    valorInventario1e4 += prod1e4;
    topInventario.push({
      nombre: p.nombre,
      cantidad: cant / 100,
      costo: costoC / 100,
      valor: Number(prod1e4) / 10_000,
    });
  }
  topInventario.sort((a, b) => b.valor - a.valor);

  const D2 = restarNulo(saldo("cxc"), saldoFacCents);
  const D3 = sumarNulo(saldo("cxp"), saldoFpCents);
  const D4 = restarNulo(sumarNulo(saldo("itbis_por_pagar"), itbisFacCents), itbisNcvCents);
  const D5 = restarNulo(saldo("itbis_adelantado"), itbisFpCents);
  // D6: saldo(inventario) - sum(cantidad*costo); en unidades de 1e-4:
  // saldoCents*100 (centavos→1e-4) menos valorInventario1e4.
  const saldoInv = saldo("inventario");
  const d6Unidades1e4 = saldoInv === null ? null : BigInt(saldoInv) * BigInt(100) - valorInventario1e4;
  const d6 = d6Unidades1e4 === null ? null : Number(d6Unidades1e4) / 10_000;

  const valores: Record<string, number | string | null> = {
    "A1 asientos descuadrados (absoluto)": A1,
    "A2 facturas con saldo negativo (absoluto)": A2,
    "A3 compras con saldo negativo (absoluto)": A3,
    "A4 facturas pagada con saldo o abierta sin saldo (absoluto)": A4,
    "A5 facturas anuladas sin asiento de reverso (absoluto)": A5,
    "A6 productos con existencia por almacén distinta del total (absoluto)": A6,
    "A7 NCF repetidos en facturas (absoluto)": A7,
    "D1 huecos en NCF B de facturas (delta)": D1,
    "D2 CxC mayor menos saldo de facturas (delta)": aUnidades(D2),
    "D3 CxP mayor más saldo de compras (delta)": aUnidades(D3),
    "D4 ITBIS por pagar mayor más ITBIS ventas netas (delta)": aUnidades(D4),
    "D5 ITBIS adelantado mayor menos ITBIS compras (delta)": aUnidades(D5),
    "D6 inventario mayor menos cantidad x costo (delta, redondeo)": d6,
    "I1 facturas ZZTEST": I1,
    "I2 tamaño de la base en MB": "no medible por API",
  };

  const salida = {
    corrida: "despues",
    generado_en: new Date().toISOString(),
    usuario: "ZZTEST_USER_1 (via API de datos; I2 no medible por API)",
    fuente: "docs/pruebas/cuadre.sql replicado via PostgREST (tests/carga/cuadre.ts)",
    conteos,
    filas_descargadas: filasPorTabla,
    avisos,
    detalle: {
      saldo_mayor_centavos: Object.fromEntries([...saldoMayor.entries()].map(([k, v]) => [k, v])),
      componentes_centavos: {
        saldo_facturas_no_anuladas: saldoFacCents,
        saldo_compras_no_anuladas: saldoFpCents,
        itbis_facturas_no_anuladas: itbisFacCents,
        itbis_compras_no_anuladas: itbisFpCents,
        itbis_notas_credito_no_anuladas: itbisNcvCents,
        valor_inventario_productos_1e4: valorInventario1e4.toString(),
      },
      asientos_con_reverso: reversos.size,
      contactos_zztest: contactosZz.length,
      a2_por_estado: Object.fromEntries(a2PorEstado),
      a2_zztest: a2Zztest,
      a2_con_marca_sinpago: a2SinPago,
      a2_muestras: a2Muestras,
      productos_inventariables: nInventariables,
      top_inventario_por_valor: topInventario.slice(0, 10),
      prefijos_ncf_b: [...ncfB.entries()].map(([p, g]) => ({
        prefijo: p,
        min: g.min.toString(),
        max: g.max.toString(),
        distintos: g.valores.size,
        huecos: Number(g.max - g.min + BigInt(1) - BigInt(g.valores.size)),
      })),
    },
    valores,
  };

  const dir = resolve(raiz, "docs", "pruebas", "resultados");
  mkdirSync(dir, { recursive: true });
  const ruta = resolve(dir, "cuadre-despues.json");
  writeFileSync(ruta, `${JSON.stringify(salida, null, 2)}\n`);
  escribir(`escrito ${ruta}`);
  for (const [k, v] of Object.entries(valores)) escribir(`${k}: ${v}`);
}

main().catch((causa) => {
  const mensaje = causa instanceof Error ? causa.message : String(causa);
  console.error(`cuadre fallo: ${mensaje}`);
  process.exit(1);
});
