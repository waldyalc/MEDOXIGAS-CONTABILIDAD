import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Transacciones"
      descripcion="Entradas y salidas por pagos recibidos, pagos a proveedores y gastos menores."
      filtros={3}
      tarjetas={3}
      filas={10}
    />
  );
}
