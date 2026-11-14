import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { libroTexto, periodoDeFecha, rangoMes } from "@/lib/reportes/fiscales/comun";
import { obtenerCompras, obtenerEmpresa } from "@/lib/reportes/fiscales/consultas";
import { encabezado606, FORMATO_606, fila606 } from "@/lib/reportes/fiscales/formatos/606";

import { ReporteDgii } from "../fiscales/_components/reporte-dgii";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const seleccion = parsearRango(params);
  const { desde, hasta } = rangoMes(seleccion.desde);
  const periodo = periodoDeFecha(desde);
  const empresa = await obtenerEmpresa();
  const compras = await obtenerCompras(desde, hasta);

  const documentos = compras.datos.documentos.filter((documento) => documento.ncf.trim() !== "");
  const filas = documentos.map((documento) => ({
    ...fila606(documento),
    __ruta: documento.ruta ?? "",
    __contactoId: documento.contactoId ?? "",
  }));
  const encabezado = encabezado606(documentos, empresa.datos.rnc, periodo);
  const texto = libroTexto(FORMATO_606.encabezado, FORMATO_606.detalle, encabezado, filas);
  const totalItbis = documentos.reduce((total, documento) => total + documento.itbis, 0);
  const totalBase = documentos.reduce((total, documento) => total + documento.base, 0);
  const sinNcf = compras.datos.documentos.length - documentos.length;

  const avisos: string[] = [];
  if (seleccion.desde !== desde || seleccion.hasta !== hasta) {
    avisos.push("El 606 es mensual: se usa el mes completo de la fecha Desde.");
  }
  if (empresa.datos.rnc == null || empresa.datos.rnc.trim() === "") {
    avisos.push("La empresa no tiene RNC configurado; el archivo se exporta con el RNC en blanco.");
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
        { titulo: "Compras sin NCF", valor: String(sinNcf) },
      ]}
      error={compras.error}
      avisos={avisos}
      textoPlano={texto}
    />
  );
}
