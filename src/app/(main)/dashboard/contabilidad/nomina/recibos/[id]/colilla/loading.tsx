import { EsqueletoDetalle } from "@/components/carga/esqueletos";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";

export default function Loading() {
  return (
    <ContenedorDetalle>
      <EsqueletoDetalle titulo="Colilla de pago" />
    </ContenedorDetalle>
  );
}
