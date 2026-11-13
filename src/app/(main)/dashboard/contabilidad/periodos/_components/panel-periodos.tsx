"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BookOpen, CircleCheck, Loader2, Lock, LockOpen } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaAsiento } from "@/lib/enlaces";
import { formatoFechaHora } from "@/lib/formato";
import { cerrarPeriodo, cerrarResultadosAnio, reabrirPeriodo } from "@/lib/periodos/acciones";
import type { DatosPeriodos, MesPeriodo } from "@/lib/periodos/tipos";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

interface Props {
  datos: DatosPeriodos;
  puedeEscribir: boolean;
}

function FilaMes({
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

  return (
    <TableRow>
      <TableCell className="pl-(--card-spacing) font-medium">
        {mes.etiqueta}
        {mes.esActual ? (
          <Badge variant="outline" className="ml-2">
            Mes actual
          </Badge>
        ) : null}
      </TableCell>
      <TableCell>
        {cerrado ? (
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" />
            Cerrado
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <LockOpen className="size-3" />
            Abierto
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{mes.cerradoEn ? formatoFechaHora(mes.cerradoEn) : "—"}</TableCell>
      <TableCell className="pr-(--card-spacing) text-right">
        {cerrado ? (
          <Button variant="outline" size="sm" disabled={!puedeEscribir || pendiente} onClick={onReabrir}>
            {procesando === mes.periodo ? <Loader2 className="animate-spin" /> : null}
            Reabrir
          </Button>
        ) : (
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
        )}
      </TableCell>
    </TableRow>
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

  const unAnio = datos.anio > datos.anioActual;

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Meses de {datos.anio}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Mes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cerrado</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.meses.map((mes) => (
                <FilaMes
                  key={mes.periodo}
                  mes={mes}
                  puedeEscribir={puedeEscribir}
                  pendiente={pendiente}
                  procesando={procesando}
                  onCerrar={() => ejecutar(mes.periodo, () => cerrarPeriodo(mes.periodo))}
                  onReabrir={() => ejecutar(mes.periodo, () => reabrirPeriodo(mes.periodo))}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                Utilidad del ejercicio. Se puede ejecutar una sola vez por año. Si diciembre está cerrado, reábrelo
                primero.
              </p>
              <div className="flex justify-end">
                <AlertDialog open={cierreAbierto} onOpenChange={setCierreAbierto}>
                  <AlertDialogTrigger render={<Button disabled={!puedeEscribir || pendiente || unAnio} />}>
                    {pendiente && procesando === "cierre" ? <Loader2 className="animate-spin" /> : null}
                    Cerrar resultados del año
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cerrar los resultados de {datos.anio}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se creará un asiento con fecha 31/12/{datos.anio} que deja en cero las cuentas de ingreso, costo
                        y gasto contra Utilidad del ejercicio. No se puede repetir para el mismo año.
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
