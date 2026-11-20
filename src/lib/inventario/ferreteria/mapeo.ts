import { z } from "zod";

import type {
  CodigoBarra,
  ComponenteCombo,
  ConteoLinea,
  ConteoResumen,
  Decimal,
  EstadoConteo,
  ProductoCatalogoPos,
  ProductoParaCombo,
  ProductoPosCodigo,
  ProductoStockBajo,
  TipoProducto,
  UnidadMedida,
  UnidadPos,
} from "./tipos";

/**
 * `numeric` de Postgres → texto decimal. Un `number` del driver se convierte
 * sin aritmética (String reproduce el decimal); un string se conserva tal
 * como llega, sin redondear.
 */
export function decimal(valor: number | string | null | undefined): Decimal {
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "0";
  if (typeof valor === "string") {
    const limpio = valor.trim();
    return limpio === "" ? "0" : limpio;
  }
  return "0";
}

/** Igual que `decimal`, pero `null`/vacío se quedan en `null` (precio opcional). */
export function decimalONulo(valor: number | string | null | undefined): Decimal | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" && valor.trim() === "") return null;
  return decimal(valor);
}

export function textoONulo(valor: string | null | undefined): string | null {
  const limpio = valor?.trim() ?? "";
  return limpio === "" ? null : limpio;
}

export function tipoProducto(valor: string | null | undefined): TipoProducto {
  return valor === "servicio" || valor === "combo" ? valor : "producto";
}

export function estadoConteo(valor: string | null | undefined): EstadoConteo {
  return valor === "aplicado" || valor === "anulado" || valor === "borrador" ? valor : "borrador";
}

/**
 * Centavos exactos de un decimal con hasta 2 posiciones, sin multiplicar
 * floats. Se usa solo para ordenar reportes, nunca para guardar.
 */
export function centavosDeDecimal(valor: Decimal): number {
  const negativo = valor.startsWith("-");
  const [entero = "0", fraccion = ""] = valor.replace("-", "").split(".");
  const centavos = Number(entero) * 100 + Number(fraccion.padEnd(2, "0").slice(0, 2));
  if (!Number.isFinite(centavos)) return 0;
  return negativo ? -centavos : centavos;
}

// ---------------------------------------------------------------------------
// Filas de las RPC (los `numeric` pueden venir como number o string según el
// driver; los mapeadores aceptan ambos y la vista siempre expone texto).
// ---------------------------------------------------------------------------

export interface FilaProductoPorCodigo {
  producto_id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  tipo: string;
  unidad_id: string | null;
  unidad_nombre: string | null;
  factor_base: number | string | null;
  precio: number | string;
  itbis_tasa: number | string;
  stock: number | string;
  disponible: number | string | null;
  imagen_path: string | null;
  favorito_pos: boolean;
  codigo: string;
}

export interface FilaProductoCatalogo {
  producto_id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  tipo: string;
  categoria_id: string | null;
  favorito_pos: boolean;
  imagen_path: string | null;
  unidad_medida: string | null;
  precio: number | string;
  itbis_tasa: number | string;
  stock: number | string;
  disponible: number | string | null;
  unidades: unknown;
}

export interface FilaStockBajo {
  producto_id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  ubicacion: string | null;
  almacen_id: string;
  cantidad: number | string;
  minimo: number | string;
  maximo: number | string | null;
  faltante: number | string;
  sugerido: number | string;
}

export interface FilaCodigoBarra {
  id: string;
  producto_id: string;
  unidad_id: string | null;
  codigo: string;
  principal: boolean;
  creado_en: string;
}

export interface FilaUnidadMedida {
  id: string;
  producto_id: string;
  nombre: string;
  factor_base: number | string;
  precio: number | string | null;
  es_compra: boolean;
  es_venta: boolean;
  activa: boolean;
  creado_en: string;
}

export interface FilaComponenteCombo {
  id: string;
  combo_id: string;
  componente_id: string;
  cantidad: number | string;
  componente: { nombre: string; tipo: string; inventariable: boolean } | null;
}

export interface FilaProductoParaCombo {
  id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  inventariable: boolean;
}

export interface FilaConteoLista {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  almacen_id: string;
  notas: string | null;
  ajuste_id: string | null;
  creado_en: string;
  almacenes: { nombre: string } | null;
}

export interface FilaConteoLinea {
  id: string;
  producto_id: string;
  cantidad_sistema: number | string;
  cantidad_contada: number | string;
  diferencia: number | string;
  notas: string | null;
  productos: { nombre: string; referencia: string | null } | null;
}

// ---------------------------------------------------------------------------
// Mapeadores
// ---------------------------------------------------------------------------

export function mapearProductoPorCodigo(fila: FilaProductoPorCodigo): ProductoPosCodigo {
  return {
    producto_id: fila.producto_id,
    nombre: fila.nombre,
    referencia: textoONulo(fila.referencia),
    marca: textoONulo(fila.marca),
    tipo: tipoProducto(fila.tipo),
    unidad_id: fila.unidad_id,
    unidad_nombre: textoONulo(fila.unidad_nombre),
    factor_base: decimal(fila.factor_base),
    precio: decimal(fila.precio),
    itbis_tasa: decimal(fila.itbis_tasa),
    stock: decimal(fila.stock),
    disponible: decimalONulo(fila.disponible),
    imagen_path: textoONulo(fila.imagen_path),
    favorito_pos: fila.favorito_pos,
    codigo: fila.codigo.trim(),
  };
}

