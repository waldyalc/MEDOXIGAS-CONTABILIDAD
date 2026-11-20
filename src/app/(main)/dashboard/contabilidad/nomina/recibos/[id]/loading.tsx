import { EsqueletoDetalle, EsqueletoTabla } from "@/components/carga/esqueletos";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";

export default function Loading() {
  return (
    <ContenedorDetalle>
      <EsqueletoDetalle titulo="Recibo de nómina" />
      <EsqueletoTabla filas={6} columnas={4} />
    </ContenedorDetalle>
  );
}
