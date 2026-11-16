import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import type { CentroCostoOpcion } from "@/lib/centros-costo/tipos";
import { getRetencionesActivas } from "@/lib/configuracion/consultas";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { limpiarBusqueda, numeroDocumento, patronIlike } from "@/lib/listas/busqueda";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import type {
  AlmacenOpcion,
  AsientoDetalle,
  AsientoLinea,
  ContactoOpcion,
  CuentaOpcion,
  DetalleFacturaCompleto,
  FacturaLista,
  LineaDetalle,
  OpcionesFactura,
  OpcionesPago,
  PagoLista,
  PagoProveedorVista,
  ProductoOpcion,
} from "./tipos";

async function cliente() {
  return createClient();
}

const CAMPOS_FACTURA_LISTA =
  "id, numero, ncf, contacto_id, fecha, vencimiento, total, pagado, credito, retenido, estado, contactos(nombre)";

const LIMITE_IDS_BUSQUEDA = 200;

type Cliente = Awaited<ReturnType<typeof cliente>>;

async function contactosQueCoinciden(supabase: Cliente, q: string): Promise<string[]> {
  const patron = patronIlike(q);
  const { data, error } = await supabase
    .from("contactos")
    .select("id")
    .or(`nombre.ilike.${patron},rnc_cedula.ilike.${patron}`)
    .limit(LIMITE_IDS_BUSQUEDA);

  if (error) throw new Error(error.message);
  return (data ?? []).map((contacto) => contacto.id);
}

