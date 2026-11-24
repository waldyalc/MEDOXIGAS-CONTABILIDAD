"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BookOpen, CircleCheck, Loader2 } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rutaAsiento } from "@/lib/enlaces";
import { formatoFechaHora } from "@/lib/formato";
import { cerrarPeriodo, cerrarResultadosAnio, reabrirPeriodo } from "@/lib/periodos/acciones";
import type { DatosPeriodos, MesPeriodo } from "@/lib/periodos/tipos";
import { puedeCerrarResultados } from "@/lib/periodos/validacion";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

interface Props {
  datos: DatosPeriodos;
  puedeEscribir: boolean;
}

function AccionMes({
  mes,
  puedeEscribir,
  pendiente,
  procesando,
  onCerrar,
  onReabrir,
}: {
  mes: MesPeriodo;
  puedeEscribir: boolean;
  pendiente: boolean;
  procesando: string | null;
  onCerrar: () => void;
  onReabrir: () => void;
}) {
  const cerrado = mes.estado === "cerrado";

  if (cerrado) {
    return (
      <Button variant="outline" size="sm" disabled={!puedeEscribir || pendiente} onClick={onReabrir}>
        {procesando === mes.periodo ? <Loader2 className="animate-spin" /> : null}
        Reabrir
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={!puedeEscribir || pendiente || mes.esFuturo}
      onClick={onCerrar}
      title={mes.esFuturo ? "No se puede cerrar un mes futuro" : undefined}
    >
      {procesando === mes.periodo ? <Loader2 className="animate-spin" /> : null}
      Cerrar mes
    </Button>
  );
}

export function PanelPeriodos({ datos, puedeEscribir }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [cierreAbierto, setCierreAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();

  function ejecutar(clave: string, accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setProcesando(clave);

    iniciar(async () => {
      const resultado = await accion();

      if (!resultado.ok) {
        setError(resultado.error);
        setProcesando(null);
        return;
      }

      router.refresh();
      setProcesando(null);
    });
  }

  // Solo se cierran ejercicios terminados: el año en curso (o uno futuro) no.
  const cierreBloqueado = !puedeCerrarResultados(datos.anio, datos.anioActual);

  const columnas: readonly ColumnaLista<MesPeriodo>[] = [
    {
      clave: "mes",
      encabezado: "Mes",
      celda: (mes) => (
        <span className="inline-flex items-center gap-2 font-medium">
          {mes.etiqueta}
          {mes.esActual ? <PillEstado tono="info">Mes actual</PillEstado> : null}
        </span>
      ),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (mes) => (
        <PillEstado tono={mes.estado === "cerrado" ? "neutro" : "exito"}>
          {mes.estado === "cerrado" ? "Cerrado" : "Abierto"}
        </PillEstado>
      ),
    },
    {
      clave: "cerradoEn",
      encabezado: "Cerrado",
      celda: (mes) => (
        <span className="text-muted-foreground">{mes.cerradoEn ? formatoFechaHora(mes.cerradoEn) : "—"}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Meses de {datos.anio}</h2>
        <TarjetaLista data-lista="contabilidad-periodos">
          <TablaLista
            columnas={columnas}
            filas={datos.meses}
            claveFila={(mes) => mes.periodo}
            acciones={(mes) => (
              <AccionMes
                mes={mes}
                puedeEscribir={puedeEscribir}
                pendiente={pendiente}
                procesando={procesando}
                onCerrar={() => ejecutar(mes.periodo, () => cerrarPeriodo(mes.periodo))}
                onReabrir={() => ejecutar(mes.periodo, () => reabrirPeriodo(mes.periodo))}
              />
            )}
            vacio={{
              titulo: "Sin meses",
              descripcion: "No hay meses para este año.",
            }}
          />
        </TarjetaLista>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cierre de resultados del año</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {datos.cierre ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium">
                  <CircleCheck className="size-4 text-emerald-600" />
                  Resultados de {datos.anio} cerrados
                </span>
                <span className="text-muted-foreground text-sm">
                  Asiento del {formatoFechaHora(datos.cierre.creadoEn)} por {formatearRd(centavos(datos.cierre.total))}.
                </span>
              </div>
              <Button variant="outline" render={<Link href={rutaAsiento(datos.cierre.asientoId)} prefetch={false} />}>
                <BookOpen data-icon="inline-start" />
                Ver asiento {datos.cierre.asientoNumero ? `#${datos.cierre.asientoNumero}` : "de cierre"}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Crea el asiento al 31 de diciembre que lleva los ingresos, costos y gastos del año contra la cuenta
                Utilidad del ejercicio y cierra los 12 meses del año. Solo se pueden cerrar años terminados. Se puede
                ejecutar una sola vez por año. Si diciembre está cerrado, reábrelo primero.
              </p>
              {cierreBloqueado ? (
                <p className="text-muted-foreground text-sm">
                  {datos.anio === datos.anioActual
                    ? "El año en curso se podrá cerrar cuando termine."
                    : "Solo se pueden cerrar años terminados."}
                </p>
              ) : null}
              <div className="flex justify-end">
                <AlertDialog open={cierreAbierto} onOpenChange={setCierreAbierto}>
                  <AlertDialogTrigger
                    render={
                      <Button
                        disabled={!puedeEscribir || pendiente || cierreBloqueado}
                        title={cierreBloqueado ? "Solo se pueden cerrar años terminados" : undefined}
                      />
                    }
                  >
                    {pendiente && procesando === "cierre" ? <Loader2 className="animate-spin" /> : null}
                    Cerrar resultados del año
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cerrar los resultados de {datos.anio}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se creará un asiento con fecha 31/12/{datos.anio} que deja en cero las cuentas de ingreso, costo
                        y gasto contra Utilidad del ejercicio, y se cerrarán los 12 meses del año. No se puede repetir
                        para el mismo año.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={pendiente}
                        onClick={() => {
                          setCierreAbierto(false);
                          ejecutar("cierre", () => cerrarResultadosAnio(datos.anio));
                        }}
                      >
                        Cerrar resultados
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
