// Sonda de fallos NO destructiva (solo lectura) — tercera pasada.
// Cubre módulos que la sonda anterior no tocó: remisiones/conduces, bancos,
// activos fijos, notas de débito/crédito de compra, estado de cuenta de
// contactos con muchos documentos y numeraciones. Replica las consultas tal
// cual las hace src/lib, sin tocar datos.
import type { SupabaseClient } from "@supabase/supabase-js";

import { cargarEntorno, clientesAutenticados, escribir } from "./_comun";

type Hallazgos = Record<string, unknown>;

const contar = async (cli: SupabaseClient, tabla: string): Promise<number> => {
  const { count } = await cli.from(tabla).select("id", { count: "exact", head: true });
  return count ?? -1;
};

async function paginado<T>(hacer: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await hacer(desde, desde + 999);
    if (!data || data.length === 0) break;
    todas.push(...data);
    if (data.length < 1000) break;
  }
  return todas;
}

const uuidFalso = (i: number) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0").slice(-12)}`;

// 1) Conteos de tablas de los módulos nuevos
async function sondaConteos(cli: SupabaseClient, h: Hallazgos) {
  const tablas: [string, string][] = [
    ["remisiones", "id"],
    ["remision_lineas", "id"],
    ["cotizaciones", "id"],
    ["notas_credito_compra", "id"],
    ["notas_debito_venta", "id"],
    ["activos_fijos", "id"],
    ["activo_depreciaciones", "id"],
    ["conciliaciones", "id"],
    ["conciliacion_movimientos", "conciliacion_id"],
    ["numeraciones", "id"],
    ["gastos_menores", "id"],
  ];
  const salida: Record<string, number | string> = {};
  for (const [tabla, columna] of tablas) {
    const { count, error } = await cli.from(tabla).select(columna, { count: "exact", head: true });
    salida[tabla] = error ? `ERR:${error.message.slice(0, 80)}` : (count ?? -1);
  }
  h["conteos-tablas"] = salida;
}

// 2) Bancos: cargarLineasCuenta trae TODO sin límite (corte 1.000) y encadena
// .in() con miles de ids. Se mide cuánto pierde cada cuenta de caja/banco y si
// la segunda consulta revienta por longitud de URL.
async function sondaBancos(cli: SupabaseClient, h: Hallazgos) {
  const { data: cuentas, error } = await cli
    .from("cuentas")
    .select("id, codigo, nombre, activa, acepta_movimientos, es_caja_banco")
    .eq("es_caja_banco", true)
    .order("codigo");
  if (error) {
    h["bancos-cuentas"] = { error: error.message.slice(0, 120) };
    return;
  }

  const porCuenta: Record<string, unknown>[] = [];
  let peor: { id: string; lineas: { id: string; asiento_id: string; contacto_id: string | null }[] } | null = null;

  for (const cuenta of cuentas ?? []) {
    const { count: reales } = await cli
      .from("asiento_lineas")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuenta.id);
    // Réplica de cargarLineasCuenta: mismo select, sin límite
    const { data: lineas, error: errLineas } = await cli
      .from("asiento_lineas")
      .select("id, asiento_id, contacto_id, debito, credito")
      .eq("cuenta_id", cuenta.id);
    const trajo = lineas?.length ?? -1;
    porCuenta.push({
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      lineasReales: reales ?? -1,
      lineasQueTraeLaApp: errLineas ? `ERR:${errLineas.message.slice(0, 80)}` : trajo,
      invisibles: errLineas ? "?" : (reales ?? 0) - trajo,
    });
    if (lineas && (peor === null || lineas.length > peor.lineas.length)) peor = { id: cuenta.id, lineas };
  }
  h["bancos-lineas-por-cuenta"] = porCuenta;

  // Segunda ronda de cargarLineasCuenta: .in("id", asientoIds) e .in("id", contactoIds)
  if (peor) {
    const asientoIds = [...new Set(peor.lineas.map((l) => l.asiento_id))];
    const contactoIds = [...new Set(peor.lineas.flatMap((l) => (l.contacto_id == null ? [] : [l.contacto_id])))];
    const r1 = await cli.from("asientos").select("id").in("id", asientoIds);
    const r2: { data: { id: string }[] | null; error: { message: string } | null } =
      contactoIds.length === 0
        ? { data: [], error: null }
        : await cli.from("contactos").select("id").in("id", contactoIds);
    h["bancos-segunda-ronda"] = {
      cuentaConMasLineas: porCuenta.reduce((a, b) => {
        const la =
          typeof (a as { lineasQueTraeLaApp?: unknown }).lineasQueTraeLaApp === "number"
            ? (a as { lineasQueTraeLaApp: number }).lineasQueTraeLaApp
            : -1;
        const lb =
          typeof (b as { lineasQueTraeLaApp?: unknown }).lineasQueTraeLaApp === "number"
            ? (b as { lineasQueTraeLaApp: number }).lineasQueTraeLaApp
            : -1;
        return lb > la ? b : a;
      }),
      asientosIdsEnIn: asientoIds.length,
      asientosResultado: r1.error ? `ERR:${r1.error.message.slice(0, 140)}` : `ok ${r1.data?.length ?? 0}`,
      contactosIdsEnIn: contactoIds.length,
      contactosResultado: r2.error ? `ERR:${r2.error.message.slice(0, 140)}` : `ok ${r2.data?.length ?? 0}`,
    };
  }

  // RPC de saldos (la usa la página de bancos y las acciones)
  const saldos = await cli.rpc("saldos_caja_banco", { p_fecha: "2026-11-14" });
  h["bancos-rpc-saldos"] = saldos.error
    ? { error: saldos.error.message.slice(0, 140) }
    : { filas: (saldos.data as unknown[] | null)?.length ?? -1 };
}

