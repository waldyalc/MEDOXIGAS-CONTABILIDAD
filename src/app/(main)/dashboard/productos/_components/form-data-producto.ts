import type { ProductoTipo } from "@/lib/productos/productos";

export interface DatosFormularioProducto {
  nombre: string;
  tipo: ProductoTipo;
  referencia: string | null;
  descripcion: string | null;
  precio: number;
  itbis_tasa: number;
  inventariable: boolean;
  cantidad: number;
  costo: number;
  categoria_id: string | null;
  activo?: boolean;
}

export function formDataProducto(datos: DatosFormularioProducto): FormData {
  const formulario = new FormData();
  formulario.set("nombre", datos.nombre);
  formulario.set("tipo", datos.tipo);
  formulario.set("referencia", datos.referencia ?? "");
  formulario.set("descripcion", datos.descripcion ?? "");
  formulario.set("precio", String(datos.precio));
  formulario.set("itbis_tasa", String(datos.itbis_tasa));
  formulario.set("inventariable", String(datos.inventariable));
  formulario.set("cantidad", String(datos.cantidad));
  formulario.set("costo", String(datos.costo));
  formulario.set("categoria_id", datos.categoria_id ?? "");
  if (datos.activo !== undefined) formulario.set("activo", String(datos.activo));
  return formulario;
}
