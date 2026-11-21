import Link from "next/link";

import { cn } from "cn";

import { ArrowRight, CalendarPlus, FileSpreadsheet, TriangleAlert, UsersRound } from "@/components/icons";
import { type ColumnaLista, ContenedorLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { ConfigNomina, EstadoNomina, ParametrosRD, PeriodoNomina } from "@/lib/nomina/tipos";

import {
  ETIQUETA_ESTADO_NOMINA,
  ETIQUETA_FRECUENCIA,
  etiquetaPeriodoCorta,
  etiquetaPeriodoLarga,
  formatoPorcentaje,
  type PeriodoSugerido,
  RUTA_EMPLEADOS,
  RUTA_ENVIOS,
  RUTA_PARAMETROS,
  RUTA_PERIODOS,
  RUTA_REPORTES,
  rutaPeriodo,
  TONO_ESTADO_NOMINA,
} from "../empleados/_components/formato-nomina";

export interface FilaUltimoPeriodo {
  periodo: PeriodoNomina;
  empleados: number;
}

export interface DatosInicioNomina {
  anio: number;
  activos: number;
  suspendidos: number;
  parametros: ParametrosRD | null;
  config: ConfigNomina | null;
  sugerido: PeriodoSugerido;
  periodoExistente: PeriodoNomina | null;
  empleadosElegibles: number;
  ultimoPeriodo: PeriodoNomina | null;
  colillasEnviadas: number;
  colillasTotales: number;
  ultimosPeriodos: FilaUltimoPeriodo[];
  conteoEstados: Record<EstadoNomina, number>;
}

const ESTADOS_ORDEN: readonly EstadoNomina[] = ["borrador", "calculado", "contabilizado", "pagado", "anulado"];

function TarjetaKpiInicio({
  etiqueta,
  valor,
  contexto,
  href,
}: {
  etiqueta: string;
  valor: string;
  contexto: string;
  href?: string;
}) {
  const contenido = (
    <>
      <span className="text-muted-foreground text-xs font-medium">{etiqueta}</span>
      <span className="text-xl font-semibold tabular-nums">{valor}</span>
      <span className="text-muted-foreground text-sm">{contexto}</span>
    </>
  );
  const clases = "ring-foreground/10 bg-card flex flex-col gap-1 rounded-xl p-4 ring-1";

  if (href) {
    return (
      <Link href={href} prefetch={false} className={cn(clases, "hover:ring-ring/40 transition-shadow")}>
        {contenido}
      </Link>
    );
  }

  return <div className={clases}>{contenido}</div>;
}

function contextoCosto(porcentaje: string | null, ultimo: PeriodoNomina | null): string {
  if (porcentaje !== null) return `${porcentaje} % sobre el pago`;
  if (ultimo !== null && ultimo.estado !== "borrador") return "Ingresos + aportes + provisiones";
  return "Sin calcular";
}

function contextoTotalPagar(ultimo: PeriodoNomina | null): string {
  if (!ultimo) return "Sin periodos";
  const estado = ultimo.estado === "borrador" ? "Sin calcular" : "Último periodo";
  return `${etiquetaPeriodoCorta(ultimo.fecha_inicio, ultimo.fecha_fin)} · ${estado}`;
}

function TasaSrl({ config, parametros }: { config: ConfigNomina | null; parametros: ParametrosRD }) {
  const riesgo = config?.riesgo_laboral ?? "tipo_1";
  const tasas: Record<string, string> = {
    tipo_1: parametros.tasa_srl_tipo_1,
    tipo_2: parametros.tasa_srl_tipo_2,
    tipo_3: parametros.tasa_srl_tipo_3,
    tipo_4: parametros.tasa_srl_tipo_4,
  };
  const romanos: Record<string, string> = { tipo_1: "I", tipo_2: "II", tipo_3: "III", tipo_4: "IV" };

  return (
    <span className="tabular-nums">
      {formatoPorcentaje(tasas[riesgo] ?? parametros.tasa_srl_tipo_1)}
      <span className="text-muted-foreground"> (Tipo {romanos[riesgo] ?? "I"})</span>
    </span>
  );
}

function FilaIndicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-1.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

function EstadoPeriodoSugerido({ datos, puedeEscribir }: { datos: DatosInicioNomina; puedeEscribir: boolean }) {
  if (datos.periodoExistente) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Ya existe <span className="font-mono">{datos.periodoExistente.codigo}</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={rutaPeriodo(datos.periodoExistente.id)} prefetch={false} />}
        >
          Ver periodo
        </Button>
      </div>
    );
  }

  if (datos.parametros === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">No hay parámetros legales para {datos.anio}.</p>
        <Button variant="outline" size="sm" render={<Link href={RUTA_PARAMETROS} prefetch={false} />}>
          Configurar parámetros
        </Button>
      </div>
    );
  }

  if (datos.empleadosElegibles === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          No hay empleados activos en la frecuencia {ETIQUETA_FRECUENCIA[datos.sugerido.frecuencia].toLowerCase()}.
        </p>
        <Button variant="outline" size="sm" render={<Link href={RUTA_EMPLEADOS} prefetch={false} />}>
          <UsersRound data-icon="inline-start" />
          Ir a Empleados
        </Button>
      </div>
    );
  }

  if (!puedeEscribir) return null;

  return (
    <>
      <p className="text-muted-foreground text-sm">
        Se crearán recibos en borrador para los empleados activos de frecuencia{" "}
        {ETIQUETA_FRECUENCIA[datos.sugerido.frecuencia].toLowerCase()}.
      </p>
      <div>
        <Button size="sm" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
          <CalendarPlus data-icon="inline-start" />
          Crear periodo
        </Button>
      </div>
    </>
  );
}

