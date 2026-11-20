import { EsqueletoLista } from "@/components/carga/esqueletos";
import { ContenedorLista } from "@/components/listas/tabla-lista";

export default function Loading() {
  return (
    <ContenedorLista>
      <EsqueletoLista
        titulo="Periodos y cálculo"
        descripcion="Crea el periodo, revisa las novedades y calcula los recibos."
        acciones={1}
        filtros={3}
        filas={6}
        columnas={7}
      />
    </ContenedorLista>
  );
}
