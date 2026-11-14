import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Cuentas por pagar"
      descripcion="Saldos pendientes con proveedores por antigüedad."
      filtros={4}
      tarjetas={4}
      filas={10}
    />
  );
}