function TarjetaPeriodoACalcular({ datos, puedeEscribir }: { datos: DatosInicioNomina; puedeEscribir: boolean }) {
  return (
    <Card className="gap-3">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold">Periodo a calcular</h2>
            <p className="text-muted-foreground text-sm">
              {etiquetaPeriodoLarga(datos.sugerido.inicio, datos.sugerido.fin)}
            </p>
          </div>
          <span className="bg-muted rounded-md px-2 py-1 font-mono text-xs">{datos.sugerido.codigo}</span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col">
            <dt className="text-muted-foreground text-xs">Frecuencia</dt>
            <dd className="font-medium">{ETIQUETA_FRECUENCIA[datos.sugerido.frecuencia]}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground text-xs">Empleados elegibles</dt>
            <dd className="font-medium tabular-nums">{datos.empleadosElegibles}</dd>
          </div>
        </dl>

        <EstadoPeriodoSugerido datos={datos} puedeEscribir={puedeEscribir} />
      </CardContent>
    </Card>
  );
}

const COLUMNAS_ULTIMOS: readonly ColumnaLista<FilaUltimoPeriodo>[] = [
  {
    clave: "periodo",
    encabezado: "Periodo",
    celda: ({ periodo }) => (
      <div className="flex flex-col">
        <span className="font-medium">{etiquetaPeriodoCorta(periodo.fecha_inicio, periodo.fecha_fin)}</span>
        <span className="text-muted-foreground font-mono text-xs">{periodo.codigo}</span>
      </div>
    ),
  },
  {
    clave: "rango",
    encabezado: "Rango",
    className: "hidden md:table-cell",
    celda: ({ periodo }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatoDia(periodo.fecha_inicio)} – {formatoDia(periodo.fecha_fin)}
      </span>
    ),
  },
  {
    clave: "empleados",
    encabezado: "Empleados",
    alineacion: "derecha",
    celda: (fila) => fila.empleados,
  },
  {
    clave: "neto",
    encabezado: "Total a pagar",
    alineacion: "derecha",
    celda: ({ periodo }) => (periodo.estado === "borrador" ? "—" : formatoMoneda(periodo.total_neto)),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: ({ periodo }) => (
      <PillEstado tono={TONO_ESTADO_NOMINA[periodo.estado]}>{ETIQUETA_ESTADO_NOMINA[periodo.estado]}</PillEstado>
    ),
  },
];

