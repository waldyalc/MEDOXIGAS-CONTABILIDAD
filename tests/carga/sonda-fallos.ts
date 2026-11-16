// Sonda de fallos NO destructiva (solo lectura) — mide cuánto se pierde cada
// pantalla por límites/cortes silenciosos. Replica las consultas tal cual las
// hace src/lib, sin tocar datos.
import type { SupabaseClient } from "@supabase/supabase-js";

import { cargarEntorno, clientesAutenticados, escribir } from "./_comun";

type Hallazgos = Record<string, unknown>;

const contar = async (cli: SupabaseClient, tabla: string): Promise<number> => {
  const { count } = await cli.from(tabla).select("id", { count: "exact", head: true });
  return count ?? -1;
};

// Listas con límite/corte: filas que mostraría la pantalla vs reales
async function sondaListas(cli: SupabaseClient, hallazgos: Hallazgos) {
  // [nombre, tabla, limiteQueUsaLaPantalla (null = sin .limit)]
  const listas: [string, string, number | null][] = [
    ["facturas-lista", "facturas", 300],
    ["compras-lista", "facturas_proveedor", null],
    ["pagos-recibidos-lista", "pagos_recibidos", 300],
    ["pagos-proveedor-lista", "pagos_proveedor", 300],
    ["notas-credito-lista", "notas_credito_venta", 300],
    ["contactos-lista", "contactos", null],
    ["productos-lista", "productos", null],
    ["asientos-lista", "asientos", 300],
    ["gastos-menores-lista", "gastos_menores", 300],
    ["cotizaciones-lista", "cotizaciones", 300],
    ["ordenes-compra-lista", "ordenes_compra", 300],
  ];
  for (const [nombre, tabla, limite] of listas) {
    let q = cli.from(tabla).select("id").order("id", { ascending: false });
    if (limite !== null) q = q.limit(limite);
    const { data, error } = await q;
    const reales = await contar(cli, tabla);
    const muestra = data?.length ?? -1;
    hallazgos[nombre] = {
      filasQueTraeLaPantalla: error ? `ERR:${error.message.slice(0, 60)}` : muestra,
      filasReales: reales,
      invisibles: error ? "?" : reales - muestra,
    };
  }
}

// Qué contactos quedan invisibles en el combobox/lista (corte de 1,000)
async function sondaContactos(cli: SupabaseClient, hallazgos: Hallazgos) {
  const { data: contactos } = await cli.from("contactos").select("id, nombre").order("nombre");
  const totalContactos = await contar(cli, "contactos");
  hallazgos["contactos-combobox"] = {
    cargados: contactos?.length ?? -1,
    reales: totalContactos,
    faltantes: totalContactos - (contactos?.length ?? 0),
    ultimos5Visibles: contactos?.slice(-5).map((c) => c.nombre),
  };
  if (!contactos || contactos.length >= totalContactos) return;
  const visibles = new Set(contactos.map((c) => c.id));
  const todos: { id: string; nombre: string }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await cli
      .from("contactos")
      .select("id, nombre")
      .order("nombre")
      .range(desde, desde + 999);
    if (!data || data.length === 0) break;
    todos.push(...data);
  }
  const invisibles = todos.filter((c) => !visibles.has(c.id));
  hallazgos["contactos-invisibles"] = invisibles.map((c) => c.nombre).slice(0, 30);
}

// Formulario "Nuevo pago": getFacturasAbiertas solo carga 300 abiertas
async function sondaFormularioPago(cli: SupabaseClient, hallazgos: Hallazgos) {
  const { count: abiertas } = await cli
    .from("facturas")
    .select("id", { count: "exact", head: true })
    .eq("estado", "abierta");
  const { data: formPago } = await cli
    .from("facturas")
    .select("id")
    .eq("estado", "abierta")
    .order("vencimiento")
    .order("numero")
    .limit(300);
  hallazgos["formulario-pago-facturas-abiertas"] = {
    abiertasReales: abiertas ?? -1,
    elSelectorMuestra: formPago?.length ?? -1,
  };
}

