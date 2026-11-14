import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Auxiliar por tercero"
      descripcion="Saldo anterior, movimientos y saldo final por cuenta para un tercero."
      filtros={4}
      tarjetas={0}
      filas={12}
    />
  );
}
