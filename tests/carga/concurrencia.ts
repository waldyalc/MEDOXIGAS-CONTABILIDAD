import type { SupabaseClient } from "@supabase/supabase-js";

import { cargarEntorno, clientesAutenticados, enteroAzar, escribir, Medidor, mulberry32 } from "./_comun";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FECHA_JUNIO = (dia: number) => `2020-06-${String(dia).padStart(2, "0")}`;

interface InfoBase {
  cajaId: string;
  bancoId: string;
  impuestoItbis18Id: string;
  impuestoExentoId: string;
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

async function cargarInfoBase(cli: SupabaseClient): Promise<InfoBase> {
  const [cuentas, impuestos] = await Promise.all([
    cli.from("cuentas").select("id, codigo, es_caja_banco").in("codigo", ["1101", "1102"]),
    cli.from("impuestos").select("id, codigo").eq("activo", true),
  ]);
  if (cuentas.error) throw new Error(`cuentas: ${cuentas.error.message}`);
  if (impuestos.error) throw new Error(`impuestos: ${impuestos.error.message}`);
  const caja = (cuentas.data ?? []).find((c) => c.codigo === "1101" && c.es_caja_banco);
  const banco = (cuentas.data ?? []).find((c) => c.codigo === "1102" && c.es_caja_banco);
  const imp18 = (impuestos.data ?? []).find((i) => i.codigo === "itbis-18");
  const impExento = (impuestos.data ?? []).find((i) => i.codigo === "exento");
  if (!caja || !banco || !imp18 || !impExento) throw new Error("faltan cuentas o impuestos del catálogo");
  return { cajaId: caja.id, bancoId: banco.id, impuestoItbis18Id: imp18.id, impuestoExentoId: impExento.id };
}

interface ProductoC {
  id: string;
  precio: number;
  itbisTasa: number;
  impuestoId: string | null;
}

function lineaDe(p: ProductoC, cantidad: number, precio?: number) {
  return {
    producto_id: p.id,
    cantidad,
    precio: precio ?? p.precio,
    descuento_pct: 0,
    itbis_tasa: p.itbisTasa,
    impuesto_id: p.impuestoId,
  };
}

async function crearContacto(
  cli: SupabaseClient,
  nombre: string,
  tipo: "cliente" | "proveedor",
  rnc: string,
): Promise<string | null> {
  const { data, error } = await cli.rpc("crear_contacto", {
    p: { tipo, nombre, tipo_identificacion: "rnc", rnc_cedula: rnc },
  });
  if (error || typeof data !== "string") return null;
  return data;
}

async function crearProducto(
  cli: SupabaseClient,
  p: {
    nombre: string;
    tipo: "producto" | "servicio";
    precio: number;
    itbisTasa: number;
    inventariable: boolean;
    impuestoId: string;
    cantidad: number;
    costo: number;
  },
): Promise<string | null> {
  const { data, error } = await cli.rpc("crear_producto", {
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
  });
  if (error || typeof data !== "string") return null;
  return data;
}

interface OpcionesFactura {
  contactoId: string;
  producto: ProductoC;
  cantidad: number;
  fecha: string;
  notas: string;
  precio?: number;
}

async function crearFacturaB01(
  cli: SupabaseClient,
  medidor: Medidor,
  nombreMedidor: string,
  o: OpcionesFactura,
): Promise<{ id: string | null; error: string | null }> {
  const res = await medidor.medir(nombreMedidor, () =>
    cli.rpc("crear_factura", {
      p: {
        tipo_comprobante: "01",
        contacto_id: o.contactoId,
        fecha: o.fecha,
        vencimiento: o.fecha > "2020-06-15" ? "2020-07-15" : "2020-07-05",
        notas: o.notas,
        lineas: [lineaDe(o.producto, o.cantidad, o.precio)],
      },
    }),
  );
  if (res.ok && typeof res.data === "string") return { id: res.data, error: null };
  return { id: null, error: res.error ?? "error desconocido" };
}

interface FilaFactura {
  id: string;
  ncf: string | null;
  numero: string;
  estado: string;
  pagado: number;
  total: number;
}

async function traerFactura(cli: SupabaseClient, id: string): Promise<FilaFactura | null> {
  const { data, error } = await cli
    .from("facturas")
    .select("id, ncf, numero, estado, pagado, total")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    ncf: data.ncf,
    numero: data.numero,
    estado: data.estado,
    pagado: Number(data.pagado),
    total: Number(data.total),
  };
}

