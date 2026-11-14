import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Cotizaciones"
      descripcion="Cotizaciones de venta y su conversión a factura."
      acciones={1}
      columnas={8}
    />
  );
}
