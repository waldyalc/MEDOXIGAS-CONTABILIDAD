import { Layers } from "@/components/icons";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { type AgruparPor, calcularAgrupado } from "@/lib/reportes/libros/agrupado";
import {
  obtenerContactos,
  obtenerCuentas,
  obtenerMovimientos,
  obtenerSaldosCuentas,
  obtenerSaldosTercero,
} from "@/lib/reportes/libros/consultas";
import { leerCodigoCuenta, leerUuid } from "@/lib/reportes/libros/parametros";
import type { FilaMovimiento, FilaSaldoCuenta, FilaSaldoTercero } from "@/lib/reportes/libros/tipos";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroAgrupado } from "../_components/libros/filtro-agrupado";
import { TablaAgrupada } from "../_components/libros/tabla-agrupada";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const cuenta = leerCodigoCuenta(params.cuenta);
  const tercero = leerUuid(params.tercero);
  const agruparPor: AgruparPor = params.agrupar === "tercero" ? "tercero" : "cuenta";

  const [cuentas, contactos] = await Promise.all([obtenerCuentas(), obtenerContactos()]);
  let movimientos: FilaMovimiento[] = [];
  let saldosCuenta: FilaSaldoCuenta[] = [];
  let saldosTercero: FilaSaldoTercero[] = [];
  let error = cuentas.error ?? contactos.error;

  if (cuenta) {
    const [lineas, porCuenta, porTercero] = await Promise.all([
      obtenerMovimientos({ desde, hasta, cuentas: [cuenta], contacto: tercero }),
      obtenerSaldosCuentas(desde, hasta, false, [cuenta]),
      obtenerSaldosTercero(desde, hasta, {
        cuentas: [cuenta],
        contacto: tercero,
        incluirCero: false,
      }),
    ]);
    movimientos = lineas.filas;
    saldosCuenta = porCuenta.filas;
    saldosTercero = porTercero.filas;
    if (lineas.error) error = lineas.error;
    else if (porCuenta.error) error = porCuenta.error;
    else if (porTercero.error) error = porTercero.error;
  }

  const agrupado = calcularAgrupado(movimientos, saldosCuenta, saldosTercero, agruparPor);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Movimientos por cuenta contable agrupado"
        descripcion="Movimientos agrupados por cuenta o tercero, con el detalle desplegable de cada grupo."
        desde={desde}
        hasta={hasta}
      />

      <FiltroAgrupado
        desde={desde}
        hasta={hasta}
        cuentas={cuentas.filas}
        contactos={contactos.filas}
        cuenta={cuenta}
        tercero={tercero}
        agruparPor={agruparPor}
      />

      {error ? <AlertaError mensaje={error} /> : null}

      {!cuenta ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>Elige una cuenta contable</EmptyTitle>
            <EmptyDescription>Puedes elegir una cuenta padre para incluir todas sus hijas.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : agrupado.grupos.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>Sin movimientos</EmptyTitle>
            <EmptyDescription>No hay movimientos para los filtros seleccionados.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TablaAgrupada grupos={agrupado.grupos} total={agrupado.total} />
      )}
    </div>
  );
}
