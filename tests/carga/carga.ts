import type { SupabaseClient } from "@supabase/supabase-js";

import {
  cargarEntorno,
  clientesAutenticados,
  elegirAzar,
  enteroAzar,
  escribir,
  fechaAzarEnPeriodo,
  Medidor,
  mulberry32,
  type Periodo,
  periodos2021a2023,
  sumarDias,
} from "./_comun";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const MARCADOR = "ZZTEST-L1";
const FECHA_MIN = "2021-01-01";
const FECHA_MAX = "2023-12-31";
const MES_PESADO = "2023-03";
const ANULABLES = 300;
const SIN_PAGO = 800;

const OBJETIVOS = {
  contactos: 1000,
  productos: 300,
  compras: 5000,
  pagosProveedor: 3000,
  facturas: 15000,
  pagosRecibidos: 7000,
  notasCredito: 500,
  anulaciones: 300,
} as const;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

let detener = false;

function revisarError(mensaje: string | null) {
  if (mensaje && /quota|disk|read.only|exceeded|storage|insufficient|resource/i.test(mensaje)) {
    detener = true;
    escribir(`!! ERROR DE CUOTA detectado: ${mensaje} — se detiene la carga`);
  }
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

interface RespuestaConsulta<T> {
  data: T[] | null;
  error: { message: string } | null;
}

async function paginar<T>(
  fn: (desde: number, hasta: number) => PromiseLike<RespuestaConsulta<T>>,
  tam = 1000,
): Promise<T[]> {
  const todo: T[] = [];
  for (let d = 0; ; d += tam) {
    const { data, error } = await fn(d, d + tam - 1);
    if (error) throw new Error(`consulta falló: ${error.message}`);
    const filas = data ?? [];
    todo.push(...filas);
    if (filas.length < tam) break;
  }
  return todo;
}

async function enParalelo<T>(
  items: readonly T[],
  clientes: SupabaseClient[],
  etiqueta: string,
  fn: (item: T, cli: SupabaseClient, indice: number) => Promise<void>,
): Promise<void> {
  let siguiente = 0;
  let hechas = 0;
  const workers = clientes.map(async (cli) => {
    for (;;) {
      if (detener) return;
      const i = siguiente++;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) continue;
      await fn(item, cli, i);
      hechas += 1;
      if (hechas % 500 === 0) escribir(`${etiqueta}: ${hechas}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Datos base
// ---------------------------------------------------------------------------

interface InfoBase {
  cajaId: string;
  bancoId: string;
  retencionItbisId: string;
  retencionItbisPct: number;
  impuestoItbis18Id: string;
  impuestoExentoId: string;
  mesesCerrados: Set<string>;
}

async function cargarInfoBase(cli: SupabaseClient): Promise<InfoBase> {
  const [cuentas, retenciones, impuestos, periodos] = await Promise.all([
    cli.from("cuentas").select("id, codigo, es_caja_banco").in("codigo", ["1101", "1102"]),
    cli.from("retenciones").select("id, tipo, porcentaje").eq("activa", true),
    cli.from("impuestos").select("id, codigo, tarifa").eq("activo", true),
    cli.from("periodos_contables").select("periodo, estado"),
  ]);
  if (cuentas.error) throw new Error(`cuentas: ${cuentas.error.message}`);
  if (retenciones.error) throw new Error(`retenciones: ${retenciones.error.message}`);
  if (impuestos.error) throw new Error(`impuestos: ${impuestos.error.message}`);
  if (periodos.error) throw new Error(`periodos: ${periodos.error.message}`);

  const caja = (cuentas.data ?? []).find((c) => c.codigo === "1101" && c.es_caja_banco);
  const banco = (cuentas.data ?? []).find((c) => c.codigo === "1102" && c.es_caja_banco);
  if (!caja || !banco) throw new Error("faltan cuentas de caja (1101) o banco (1102)");

  const retItbis = (retenciones.data ?? []).find((r) => r.tipo === "itbis");
  const imp18 = (impuestos.data ?? []).find((i) => i.codigo === "itbis-18");
  const impExento = (impuestos.data ?? []).find((i) => i.codigo === "exento");
  if (!retItbis || !imp18 || !impExento) {
    throw new Error("faltan retención ITBIS o impuestos itbis-18/exento en el catálogo");
  }

  const mesesCerrados = new Set<string>();
  for (const p of periodos.data ?? []) {
    if (p.estado === "cerrado") mesesCerrados.add(String(p.periodo).slice(0, 7));
  }
  if (mesesCerrados.size > 0) {
    escribir(`periodos cerrados: ${[...mesesCerrados].sort().join(", ")}`);
  }

  return {
    cajaId: caja.id,
    bancoId: banco.id,
    retencionItbisId: retItbis.id,
    retencionItbisPct: Number(retItbis.porcentaje),
    impuestoItbis18Id: imp18.id,
    impuestoExentoId: impExento.id,
    mesesCerrados,
  };
}

function fechaAbierta(info: InfoBase, fecha: string): boolean {
  return fecha >= FECHA_MIN && fecha <= FECHA_MAX && !info.mesesCerrados.has(fecha.slice(0, 7));
}

function fechaResultado(info: InfoBase, base: string, rng: () => number): string {
  for (let intento = 0; intento < 40; intento++) {
    const candidata = sumarDias(base, enteroAzar(rng, 0, 60));
    if (fechaAbierta(info, candidata)) return candidata;
  }
  for (let d = 0; d <= 400; d++) {
    const candidata = sumarDias(base, d);
    if (fechaAbierta(info, candidata)) return candidata;
  }
  return base;
}

function centavosDePesos(pesos: number): number {
  return Math.round(pesos * 100);
}

function pesosDeCentavos(centavos: number): number {
  return centavos / 100;
}

// ---------------------------------------------------------------------------
// Contactos y productos (por nombre, reanudables)
// ---------------------------------------------------------------------------

interface ContactoInfo {
  id: string;
  nombre: string;
}

async function asegurarContactos(
  clientes: SupabaseClient[],
  medidor: Medidor,
): Promise<{ clientes: ContactoInfo[]; proveedores: ContactoInfo[] }> {
  const cli = clientes[0];
  if (!cli) throw new Error("sin cliente");

  interface Fila {
    id: string;
    nombre: string;
  }
  const [cliRows, provRows] = await Promise.all([
    paginar<Fila>((d, h) => cli.from("contactos").select("id, nombre").like("nombre", "ZZTEST-Cliente-%").range(d, h)),
    paginar<Fila>((d, h) =>
      cli.from("contactos").select("id, nombre").like("nombre", "ZZTEST-Proveedor-%").range(d, h),
    ),
  ]);
  const porNombre = new Map([...cliRows, ...provRows].map((c) => [c.nombre, c.id]));
  escribir(`contactos ZZTEST existentes: ${porNombre.size}`);

  const pendientes: { nombre: string; tipo: "cliente" | "proveedor"; indice: number }[] = [];
  for (let i = 1; i <= 800; i++) {
    const nombre = `ZZTEST-Cliente-${pad(i, 4)}`;
    if (!porNombre.has(nombre)) pendientes.push({ nombre, tipo: "cliente", indice: i });
  }
  for (let i = 1; i <= 200; i++) {
    const nombre = `ZZTEST-Proveedor-${pad(i, 4)}`;
    if (!porNombre.has(nombre)) pendientes.push({ nombre, tipo: "proveedor", indice: i });
  }
  escribir(`contactos por crear: ${pendientes.length}`);

  const creados: { nombre: string; id: string }[] = [];
  await enParalelo(pendientes, clientes, "contactos", async (p, cliWorker) => {
    const res = await medidor.medir("crear_contacto", () =>
      cliWorker.rpc("crear_contacto", {
        p: {
          tipo: p.tipo,
          nombre: p.nombre,
          tipo_identificacion: "rnc",
          rnc_cedula: String(900_000_000 + p.indice),
        },
      }),
    );
    revisarError(res.error);
    if (res.ok && typeof res.data === "string") creados.push({ nombre: p.nombre, id: res.data });
  });
  for (const c of creados) porNombre.set(c.nombre, c.id);

  const listaClientes: ContactoInfo[] = [];
  const listaProveedores: ContactoInfo[] = [];
  for (let i = 1; i <= 800; i++) {
    const nombre = `ZZTEST-Cliente-${pad(i, 4)}`;
    const id = porNombre.get(nombre);
    if (id) listaClientes.push({ id, nombre });
  }
  for (let i = 1; i <= 200; i++) {
    const nombre = `ZZTEST-Proveedor-${pad(i, 4)}`;
    const id = porNombre.get(nombre);
    if (id) listaProveedores.push({ id, nombre });
  }
  escribir(`contactos listos: ${listaClientes.length} clientes, ${listaProveedores.length} proveedores`);
  return { clientes: listaClientes, proveedores: listaProveedores };
}

interface ProductoInfo {
  id: string;
  nombre: string;
  tipo: string;
  precio: number;
  itbisTasa: number;
  inventariable: boolean;
  impuestoId: string | null;
}

async function asegurarProductos(
  clientes: SupabaseClient[],
  medidor: Medidor,
  info: InfoBase,
): Promise<ProductoInfo[]> {
  const cli = clientes[0];
  if (!cli) throw new Error("sin cliente");
  const rng = mulberry32(20231114);

  interface Fila {
    id: string;
    nombre: string;
    tipo: string;
    precio: number;
    itbis_tasa: number;
    inventariable: boolean;
    impuesto_id: string | null;
  }
  const traer = () =>
    paginar<Fila>((d, h) =>
      cli
        .from("productos")
        .select("id, nombre, tipo, precio, itbis_tasa, inventariable, impuesto_id")
        .like("nombre", "ZZTEST-Producto-%")
        .range(d, h),
    );
  const existentes = await traer();
  const porNombre = new Map(existentes.map((p) => [p.nombre, p.id]));
  escribir(`productos ZZTEST existentes: ${existentes.length}`);

  interface Pendiente {
    nombre: string;
    tipo: "producto" | "servicio";
    precio: number;
    itbisTasa: number;
    inventariable: boolean;
    impuestoId: string;
    cantidad: number;
    costo: number;
  }
  const pendientes: Pendiente[] = [];

  for (let i = 1; i <= 250; i++) {
    const nombre = `ZZTEST-Producto-${pad(i, 3)}`;
    if (porNombre.has(nombre)) continue;
    const precio = enteroAzar(rng, 100, 5000);
    pendientes.push({
      nombre,
      tipo: "producto",
      precio,
      itbisTasa: 18,
      inventariable: true,
      impuestoId: info.impuestoItbis18Id,
      cantidad: 300,
      costo: Math.round(precio * 0.6 * 100) / 100,
    });
  }
  for (let i = 251; i <= 300; i++) {
    const nombre = `ZZTEST-Producto-${pad(i, 3)}`;
    if (porNombre.has(nombre)) continue;
    const precio = enteroAzar(rng, 100, 5000);
    const exento = i > 275;
    pendientes.push({
      nombre,
      tipo: "servicio",
      precio,
      itbisTasa: exento ? 0 : 18,
      inventariable: false,
      impuestoId: exento ? info.impuestoExentoId : info.impuestoItbis18Id,
      cantidad: 0,
      costo: 0,
    });
  }
  escribir(`productos por crear: ${pendientes.length}`);

  await enParalelo(pendientes, clientes, "productos", async (p, cliWorker) => {
    const res = await medidor.medir("crear_producto", () =>
      cliWorker.rpc("crear_producto", {
        p: {
          tipo: p.tipo,
          nombre: p.nombre,
          precio: p.precio,
          itbis_tasa: p.itbisTasa,
          impuesto_id: p.impuestoId,
          inventariable: p.inventariable,
          cantidad: p.cantidad,
          costo: p.costo,
        },
      }),
    );
    revisarError(res.error);
  });

  const todos = await traer();
  const lista: ProductoInfo[] = todos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    precio: Number(p.precio),
    itbisTasa: Number(p.itbis_tasa),
    inventariable: p.inventariable,
    impuestoId: p.impuesto_id,
  }));
  escribir(`productos listos: ${lista.length}`);
  return lista;
}

// ---------------------------------------------------------------------------
// Filas de documentos (reanudación leyendo la base)
// ---------------------------------------------------------------------------

interface CompraRow {
  id: string;
  proveedorId: string;
  fecha: string;
  total: number;
  saldo: number;
  estado: string;
}

interface FacturaRow {
  id: string;
  contactoId: string;
  fecha: string;
  tipo: string;
  total: number;
  itbis: number;
  subtotal: number;
  estado: string;
  notas: string | null;
  saldo: number;
}

async function traerCompras(cli: SupabaseClient): Promise<CompraRow[]> {
  interface Fila {
    id: string;
    contacto_id: string;
    fecha: string;
    total: number;
    pagado: number;
    credito: number;
    retenido: number;
    estado: string;
  }
  const filas = await paginar<Fila>((d, h) =>
    cli
      .from("facturas_proveedor")
      .select("id, contacto_id, fecha, total, pagado, credito, retenido, estado")
      .like("notas", `${MARCADOR}%`)
      .range(d, h),
  );
  return filas.map((f) => ({
    id: f.id,
    proveedorId: f.contacto_id,
    fecha: f.fecha,
    total: Number(f.total),
    saldo: Math.round((Number(f.total) - Number(f.pagado) - Number(f.credito) - Number(f.retenido)) * 100) / 100,
    estado: f.estado,
  }));
}

async function traerFacturas(cli: SupabaseClient): Promise<FacturaRow[]> {
  interface Fila {
    id: string;
    contacto_id: string;
    fecha: string;
    tipo_comprobante: string;
    total: number;
    itbis: number;
    subtotal: number;
    pagado: number;
    credito: number;
    retenido: number;
    estado: string;
    notas: string | null;
  }
  const filas = await paginar<Fila>((d, h) =>
    cli
      .from("facturas")
      .select(
        "id, contacto_id, fecha, tipo_comprobante, total, itbis, subtotal, pagado, credito, retenido, estado, notas",
      )
      .like("notas", `${MARCADOR}%`)
      .range(d, h),
  );
  return filas.map((f) => ({
    id: f.id,
    contactoId: f.contacto_id,
    fecha: f.fecha,
    tipo: f.tipo_comprobante,
    total: Number(f.total),
    itbis: Number(f.itbis),
    subtotal: Number(f.subtotal),
    estado: f.estado,
    notas: f.notas,
    saldo: Math.round((Number(f.total) - Number(f.pagado) - Number(f.credito) - Number(f.retenido)) * 100) / 100,
  }));
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

async function asegurarCompras(
  clientes: SupabaseClient[],
  medidor: Medidor,
  info: InfoBase,
  proveedores: ContactoInfo[],
  productos: ProductoInfo[],
): Promise<void> {
  const cli = clientes[0];
  if (!cli || proveedores.length === 0 || productos.length === 0) throw new Error("faltan datos base");
  const rng = mulberry32(777001);
  const inventariables = productos.filter((p) => p.inventariable);
  if (inventariables.length === 0) throw new Error("sin productos inventariables");

  const existentes = await traerCompras(cli);
  const faltan = OBJETIVOS.compras - existentes.length;
  escribir(`compras ZZTEST: ${existentes.length} existentes, ${Math.max(0, faltan)} por crear`);
  if (faltan <= 0 || detener) return;

  const periodos = periodos2021a2023();
  interface LineaPlan {
    producto: ProductoInfo;
    cantidad: number;
    costoCentavos: number;
  }
  interface CompraPlan {
    proveedor: ContactoInfo;
    periodo: Periodo;
    lineas: LineaPlan[];
    ncf: string;
  }
  const plan: CompraPlan[] = [];
  for (let i = 0; i < faltan; i++) {
    const proveedor = elegirAzar(rng, proveedores);
    const periodo = elegirAzar(rng, periodos);
    const nLineas = enteroAzar(rng, 1, 5);
    const lineas: LineaPlan[] = [];
    for (let l = 0; l < nLineas; l++) {
      const producto = elegirAzar(rng, inventariables);
      const cantidad = enteroAzar(rng, 10, 60);
      const costo = Math.round(producto.precio * 0.6 * (0.85 + rng() * 0.3) * 100) / 100;
      lineas.push({ producto, cantidad, costoCentavos: centavosDePesos(costo) });
    }
    plan.push({
      proveedor,
      periodo,
      lineas,
      ncf: `B01${pad(1_000_000 + existentes.length + i + 1, 8)}`,
    });
  }

  await enParalelo(plan, clientes, "compras", async (c, cliWorker) => {
    const fecha = fechaAzarEnPeriodo(rng, c.periodo);
    const lineas = c.lineas.map((l) => ({
      producto_id: l.producto.id,
      cantidad: l.cantidad,
      costo: pesosDeCentavos(l.costoCentavos),
      itbis_tasa: 18,
      impuesto_id: info.impuestoItbis18Id,
      descuento_pct: 0,
    }));
    const res = await medidor.medir("crear_factura_proveedor", () =>
      cliWorker.rpc("crear_factura_proveedor", {
        p: {
          contacto_id: c.proveedor.id,
          fecha,
          vencimiento: sumarDias(fecha, 30),
          ncf: c.ncf,
          notas: `${MARCADOR} compra ${c.ncf}`,
          lineas,
        },
      }),
    );
    revisarError(res.error);
  });
}

// ---------------------------------------------------------------------------
// Facturas de venta
// ---------------------------------------------------------------------------

interface SpecFactura {
  fecha: string;
  vencimiento: string;
  tipo: "01" | "02";
  contactoId: string;
  lineas: { producto: ProductoInfo; cantidad: number }[];
  totalCentavos: number;
  notas: string;
}

function planFacturas(rng: () => number, contactos: ContactoInfo[], productos: ProductoInfo[]): SpecFactura[] {
  const periodos = periodos2021a2023();
  const asignaciones: { periodo: Periodo; pos: number }[] = [];
  for (const p of periodos) {
    const veces = p.desde.startsWith(MES_PESADO) ? 1700 : 380;
    for (let i = 0; i < veces; i++) asignaciones.push({ periodo: p, pos: asignaciones.length });
  }
  for (let i = asignaciones.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = asignaciones[i];
    const b = asignaciones[j];
    if (a && b) {
      asignaciones[i] = b;
      asignaciones[j] = a;
    }
  }

  const esMarzo = (p: Periodo) => p.desde.startsWith(MES_PESADO);
  const elegiblesAnular = asignaciones.filter((a) => !esMarzo(a.periodo));
  const marcadosAnular = new Set<number>();
  while (marcadosAnular.size < ANULABLES && elegiblesAnular.length > 0) {
    const elegido = elegiblesAnular[Math.floor(rng() * elegiblesAnular.length)];
    if (elegido) marcadosAnular.add(elegido.pos);
  }
  const marcadosSinPago = new Set<number>();
  while (marcadosSinPago.size < SIN_PAGO) {
    const pos = Math.floor(rng() * asignaciones.length);
    if (!marcadosAnular.has(pos)) marcadosSinPago.add(pos);
  }

  const inventariables = productos.filter((p) => p.inventariable);
  const servicios = productos.filter((p) => !p.inventariable);
  const todos = [...inventariables, ...servicios];

  const specs: SpecFactura[] = [];
  for (const asig of asignaciones) {
    const anular = marcadosAnular.has(asig.pos);
    const sinPago = marcadosSinPago.has(asig.pos);
    const forzadoCredito = anular || sinPago;
    const tipo: "01" | "02" = forzadoCredito ? "01" : rng() < 0.7 ? "01" : "02";
    const fecha = fechaAzarEnPeriodo(rng, asig.periodo);
    const nLineas = enteroAzar(rng, 1, 6);
    const lineas: { producto: ProductoInfo; cantidad: number }[] = [];
    let totalCentavos = 0;
    for (let l = 0; l < nLineas; l++) {
      const producto =
        rng() < 0.75 && inventariables.length > 0 ? elegirAzar(rng, inventariables) : elegirAzar(rng, todos);
      const cantidad = enteroAzar(rng, 1, 5);
      const subtotal = cantidad * centavosDePesos(producto.precio);
      const itbis = Math.round((subtotal * producto.itbisTasa) / 100);
      totalCentavos += subtotal + itbis;
      lineas.push({ producto, cantidad });
    }
    specs.push({
      fecha,
      vencimiento: tipo === "01" ? sumarDias(fecha, 30) : fecha,
      tipo,
      contactoId: elegirAzar(rng, contactos).id,
      lineas,
      totalCentavos,
      notas: `${MARCADOR}${anular ? " ANULAR" : ""}${sinPago ? " SINPAGO" : ""} F${asig.pos}`,
    });
  }
  return specs;
}

async function asegurarFacturas(
  clientes: SupabaseClient[],
  medidor: Medidor,
  info: InfoBase,
  contactos: ContactoInfo[],
  productos: ProductoInfo[],
): Promise<FacturaRow[]> {
  const cli = clientes[0];
  if (!cli || contactos.length === 0 || productos.length === 0) throw new Error("faltan datos base");
  const rng = mulberry32(424242);

  const existentes = await traerFacturas(cli);
  const faltan = OBJETIVOS.facturas - existentes.length;
  escribir(`facturas ZZTEST: ${existentes.length} existentes, ${Math.max(0, faltan)} por crear`);
  if (faltan <= 0 || detener) return existentes;

  const specs = planFacturas(rng, contactos, productos);
  const pendientes = specs.slice(specs.length - faltan);

  await enParalelo(pendientes, clientes, "facturas", async (spec, cliWorker) => {
    const lineas = spec.lineas.map((l) => ({
      producto_id: l.producto.id,
      cantidad: l.cantidad,
      precio: l.producto.precio,
      descuento_pct: 0,
      itbis_tasa: l.producto.itbisTasa,
      impuesto_id: l.producto.impuestoId,
    }));
    const esContado = spec.tipo === "02";
    const res = await medidor.medir(esContado ? "crear_factura_contado" : "crear_factura", () =>
      cliWorker.rpc("crear_factura", {
        p: {
          tipo_comprobante: spec.tipo,
          contacto_id: spec.contactoId,
          fecha: spec.fecha,
          vencimiento: spec.vencimiento,
          notas: spec.notas,
          lineas,
          ...(esContado
            ? {
                pago: {
                  cuenta_id: rng() < 0.7 ? info.cajaId : info.bancoId,
                  metodo: rng() < 0.7 ? "efectivo" : "tarjeta",
                  monto: pesosDeCentavos(spec.totalCentavos),
                  fecha: spec.fecha,
                },
              }
            : {}),
        },
      }),
    );
    revisarError(res.error);
  });

  return traerFacturas(cli);
}

// ---------------------------------------------------------------------------
// Pagos a proveedores
// ---------------------------------------------------------------------------

interface PagoProvPlan {
  tipo: "single" | "multi";
  proveedorId: string;
  fecha: string;
  aplicaciones: { compraId: string; monto: number }[];
}

async function asegurarPagosProveedor(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<void> {
  const cli = clientes[0];
  if (!cli) throw new Error("sin cliente");
  const rng = mulberry32(919191);

  const { count, error } = await cli
    .from("pagos_proveedor")
    .select("id", { count: "exact", head: true })
    .like("notas", `${MARCADOR}%`);
  if (error) throw new Error(`pagos_proveedor: ${error.message}`);
  const existentes = count ?? 0;
  const faltan = OBJETIVOS.pagosProveedor - existentes;
  escribir(`pagos a proveedores ZZTEST: ${existentes} existentes, ${Math.max(0, faltan)} por crear`);
  if (faltan <= 0 || detener) return;

  const compras = (await traerCompras(cli)).filter((c) => c.estado !== "anulada" && c.saldo > 0.01);
  const saldo = new Map(compras.map((c) => [c.id, c.saldo]));
  const porProveedor = new Map<string, CompraRow[]>();
  for (const c of compras) {
    const lista = porProveedor.get(c.proveedorId) ?? [];
    lista.push(c);
    porProveedor.set(c.proveedorId, lista);
  }
  const proveedoresConCompras = [...porProveedor.entries()].filter(([, l]) => l.length >= 2);

  const plan: PagoProvPlan[] = [];
  let guardia = 0;
  while (plan.length < faltan && guardia < faltan * 40) {
    guardia += 1;
    if (detener) break;
    const aplicaciones: { compraId: string; monto: number }[] = [];
    let proveedorId = "";
    let fechaBase = "";

    const tomar = (c: CompraRow): number | null => {
      const s = saldo.get(c.id) ?? 0;
      if (s <= 0.01) return null;
      const total = rng() < 0.7 ? s : Math.round(s * (0.3 + rng() * 0.6) * 100) / 100;
      const monto = Math.max(0.01, Math.min(total, s));
      saldo.set(c.id, Math.round((s - monto) * 100) / 100);
      return monto;
    };

    if (rng() < 0.35 && proveedoresConCompras.length > 0) {
      const elegido = elegirAzar(rng, proveedoresConCompras);
      const lista = elegido?.[1];
      if (!elegido || !lista) continue;
      proveedorId = elegido[0];
      const disponibles = lista.filter((c) => (saldo.get(c.id) ?? 0) > 0.01);
      if (disponibles.length < 2) continue;
      const n = Math.min(disponibles.length, enteroAzar(rng, 2, 3));
      const copia = [...disponibles];
      while (aplicaciones.length < n && copia.length > 0) {
        const idx = Math.floor(rng() * copia.length);
        const c = copia.splice(idx, 1)[0];
        if (!c) continue;
        const monto = tomar(c);
        if (monto != null) aplicaciones.push({ compraId: c.id, monto });
      }
      if (aplicaciones.length < 2) {
        for (const a of aplicaciones) {
          const c = copia.find((x) => x.id === a.compraId) ?? compras.find((x) => x.id === a.compraId);
          if (c) saldo.set(c.id, Math.round(((saldo.get(c.id) ?? 0) + a.monto) * 100) / 100);
        }
        continue;
      }
      fechaBase = compras.find((c) => c.id === aplicaciones[0]?.compraId)?.fecha ?? FECHA_MIN;
    } else {
      const compra = elegirAzar(rng, compras);
      const monto = compra ? tomar(compra) : null;
      if (!compra || monto == null) continue;
      proveedorId = compra.proveedorId;
      aplicaciones.push({ compraId: compra.id, monto });
      fechaBase = compra.fecha;
    }

    plan.push({
      tipo: aplicaciones.length > 1 ? "multi" : "single",
      proveedorId,
      fecha: fechaResultado(info, fechaBase, rng),
      aplicaciones,
    });
  }
  escribir(`pagos a proveedores planificados: ${plan.length}`);

  await enParalelo(plan, clientes, "pagos-proveedor", async (p, cliWorker) => {
    const usaBanco = rng() < 0.6;
    const cuentaId = usaBanco ? info.bancoId : info.cajaId;
    const metodo = usaBanco ? "transferencia" : "efectivo";
    if (p.aplicaciones.length === 1) {
      const a = p.aplicaciones[0];
      if (!a) return;
      const res = await medidor.medir("registrar_pago_proveedor", () =>
        cliWorker.rpc("registrar_pago_proveedor", {
          p: {
            factura_proveedor_id: a.compraId,
            fecha: p.fecha,
            cuenta_id: cuentaId,
            metodo,
            monto: a.monto,
            notas: `${MARCADOR} pago prov`,
          },
        }),
      );
      revisarError(res.error);
      return;
    }
    const res = await medidor.medir("registrar_pago_proveedor_multi", () =>
      cliWorker.rpc("registrar_pago_proveedor_multi", {
        p_encabezado: {
          contacto_id: p.proveedorId,
          fecha: p.fecha,
          cuenta_id: cuentaId,
          metodo,
          notas: `${MARCADOR} pago prov multi`,
        },
        p_aplicaciones: p.aplicaciones.map((a) => ({
          factura_proveedor_id: a.compraId,
          monto: a.monto,
        })),
      }),
    );
    revisarError(res.error);
  });
}

// ---------------------------------------------------------------------------
// Pagos recibidos
// ---------------------------------------------------------------------------

interface AplicacionPlan {
  facturaId: string;
  contactoId: string;
  fechaBase: string;
  monto: number;
  retencion: boolean;
}

interface PagoPlan {
  fecha: string;
  cuentaId: string;
  metodo: string;
  aplicaciones: AplicacionPlan[];
}

async function asegurarPagosRecibidos(
  clientes: SupabaseClient[],
  medidor: Medidor,
  info: InfoBase,
  facturas: FacturaRow[],
): Promise<void> {
  const cli = clientes[0];
  if (!cli) throw new Error("sin cliente");
  const rng = mulberry32(313131);

  const { count, error } = await cli
    .from("pagos_recibidos")
    .select("id", { count: "exact", head: true })
    .like("notas", `${MARCADOR}%`);
  if (error) throw new Error(`pagos_recibidos: ${error.message}`);
  const existentes = count ?? 0;
  const faltan = OBJETIVOS.pagosRecibidos - existentes;
  escribir(`pagos recibidos ZZTEST: ${existentes} existentes, ${Math.max(0, faltan)} por crear`);
  if (faltan <= 0 || detener) return;

  const retUsadas = new Set<string>();
  const saldo = new Map<string, number>();
  const porFactura = new Map<string, FacturaRow>();
  const porCliente = new Map<string, FacturaRow[]>();

  for (const f of facturas) {
    if (f.tipo !== "01" || f.estado === "anulada") continue;
    if (f.notas?.includes("ANULAR")) continue;
    if (f.saldo <= 0.01) continue;
    saldo.set(f.id, f.saldo);
    porFactura.set(f.id, f);
    const lista = porCliente.get(f.contactoId) ?? [];
    lista.push(f);
    porCliente.set(f.contactoId, lista);
  }
  const clientesConFacturas = [...porCliente.entries()].filter(([, l]) => l.length >= 2);
  let facturasDisponibles = [...porFactura.keys()];

  const plan: PagoPlan[] = [];
  let guardia = 0;
  while (plan.length < faltan && guardia < faltan * 40) {
    guardia += 1;
    if (detener) break;
    if (guardia % 5000 === 0) {
      facturasDisponibles = facturasDisponibles.filter((id) => (saldo.get(id) ?? 0) > 0.01);
    }
    if (facturasDisponibles.length === 0) break;

    const aplicaciones: AplicacionPlan[] = [];
    let fechaBase = "";
    let conRetencion = false;

    const armarAplicacion = (f: FacturaRow): AplicacionPlan | null => {
      const saldoActual = saldo.get(f.id) ?? 0;
      if (saldoActual <= 0.01) return null;
      const retencion = !conRetencion && rng() < 0.1 && !retUsadas.has(`${f.id}:${info.retencionItbisId}`);
      const retEst = retencion ? Math.round(((f.itbis * info.retencionItbisPct) / 100) * 100) / 100 : 0;
      const tope = retencion ? saldoActual - retEst - 0.01 : saldoActual;
      if (tope <= 0.01) return null;
      const deseado = rng() < 0.6 ? tope : Math.round(tope * (0.3 + rng() * 0.65) * 100) / 100;
      const monto = Math.max(0.01, Math.min(deseado, tope));
      if (monto <= 0.01) return null;
      if (retencion) {
        conRetencion = true;
        retUsadas.add(`${f.id}:${info.retencionItbisId}`);
      }
      saldo.set(f.id, Math.round((saldoActual - monto - retEst) * 100) / 100);
      return {
        facturaId: f.id,
        contactoId: f.contactoId,
        fechaBase: f.fecha,
        monto,
        retencion,
      };
    };

    const esMulti = rng() < 0.2 && clientesConFacturas.length > 0;
    if (esMulti) {
      const elegido = elegirAzar(rng, clientesConFacturas);
      const lista = elegido?.[1];
      if (!elegido || !lista) continue;
      const disponibles = lista.filter((f) => (saldo.get(f.id) ?? 0) > 0.01);
      if (disponibles.length < 2) continue;
      const n = Math.min(disponibles.length, enteroAzar(rng, 2, 4));
      const copia = [...disponibles];
      while (aplicaciones.length < n && copia.length > 0) {
        const idx = Math.floor(rng() * copia.length);
        const f = copia.splice(idx, 1)[0];
        if (!f) continue;
        const app = armarAplicacion(f);
        if (app) aplicaciones.push(app);
      }
      if (aplicaciones.length < 2) {
        for (const a of aplicaciones) {
          const f = porFactura.get(a.facturaId);
          if (f) saldo.set(f.id, Math.round(((saldo.get(f.id) ?? 0) + a.monto) * 100) / 100);
        }
        continue;
      }
      fechaBase = aplicaciones.map((a) => a.fechaBase).sort()[0] ?? FECHA_MIN;
    } else {
      const fid = elegirAzar(rng, facturasDisponibles);
      const f = fid ? porFactura.get(fid) : undefined;
      if (!f) continue;
      const app = armarAplicacion(f);
      if (!app) continue;
      aplicaciones.push(app);
      fechaBase = f.fecha;
    }

    const contactoId = aplicaciones[0]?.contactoId;
    if (!contactoId) continue;
    const usaBanco = rng() < 0.4;
    plan.push({
      fecha: fechaResultado(info, fechaBase, rng),
      cuentaId: usaBanco ? info.bancoId : info.cajaId,
      metodo: usaBanco ? "transferencia" : elegirAzar(rng, ["efectivo", "efectivo", "tarjeta"] as const),
      aplicaciones,
    });
  }
  escribir(`pagos recibidos planificados: ${plan.length}`);

  await enParalelo(plan, clientes, "pagos-recibidos", async (p, cliWorker) => {
    if (p.aplicaciones.length === 1) {
      const a = p.aplicaciones[0];
      if (!a) return;
      const res = await medidor.medir("registrar_pago_recibido", () =>
        cliWorker.rpc("registrar_pago_recibido", {
          p: {
            factura_id: a.facturaId,
            contacto_id: a.contactoId,
            fecha: p.fecha,
            cuenta_id: p.cuentaId,
            metodo: p.metodo,
            monto: a.monto,
            notas: `${MARCADOR} pago recibido`,
            ...(a.retencion ? { retenciones: [{ retencion_id: info.retencionItbisId }] } : {}),
          },
        }),
      );
      revisarError(res.error);
      return;
    }
    const res = await medidor.medir("registrar_pago_recibido_multi", () =>
      cliWorker.rpc("registrar_pago_recibido_multi", {
        p_encabezado: {
          contacto_id: p.aplicaciones[0]?.contactoId ?? "",
          fecha: p.fecha,
          cuenta_id: p.cuentaId,
          metodo: p.metodo,
          notas: `${MARCADOR} pago recibido multi`,
        },
        p_aplicaciones: p.aplicaciones.map((a) => ({
          factura_id: a.facturaId,
          monto: a.monto,
          ...(a.retencion ? { retenciones: [{ retencion_id: info.retencionItbisId }] } : {}),
        })),
      }),
    );
    revisarError(res.error);
  });
}

// ---------------------------------------------------------------------------
// Notas de crédito de venta
// ---------------------------------------------------------------------------

async function asegurarNotasCredito(
  clientes: SupabaseClient[],
  medidor: Medidor,
  info: InfoBase,
  facturas: FacturaRow[],
): Promise<void> {
  const cli = clientes[0];
  if (!cli) throw new Error("sin cliente");
  const rng = mulberry32(606060);

  const { count, error } = await cli
    .from("notas_credito_venta")
    .select("id", { count: "exact", head: true })
    .like("notas", `${MARCADOR}%`);
  if (error) throw new Error(`notas_credito_venta: ${error.message}`);
  const existentes = count ?? 0;
  const faltan = OBJETIVOS.notasCredito - existentes;
  escribir(`notas de crédito ZZTEST: ${existentes} existentes, ${Math.max(0, faltan)} por crear`);
  if (faltan <= 0 || detener) return;

  interface FilaNc {
    factura_id: string;
  }
  const ncsPrevias = await paginar<FilaNc>((d, h) =>
    cli.from("notas_credito_venta").select("factura_id").like("notas", `${MARCADOR}%`).range(d, h),
  );
  const usadas = new Set(ncsPrevias.map((n) => n.factura_id));

  const candidatas = facturas.filter(
    (f) =>
      f.tipo === "01" && f.estado !== "anulada" && f.saldo > 0 && !f.notas?.includes("ANULAR") && !usadas.has(f.id),
  );
  const sinPago = candidatas.filter((f) => f.notas?.includes("SINPAGO"));
  const resto = candidatas.filter((f) => !f.notas?.includes("SINPAGO"));
  const plan = [...sinPago, ...resto].slice(0, faltan);
  escribir(`NC candidatas: ${candidatas.length}, planificadas: ${plan.length}`);

  await enParalelo(plan, clientes, "notas-credito", async (f, cliWorker) => {
    const lineasRes = await cliWorker
      .from("factura_lineas")
      .select("id, cantidad")
      .eq("factura_id", f.id)
      .order("id")
      .limit(1);
    const linea = lineasRes.data?.[0];
    if (!linea || lineasRes.error) return;
    const res = await medidor.medir("crear_nota_credito_venta", () =>
      cliWorker.rpc("crear_nota_credito_venta", {
        p: {
          factura_id: f.id,
          fecha: fechaResultado(info, f.fecha, rng),
          notas: `${MARCADOR} NC venta`,
          devuelve_inventario: true,
          lineas: [{ factura_linea_id: linea.id, cantidad: Math.min(1, Number(linea.cantidad)) }],
        },
      }),
    );
    revisarError(res.error);
  });
}

// ---------------------------------------------------------------------------
// Anulaciones
// ---------------------------------------------------------------------------

async function asegurarAnulaciones(clientes: SupabaseClient[], medidor: Medidor): Promise<void> {
  const cli = clientes[0];
  if (!cli) throw new Error("sin cliente");

  interface Fila {
    id: string;
  }
  const candidatas = await paginar<Fila>((d, h) =>
    cli.from("facturas").select("id").like("notas", `${MARCADOR}%ANULAR%`).neq("estado", "anulada").range(d, h),
  );
  escribir(`facturas ZZTEST marcadas para anular: ${candidatas.length} pendientes`);
  if (candidatas.length === 0 || detener) return;

  await enParalelo(candidatas, clientes, "anulaciones", async (f, cliWorker) => {
    const res = await medidor.medir("anular_documento", () =>
      cliWorker.rpc("anular_documento", { p_tipo: "factura", p_id: f.id }),
    );
    revisarError(res.error);
  });
}

// ---------------------------------------------------------------------------
// Cuadre local: mis facturas de marzo 2023 vs lectura simple (posible corte)
// ---------------------------------------------------------------------------

async function cuadreLocal(cli: SupabaseClient, facturas: FacturaRow[]) {
  const mias = facturas.filter((f) => f.fecha.startsWith(MES_PESADO) && f.estado !== "anulada");
  const total = Math.round(mias.reduce((s, f) => s + f.total, 0) * 100) / 100;
  const itbis = Math.round(mias.reduce((s, f) => s + f.itbis, 0) * 100) / 100;
  const subtotal = Math.round(mias.reduce((s, f) => s + f.subtotal, 0) * 100) / 100;

  const { data: reporte, error } = await cli
    .from("facturas")
    .select("id, total, notas")
    .neq("estado", "anulada")
    .gte("fecha", "2023-03-01")
    .lte("fecha", "2023-03-31");
  if (error) return { error: error.message };
  const filas = reporte ?? [];
  const totalLectura = Math.round(filas.reduce((s, f) => s + Number(f.total), 0) * 100) / 100;
  const conMarcador = filas.filter((f) => (f.notas ?? "").includes(MARCADOR));

  const { count: reales, error: errCount } = await cli
    .from("facturas")
    .select("id", { count: "exact", head: true })
    .neq("estado", "anulada")
    .gte("fecha", "2023-03-01")
    .lte("fecha", "2023-03-31");
  if (errCount) return { error: errCount.message };

  const { data: ncs, error: errNc } = await cli
    .from("notas_credito_venta")
    .select("id, total")
    .eq("estado", "activa")
    .gte("fecha", "2023-03-01")
    .lte("fecha", "2023-03-31");
  const totalNc = errNc ? null : Math.round((ncs ?? []).reduce((s, n) => s + Number(n.total), 0) * 100) / 100;

  return {
    facturasMarzo2023Reales: reales ?? 0,
    filasLecturaSinPaginar: filas.length,
    filasConMarcadorZZTEST: conMarcador.length,
    sumaTotalesMisFacturasMarzo: total,
    sumaItbisMisFacturasMarzo: itbis,
    sumaSubtotalMisFacturasMarzo: subtotal,
    sumaTotalesLecturaSimpleMarzo: totalLectura,
    notasCreditoMarzo: { cantidad: (ncs ?? []).length, total: totalNc },
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const raiz = resolve(__dirname, "..", "..");
  const entorno = cargarEntorno(raiz);
  const inicio = Date.now();
  escribir(`carga ZZTEST-L1 — inicio ${new Date().toISOString()}`);

  const clientes = await clientesAutenticados(entorno);
  escribir(`sesiones abiertas: ${clientes.length}`);
  const medidor = new Medidor();
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente 0");

  const info = await cargarInfoBase(cli0);
  escribir(`cuentas ok, retención ITBIS ${info.retencionItbisPct}%, meses cerrados: ${info.mesesCerrados.size}`);

  const { clientes: contactos, proveedores } = await asegurarContactos(clientes, medidor);
  const productos = await asegurarProductos(clientes, medidor, info);
  await asegurarCompras(clientes, medidor, info, proveedores, productos);
  await asegurarPagosProveedor(clientes, medidor, info);
  const facturas = await asegurarFacturas(clientes, medidor, info, contactos, productos);
  await asegurarPagosRecibidos(clientes, medidor, info, facturas);
  await asegurarNotasCredito(clientes, medidor, info, facturas);
  await asegurarAnulaciones(clientes, medidor);

  const cuadre = await cuadreLocal(cli0, facturas);

  const salida = {
    marcador: MARCADOR,
    duracionSegundos: Math.round((Date.now() - inicio) / 1000),
    detenidoPorCuota: detener,
    resumen: medidor.resumen(),
    cuadreMarzo2023: cuadre,
  };
  writeFileSync(resolve(raiz, "docs", "pruebas", "resultados", "carga.json"), JSON.stringify(salida, null, 2));
  escribir(`fin — ${salida.duracionSegundos}s. Resultados en docs/pruebas/resultados/carga.json`);
  if (detener) process.exit(2);
}

main().catch((error) => {
  console.error("CARGA ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
