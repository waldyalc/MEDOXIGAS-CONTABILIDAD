import { EsqueletoLista } from "@/components/carga/esqueletos";
import { ContenedorLista } from "@/components/listas/tabla-lista";

export default function Loading() {
  return (
    <ContenedorLista>
      <EsqueletoLista
        titulo="Envíos de colillas"
        descripcion="Consulta y registra la entrega de las colillas de pago."
        acciones={1}
        filtros={2}
        filas={6}
        columnas={5}
      />
    </ContenedorLista>
  );
}