// 3) Límite real de .in() en la URL (GET): UUIDs falsos, no toca datos
async function sondaLimiteIn(cli: SupabaseClient, h: Hallazgos) {
  const resultados: Record<string, string> = {};
  for (const n of [100, 200, 300, 400, 600, 800, 1200, 2000]) {
    const ids = Array.from({ length: n }, (_, i) => uuidFalso(i));
    const { error } = await cli.from("facturas").select("id").in("id", ids);
    resultados[`${n} ids (~${(n * 37) / 1000} KB de URL)`] = error
      ? `ERR:${error.message.slice(0, 140)}`
      : "ok (0 filas)";
    if (error) break;
  }
  h["limite-url-in"] = resultados;
}

// 4) Estado de cuenta / ficha: contactos con más documentos y distancia a los
// cortes (1.000 filas por consulta; .in() gigante en la 2da ronda)
async function sondaEstadoCuenta(cli: SupabaseClient, h: Hallazgos) {
  const facturas = await paginado((d, hasta) => cli.from("facturas").select("contacto_id").range(d, hasta));
  const porContacto = new Map<string, number>();
  for (const f of facturas) {
    const c = (f as { contacto_id: string }).contacto_id;
    porContacto.set(c, (porContacto.get(c) ?? 0) + 1);
  }
  const top = [...porContacto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  h["estado-cuenta-top-facturas"] = top.map(([id, n]) => ({ contactoId: id, facturas: n }));

  // Para el contacto con más documentos: pagos, líneas de asiento y réplica
  // exacta de obtenerEstadoCuentaCliente (reporte) y del .in() de la ficha.
  const campeon = top[0]?.[0];
  if (!campeon) return;
  const [pagosN, lineasN, comprasN, cotizN, remiN, ncN, ndN, nccN, ppN] = await Promise.all([
    cli.from("pagos_recibidos").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("asiento_lineas").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("facturas_proveedor").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("cotizaciones").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("remisiones").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("notas_credito_venta").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("notas_debito_venta").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("notas_credito_compra").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
    cli.from("pagos_proveedor").select("id", { count: "exact", head: true }).eq("contacto_id", campeon),
  ]);
  h["estado-cuenta-campeon"] = {
    contactoId: campeon,
    facturas: top[0]?.[1],
    pagosRecibidos: pagosN.count ?? -1,
    asientoLineas: lineasN.count ?? -1,
    compras: comprasN.count ?? -1,
    cotizaciones: cotizN.count ?? -1,
    remisiones: remiN.count ?? -1,
    notasCreditoVenta: ncN.count ?? -1,
    notasDebitoVenta: ndN.count ?? -1,
    notasCreditoCompra: nccN.count ?? -1,
    pagosProveedor: ppN.count ?? -1,
  };

  // Réplica del reporte estado-cuenta-cliente para ese contacto
  const { data: facs } = await cli
    .from("facturas")
    .select("id, numero, ncf, fecha, vencimiento, total")
    .eq("contacto_id", campeon)
    .lte("fecha", "2026-12-31")
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false });
  const ids = (facs ?? []).map((f) => f.id);
  const [pagosRes, apliRes] = await Promise.all([
    cli.from("pagos_recibidos").select("id").in("factura_id", ids).eq("estado", "activo"),
    cli.from("pago_recibido_aplicaciones").select("pago_id").in("factura_id", ids),
  ]);
  h["estado-cuenta-replica-reporte"] = {
    facturasDevueltas: facs?.length ?? -1,
    facturasReales: top[0]?.[1],
    pagosIn: pagosRes.error ? `ERR:${pagosRes.error.message.slice(0, 120)}` : `ok ${pagosRes.data?.length ?? 0}`,
    aplicacionesIn: apliRes.error ? `ERR:${apliRes.error.message.slice(0, 120)}` : `ok ${apliRes.data?.length ?? 0}`,
  };
}

