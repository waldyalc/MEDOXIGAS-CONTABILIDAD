import { EsqueletoReporte } from "@/components/carga/esqueletos";
import { ContenedorLista } from "@/components/listas/tabla-lista";

export default function Loading() {
  return (
    <ContenedorLista>
      <EsqueletoReporte
        titulo="Reporte TSS"
        descripcion="Resumen mensual por empleado para SUIRPlus e IR-3."
        filtros={2}
        tarjetas={4}
        filas={10}
      />
    </ContenedorLista>
  );
}
