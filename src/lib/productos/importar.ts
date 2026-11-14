import type { CategoriaProducto } from "@/lib/inventario/tipos";

import {
  type DatosProducto,
  normalizarNombre,
  normalizarReferencia,
  type Producto,
  type ProductoTipo,
  parsearMonto,
  SIN_CATEGORIA,
  type TasaItbis,
  textoOpcional,
} from "./productos";

export type ClaveImportacion =
  | "nombre"
  | "referencia"
  | "tipo"
  | "precio"
  | "itbis_tasa"
  | "costo"
  | "unidad"
  | "categoria"
  | "descripcion";

export const COLUMNAS_IMPORTACION: { clave: ClaveImportacion; titulo: string }[] = [
  { clave: "nombre", titulo: "nombre" },
  { clave: "referencia", titulo: "referencia" },
  { clave: "tipo", titulo: "tipo" },
  { clave: "precio", titulo: "precio" },
  { clave: "itbis_tasa", titulo: "ITBIS" },
  { clave: "costo", titulo: "costo inicial" },
  { clave: "unidad", titulo: "unidad" },
  { clave: "categoria", titulo: "categoría" },
  { clave: "descripcion", titulo: "descripción" },
];

const SINONIMOS: Record<ClaveImportacion, readonly string[]> = {
  nombre: ["nombre", "producto", "nombre producto", "nombre del producto"],
  referencia: ["referencia", "codigo", "sku"],
  tipo: ["tipo", "tipo producto", "tipo de producto"],
  precio: ["precio", "precio venta", "precio de venta"],
  itbis_tasa: ["itbis", "itbis tasa", "tasa itbis", "impuesto"],
  costo: ["costo", "costo inicial", "costo unitario"],
  unidad: ["unidad", "unidad de medida", "um"],
  categoria: ["categoria", "categoria producto", "categoria de producto"],
  descripcion: ["descripcion", "detalle"],
};

export function etiquetaColumna(clave: ClaveImportacion) {
  return COLUMNAS_IMPORTACION.find((columna) => columna.clave === clave)?.titulo ?? clave;
}

export function plantillaCsv() {
  return `\uFEFF${COLUMNAS_IMPORTACION.map((columna) => columna.titulo).join(",")}\n`;
}

function valorTextoObjeto(objeto: Record<string, unknown>): string {
  if ("result" in objeto) return valorTexto(objeto.result);
  if ("text" in objeto) return valorTexto(objeto.text);
  if (!("richText" in objeto) || !Array.isArray(objeto.richText)) return "";

  return objeto.richText
    .map((parte) => {
      if (parte === null || typeof parte !== "object") return "";
      return valorTexto((parte as Record<string, unknown>).text);
    })
    .join("")
    .trim();
}

export function valorTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? "" : valor.toISOString().slice(0, 10);
  if (typeof valor === "object") return valorTextoObjeto(valor as Record<string, unknown>);
  return "";
}