// 5) Formularios con listas cerradas: cuánto queda fuera
async function sondaFormularios(cli: SupabaseClient, h: Hallazgos) {
  // Nueva nota de débito de venta: facturas != anulada, limit 500
  const { count: facsNoAnuladas } = await cli
    .from("facturas")
    .select("id", { count: "exact", head: true })
    .neq("estado", "anulada");
  const { data: formNd } = await cli
    .from("facturas")
    .select("id")
    .neq("estado", "anulada")
    .order("numero", { ascending: false })
    .limit(500);
  h["form-nota-debito-facturas"] = {
    facturasElegiblesReales: facsNoAnuladas ?? -1,
    elSelectorCarga: formNd?.length ?? -1,
    inalcanzables: (facsNoAnuladas ?? 0) - (formNd?.length ?? 0),
  };

  // Nuevo activo fijo: proveedores activos sin límite (corte 1.000)
  const { count: provReales } = await cli
    .from("contactos")
    .select("id", { count: "exact", head: true })
    .eq("activo", true)
    .in("tipo", ["proveedor", "ambos"]);
  const { data: provApp } = await cli
    .from("contactos")
    .select("id")
    .eq("activo", true)
    .in("tipo", ["proveedor", "ambos"])
    .order("nombre");
  h["form-activo-proveedores"] = {
    proveedoresReales: provReales ?? -1,
    elSelectorCarga: provApp?.length ?? -1,
    inalcanzables: (provReales ?? 0) - (provApp?.length ?? 0),
  };

  // Listas con limit 300/500 de los módulos nuevos
  const listas: [string, string, number][] = [
    ["remisiones", "remisiones", 300],
    ["cotizaciones", "cotizaciones", 300],
    ["notas-credito-compra", "notas_credito_compra", 300],
    ["notas-debito-venta", "notas_debito_venta", 300],
    ["activos-fijos", "activos_fijos", 500],
  ];
  const salida: Record<string, unknown> = {};
  for (const [nombre, tabla, limite] of listas) {
    const reales = await contar(cli, tabla);
    salida[nombre] = { limite, reales, invisibles: Math.max(0, reales - limite) };
  }
  h["listas-nuevos-modulos"] = salida;
}

