import { PaginadorLista } from "@/components/listas/paginador-lista";
import { TAMANOS_PAGINA } from "@/lib/listas/parametros";
import type { ParametrosFecha } from "@/lib/reportes/fechas";

interface Props {
  base: string;
  params: ParametrosFecha;
  pagina: number;
  totalPaginas: number;
  inicio: number;
  fin: number;
  total: number;
  tamano: number;
}

export function Paginador({ base, params, pagina, totalPaginas, inicio, fin, total, tamano }: Props) {
  return (
    <PaginadorLista
      base={base}
      params={params}
      resumen={{ pagina, totalPaginas, inicio, fin, total }}
      tamano={tamano}
      opciones={TAMANOS_PAGINA}
      className="print:hidden"
    />
  );
}
