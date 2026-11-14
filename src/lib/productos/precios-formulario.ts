import type { ProductoTipo, TasaItbis } from "./productos";

export type PrecioListaFormulario = {
  lista_id: string;
  precio: number | null;
};

export type PreciosFormulario = {
  precios: PrecioListaFormulario[];
  presente: boolean;
};

export type DatosPayloadProducto = {
  nombre: string;
  tipo: ProductoTipo;
  referencia: string | null;
  descripcion: string | null;
  precio: number;
  itbis_tasa: TasaItbis;
  inventariable: boolean;
  cantidad: number;
  costo: number;
  categoria_id: string | null;
  activo?: boolean;
};

export type PayloadProducto = DatosPayloadProducto & {
  precios?: PrecioListaFormulario[];
};

function idValido(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function leerPreciosFormulario(formData: FormData): PreciosFormulario | null {
  const precios: PrecioListaFormulario[] = [];
  let presente = false;

  for (const [campo, valor] of formData.entries()) {
    if (!campo.startsWith("precio_lista_")) continue;
    if (typeof valor !== "string") continue;

    const listaId = campo.slice("precio_lista_".length);
    if (!idValido(listaId)) continue;
    presente = true;

    const texto = valor.trim().replace(",", ".");
    if (texto === "") {
      precios.push({ lista_id: listaId, precio: null });
      continue;
    }

    const numero = Number(texto);
    if (!Number.isFinite(numero)) return null;
    precios.push({ lista_id: listaId, precio: numero });
  }

  return { precios, presente };
}

export function construirPayloadProducto(
  datos: DatosPayloadProducto,
  precios: PreciosFormulario | null,
): PayloadProducto {
  const payload: PayloadProducto = { ...datos };
  if (payload.activo === undefined) delete payload.activo;
  if (precios?.presente) {
    payload.precios = precios.precios.map((item) => ({ ...item }));
  }
  return payload;
}