// 6) Numeraciones: ¿siguiente = último emitido + 1? ¿qué series vigila el RPC?
async function sondaNumeraciones(cli: SupabaseClient, h: Hallazgos) {
  const { data: nums, error } = await cli
    .from("numeraciones")
    .select("id, tipo_comprobante, nombre, prefijo, siguiente, hasta, vence, activa")
    .order("tipo_comprobante")
    .order("prefijo");
  if (error) {
    h["numeraciones"] = { error: error.message.slice(0, 120) };
    return;
  }

  const maxPorPrefijo = new Map<string, number>();
  const tomar = (ncf: string | null) => {
    if (ncf == null || !/^B[0-9]{2}[0-9]+$/.test(ncf)) return;
    const prefijo = ncf.slice(0, 3);
    const n = Number(ncf.slice(3));
    if (n > (maxPorPrefijo.get(prefijo) ?? 0)) maxPorPrefijo.set(prefijo, n);
  };
  for (const tabla of ["facturas", "notas_credito_venta", "notas_debito_venta", "gastos_menores"]) {
    const filas = await paginado((d, hasta) => cli.from(tabla).select("ncf").range(d, hasta));
    for (const f of filas) tomar((f as { ncf: string | null }).ncf);
  }

  h.numeraciones = (nums ?? []).map((n) => {
    const max = maxPorPrefijo.get(n.prefijo) ?? 0;
    return {
      tipo: n.tipo_comprobante,
      prefijo: n.prefijo,
      nombre: n.nombre,
      activa: n.activa,
      siguiente: n.siguiente,
      hasta: n.hasta,
      vence: n.vence,
      ultimoEmitido: max,
      deriva: n.siguiente - (max + 1), // 0 = perfecto; <0 reutiliza NCF; >0 hueco
    };
  });
}

// 7) RPC de escritura alcanzables (solo se verifica que respondan; se llaman
// con payload inválido para que fallen ANTES de escribir nada)
async function sondaRpcVivas(cli: SupabaseClient, h: Hallazgos) {
  const pruebas: [string, Record<string, unknown>][] = [
    ["actualizar_numeracion", { p: {} }],
    ["transferir_entre_cuentas", { p: {} }],
    ["registrar_deposito", { p: {} }],
    ["crear_cuenta_banco", { p: {} }],
    ["guardar_borrador_conciliacion", { p: {} }],
    ["crear_activo_fijo", { p: {} }],
    ["depreciar_activo", { p_activo_id: "00000000-0000-4000-8000-000000000000" }],
    ["crear_remision", { p: {} }],
    ["editar_remision", { p: {} }],
    ["convertir_a_factura", { p: {} }],
    ["crear_nota_credito_compra", { p: {} }],
    ["crear_nota_debito_venta", { p: {} }],
    ["conciliar_cuenta", { p: {} }],
  ];
  const salida: Record<string, string> = {};
  for (const [fn, args] of pruebas) {
    const { error } = await cli.rpc(fn, args as never);
    salida[fn] = error ? error.message.slice(0, 160) : "SIN ERROR (revisar: respondió ok)";
  }
  h["rpc-alcanzables"] = salida;
}

async function principal() {
  const entorno = cargarEntorno();
  const [cli] = await clientesAutenticados(entorno);
  if (!cli) throw new Error("sin cliente");
  const h: Hallazgos = {};
  await sondaConteos(cli, h);
  await sondaBancos(cli, h);
  await sondaLimiteIn(cli, h);
  await sondaEstadoCuenta(cli, h);
  await sondaFormularios(cli, h);
  await sondaNumeraciones(cli, h);
  await sondaRpcVivas(cli, h);
  escribir(JSON.stringify(h, null, 2));
}

principal().catch((e) => {
  escribir(`ERROR: ${String(e).slice(0, 300)}`);
  process.exit(1);
});
