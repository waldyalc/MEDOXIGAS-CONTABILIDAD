import { EsqueletoLista } from "@/components/carga/esqueletos";
import { ContenedorLista } from "@/components/listas/tabla-lista";

export default function Loading() {
  return (
    <ContenedorLista>
      <EsqueletoLista
        titulo="Pagos de nómina"
        descripcion="Registra la salida de caja o banco de los recibos contabilizados."
        acciones={1}
        filtros={2}
        filas={6}
        columnas={7}
      />
    </ContenedorLista>
  );
}