export function mapearProductoCatalogo(fila: FilaProductoCatalogo): ProductoCatalogoPos {
  return {
    producto_id: fila.producto_id,
    nombre: fila.nombre,
    referencia: textoONulo(fila.referencia),
    marca: textoONulo(fila.marca),
    tipo: tipoProducto(fila.tipo),
    categoria_id: fila.categoria_id,
    favorito_pos: fila.favorito_pos,
    imagen_path: textoONulo(fila.imagen_path),
    unidad_medida: textoONulo(fila.unidad_medida),
    precio: decimal(fila.precio),
    itbis_tasa: decimal(fila.itbis_tasa),
    stock: decimal(fila.stock),
    disponible: decimalONulo(fila.disponible),
    unidades: mapearUnidadesJson(fila.unidades),
  };
}

const unidadJsonSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  factor_base: z.union([z.number(), z.string()]),
  precio: z.union([z.number(), z.string()]),
});

/** Lee el JSONB `unidades` del catálogo; descarta elementos incompletos. */
export function mapearUnidadesJson(valor: unknown): UnidadPos[] {
  if (!Array.isArray(valor)) return [];

  return valor.flatMap((item) => {
    const parseo = unidadJsonSchema.safeParse(item);
    if (!parseo.success) return [];

    return [
      {
        id: parseo.data.id,
        nombre: parseo.data.nombre,
        factor_base: decimal(parseo.data.factor_base),
        precio: decimal(parseo.data.precio),
      },
    ];
  });
}

export function mapearStockBajo(fila: FilaStockBajo): ProductoStockBajo {
  return {
    producto_id: fila.producto_id,
    nombre: fila.nombre,
    referencia: textoONulo(fila.referencia),
    marca: textoONulo(fila.marca),
    ubicacion: textoONulo(fila.ubicacion),
    almacen_id: fila.almacen_id,
    cantidad: decimal(fila.cantidad),
    minimo: decimal(fila.minimo),
    maximo: decimalONulo(fila.maximo),
    faltante: decimal(fila.faltante),
    sugerido: decimal(fila.sugerido),
  };
}

export function mapearCodigoBarra(fila: FilaCodigoBarra): CodigoBarra {
  return {
    id: fila.id,
    producto_id: fila.producto_id,
    unidad_id: fila.unidad_id,
    codigo: fila.codigo.trim(),
    principal: fila.principal,
    creado_en: fila.creado_en,
  };
}

export function mapearUnidad(fila: FilaUnidadMedida): UnidadMedida {
  return {
    id: fila.id,
    producto_id: fila.producto_id,
    nombre: fila.nombre,
    factor_base: decimal(fila.factor_base),
    precio: decimalONulo(fila.precio),
    es_compra: fila.es_compra,
    es_venta: fila.es_venta,
    activa: fila.activa,
    creado_en: fila.creado_en,
  };
}

export function mapearComponenteCombo(fila: FilaComponenteCombo): ComponenteCombo {
  return {
    id: fila.id,
    combo_id: fila.combo_id,
    componente_id: fila.componente_id,
    componente_nombre: fila.componente?.nombre ?? "—",
    componente_tipo: tipoProducto(fila.componente?.tipo),
    inventariable: fila.componente?.inventariable ?? false,
    cantidad: decimal(fila.cantidad),
  };
}

export function mapearProductoParaCombo(fila: FilaProductoParaCombo): ProductoParaCombo {
  return {
    id: fila.id,
    nombre: fila.nombre,
    referencia: textoONulo(fila.referencia),
    marca: textoONulo(fila.marca),
    inventariable: fila.inventariable,
  };
}

export function mapearConteoResumen(fila: FilaConteoLista): ConteoResumen {
  return {
    id: fila.id,
    numero: fila.numero,
    fecha: fila.fecha,
    estado: estadoConteo(fila.estado),
    almacen_id: fila.almacen_id,
    almacen_nombre: fila.almacenes?.nombre ?? "—",
    notas: fila.notas,
    ajuste_id: fila.ajuste_id,
    creado_en: fila.creado_en,
  };
}

export function mapearConteoLinea(fila: FilaConteoLinea): ConteoLinea {
  return {
    id: fila.id,
    producto_id: fila.producto_id,
    producto_nombre: fila.productos?.nombre ?? "—",
    producto_referencia: textoONulo(fila.productos?.referencia),
    cantidad_sistema: decimal(fila.cantidad_sistema),
    cantidad_contada: decimal(fila.cantidad_contada),
    diferencia: decimal(fila.diferencia),
    notas: fila.notas,
  };
}

/**
 * Orden de criticidad del reporte de stock bajo: `cantidad − minimo`
 * ascendente (primero lo más por debajo del mínimo, incluidos los negativos)
 * y luego por nombre. Se calcula en centavos enteros, nunca con floats.
 */
export function ordenarPorCriticidad(productos: ProductoStockBajo[]): ProductoStockBajo[] {
  return productos.sort((a, b) => {
    const criticidadA = centavosDeDecimal(a.cantidad) - centavosDeDecimal(a.minimo);
    const criticidadB = centavosDeDecimal(b.cantidad) - centavosDeDecimal(b.minimo);
    return criticidadA - criticidadB || a.nombre.localeCompare(b.nombre, "es");
  });
}
