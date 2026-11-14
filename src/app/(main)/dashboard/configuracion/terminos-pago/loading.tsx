import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista titulo="Términos de pago" descripcion="Plazos disponibles para facturas y compras." columnas={3} />
  );
}