async function facturasProveedorQueCoinciden(supabase: Cliente, q: string): Promise<string[]> {
  const numero = numeroDocumento(q);
  let consulta = supabase.from("facturas_proveedor").select("id");

  consulta = numero != null ? consulta.eq("numero", numero) : consulta.or(`ncf.ilike.${patronIlike(q)}`);

  const { data, error } = await consulta.limit(LIMITE_IDS_BUSQUEDA);

  if (error) throw new Error(error.message);
  return (data ?? []).map((factura) => factura.id);
}

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export async function listarFacturasProveedor(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<FacturaLista>> {
  const supabase = await cliente();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const idsContactos = q && numero == null ? await contactosQueCoinciden(supabase, q) : [];

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase.from("facturas_proveedor").select(CAMPOS_FACTURA_LISTA, { count: "exact" });

    if (q) {
      const condiciones: string[] = [];
      if (numero != null) condiciones.push(`numero.eq.${numero}`);
      else condiciones.push(`ncf.ilike.${patronIlike(q)}`);
      if (idsContactos.length > 0) condiciones.push(`contacto_id.in.(${idsContactos.join(",")})`);
      consulta = consulta.or(condiciones.join(","));
    }

    const { data, error, count } = await consulta
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .range(desde, hasta)
      .returns<FacturaLista[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);

  if (resumen.pagina !== opciones.pagina && primera.filas.length === 0) {
    const ultima = await consultar(resumen.pagina);
    return { filas: ultima.filas, resumen };
  }

  return { filas: primera.filas, resumen };
}

export async function obtenerFacturaProveedor(id: string): Promise<DetalleFacturaCompleto | null> {
  const supabase = await cliente();
  const { data: factura, error } = await supabase
    .from("facturas_proveedor")
    .select(
      "id, numero, ncf, contacto_id, fecha, vencimiento, subtotal, itbis, total, pagado, credito, retenido, estado, notas, asiento_id, contactos(nombre, rnc_cedula)",
    )
    .eq("id", id)
    .maybeSingle<DetalleFacturaCompleto["factura"]>();

  if (error) throw new Error(error.message);
  if (!factura) return null;

  const [lineas, pagos, aplicaciones] = await Promise.all([
    supabase
      .from("facturas_proveedor_lineas")
      .select(
        "id, descripcion, cantidad, costo, itbis_tasa, subtotal, itbis, total, producto_id, cuenta_id, productos(nombre), cuentas(codigo, nombre)",
      )
      .eq("factura_proveedor_id", id)
      .order("id")
      .returns<LineaDetalle[]>(),
    supabase
      .from("pagos_proveedor")
      .select("id, numero, fecha, metodo, monto, estado, cuenta_id")
      .eq("factura_proveedor_id", id)
      .order("fecha")
      .returns<PagoProveedorVista[]>(),
    supabase
      .from("pago_proveedor_aplicaciones")
      .select("pago_id, monto, pagos_proveedor(id, numero, fecha, metodo, monto, estado, cuenta_id)")
      .eq("factura_proveedor_id", id)
      .returns<
        {
          pago_id: string;
          monto: number;
          pagos_proveedor: {
            id: string;
            numero: number;
            fecha: string;
            metodo: string;
            monto: number;
            estado: "activo" | "anulado";
            cuenta_id: string;
          } | null;
        }[]
      >(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (pagos.error) throw new Error(pagos.error.message);
  if (aplicaciones.error) throw new Error(aplicaciones.error.message);

  const pagosAplicados: PagoProveedorVista[] = (aplicaciones.data ?? []).flatMap((aplicacion) => {
    const pago = aplicacion.pagos_proveedor;
    if (!pago) return [];
    return [
      {
        id: pago.id,
        numero: pago.numero,
        fecha: pago.fecha,
        metodo: pago.metodo as PagoProveedorVista["metodo"],
        monto: aplicacion.monto,
        estado: pago.estado,
        cuenta_id: pago.cuenta_id,
      },
    ];
  });
  const idsAplicados = new Set(pagosAplicados.map((pago) => pago.id));
  const pagosFactura = [...pagos.data.filter((pago) => !idsAplicados.has(pago.id)), ...pagosAplicados].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero,
  );

  if (!factura.asiento_id) {
    return { factura, lineas: lineas.data ?? [], asiento: null, lineasAsiento: [], pagos: pagosFactura };
  }

  const { data: asiento, error: errorAsiento } = await supabase
    .from("asientos")
    .select("id, numero, fecha, descripcion, total")
    .eq("id", factura.asiento_id)
    .maybeSingle<AsientoDetalle>();

  if (errorAsiento) throw new Error(errorAsiento.message);

  if (!asiento) {
    return { factura, lineas: lineas.data ?? [], asiento: null, lineasAsiento: [], pagos: pagosFactura };
  }

  const { data: lineasAsiento, error: errorLineasAsiento } = await supabase
    .from("asiento_lineas")
    .select("id, cuenta_id, descripcion, debito, credito, cuentas(codigo, nombre)")
    .eq("asiento_id", asiento.id)
    .order("debito", { ascending: false })
    .returns<AsientoLinea[]>();

  if (errorLineasAsiento) throw new Error(errorLineasAsiento.message);

  return {
    factura,
    lineas: lineas.data ?? [],
    asiento,
    lineasAsiento: lineasAsiento ?? [],
    pagos: pagosFactura,
  };
}

const ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

async function pagosQueCubrenFacturas(supabase: Cliente, idsFacturas: readonly string[]): Promise<string[]> {
  if (idsFacturas.length === 0) return [];

  const { data, error } = await supabase
    .from("pago_proveedor_aplicaciones")
    .select("pago_id")
    .in("factura_proveedor_id", idsFacturas)
    .limit(LIMITE_IDS_BUSQUEDA);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((aplicacion) => aplicacion.pago_id))];
}

function filtroPagos(
  q: string,
  idsContactos: readonly string[],
  idsFacturas: readonly string[],
  idsPagos: readonly string[],
): string | null {
  if (!q) return null;

  const condiciones: string[] = [];
  const numero = numeroDocumento(q);
  if (numero != null) condiciones.push(`numero.eq.${numero}`);
  if (idsContactos.length > 0) condiciones.push(`contacto_id.in.(${idsContactos.join(",")})`);
  if (idsFacturas.length > 0) condiciones.push(`factura_proveedor_id.in.(${idsFacturas.join(",")})`);
  if (idsPagos.length > 0) condiciones.push(`id.in.(${idsPagos.join(",")})`);

  return condiciones.length > 0 ? condiciones.join(",") : ID_INEXISTENTE;
}

export async function listarPagosProveedor(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<PagoLista>> {
  const supabase = await cliente();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const [idsContactos, idsFacturas] = await Promise.all([
    q && numero == null ? contactosQueCoinciden(supabase, q) : Promise.resolve<string[]>([]),
    q ? facturasProveedorQueCoinciden(supabase, q) : Promise.resolve<string[]>([]),
  ]);
  const idsPagos = await pagosQueCubrenFacturas(supabase, idsFacturas);
  const filtro = filtroPagos(q, idsContactos, idsFacturas, idsPagos);

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase
      .from("pagos_proveedor")
      .select(
        "id, numero, fecha, metodo, monto, estado, contacto_id, cuenta_id, contactos(nombre), cuentas(nombre), facturas_proveedor(id, numero, ncf)",
        { count: "exact" },
      );

    if (filtro === ID_INEXISTENTE) consulta = consulta.eq("id", ID_INEXISTENTE);
    else if (filtro) consulta = consulta.or(filtro);

    const { data, error, count } = await consulta
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .range(desde, hasta)
      .returns<PagoLista[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const pagos =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  const ids = pagos.map((pago) => pago.id);
  const { data: aplicaciones, error: errorAplicaciones } =
    ids.length === 0
      ? { data: [] as { pago_id: string }[], error: null }
      : await supabase
          .from("pago_proveedor_aplicaciones")
          .select("pago_id")
          .in("pago_id", ids)
          .returns<{ pago_id: string }[]>();

  if (errorAplicaciones) throw new Error(errorAplicaciones.message);

  const conteo = new Map<string, number>();
  for (const aplicacion of aplicaciones ?? []) {
    conteo.set(aplicacion.pago_id, (conteo.get(aplicacion.pago_id) ?? 0) + 1);
  }

  return {
    filas: pagos.map((pago) => ({ ...pago, aplicaciones: conteo.get(pago.id) ?? 0 })),
    resumen,
  };
}

export async function cargarOpcionesFactura(): Promise<OpcionesFactura> {
  const supabase = await cliente();
  const [contactos, productos, cuentasGasto, centrosCosto, almacenes, impuestos] = await Promise.all([
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula")
      .in("tipo", ["proveedor", "ambos"])
      .eq("activo", true)
      .order("nombre")
      .returns<ContactoOpcion[]>(),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("productos")
        .select("id, nombre, referencia, costo, precio, itbis_tasa, impuesto_id, inventariable, tipo")
        .eq("activo", true)
        .order("nombre")
        .order("id")
        .range(inicio, fin)
        .returns<ProductoOpcion[]>(),
    ),
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, es_caja_banco")
      .eq("tipo", "gasto")
      .eq("acepta_movimientos", true)
      .eq("activa", true)
      .order("codigo")
      .returns<CuentaOpcion[]>(),
    supabase
      .from("centros_costo")
      .select("id, codigo, nombre")
      .eq("activo", true)
      .order("codigo")
      .returns<CentroCostoOpcion[]>(),
    supabase
      .from("almacenes")
      .select("id, nombre, es_principal")
      .eq("activo", true)
      .order("es_principal", { ascending: false })
      .order("nombre")
      .returns<AlmacenOpcion[]>(),
    getImpuestosActivos(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (productos.error) throw new Error(productos.error.message);
  if (cuentasGasto.error) throw new Error(cuentasGasto.error.message);
  if (centrosCosto.error) throw new Error(centrosCosto.error.message);
  if (almacenes.error) throw new Error(almacenes.error.message);

  return {
    contactos: contactos.data ?? [],
    productos: productos.data ?? [],
    cuentasGasto: cuentasGasto.data ?? [],
    centrosCosto: centrosCosto.data ?? [],
    almacenes: almacenes.data ?? [],
    impuestos,
  };
}

export async function cargarCuentasCajaBanco(): Promise<CuentaOpcion[]> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo, es_caja_banco")
    .eq("es_caja_banco", true)
    .eq("acepta_movimientos", true)
    .eq("activa", true)
    .order("codigo")
    .returns<CuentaOpcion[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function cargarOpcionesPago(): Promise<OpcionesPago> {
  const supabase = await cliente();
  const [empresa, contactos, cuentasCajaBanco, cuentasGasto, centrosCosto, retenciones, numero] = await Promise.all([
    getEmpresa(),
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula")
      .in("tipo", ["proveedor", "ambos"])
      .eq("activo", true)
      .order("nombre")
      .returns<ContactoOpcion[]>(),
    cargarCuentasCajaBanco(),
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, es_caja_banco")
      .in("tipo", ["gasto", "costo"])
      .eq("acepta_movimientos", true)
      .eq("activa", true)
      .order("codigo")
      .returns<CuentaOpcion[]>(),
    getCentrosCostoActivos(),
    getRetencionesActivas(),
    supabase
      .from("pagos_proveedor")
      .select("numero")
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle<{ numero: number }>(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (cuentasGasto.error) throw new Error(cuentasGasto.error.message);
  if (numero.error) throw new Error(numero.error.message);

  return {
    empresa,
    contactos: contactos.data ?? [],
    cuentasCajaBanco,
    cuentasGasto: cuentasGasto.data ?? [],
    centrosCosto,
    retenciones,
    siguienteNumero: (numero.data?.numero ?? 0) + 1,
  };
}