function sinAcentos(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizarCabecera(valor: unknown) {
  return sinAcentos(valorTexto(valor))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function mapearColumnas(encabezados: readonly unknown[]): Partial<Record<ClaveImportacion, number>> {
  const mapa: Partial<Record<ClaveImportacion, number>> = {};
  encabezados.forEach((valor, indice) => {
    const normalizado = normalizarCabecera(valor);
    if (normalizado === "") return;

    for (const [clave, sinonimos] of Object.entries(SINONIMOS) as [ClaveImportacion, readonly string[]][]) {
      if (mapa[clave] === undefined && sinonimos.includes(normalizado)) {
        mapa[clave] = indice;
        return;
      }
    }
  });
  return mapa;
}

function contarDelimitadores(linea: string, delimitador: string) {
  let total = 0;
  let entreComillas = false;

  for (let indice = 0; indice < linea.length; indice++) {
    const caracter = linea.charAt(indice);
    if (caracter === '"') {
      if (entreComillas && linea.charAt(indice + 1) === '"') {
        indice++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (!entreComillas && caracter === delimitador) {
      total++;
    }
  }

  return total;
}

function detectarDelimitador(texto: string) {
  const primeraLinea = texto.split(/\r?\n/).find((linea) => linea.trim() !== "") ?? "";
  const candidatos = [",", ";", "\t"];

  return candidatos.reduce((mejor, candidato) =>
    contarDelimitadores(primeraLinea, candidato) > contarDelimitadores(primeraLinea, mejor) ? candidato : mejor,
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: el parser CSV necesita la máquina de estados de comillas para soportar comas y saltos dentro de una celda.
export function parsearCsv(texto: string): string[][] {
  const contenido = texto.replace(/^\uFEFF/, "");
  const delimitador = detectarDelimitador(contenido);
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let indice = 0; indice < contenido.length; indice++) {
    const caracter = contenido.charAt(indice);

    if (entreComillas) {
      if (caracter === '"') {
        if (contenido.charAt(indice + 1) === '"') {
          celda += '"';
          indice++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === delimitador) {
      fila.push(celda.trim());
      celda = "";
    } else if (caracter === "\n") {
      fila.push(celda.trim());
      filas.push(fila);
      fila = [];
      celda = "";
    } else if (caracter !== "\r") {
      celda += caracter;
    }
  }

  if (celda !== "" || fila.length > 0) {
    fila.push(celda.trim());
    filas.push(fila);
  }

  return filas.filter((registro) => registro.some((valor) => valor !== ""));
}

export interface ProductoImportado {
  nombre: string;
  tipo: ProductoTipo;
  referencia: string | null;
  descripcion: string | null;
  precio: number;
  itbis_tasa: TasaItbis;
  impuesto_id: string | null;
  costo: number;
  inventariable: boolean;
  cantidad: number;
  categoria_id: string | null;
  unidad: string | null;
}

export interface ValoresFilaImportacion {
  nombre: string;
  referencia: string;
  tipo: string;
  precio: string;
  itbis: string;
}

export interface FilaImportacion {
  numero: number;
  datos: ProductoImportado | null;
  errores: string[];
  valores: ValoresFilaImportacion;
}

export interface ResultadoImportacion {
  filas: FilaImportacion[];
  errorGeneral: string | null;
  columnasFaltantes: ClaveImportacion[];
}

function celda(fila: readonly unknown[], mapa: Partial<Record<ClaveImportacion, number>>, clave: ClaveImportacion) {
  const indice = mapa[clave];
  return indice === undefined ? "" : valorTexto(fila[indice]);
}

function normalizarTipo(valor: string): ProductoTipo | null {
  const texto = sinAcentos(valor);
  if (texto === "producto") return "producto";
  if (texto === "servicio") return "servicio";
  return null;
}

function itbisDesdeTexto(valor: string): TasaItbis | null {
  const limpio = valor.replace(/%/g, "").replace(",", ".").trim();
  if (limpio === "") return 18;

  const numero = Number(limpio);
  if (numero === 0) return 0;
  if (numero === 16) return 16;
  if (numero === 18) return 18;
  return null;
}

function normalizarCategoria(valor: string) {
  return sinAcentos(valor).replace(/\s+/g, " ").trim();
}

function validarNombre(valor: string) {
  const nombre = normalizarNombre(valor);
  if (nombre === "") return { nombre, error: "El nombre es obligatorio." };
  if (nombre.length > 200) return { nombre, error: "El nombre no puede pasar de 200 caracteres." };
  return { nombre, error: null };
}

function validarTipo(valor: string) {
  if (valor === "") return { tipo: "producto" as ProductoTipo, error: null };
  const tipo = normalizarTipo(valor);
  return tipo === null
    ? { tipo: "producto" as ProductoTipo, error: "El tipo debe ser «Producto» o «Servicio»." }
    : { tipo, error: null };
}

function validarPrecio(valor: string) {
  const precio = parsearMonto(valor);
  if (precio !== null) return { precio, error: null };
  return { precio: null, error: valor === "" ? "El precio es obligatorio." : "El precio no es válido." };
}

function validarCosto(valor: string) {
  if (valor === "") return { costo: 0, error: null };
  const costo = parsearMonto(valor);
  return costo === null ? { costo: null, error: "El costo inicial no es válido." } : { costo, error: null };
}

function validarCategoria(valor: string, categorias: Map<string, CategoriaProducto>) {
  if (valor === "") return { id: null, error: null };
  const categoria = categorias.get(normalizarCategoria(valor));
  return categoria === undefined
    ? { id: null, error: `La categoría «${valor}» no existe.` }
    : { id: categoria.id, error: null };
}

function validarFila(
  fila: readonly unknown[],
  numero: number,
  mapa: Partial<Record<ClaveImportacion, number>>,
  categorias: Map<string, CategoriaProducto>,
): FilaImportacion {
  const nombre = validarNombre(celda(fila, mapa, "nombre"));
  const tipo = validarTipo(celda(fila, mapa, "tipo"));
  const precio = validarPrecio(celda(fila, mapa, "precio"));
  const itbis = itbisDesdeTexto(celda(fila, mapa, "itbis_tasa"));
  const costo = validarCosto(celda(fila, mapa, "costo"));
  const categoria = validarCategoria(celda(fila, mapa, "categoria"), categorias);

  const errores = [
    nombre.error,
    tipo.error,
    precio.error,
    itbis === null ? "El ITBIS debe ser 18, 16 o 0." : null,
    costo.error,
    categoria.error,
  ].filter((error): error is string => error !== null);

  const datos: ProductoImportado | null =
    errores.length === 0 && precio.precio !== null && costo.costo !== null && itbis !== null
      ? {
          nombre: nombre.nombre,
          tipo: tipo.tipo,
          referencia: textoOpcional(normalizarReferencia(celda(fila, mapa, "referencia"))),
          descripcion: textoOpcional(celda(fila, mapa, "descripcion")),
          precio: precio.precio,
          itbis_tasa: itbis,
          impuesto_id: null,
          costo: tipo.tipo === "producto" ? costo.costo : 0,
          inventariable: tipo.tipo === "producto",
          cantidad: 0,
          categoria_id: categoria.id,
          unidad: textoOpcional(celda(fila, mapa, "unidad")),
        }
      : null;

  return {
    numero,
    datos,
    errores,
    valores: {
      nombre: celda(fila, mapa, "nombre"),
      referencia: celda(fila, mapa, "referencia"),
      tipo: celda(fila, mapa, "tipo"),
      precio: celda(fila, mapa, "precio"),
      itbis: celda(fila, mapa, "itbis_tasa"),
    },
  };
}

export function validarFilasImportacion(
  filas: readonly (readonly unknown[])[],
  categorias: readonly CategoriaProducto[],
): ResultadoImportacion {
  if (filas.length === 0) {
    return { filas: [], errorGeneral: "El archivo está vacío.", columnasFaltantes: [] };
  }

  const mapa = mapearColumnas(filas[0] ?? []);
  const faltantes = (["nombre", "precio"] as const).filter((clave) => mapa[clave] === undefined);

  if (faltantes.length > 0) {
    return {
      filas: [],
      errorGeneral: `Faltan columnas obligatorias: ${faltantes.map(etiquetaColumna).join(", ")}.`,
      columnasFaltantes: faltantes,
    };
  }

  const categoriasPorNombre = new Map<string, CategoriaProducto>();
  for (const categoria of categorias) {
    categoriasPorNombre.set(normalizarCategoria(categoria.nombre), categoria);
  }

  const resultado: FilaImportacion[] = [];

  for (let indice = 1; indice < filas.length; indice++) {
    const fila = filas[indice] ?? [];
    if (fila.every((valor) => valorTexto(valor) === "")) continue;
    resultado.push(validarFila(fila, indice + 1, mapa, categoriasPorNombre));
  }

  return {
    filas: resultado,
    errorGeneral: resultado.length === 0 ? "El archivo no tiene filas de datos." : null,
    columnasFaltantes: [],
  };
}

export interface CambiosEdicionMasiva {
  precioModo: "sin_cambio" | "fijo" | "porcentaje";
  precioFijo: string;
  porcentaje: string;
  itbisTasa: string;
  categoriaId: string;
  activo: "" | "activo" | "inactivo";
}

export interface FilaEdicionMasiva {
  producto: Producto;
  datos: DatosProducto;
}

export interface ResultadoEdicionMasiva {
  filas: FilaEdicionMasiva[];
  error: string | null;
}

function redondearMonto(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function parsearPorcentaje(texto: string): number | null {
  const limpio = texto.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return null;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(limpio)) return null;

  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

interface CambiosNormalizados {
  precioFijo: number | null;
  porcentaje: number | null;
  itbis: DatosProducto["itbis_tasa"] | null;
  categoria: { cambia: boolean; id: string | null };
  activo: boolean | undefined;
}

function normalizarPrecio(cambios: CambiosEdicionMasiva) {
  if (cambios.precioModo === "fijo") {
    const precioFijo = parsearMonto(cambios.precioFijo);
    return precioFijo === null
      ? { precioFijo: null, porcentaje: null, error: "Escribe un precio fijo válido." }
      : { precioFijo, porcentaje: null, error: null };
  }

  if (cambios.precioModo === "porcentaje") {
    const porcentaje = parsearPorcentaje(cambios.porcentaje);
    return porcentaje === null
      ? { precioFijo: null, porcentaje: null, error: "Escribe un porcentaje válido (puede ser negativo)." }
      : { precioFijo: null, porcentaje, error: null };
  }

  return { precioFijo: null, porcentaje: null, error: null };
}

function normalizarItbis(valor: string) {
  if (valor === "0") return { itbis: 0 as const, error: null };
  if (valor === "16") return { itbis: 16 as const, error: null };
  if (valor === "18") return { itbis: 18 as const, error: null };
  return valor === "" ? { itbis: null, error: null } : { itbis: null, error: "El ITBIS debe ser 18, 16 o 0." };
}

function normalizarCategoriaCambio(valor: string) {
  if (valor === "") return { categoria: { cambia: false, id: null as string | null }, error: null };
  if (valor === SIN_CATEGORIA) return { categoria: { cambia: true, id: null as string | null }, error: null };

  const valida = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
  return valida
    ? { categoria: { cambia: true, id: valor }, error: null }
    : { categoria: { cambia: false, id: null as string | null }, error: "La categoría no es válida." };
}

function normalizarCambios(cambios: CambiosEdicionMasiva): { datos: CambiosNormalizados | null; error: string | null } {
  const hayCambios =
    cambios.precioModo !== "sin_cambio" ||
    cambios.itbisTasa !== "" ||
    cambios.categoriaId !== "" ||
    cambios.activo !== "";

  if (!hayCambios) return { datos: null, error: "Selecciona al menos un cambio." };

  const precio = normalizarPrecio(cambios);
  if (precio.error !== null) return { datos: null, error: precio.error };

  const itbis = normalizarItbis(cambios.itbisTasa);
  if (itbis.error !== null) return { datos: null, error: itbis.error };

  const categoria = normalizarCategoriaCambio(cambios.categoriaId);
  if (categoria.error !== null) return { datos: null, error: categoria.error };

  let activo: boolean | undefined;
  if (cambios.activo === "activo") activo = true;
  else if (cambios.activo === "inactivo") activo = false;

  return {
    datos: {
      precioFijo: precio.precioFijo,
      porcentaje: precio.porcentaje,
      itbis: itbis.itbis,
      categoria: categoria.categoria,
      activo,
    },
    error: null,
  };
}

function calcularPrecioNuevo(producto: Producto, precioFijo: number | null, porcentaje: number | null) {
  if (precioFijo !== null) return { precio: precioFijo, error: null };
  if (porcentaje === null) return { precio: producto.precio, error: null };

  const precio = redondearMonto(producto.precio * (1 + porcentaje / 100));
  return precio < 0
    ? { precio, error: `El ajuste deja un precio negativo en «${producto.nombre}».` }
    : { precio, error: null };
}

export function calcularEdicionMasiva(
  productos: readonly Producto[],
  cambios: CambiosEdicionMasiva,
): ResultadoEdicionMasiva {
  const normalizado = normalizarCambios(cambios);
  if (normalizado.error !== null || normalizado.datos === null) {
    return { filas: [], error: normalizado.error ?? "No se pudieron leer los cambios." };
  }

  const { precioFijo, porcentaje, itbis, categoria, activo } = normalizado.datos;
  const filas: FilaEdicionMasiva[] = [];

  for (const producto of productos) {
    const precio = calcularPrecioNuevo(producto, precioFijo, porcentaje);
    if (precio.error !== null) return { filas: [], error: precio.error };

    filas.push({
      producto,
      datos: {
        nombre: producto.nombre,
        tipo: producto.tipo,
        referencia: producto.referencia,
        descripcion: producto.descripcion,
        precio: precio.precio,
        itbis_tasa: itbis ?? producto.itbis_tasa,
        impuesto_id: producto.impuesto_id,
        inventariable: producto.inventariable,
        cantidad: producto.cantidad,
        costo: producto.costo,
        categoria_id: categoria.cambia ? categoria.id : producto.categoria_id,
        activo: activo ?? producto.activo,
      },
    });
  }

  return { filas, error: null };
}
