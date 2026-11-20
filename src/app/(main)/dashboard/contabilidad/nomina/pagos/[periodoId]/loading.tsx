import { EsqueletoDetalle, EsqueletoTabla } from "@/components/carga/esqueletos";
import { ContenedorLista } from "@/components/listas/tabla-lista";

export default function Loading() {
  return (
    <ContenedorLista>
      <EsqueletoDetalle titulo="Pagos del periodo" />
      <EsqueletoTabla filas={6} columnas={5} />
    </ContenedorLista>
  );
}
