import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { libroTexto, periodoDeFecha, rangoMes } from "@/lib/reportes/fiscales/comun";
import { obtenerDevolucionesVentas, obtenerEmpresa, obtenerVentas } from "@/lib/reportes/fiscales/consultas";
import { encabezado607, FORMATO_607, fila607 } from "@/lib/reportes/fiscales/formatos/607";

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
  const filas = documentos.map(fila607);
  const encabezado = encabezado607(documentos, empresa.datos.rnc, periodo);
  const texto = libroTexto(FORMATO_607.encabezado, FORMATO_607.detalle, encabezado, filas);
  const totalItbis = documentos.reduce(
    (total, documento) => total + (documento.clase === "devolucion-venta" ? -documento.itbis : documento.itbis),
    0,
  );
  const aCredito = documentos.reduce((total, documento) => total + documento.pagos.credito, 0);
  const totalBase = documentos.reduce(
    (total, documento) => total + (documento.clase === "devolucion-venta" ? -documento.base : documento.base),
    0,
  );

  const avisos: string[] = [];
  if (seleccion.desde !== desde || seleccion.hasta !== hasta) {
    avisos.push("El 607 es mensual: se usa el mes completo de la fecha Desde.");
  }
  if (empresa.datos.rnc == null || empresa.datos.rnc.trim() === "") {
    avisos.push("La empresa no tiene RNC configurado; el archivo se exporta con el RNC en blanco.");
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
      textoPlano={texto}
    />
  );
}
