import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { libroTexto, periodoDeFecha, rangoMes } from "@/lib/reportes/fiscales/comun";
import { obtenerDevolucionesVentas, obtenerEmpresa, obtenerVentas } from "@/lib/reportes/fiscales/consultas";
import { separarDocumentos } from "@/lib/reportes/fiscales/excluidos";
import { encabezado607, FORMATO_607, fila607 } from "@/lib/reportes/fiscales/formatos/607";
import { columnasTextoDgii } from "@/lib/reportes/fiscales/formatos/tipos";

import { ReporteDgii } from "../fiscales/_components/reporte-dgii";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const seleccion = parsearRango(params);
  const { desde, hasta } = rangoMes(seleccion.desde);
  const periodo = periodoDeFecha(desde);
  const empresa = await obtenerEmpresa();
  const [ventas, devoluciones] = await Promise.all([
    obtenerVentas(desde, hasta),
    obtenerDevolucionesVentas(desde, hasta),
  ]);

  const documentos = [...ventas.datos.documentos, ...devoluciones.datos.documentos];
  const { incluidos, excluidos } = separarDocumentos(documentos);
  const filas = incluidos.map((documento) => ({
    ...fila607(documento),
    __ruta: documento.ruta ?? "",
    __contactoId: documento.contactoId ?? "",
  }));
  const encabezado = encabezado607(incluidos, empresa.datos.rnc, periodo);
  const texto = libroTexto(FORMATO_607.encabezado, columnasTextoDgii(FORMATO_607), encabezado, filas);

  // Las notas de crédito van en positivo en el TXT; el neteo solo se ve aquí.
  const signo = (documento: (typeof incluidos)[number]) => (documento.clase === "devolucion-venta" ? -1 : 1);
  const totalItbis = incluidos.reduce((total, documento) => total + documento.itbis * signo(documento), 0);
  const totalBase = incluidos.reduce((total, documento) => total + documento.base * signo(documento), 0);
  const aCredito = incluidos.reduce((total, documento) => total + documento.pagos.credito, 0);

  const avisos: string[] = [];
  if (seleccion.desde !== desde || seleccion.hasta !== hasta) {
    avisos.push("El 607 es mensual: se usa el mes completo de la fecha Desde.");
  }

  return (
    <ReporteDgii
      titulo="Reporte 607"
      descripcion="Ventas de bienes y servicios del período, con notas de crédito y el formato de envío de la DGII."
      formato={FORMATO_607}
      filas={filas}
      desde={desde}
      hasta={hasta}
      periodo={periodo}
      rnc={empresa.datos.rnc}
      tarjetas={[
        { titulo: "Registros", valor: String(filas.length) },
        { titulo: "Monto facturado", valor: formatearRd(totalBase) },
        { titulo: "ITBIS facturado", valor: formatearRd(totalItbis) },
        { titulo: "Ventas a crédito", valor: formatearRd(aCredito) },
      ]}
      error={ventas.error ?? devoluciones.error}
      avisos={avisos}
      excluidos={excluidos}
      textoPlano={texto}
    />
  );
}
