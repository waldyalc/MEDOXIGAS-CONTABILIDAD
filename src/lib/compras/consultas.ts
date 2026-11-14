import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import type { CentroCostoOpcion } from "@/lib/centros-costo/tipos";
import { getRetencionesActivas } from "@/lib/configuracion/consultas";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { createClient } from "@/lib/supabase/server";

import type {
  AlmacenOpcion,
  AsientoDetalle,
  AsientoLinea,
  ContactoOpcion,
  CuentaOpcion,
  DetalleFacturaCompleto,
  FacturaAbierta,
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

export async function listarFacturasProveedor(): Promise<FacturaLista[]> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("facturas_proveedor")
    .select(
      "id, numero, ncf, contacto_id, fecha, vencimiento, total, pagado, credito, retenido, estado, contactos(nombre)",
    )
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<FacturaLista[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
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

export async function listarPagosProveedor(): Promise<PagoLista[]> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .select(
      "id, numero, fecha, metodo, monto, estado, contacto_id, cuenta_id, contactos(nombre), cuentas(nombre), facturas_proveedor(id, numero, ncf)",
    )
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<PagoLista[]>();

  if (error) throw new Error(error.message);

  const pagos = data ?? [];
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

  return pagos.map((pago) => ({ ...pago, aplicaciones: conteo.get(pago.id) ?? 0 }));
}

export async function cargarOpcionesFactura(): Promise<OpcionesFactura> {
  const supabase = await cliente();
  const [contactos, productos, cuentasGasto, centrosCosto, almacenes] = await Promise.all([
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula")
      .in("tipo", ["proveedor", "ambos"])
      .eq("activo", true)
      .order("nombre")
      .returns<ContactoOpcion[]>(),
    supabase
      .from("productos")
      .select("id, nombre, referencia, costo, precio, itbis_tasa, inventariable, tipo")
      .eq("activo", true)
      .order("nombre")
      .returns<ProductoOpcion[]>(),
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
  const [empresa, contactos, cuentasCajaBanco, cuentasGasto, centrosCosto, facturasAbiertas, retenciones, numero] =
    await Promise.all([
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
      supabase
        .from("facturas_proveedor")
        .select(
          "id, numero, ncf, fecha, vencimiento, subtotal, itbis, total, pagado, credito, retenido, contacto_id, contactos(nombre)",
        )
        .eq("estado", "abierta")
        .order("vencimiento")
        .returns<FacturaAbierta[]>(),
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
  if (facturasAbiertas.error) throw new Error(facturasAbiertas.error.message);
  if (numero.error) throw new Error(numero.error.message);

  return {
    empresa,
    contactos: contactos.data ?? [],
    cuentasCajaBanco,
    cuentasGasto: cuentasGasto.data ?? [],
    centrosCosto,
    facturasAbiertas: facturasAbiertas.data ?? [],
    retenciones,
    siguienteNumero: (numero.data?.numero ?? 0) + 1,
  };
}