interface Escenario {
  esperado: string;
  real: unknown;
  pasa: boolean;
  ids: string[];
  errores: Record<string, number>;
}

function servicioExento(info: InfoBase, id: string, precio: number): ProductoC {
  return { id, precio, itbisTasa: 0, impuestoId: info.impuestoExentoId };
}

function servicioGravado(info: InfoBase, id: string, precio: number): ProductoC {
  return { id, precio, itbisTasa: 18, impuestoId: info.impuestoItbis18Id };
}

// ---------------------------------------------------------------------------
// C1: 500 facturas B01 a crédito en paralelo; NCF consecutivos sin huecos
// ---------------------------------------------------------------------------

async function c1(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<Escenario> {
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente");
  const contactoId = await crearContacto(cli0, "ZZTEST-C1-Cliente", "cliente", "910000001");
  const prodId = await crearProducto(cli0, {
    nombre: "ZZTEST-C1-Servicio",
    tipo: "servicio",
    precio: 1500,
    itbisTasa: 18,
    inventariable: false,
    impuestoId: info.impuestoItbis18Id,
    cantidad: 0,
    costo: 0,
  });
  if (!contactoId || !prodId) throw new Error("C1: no se pudieron crear datos base");
  const producto = servicioGravado(info, prodId, 1500);
  const rng = mulberry32(101);

  const ids: string[] = [];
  const errores: Record<string, number> = {};
  const anotar = (msg: string | null) => {
    const m = msg ?? "desconocido";
    errores[m] = (errores[m] ?? 0) + 1;
  };

  await Promise.all(
    clientes.map(async (cli, u) => {
      for (let i = 0; i < 100; i++) {
        const r = await crearFacturaB01(cli, medidor, "c1_crear_factura", {
          contactoId,
          producto,
          cantidad: enteroAzar(rng, 1, 3),
          fecha: FECHA_JUNIO(enteroAzar(rng, 1, 28)),
          notas: `ZZTEST-C1 U${u} F${i}`,
        });
        if (r.id) ids.push(r.id);
        else anotar(r.error);
      }
    }),
  );

  const filas = await paginar<{ ncf: string | null }>((d, h) =>
    cli0.from("facturas").select("ncf").like("notas", "ZZTEST-C1%").range(d, h),
  );
  const numeros = filas
    .map((f) => f.ncf)
    .filter((n): n is string => typeof n === "string")
    .map((n) => Number(n.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const distintos = new Set(numeros).size;
  const min = numeros[0] ?? 0;
  const max = numeros[numeros.length - 1] ?? 0;
  const consecutivos = numeros.length === distintos && max - min + 1 === numeros.length;

  return {
    esperado: "500 facturas creadas; NCF distintos y consecutivos sin huecos",
    real: {
      creadas: ids.length,
      ncfDistintos: distintos,
      ncfMin: min,
      ncfMax: max,
      ncfConsecutivos: consecutivos,
    },
    pasa: ids.length === 500 && consecutivos,
    ids: ids.slice(0, 20),
    errores,
  };
}

// ---------------------------------------------------------------------------
// C2: 5 cobros simultáneos de RD$3,000 sobre una factura de RD$10,000
// ---------------------------------------------------------------------------

async function c2(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<Escenario> {
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente");
  const contactoId = await crearContacto(cli0, "ZZTEST-C2-Cliente", "cliente", "920000001");
  const prodId = await crearProducto(cli0, {
    nombre: "ZZTEST-C2-Servicio",
    tipo: "servicio",
    precio: 1000,
    itbisTasa: 0,
    inventariable: false,
    impuestoId: info.impuestoExentoId,
    cantidad: 0,
    costo: 0,
  });
  if (!contactoId || !prodId) throw new Error("C2: no se pudieron crear datos base");
  const producto = servicioExento(info, prodId, 1000);

  const creada = await crearFacturaB01(cli0, medidor, "c2_crear_factura", {
    contactoId,
    producto,
    cantidad: 10,
    fecha: FECHA_JUNIO(10),
    notas: "ZZTEST-C2 factura 10000",
  });
  if (!creada.id) throw new Error(`C2: factura no creada: ${creada.error}`);
  const facturaId = creada.id;
  const antes = await traerFactura(cli0, facturaId);

  const resultados = await Promise.all(
    clientes.map((cli, u) =>
      medidor.medir("c2_pago_3000", () =>
        cli.rpc("registrar_pago_recibido", {
          p: {
            factura_id: facturaId,
            contacto_id: contactoId,
            fecha: FECHA_JUNIO(20),
            cuenta_id: info.cajaId,
            metodo: "efectivo",
            monto: 3000,
            notas: `ZZTEST-C2 U${u}`,
          },
        }),
      ),
    ),
  );
  const exitos = resultados.filter((r) => r.ok).length;
  const fallos = resultados.filter((r) => !r.ok);
  const despues = await traerFactura(cli0, facturaId);

  return {
    esperado: "3 cobros exitosos, 2 fallos con error claro, pagado=9000",
    real: {
      totalFactura: antes?.total ?? null,
      exitosos: exitos,
      fallidos: fallos.length,
      errores: fallos.map((f) => f.error),
      pagadoFinal: despues?.pagado ?? null,
      estadoFinal: despues?.estado ?? null,
    },
    pasa: exitos === 3 && fallos.length === 2 && (despues?.pagado ?? 0) === 9000,
    ids: [facturaId],
    errores: {},
  };
}

// ---------------------------------------------------------------------------
// C3: pagos multi simultáneos sobre 2 facturas; nunca más que el saldo
// ---------------------------------------------------------------------------

async function c3(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<Escenario> {
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente");
  const contactoId = await crearContacto(cli0, "ZZTEST-C3-Cliente", "cliente", "930000001");
  const pA = await crearProducto(cli0, {
    nombre: "ZZTEST-C3-S1",
    tipo: "servicio",
    precio: 1000,
    itbisTasa: 0,
    inventariable: false,
    impuestoId: info.impuestoExentoId,
    cantidad: 0,
    costo: 0,
  });
  const pB = await crearProducto(cli0, {
    nombre: "ZZTEST-C3-S2",
    tipo: "servicio",
    precio: 800,
    itbisTasa: 0,
    inventariable: false,
    impuestoId: info.impuestoExentoId,
    cantidad: 0,
    costo: 0,
  });
  if (!contactoId || !pA || !pB) throw new Error("C3: no se pudieron crear datos base");

  const fa = await crearFacturaB01(cli0, medidor, "c3_crear_factura_a", {
    contactoId,
    producto: servicioExento(info, pA, 1000),
    cantidad: 6,
    fecha: FECHA_JUNIO(11),
    notas: "ZZTEST-C3 factura A 6000",
  });
  const fb = await crearFacturaB01(cli0, medidor, "c3_crear_factura_b", {
    contactoId,
    producto: servicioExento(info, pB, 800),
    cantidad: 10,
    fecha: FECHA_JUNIO(11),
    notas: "ZZTEST-C3 factura B 8000",
  });
  if (!fa.id || !fb.id) throw new Error("C3: facturas no creadas");
  const idA = fa.id;
  const idB = fb.id;

  const resultados = await Promise.all(
    clientes.map((cli, u) =>
      medidor.medir("c3_pago_multi", () =>
        cli.rpc("registrar_pago_recibido_multi", {
          p_encabezado: {
            contacto_id: contactoId,
            fecha: FECHA_JUNIO(21),
            cuenta_id: info.bancoId,
            metodo: "transferencia",
            notas: `ZZTEST-C3 U${u}`,
          },
          p_aplicaciones: [
            { factura_id: idA, monto: 1500 },
            { factura_id: idB, monto: 1500 },
          ],
        }),
      ),
    ),
  );

  const [desA, desB] = await Promise.all([traerFactura(cli0, idA), traerFactura(cli0, idB)]);
  const pagadoA = desA?.pagado ?? 0;
  const pagadoB = desB?.pagado ?? 0;
  const totalA = desA?.total ?? 0;
  const totalB = desB?.total ?? 0;
  const sobrepago = pagadoA > totalA + 0.001 || pagadoB > totalB + 0.001;

  return {
    esperado: "nunca cobrar más que el saldo de cada factura",
    real: {
      exitosos: resultados.filter((r) => r.ok).length,
      fallidos: resultados.filter((r) => !r.ok).length,
      errores: resultados.filter((r) => !r.ok).map((r) => r.error),
      facturaA: { total: totalA, pagado: pagadoA },
      facturaB: { total: totalB, pagado: pagadoB },
      sobrepago,
    },
    pasa: !sobrepago,
    ids: [idA, idB],
    errores: {},
  };
}

// ---------------------------------------------------------------------------
// C4: producto con existencia 3; 5 ventas simultáneas de 1 unidad
// ---------------------------------------------------------------------------

async function c4(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<Escenario> {
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente");
  const contactoId = await crearContacto(cli0, "ZZTEST-C4-Cliente", "cliente", "940000001");
  const prodId = await crearProducto(cli0, {
    nombre: "ZZTEST-C4-Producto",
    tipo: "producto",
    precio: 100,
    itbisTasa: 18,
    inventariable: true,
    impuestoId: info.impuestoItbis18Id,
    cantidad: 3,
    costo: 60,
  });
  if (!contactoId || !prodId) throw new Error("C4: no se pudieron crear datos base");
  const producto: ProductoC = { id: prodId, precio: 100, itbisTasa: 18, impuestoId: info.impuestoItbis18Id };

  const ids: string[] = [];
  const errores: Record<string, number> = {};
  const resultados = await Promise.all(
    clientes.map(async (cli, u) => {
      const r = await crearFacturaB01(cli, medidor, "c4_crear_factura", {
        contactoId,
        producto,
        cantidad: 1,
        fecha: FECHA_JUNIO(12),
        notas: `ZZTEST-C4 U${u}`,
      });
      if (r.id) ids.push(r.id);
      else {
        const m = r.error ?? "desconocido";
        errores[m] = (errores[m] ?? 0) + 1;
      }
      return r;
    }),
  );
  void resultados;

  const { data: prod } = await cli0.from("productos").select("cantidad").eq("id", prodId).maybeSingle();
  const { data: exis } = await cli0.from("existencias").select("cantidad").eq("producto_id", prodId);
  const cantidadProducto = prod ? Number(prod.cantidad) : null;
  const cantidadExistencias = (exis ?? []).reduce((s, e) => s + Number(e.cantidad), 0);
  const esperada = 3 - ids.length;

  return {
    esperado: `existencia final = 3 − ventas creadas (${esperada}); existencias = productos.cantidad`,
    real: {
      ventasCreadas: ids.length,
      productosCantidad: cantidadProducto,
      existenciasCantidad: cantidadExistencias,
      existenciasIgualProductos: cantidadProducto != null && cantidadExistencias === cantidadProducto,
    },
    pasa: cantidadProducto === esperada && cantidadExistencias === cantidadProducto,
    ids,
    errores,
  };
}

// ---------------------------------------------------------------------------
// C5: anular vs pagar la misma factura, 20 veces
// ---------------------------------------------------------------------------

async function c5(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<Escenario> {
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente");
  const contactoId = await crearContacto(cli0, "ZZTEST-C5-Cliente", "cliente", "950000001");
  const prodId = await crearProducto(cli0, {
    nombre: "ZZTEST-C5-Servicio",
    tipo: "servicio",
    precio: 500,
    itbisTasa: 0,
    inventariable: false,
    impuestoId: info.impuestoExentoId,
    cantidad: 0,
    costo: 0,
  });
  if (!contactoId || !prodId) throw new Error("C5: no se pudieron crear datos base");
  const producto = servicioExento(info, prodId, 500);

  const intentos: {
    iteracion: number;
    facturaId: string;
    anulacion: string;
    pago: string;
    estadoFinal: string | null;
    pagadoFinal: number | null;
    resultado: "anulacion" | "pago" | "ambos" | "ninguno" | "otro";
  }[] = [];
  const ids: string[] = [];

  for (let i = 0; i < 20; i++) {
    const creada = await crearFacturaB01(cli0, medidor, "c5_crear_factura", {
      contactoId,
      producto,
      cantidad: 1,
      fecha: FECHA_JUNIO(10),
      notas: `ZZTEST-C5 iteracion ${i}`,
    });
    if (!creada.id) {
      intentos.push({
        iteracion: i,
        facturaId: "",
        anulacion: "-",
        pago: "-",
        estadoFinal: null,
        pagadoFinal: null,
        resultado: "otro",
      });
      continue;
    }
    const facturaId = creada.id;
    ids.push(facturaId);

    const [resAnular, resPago] = await Promise.all([
      medidor.medir(
        "c5_anular",
        () =>
          clientes[i % clientes.length]?.rpc("anular_documento", { p_tipo: "factura", p_id: facturaId }) ??
          Promise.resolve({ data: null, error: { message: "sin cliente" } }),
      ),
      medidor.medir(
        "c5_pago",
        () =>
          clientes[(i + 2) % clientes.length]?.rpc("registrar_pago_recibido", {
            p: {
              factura_id: facturaId,
              contacto_id: contactoId,
              fecha: FECHA_JUNIO(18),
              cuenta_id: info.cajaId,
              metodo: "efectivo",
              monto: 500,
              notas: `ZZTEST-C5 pago iteracion ${i}`,
            },
          }) ?? Promise.resolve({ data: null, error: { message: "sin cliente" } }),
      ),
    ]);

    const final = await traerFactura(cli0, facturaId);
    const estado = final?.estado ?? null;
    const pagado = final?.pagado ?? null;
    const anulada = estado === "anulada";
    const conPago = (pagado ?? 0) > 0;
    const resultado: (typeof intentos)[number]["resultado"] =
      anulada && conPago ? "ambos" : anulada ? "anulacion" : conPago ? "pago" : "ninguno";
    intentos.push({
      iteracion: i,
      facturaId,
      anulacion: resAnular.ok ? "ok" : (resAnular.error ?? "?"),
      pago: resPago.ok ? "ok" : (resPago.error ?? "?"),
      estadoFinal: estado,
      pagadoFinal: pagado,
      resultado,
    });
  }

  const ganadores = intentos.filter((t) => t.resultado === "anulacion" || t.resultado === "pago").length;
  const ambos = intentos.filter((t) => t.resultado === "ambos").length;
  const ningunos = intentos.filter((t) => t.resultado === "ninguno" || t.resultado === "otro").length;

  return {
    esperado: "en cada intento gana uno solo: anulada sin pago, o pagada sin anular",
    real: {
      intentos: intentos.length,
      unSoloGanador: ganadores,
      ambos: ambos,
      ninguno: ningunos,
      detalle: intentos,
    },
    pasa: ambos === 0 && ganadores === intentos.filter((t) => t.facturaId !== "").length,
    ids,
    errores: {},
  };
}

// ---------------------------------------------------------------------------
// C6: cerrar junio 2020 mientras 4 usuarios crean facturas de ese mes
// ---------------------------------------------------------------------------

async function c6(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<Escenario> {
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente");
  const contactoId = await crearContacto(cli0, "ZZTEST-C6-Cliente", "cliente", "960000001");
  const prodId = await crearProducto(cli0, {
    nombre: "ZZTEST-C6-Servicio",
    tipo: "servicio",
    precio: 300,
    itbisTasa: 0,
    inventariable: false,
    impuestoId: info.impuestoExentoId,
    cantidad: 0,
    costo: 0,
  });
  if (!contactoId || !prodId) throw new Error("C6: no se pudieron crear datos base");
  const producto = servicioExento(info, prodId, 300);

  const cierre = clientes[0]?.rpc("cerrar_periodo", { p_periodo: "2020-06-01" });
  const creaciones = clientes.slice(1).map((cli, u) =>
    (async () => {
      const creadas: string[] = [];
      const fallos: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = await crearFacturaB01(cli, medidor, "c6_crear_factura", {
          contactoId,
          producto,
          cantidad: 1,
          fecha: FECHA_JUNIO(15),
          notas: `ZZTEST-C6 U${u} F${i}`,
        });
        if (r.id) creadas.push(r.id);
        else fallos.push(r.error ?? "?");
      }
      return { creadas, fallos };
    })(),
  );
  const [resCierre, ...grupos] = await Promise.all([cierre, ...creaciones]);
  const creadasDurante = grupos.flatMap((g) => g.creadas);
  const erroresDurante = grupos.flatMap((g) => g.fallos);

  // Sondas posteriores al cierre: ninguna debe entrar
  const sondas: { id: string | null; error: string | null }[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await crearFacturaB01(cli0, medidor, "c6_sonda", {
      contactoId,
      producto,
      cantidad: 1,
      fecha: FECHA_JUNIO(16),
      notas: `ZZTEST-C6 sonda ${i}`,
    });
    sondas.push({ id: r.id, error: r.error });
  }

  const reapertura = await cli0?.rpc("reabrir_periodo", { p_periodo: "2020-06-01" });
  const { data: periodo } = await cli0
    .from("periodos_contables")
    .select("estado")
    .eq("periodo", "2020-06-01")
    .maybeSingle();

  const cierreOk = !resCierre?.error;
  const sondasBloqueadas = sondas.every((s) => s.id === null);
  const reabierto = !reapertura?.error && periodo?.estado === "abierto";

  return {
    esperado: "tras el cierre no entra ninguna factura de junio 2020; al final el periodo queda abierto",
    real: {
      cierre: resCierre?.error ? `error: ${resCierre.error.message}` : "ok",
      creadasDuranteLaCarrera: creadasDurante.length,
      fallidasDuranteLaCarrera: erroresDurante.length,
      erroresMuestra: [...new Set(erroresDurante)].slice(0, 3),
      sondas: sondas.map((s) => (s.id ? "creada" : s.error)),
      reapertura: reapertura?.error ? `error: ${reapertura.error.message}` : "ok",
      estadoPeriodoDespues: periodo?.estado ?? null,
    },
    pasa: cierreOk && sondasBloqueadas && reabierto,
    ids: creadasDurante.slice(0, 20),
    errores: {},
  };
}

// ---------------------------------------------------------------------------
// C7: 4 usuarios crean facturas 2 min mientras el 5º abre reportes de 2023
// ---------------------------------------------------------------------------

async function c7(clientes: SupabaseClient[], medidor: Medidor, info: InfoBase): Promise<Escenario> {
  const cli0 = clientes[0];
  const cliReportes = clientes[4];
  if (!cli0 || !cliReportes) throw new Error("sin cliente");
  const contactoId = await crearContacto(cli0, "ZZTEST-C7-Cliente", "cliente", "970000001");
  const prodId = await crearProducto(cli0, {
    nombre: "ZZTEST-C7-Servicio",
    tipo: "servicio",
    precio: 200,
    itbisTasa: 0,
    inventariable: false,
    impuestoId: info.impuestoExentoId,
    cantidad: 0,
    costo: 0,
  });
  if (!contactoId || !prodId) throw new Error("C7: no se pudieron crear datos base");
  const producto = servicioExento(info, prodId, 200);
  const rng = mulberry32(707);

  const reporte607 = (desde: string, hasta: string) =>
    cliReportes
      .from("facturas")
      .select(
        "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, total, pagado, credito, estado, tipo_comprobante, contacto_id, contactos(nombre, rnc_cedula), factura_lineas(subtotal, itbis, itbis_tasa, impuesto_id)",
      )
      .neq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("numero");

  const reporteVentas = () =>
    cliReportes
      .from("facturas")
      .select(
        "id, numero, ncf, tipo_comprobante, contacto_id, fecha, subtotal, descuento, itbis, total, pagado, estado, contactos(nombre)",
      )
      .gte("fecha", "2023-01-01")
      .lte("fecha", "2023-12-31")
      .order("fecha")
      .order("numero")
      .range(0, 999);

  const duracionMs = 120_000;
  const limite = Date.now() + duracionMs;
  let facturasCreadas = 0;
  const errores: Record<string, number> = {};

  const crear = async (cli: SupabaseClient) => {
    while (Date.now() < limite) {
      const r = await crearFacturaB01(cli, medidor, "c7_crear_factura", {
        contactoId,
        producto,
        cantidad: 1,
        fecha: FECHA_JUNIO(enteroAzar(rng, 1, 28)),
        notas: "ZZTEST-C7 factura",
      });
      if (r.id) facturasCreadas += 1;
      else {
        const m = r.error ?? "desconocido";
        errores[m] = (errores[m] ?? 0) + 1;
      }
    }
  };

  const reportar = async () => {
    let turno = 0;
    while (Date.now() < limite) {
      turno += 1;
      if (turno % 3 === 0) {
        await medidor.medir("c7_reporte_ventas_2023", reporteVentas);
      } else if (turno % 3 === 1) {
        await medidor.medir("c7_reporte_607_marzo2023", () => reporte607("2023-03-01", "2023-03-31"));
      } else {
        await medidor.medir("c7_reporte_607_2023", () => reporte607("2023-01-01", "2023-12-31"));
      }
    }
  };

  const lectores = clientes.slice(0, 4);
  await Promise.all([...lectores.map((cli) => crear(cli)), reportar()]);

  return {
    esperado: "facturas p95 < 1 s durante 2 min; nada se cuelga ni da timeout",
    real: { facturasCreadas, duracionSegundos: duracionMs / 1000 },
    pasa: true, // se evalúa con los tiempos del resumen global
    ids: [],
    errores,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const raiz = resolve(__dirname, "..", "..");
  const entorno = cargarEntorno(raiz);
  const clientes = await clientesAutenticados(entorno);
  escribir(`sesiones abiertas: ${clientes.length}`);
  const medidor = new Medidor();
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente 0");
  const info = await cargarInfoBase(cli0);

  const escenarios: Record<string, Escenario> = {};
  const correr = async (nombre: string, fn: () => Promise<Escenario>) => {
    escribir(`== ${nombre} ==`);
    const inicio = Date.now();
    try {
      escenarios[nombre] = await fn();
      const e = escenarios[nombre];
      escribir(
        `${nombre}: ${e?.pasa ? "PASA" : "NO PASA"} — ${JSON.stringify(e?.real).slice(0, 300)} (${Math.round((Date.now() - inicio) / 1000)}s)`,
      );
    } catch (error) {
      escenarios[nombre] = {
        esperado: "",
        real: { excepcion: error instanceof Error ? error.message : String(error) },
        pasa: false,
        ids: [],
        errores: {},
      };
      escribir(`${nombre}: ERROR — ${error instanceof Error ? error.message : error}`);
    }
  };

  await correr("C1", () => c1(clientes, medidor, info));
  await correr("C2", () => c2(clientes, medidor, info));
  await correr("C3", () => c3(clientes, medidor, info));
  await correr("C4", () => c4(clientes, medidor, info));
  await correr("C5", () => c5(clientes, medidor, info));
  await correr("C6", () => c6(clientes, medidor, info));
  await correr("C7", () => c7(clientes, medidor, info));

  const resumen = medidor.resumen();
  const tiemposC7 = resumen["c7_crear_factura"];
  if (tiemposC7 && escenarios.C7) {
    escenarios.C7.pasa = tiemposC7.p95 < 1000;
    escenarios.C7.real = { ...((escenarios.C7.real as object) ?? {}), tiempos: tiemposC7 };
  }

  const salida = {
    generado: new Date().toISOString(),
    escenarios,
    resumenTiempos: resumen,
  };
  writeFileSync(resolve(raiz, "docs", "pruebas", "resultados", "concurrencia.json"), JSON.stringify(salida, null, 2));
  escribir("fin — docs/pruebas/resultados/concurrencia.json");
}

main().catch((error) => {
  console.error("CONCURRENCIA ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