function TarjetaUltimosPeriodos({ datos, puedeEscribir }: { datos: DatosInicioNomina; puedeEscribir: boolean }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <h2 className="text-base font-semibold">Últimos periodos</h2>
        <Link
          href={RUTA_PERIODOS}
          prefetch={false}
          className="text-primary inline-flex items-center gap-1 text-sm font-medium"
        >
          Ver todos los periodos
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <TablaLista
        columnas={COLUMNAS_ULTIMOS}
        filas={datos.ultimosPeriodos.slice(0, 5)}
        claveFila={(fila) => fila.periodo.id}
        densidad="compacta"
        filaHref={(fila) => rutaPeriodo(fila.periodo.id)}
        vacio={{
          titulo: "Todavía no hay periodos.",
          descripcion: "Crea el primero para empezar.",
          accion: puedeEscribir ? (
            <Button size="sm" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
              Crear periodo
            </Button>
          ) : undefined,
        }}
      />
    </Card>
  );
}

function TarjetaIndicadores({ datos }: { datos: DatosInicioNomina }) {
  if (!datos.parametros) {
    return (
      <Card className="gap-3">
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Indicadores RD {datos.anio}</h2>
          <p className="text-muted-foreground text-sm">
            Sin parámetros para {datos.anio}.{" "}
            <Link href={RUTA_PARAMETROS} prefetch={false} className="text-primary font-medium underline">
              Configurar
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const parametros = datos.parametros;
  const aplicaInfotep = datos.config?.aplica_infotep ?? true;

  return (
    <Card className="gap-3">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">Indicadores RD {datos.anio}</h2>
          <p className="text-muted-foreground text-sm">Tasas y topes que usará el cálculo.</p>
        </div>

        <dl className="flex flex-col">
          <FilaIndicador etiqueta="Salario mínimo" valor={formatoMoneda(parametros.salario_minimo)} />
          <FilaIndicador etiqueta="Tope SFS (10 salarios)" valor={formatoMoneda(parametros.tope_sfs_mensual)} />
          <FilaIndicador etiqueta="Tope AFP (20 salarios)" valor={formatoMoneda(parametros.tope_afp_mensual)} />
          <FilaIndicador etiqueta="Tope SRL (4 salarios)" valor={formatoMoneda(parametros.tope_srl_mensual)} />
          <FilaIndicador
            etiqueta="SFS"
            valor={`${formatoPorcentaje(parametros.tasa_sfs_empleado)} empleado / ${formatoPorcentaje(parametros.tasa_sfs_empleador)} empleador`}
          />
          <FilaIndicador
            etiqueta="AFP"
            valor={`${formatoPorcentaje(parametros.tasa_afp_empleado)} empleado / ${formatoPorcentaje(parametros.tasa_afp_empleador)} empleador`}
          />
          <div className="border-border flex items-baseline justify-between gap-4 border-b py-1.5 text-sm last:border-0">
            <dt className="text-muted-foreground">SRL</dt>
            <dd className="text-right font-medium">
              <TasaSrl config={datos.config} parametros={parametros} />
            </dd>
          </div>
          <FilaIndicador
            etiqueta="INFOTEP"
            valor={aplicaInfotep ? formatoPorcentaje(parametros.tasa_infotep) : "No aplica"}
          />
        </dl>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={RUTA_PARAMETROS} prefetch={false} className="text-primary font-medium">
            Ver parámetros legales
          </Link>
          <Link href={`${RUTA_PARAMETROS}#escala-isr`} prefetch={false} className="text-primary font-medium">
            Ver escala de ISR
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TarjetaEstadoNomina({ datos }: { datos: DatosInicioNomina }) {
  const sinPeriodos = ESTADOS_ORDEN.every((estado) => datos.conteoEstados[estado] === 0);

  return (
    <Card className="gap-3">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Estado de la nómina</h2>

        {sinPeriodos ? (
          <p className="text-muted-foreground text-sm">Todavía no hay periodos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ESTADOS_ORDEN.map((estado) => (
              <li key={estado} className="flex items-center justify-between gap-3 text-sm">
                <PillEstado tono={TONO_ESTADO_NOMINA[estado]}>{ETIQUETA_ESTADO_NOMINA[estado]}</PillEstado>
                <span className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{datos.conteoEstados[estado]}</span>
                  <Link
                    href={`${RUTA_PERIODOS}?estado=${estado}`}
                    prefetch={false}
                    className="text-primary font-medium"
                  >
                    Ver
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function InicioNomina({ datos, puedeEscribir }: { datos: DatosInicioNomina; puedeEscribir: boolean }) {
  const { ultimoPeriodo } = datos;
  const sinParametros = datos.parametros === null;
  const netoCalculado =
    ultimoPeriodo !== null && ultimoPeriodo.estado !== "borrador" ? Number(ultimoPeriodo.total_neto) : null;
  const costoCalculado =
    ultimoPeriodo !== null && ultimoPeriodo.estado !== "borrador" ? Number(ultimoPeriodo.total_costo_empresa) : null;
  const porcentajeCosto =
    netoCalculado !== null && netoCalculado > 0 && costoCalculado !== null
      ? new Intl.NumberFormat("es-DO", { maximumFractionDigits: 1 }).format((costoCalculado / netoCalculado) * 100)
      : null;
  const colillas = datos.colillasTotales > 0 ? `${datos.colillasEnviadas} / ${datos.colillasTotales}` : "—";

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Nómina"
        subtitulo="Empleados, periodos y aportes de ley en un solo lugar."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Nómina" },
        ]}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {puedeEscribir ? (
              <Button render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
                <CalendarPlus data-icon="inline-start" />
                Crear periodo
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href={RUTA_REPORTES} prefetch={false} />}>
              <FileSpreadsheet data-icon="inline-start" />
              Ver reporte TSS
            </Button>
          </div>
        }
      />

      {sinParametros ? (
        <Alert className="border-amber-700/15 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          <TriangleAlert />
          <AlertTitle>No hay parámetros legales para {datos.anio}</AlertTitle>
          <AlertDescription className="text-amber-700/90 dark:text-amber-400/90">
            Sin las tasas y topes del año no se puede calcular la nómina.{" "}
            <Link href={RUTA_PARAMETROS} prefetch={false} className="font-medium underline">
              Configurar parámetros
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpiInicio
          etiqueta="Empleados activos"
          valor={String(datos.activos)}
          contexto={datos.suspendidos > 0 ? `${datos.suspendidos} suspendidos` : "Sin suspendidos"}
          href={RUTA_EMPLEADOS}
        />
        <TarjetaKpiInicio
          etiqueta="Total a pagar"
          valor={netoCalculado === null ? "—" : formatoMoneda(ultimoPeriodo?.total_neto)}
          contexto={contextoTotalPagar(ultimoPeriodo)}
        />
        <TarjetaKpiInicio
          etiqueta="Costo de la empresa"
          valor={costoCalculado === null ? "—" : formatoMoneda(ultimoPeriodo?.total_costo_empresa)}
          contexto={contextoCosto(porcentajeCosto, ultimoPeriodo)}
        />
        <TarjetaKpiInicio
          etiqueta="Colillas enviadas"
          valor={colillas}
          contexto={
            ultimoPeriodo ? etiquetaPeriodoCorta(ultimoPeriodo.fecha_inicio, ultimoPeriodo.fecha_fin) : "Sin envíos"
          }
          href={ultimoPeriodo ? `${RUTA_ENVIOS}?periodo=${ultimoPeriodo.id}` : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-7">
          <TarjetaPeriodoACalcular datos={datos} puedeEscribir={puedeEscribir} />
          <TarjetaUltimosPeriodos datos={datos} puedeEscribir={puedeEscribir} />
        </div>

        <div className="flex flex-col gap-4 xl:col-span-5">
          <TarjetaIndicadores datos={datos} />
          <TarjetaEstadoNomina datos={datos} />
        </div>
      </div>
    </ContenedorLista>
  );
}
