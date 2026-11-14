import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Cuentas por cobrar"
      descripcion="Saldos pendientes de clientes por antigüedad."
      filtros={4}
      tarjetas={5}
      filas={10}
    />
  );
}