// reporte_cxc (RPC): PostgREST también corta funciones a 1,000 filas
async function sondaCxc(cli: SupabaseClient, hallazgos: Hallazgos) {
  const { data: cxc, error } = await cli.rpc("reporte_cxc", { p_fecha: "2023-12-31" });
  let real = { facturas: -1, saldo: -1 };
  let suma = 0;
  let n = 0;
  for (let desde = 0; ; desde += 1000) {
    const { data } = await cli
      .from("facturas")
      .select("total,pagado,credito,retenido,estado")
      .neq("estado", "anulada")
      .lte("fecha", "2023-12-31")
      .range(desde, desde + 999);
    if (!data || data.length === 0) break;
    for (const f of data) {
      const s = f.total - f.pagado - f.credito - f.retenido;
      if (s !== 0) {
        suma += s;
        n++;
      }
    }
  }
  real = { facturas: n, saldo: Math.round(suma * 100) / 100 };
  hallazgos["reporte_cxc-rpc"] = error
    ? { error: error.message.slice(0, 120) }
    : { filasDevueltas: (cxc as unknown[] | null)?.length ?? -1, real };
}

// Consistencias: pagado>total, stock negativo, existencias vs productos
async function sondaConsistencias(cli: SupabaseClient, hallazgos: Hallazgos) {
  const { data: malas } = await cli
    .from("facturas")
    .select("id, numero, total, pagado")
    .or("pagado.gt.total,pagado.lt.0")
    .limit(50);
  hallazgos["facturas-pagado-inconsistente"] = { total: malas?.length ?? 0, ejemplos: malas?.slice(0, 10) };
  const { data: malasP } = await cli
    .from("facturas_proveedor")
    .select("id, numero, total, pagado")
    .or("pagado.gt.total,pagado.lt.0")
    .limit(50);
  hallazgos["compras-pagado-inconsistente"] = { total: malasP?.length ?? 0 };
  const { data: neg } = await cli.from("productos").select("id, nombre, cantidad").lt("cantidad", 0);
  hallazgos["productos-stock-negativo"] = {
    total: neg?.length ?? 0,
    ejemplos: neg?.slice(0, 10).map((p) => `${p.nombre}: ${p.cantidad}`),
  };
  const { count: sinAsientoN } = await cli
    .from("facturas")
    .select("id", { count: "exact", head: true })
    .is("asiento_id", null);
  hallazgos["facturas-sin-asiento"] = { total: sinAsientoN ?? -1 };
}

// RNC/cédula duplicados (sin constraint de unicidad)
async function sondaRnc(cli: SupabaseClient, hallazgos: Hallazgos) {
  const { data: rncs } = await cli.from("contactos").select("rnc_cedula").not("rnc_cedula", "is", null);
  const vistos = new Map<string, number>();
  for (const c of rncs ?? []) {
    const r = (c as { rnc_cedula: string | null }).rnc_cedula;
    if (r) vistos.set(r, (vistos.get(r) ?? 0) + 1);
  }
  const dups = [...vistos.entries()].filter(([, n]) => n > 1);
  hallazgos["rnc-duplicados"] = { total: dups.length, ejemplos: dups.slice(0, 10) };
}

async function principal() {
  const entorno = cargarEntorno();
  const [cli] = await clientesAutenticados(entorno);
  if (!cli) throw new Error("sin cliente");
  const hallazgos: Hallazgos = {};
  await sondaListas(cli, hallazgos);
  await sondaContactos(cli, hallazgos);
  await sondaFormularioPago(cli, hallazgos);
  await sondaCxc(cli, hallazgos);
  await sondaConsistencias(cli, hallazgos);
  await sondaRnc(cli, hallazgos);
  escribir(JSON.stringify(hallazgos, null, 2));
}

principal().catch((e) => {
  escribir(`ERROR: ${String(e).slice(0, 300)}`);
  process.exit(1);
});
