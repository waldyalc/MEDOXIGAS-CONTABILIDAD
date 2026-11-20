import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { libroTexto, periodoDeFecha, rangoMes } from "@/lib/reportes/fiscales/comun";
import { obtenerCompras, obtenerEmpresa } from "@/lib/reportes/fiscales/consultas";
import { separarDocumentos } from "@/lib/reportes/fiscales/excluidos";
import { encabezado606, FORMATO_606, fila606 } from "@/lib/reportes/fiscales/formatos/606";
import { columnasTextoDgii } from "@/lib/reportes/fiscales/formatos/tipos";

import { ReporteDgii } from "../fiscales/_components/reporte-dgii";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const seleccion = parsearRango(params);
  const { desde, hasta } = rangoMes(seleccion.desde);
  const periodo = periodoDeFecha(desde);
  const empresa = await obtenerEmpresa();
  const compras = await obtenerCompras(desde, hasta);

  const conNcf = compras.datos.documentos.filter((documento) => documento.ncf.trim() !== "");
  const { incluidos, excluidos } = separarDocumentos(conNcf);
  const filas = incluidos.map((documento) => ({
    ...fila606(documento),
    __ruta: documento.ruta ?? "",
    __contactoId: documento.contactoId ?? "",
  }));
  const encabezado = encabezado606(incluidos, empresa.datos.rnc, periodo);
  const texto = libroTexto(FORMATO_606.encabezado, columnasTextoDgii(FORMATO_606), encabezado, filas);
  const totalItbis = incluidos.reduce((total, documento) => total + documento.itbis, 0);
  const totalBase = incluidos.reduce((total, documento) => total + documento.base, 0);
  const sinNcf = compras.datos.documentos.length - conNcf.length;

  const avisos: string[] = [];
  if (seleccion.desde !== desde || seleccion.hasta !== hasta) {
    avisos.push("El 606 es mensual: se usa el mes completo de la fecha Desde.");
  }
  if (sinNcf > 0) {
    avisos.push(`${sinNcf} compra(s) sin NCF no se incluyen en el 606.`);
  }

  return (
    <ReporteDgii
      titulo="Reporte 606"
      descripcion="Compras de bienes y servicios del período, con el formato de envío de la DGII."
      formato={FORMATO_606}
      filas={filas}
      desde={desde}
      hasta={hasta}
      periodo={periodo}
      rnc={empresa.datos.rnc}
      tarjetas={[
        { titulo: "Registros", valor: String(filas.length) },
        { titulo: "Total facturado", valor: formatearRd(totalBase) },
        { titulo: "ITBIS facturado", valor: formatearRd(totalItbis) },
        { titulo: "Documentos no incluidos", valor: String(excluidos.length) },
      ]}
      error={compras.error}
      avisos={avisos}
      excluidos={excluidos}
      textoPlano={texto}
    />
  );
}
