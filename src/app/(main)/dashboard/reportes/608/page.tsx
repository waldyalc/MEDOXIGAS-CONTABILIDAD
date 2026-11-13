import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { libroTexto, periodoDeFecha, rangoMes, textoPeriodo } from "@/lib/reportes/fiscales/comun";
import { obtenerAnulados, obtenerEmpresa } from "@/lib/reportes/fiscales/consultas";
import { encabezado608, FORMATO_608, fila608 } from "@/lib/reportes/fiscales/formatos/608";

import { ReporteDgii } from "../fiscales/_components/reporte-dgii";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const seleccion = parsearRango(params);
  const { desde, hasta } = rangoMes(seleccion.desde);
  const periodo = periodoDeFecha(desde);
  const empresa = await obtenerEmpresa();
  const anulados = await obtenerAnulados(desde, hasta);

  const filas = anulados.datos.map(fila608);
  const encabezado = encabezado608(anulados.datos, empresa.datos.rnc, periodo);
  const texto = libroTexto(FORMATO_608.encabezado, FORMATO_608.detalle, encabezado, filas);

  const avisos: string[] = [];
  if (seleccion.desde !== desde || seleccion.hasta !== hasta) {
    avisos.push("El 608 es mensual: se usa el mes completo de la fecha Desde.");
  }
  if (empresa.datos.rnc == null || empresa.datos.rnc.trim() === "") {
    avisos.push("La empresa no tiene RNC configurado; el archivo se exporta con el RNC en blanco.");
  }

  return (
    <ReporteDgii
      titulo="Reporte 608"
      descripcion="Comprobantes fiscales anulados del período, con el formato de envío de la DGII."
      formato={FORMATO_608}
      filas={filas}
      desde={desde}
      hasta={hasta}
      periodo={periodo}
      rnc={empresa.datos.rnc}
      tarjetas={[
        { titulo: "Registros anulados", valor: String(filas.length) },
        { titulo: "Período", valor: textoPeriodo(periodo) },
      ]}
      error={anulados.error}
      avisos={avisos}
      textoPlano={texto}
    />
  );
}
