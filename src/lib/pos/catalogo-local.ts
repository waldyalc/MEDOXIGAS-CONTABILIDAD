import type { OperacionOffline } from "./cola-offline";
import type { ProductoPOS } from "./tipos";

/**
 * Búsqueda y existencias del catálogo del POS hechas en memoria.
 *
 * El catálogo completo vive en IndexedDB (`ambito/listaPrecioId`). Con la red
 * tambaleando, pedirle la búsqueda al servidor deja el buscador girando; aquí
 * el filtro es puro y responde al instante, y las ventas aún pendientes de
 * subir descuentan la existencia visible para no ofrecer lo ya vendido.
 */

export interface FiltroCatalogoLocal {
  busqueda: string;
  categoria: string;
}

interface LineaVentaLocal {
  producto_id: string;
  cantidad: string;
  unidad_id: string | null;
  factor_base: string | null;
}

const ESCALA = 10_000;

function sinAcentos(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizar(valor: string | null | undefined): string {
  return sinAcentos(valor ?? "").trim();
}

/** Coincide por nombre, referencia o marca, sin acentos ni mayúsculas. */
export function filtrarCatalogoLocal(productos: readonly ProductoPOS[], filtro: FiltroCatalogoLocal): ProductoPOS[] {
  const termino = normalizar(filtro.busqueda);
  return productos.filter((producto) => {
    if (filtro.categoria !== "" && producto.categoria_id !== filtro.categoria) return false;
    if (termino === "") return true;
    return [producto.nombre, producto.referencia ?? "", producto.marca ?? ""].some((valor) =>
      normalizar(valor).includes(termino),
    );
  });
}

/** Pistola del POS sin red: la referencia exacta entre los productos ya cargados. */
export function buscarCodigoLocal(productos: readonly ProductoPOS[], codigo: string): ProductoPOS | null {
  const buscado = codigo.trim().toLowerCase();
  if (buscado === "") return null;
  return productos.find((producto) => (producto.referencia ?? "").trim().toLowerCase() === buscado) ?? null;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function textoDePayload(valor: unknown): string | null {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return null;
}

function lineasDeOperacion(operacion: OperacionOffline): LineaVentaLocal[] {
  const payload = operacion.payload;
  if (!esObjeto(payload) || !Array.isArray(payload.lineas)) return [];

  const lineas: LineaVentaLocal[] = [];
  for (const linea of payload.lineas) {
    if (!esObjeto(linea)) continue;
    const productoId = linea.producto_id;
    const cantidad = textoDePayload(linea.cantidad);
    if (typeof productoId !== "string" || productoId === "" || cantidad === null) continue;

    lineas.push({
      producto_id: productoId,
      cantidad,
      unidad_id: typeof linea.unidad_id === "string" ? linea.unidad_id : null,
      factor_base: textoDePayload(linea.factor_base),
    });
  }
  return lineas;
}

/** Valor decimal como entero en diezmilésimas; `null` si no es un decimal válido. */
function aEscala(valor: string): number | null {
  const texto = valor.trim().replace(",", ".");
  const coincidencia = /^(-)?(\d+)(?:\.(\d*))?$/.exec(texto);
  if (!coincidencia) return null;

  const signo = coincidencia[1] === "-" ? -1 : 1;
  const entero = Number(coincidencia[2] ?? "0");
  const fraccion = Number((coincidencia[3] ?? "").padEnd(4, "0").slice(0, 4));
  const total = entero * ESCALA + fraccion;
  return Number.isSafeInteger(total) ? signo * total : null;
}

/** Texto decimal de dos posiciones, como la columna `numeric(14,2)` de existencias. */
function formatearEscala(valor: number): string {
  const centesimas = Math.round(Math.abs(valor) / 100);
  const entero = Math.floor(centesimas / 100);
  const resto = centesimas % 100;
  return `${valor < 0 ? "-" : ""}${entero}.${String(resto).padStart(2, "0")}`;
}

function restarEscala(base: string, cantidad: number): string | null {
  const baseEscala = aEscala(base);
  if (baseEscala === null) return null;
  return formatearEscala(Math.max(0, baseEscala - cantidad));
}

function factorDeLinea(producto: ProductoPOS, linea: LineaVentaLocal): string {
  if (linea.factor_base) return linea.factor_base;
  if (linea.unidad_id) {
    const unidad = producto.unidades.find((candidata) => candidata.id === linea.unidad_id);
    if (unidad) return unidad.factor_base;
  }
  return "1";
}

/**
 * Descuenta de `stock` y `disponible` lo vendido en operaciones que todavía no
 * suben al servidor. Servicios, combos y productos sin disponibilidad conocida
 * se dejan intactos: nunca se inventa existencia.
 */
export function aplicarDescuentoStockLocal(
  productos: readonly ProductoPOS[],
  operaciones: readonly OperacionOffline[],
): ProductoPOS[] {
  const lineasPendientes = new Map<string, LineaVentaLocal[]>();

  for (const operacion of operaciones) {
    if (operacion.tipo !== "venta" || operacion.estado !== "pendiente") continue;
    for (const linea of lineasDeOperacion(operacion)) {
      const actuales = lineasPendientes.get(linea.producto_id);
      if (actuales) actuales.push(linea);
      else lineasPendientes.set(linea.producto_id, [linea]);
    }
  }

  if (lineasPendientes.size === 0) return [...productos];

  return productos.map((producto) => {
    const lineas = lineasPendientes.get(producto.producto_id);
    if (!lineas || producto.tipo !== "producto" || producto.disponible === null) return producto;

    let vendido = 0;
    for (const linea of lineas) {
      const factor = aEscala(factorDeLinea(producto, linea));
      const cantidad = aEscala(linea.cantidad);
      if (factor === null || cantidad === null) return producto;
      vendido += Math.round((cantidad * factor) / ESCALA);
    }

    const stock = restarEscala(producto.stock, vendido);
    const disponible = restarEscala(producto.disponible, vendido);
    if (stock === null || disponible === null) return producto;
    return { ...producto, stock, disponible };
  });
}
