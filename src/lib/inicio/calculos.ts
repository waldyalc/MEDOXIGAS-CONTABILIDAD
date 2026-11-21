/**
 * Agregaciones puras de los widgets secundarios del Inicio. Reciben filas ya
 * leídas de Supabase (en centavos) y devuelven lo que dibuja cada tarjeta;
 * separadas de `consultas.ts` para probarlas sin base.
 */

export interface LineaMovimiento {
  asientoId: string;
  cuentaId: string;
  debito: number;
  credito: number;
}

export interface PuntoFlujo {
  /** ISO yyyy-mm-dd; solo días con movimiento. */
  fecha: string;
  ingresos: number;
  egresos: number;
}

export interface FlujoTransacciones {
  puntos: PuntoFlujo[];
  totalIngresos: number;
  totalEgresos: number;
  /** % contra el período anterior del mismo largo; null si no hay base. */
  variacionIngresos: number | null;
  variacionEgresos: number | null;
}

export interface GastoParticipacion {
  nombre: string;
  valor: number;
  participacion: number;
}

export interface DistribucionGastos {
  items: GastoParticipacion[];
  total: number;
}

export interface TopProducto {
  nombre: string;
  /** Referencia (SKU) del producto; alimenta el avatar de la tabla. */
  referencia: string | null;
  items: number;
  total: number;
}

export interface TopCliente {
  nombre: string;
  documentos: number;
  total: number;
}

/** % de cambio contra la base; null cuando no hay base para comparar. */
export function variacionPct(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

/**
 * Entradas y salidas de las cuentas de caja/banco agrupadas por día. Las
 * líneas del período anterior solo alimentan los totales de comparación.
 */
export function agruparFlujo(
  lineas: readonly LineaMovimiento[],
  fechaPorAsiento: ReadonlyMap<string, string>,
  cuentasCajaBanco: ReadonlySet<string>,
  hastaAnterior: string,
): FlujoTransacciones {
  const porFecha = new Map<string, PuntoFlujo>();
  let anteriorIngresos = 0;
  let anteriorEgresos = 0;

  for (const linea of lineas) {
    if (!cuentasCajaBanco.has(linea.cuentaId)) continue;
    const fecha = fechaPorAsiento.get(linea.asientoId);
    if (fecha == null) continue;

    if (fecha <= hastaAnterior) {
      anteriorIngresos += linea.debito;
      anteriorEgresos += linea.credito;
      continue;
    }

    let punto = porFecha.get(fecha);
    if (punto == null) {
      punto = { fecha, ingresos: 0, egresos: 0 };
      porFecha.set(fecha, punto);
    }
    punto.ingresos += linea.debito;
    punto.egresos += linea.credito;
  }

  const puntos = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const totalIngresos = puntos.reduce((suma, punto) => suma + punto.ingresos, 0);
  const totalEgresos = puntos.reduce((suma, punto) => suma + punto.egresos, 0);

  return {
    puntos,
    totalIngresos,
    totalEgresos,
    variacionIngresos: variacionPct(totalIngresos, anteriorIngresos),
    variacionEgresos: variacionPct(totalEgresos, anteriorEgresos),
  };
}

/**
 * Top 5 de cuentas de gasto por movimiento neto (débito - crédito) del
 * período. `participacion` es el % sobre el total de gasto, con 2 decimales.
 */
export function agruparGastos(
  lineas: readonly LineaMovimiento[],
  fechaPorAsiento: ReadonlyMap<string, string>,
  cuentasGasto: ReadonlySet<string>,
  nombrePorCuenta: ReadonlyMap<string, string>,
  hastaAnterior: string,
): DistribucionGastos {
  const porCuenta = new Map<string, number>();

  for (const linea of lineas) {
    if (!cuentasGasto.has(linea.cuentaId)) continue;
    const fecha = fechaPorAsiento.get(linea.asientoId);
    if (fecha == null || fecha <= hastaAnterior) continue;
    porCuenta.set(linea.cuentaId, (porCuenta.get(linea.cuentaId) ?? 0) + linea.debito - linea.credito);
  }

  const items = [...porCuenta.entries()]
    .filter(([, valor]) => valor > 0)
    .map(([cuentaId, valor]) => ({ nombre: nombrePorCuenta.get(cuentaId) ?? "Gasto", valor }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 5);

  const total = items.reduce((suma, item) => suma + item.valor, 0);

  return {
    items: items.map((item) => ({
      ...item,
      participacion: total > 0 ? Math.round((item.valor / total) * 10000) / 100 : 0,
    })),
    total,
  };
}

export interface LineaVentaTop {
  productoId: string | null;
  descripcion: string;
  cantidad: number;
  total: number;
  nombreProducto: string | null;
  referenciaProducto: string | null;
}

/** Top 5 de productos por total vendido (impuestos incluidos). */
export function agruparTopProductos(lineas: readonly LineaVentaTop[]): TopProducto[] {
  const porProducto = new Map<string, TopProducto>();

  for (const linea of lineas) {
    const clave = linea.productoId ?? `texto:${linea.descripcion}`;
    let producto = porProducto.get(clave);
    if (producto == null) {
      producto = {
        nombre: linea.nombreProducto ?? linea.descripcion,
        referencia: linea.referenciaProducto,
        items: 0,
        total: 0,
      };
      porProducto.set(clave, producto);
    }
    producto.items += linea.cantidad;
    producto.total += linea.total;
  }

  return [...porProducto.values()]
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 5);
}

export interface FacturaTop {
  contactoId: string;
  total: number;
  nombreContacto: string;
}

/** Top 5 de clientes por total vendido (impuestos incluidos). */
export function agruparTopClientes(facturas: readonly FacturaTop[]): TopCliente[] {
  const porCliente = new Map<string, TopCliente>();

  for (const factura of facturas) {
    let cliente = porCliente.get(factura.contactoId);
    if (cliente == null) {
      cliente = { nombre: factura.nombreContacto, documentos: 0, total: 0 };
      porCliente.set(factura.contactoId, cliente);
    }
    cliente.documentos += 1;
    cliente.total += factura.total;
  }

  return [...porCliente.values()]
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 5);
}

/**
 * Iniciales del avatar de las tablas del Inicio: primera letra de la primera
 * palabra + primera de la última; una sola palabra aporta sus dos primeras.
 */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "·";
  const primera = palabras[0] ?? "";
  if (palabras.length === 1) return primera.slice(0, 2).toUpperCase();
  const ultima = palabras[palabras.length - 1] ?? "";
  return `${primera[0] ?? ""}${ultima[0] ?? ""}`.toUpperCase();
}
