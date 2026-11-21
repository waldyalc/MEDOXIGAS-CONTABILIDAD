"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Enlace } from "@/components/enlace";
import { FORM_INPUT } from "@/components/formularios/formulario";
import { Loader2, Search, UserPlus } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { agregarEmpleadosPeriodo } from "@/lib/nomina/acciones";
import type { PeriodoNomina } from "@/lib/nomina/tipos";

import { RUTA_EMPLEADOS } from "../../../empleados/_components/formato-nomina";
import { etiquetaPeriodo } from "../../_components/comun-nomina";
import { type FilaEmpleadoAgregable, leerEmpleadosAgregables } from "./acciones-periodo";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  periodo: PeriodoNomina;
}

/** "Ya tiene recibo" (no anulado) no se puede marcar; el anulado se reactiva. */
function esMarcable(fila: FilaEmpleadoAgregable): boolean {
  return fila.recibo_estado === null || fila.recibo_estado === "anulado";
}

function SituacionEmpleado({ fila }: { fila: FilaEmpleadoAgregable }) {
  if (fila.recibo_estado === null) return <PillEstado tono="info">Se agregará</PillEstado>;
  if (fila.recibo_estado === "anulado") return <PillEstado tono="pendiente">Se reactivará</PillEstado>;
  return <PillEstado tono="neutro">Ya tiene recibo</PillEstado>;
}

export function DialogoAgregarEmpleados({ abierto, onOpenChange, periodo }: Props) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [filas, setFilas] = useState<FilaEmpleadoAgregable[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    if (!abierto) return;

    setCargando(true);
    setError(null);
    setBusqueda("");
    setSeleccion(new Set());

    void leerEmpleadosAgregables(periodo.id).then((resultado) => {
      if (resultado.ok) {
        setFilas(resultado.filas);
      } else {
        setError(resultado.error);
        setFilas([]);
      }
      setCargando(false);
    });
  }, [abierto, periodo.id]);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter((fila) => fila.nombre.toLowerCase().includes(termino));
  }, [filas, busqueda]);

  const seleccionadas = filas.filter((fila) => seleccion.has(fila.empleado_id));
  const marcablesVisibles = visibles.filter(esMarcable);
  const todasMarcadas =
    marcablesVisibles.length > 0 && marcablesVisibles.every((fila) => seleccion.has(fila.empleado_id));

  function alternar(empleadoId: string, marcado: boolean) {
    setSeleccion((previas) => {
      const siguiente = new Set(previas);
      if (marcado) siguiente.add(empleadoId);
      else siguiente.delete(empleadoId);
      return siguiente;
    });
  }

  function alternarTodo(marcado: boolean) {
    setSeleccion((previas) => {
      const siguiente = new Set(previas);
      for (const fila of marcablesVisibles) {
        if (marcado) siguiente.add(fila.empleado_id);
        else siguiente.delete(fila.empleado_id);
      }
      return siguiente;
    });
  }

  function cambiar(abrir: boolean) {
    if (pendiente) return;
    if (!abrir) setError(null);
    onOpenChange(abrir);
  }

  function confirmar() {
    setError(null);
    const empleadoIds = seleccionadas.map((fila) => fila.empleado_id);
    if (empleadoIds.length === 0) {
      setError("Selecciona al menos un empleado.");
      return;
    }

    iniciar(async () => {
      const resultado = await agregarEmpleadosPeriodo({ periodo_id: periodo.id, empleado_ids: empleadoIds });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      const saltados = empleadoIds.length - resultado.agregados;
      onOpenChange(false);
      toast.add({
        type: "success",
        title:
          resultado.agregados === 1
            ? "1 empleado agregado al periodo"
            : `${resultado.agregados} empleados agregados al periodo`,
        ...(saltados > 0
          ? {
              description:
                saltados === 1
                  ? "1 quedó fuera: ya tenía recibo o no era elegible."
                  : `${saltados} quedaron fuera: ya tenían recibo o no eran elegibles.`,
            }
          : {}),
      });
      router.refresh();
    });
  }

  const columnas: readonly ColumnaLista<FilaEmpleadoAgregable>[] = [
    {
      clave: "empleado",
      encabezado: "Empleado",
      celda: (fila) => (
        <div className="flex flex-col">
          <span className="font-medium">{fila.nombre}</span>
          <span className="text-muted-foreground text-xs">{fila.cargo ?? "Sin cargo"}</span>
        </div>
      ),
    },
    {
      clave: "situacion",
      encabezado: "Situación",
      celda: (fila) => <SituacionEmpleado fila={fila} />,
    },
  ];

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Agregar empleados al periodo {etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin)}
          </DialogTitle>
          <DialogDescription>
            Se listan los empleados activos de la frecuencia del periodo. Un recibo anulado se reactiva en borrador;
            quien ya tenga recibo no se puede marcar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              className={`${FORM_INPUT} pl-9`}
              placeholder="Buscar por nombre…"
              aria-label="Buscar empleado por nombre"
            />
          </div>

          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando empleados…
            </div>
          ) : null}

          {!cargando && error && filas.length === 0 ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!cargando && !(error && filas.length === 0) ? (
            <TablaLista
              densidad="compacta"
              columnas={columnas}
              filas={visibles}
              claveFila={(fila) => fila.empleado_id}
              seleccion={{
                cabecera: (
                  <Checkbox
                    checked={todasMarcadas}
                    disabled={marcablesVisibles.length === 0}
                    onCheckedChange={(marcado) => alternarTodo(marcado === true)}
                    aria-label="Seleccionar todos los empleados"
                  />
                ),
                celda: (fila) => (
                  <Checkbox
                    checked={seleccion.has(fila.empleado_id)}
                    disabled={!esMarcable(fila)}
                    onCheckedChange={(marcado) => alternar(fila.empleado_id, marcado === true)}
                    aria-label={`Seleccionar a ${fila.nombre}`}
                  />
                ),
              }}
              vacio={{
                titulo: filas.length === 0 ? "No hay empleados activos para agregar." : "Sin resultados.",
                descripcion:
                  filas.length === 0
                    ? "No hay empleados activos de esta frecuencia con contrato vigente en el periodo."
                    : "Ningún empleado coincide con la búsqueda.",
                filtrada: filas.length > 0,
                accion:
                  filas.length === 0 ? (
                    <Enlace href={RUTA_EMPLEADOS} className="text-sm">
                      Ir a Empleados
                    </Enlace>
                  ) : undefined,
              }}
            />
          ) : null}

          {!cargando ? (
            <p className="text-muted-foreground text-sm">
              {seleccionadas.length === 1 ? "1 seleccionado" : `${seleccionadas.length} seleccionados`}
            </p>
          ) : null}

          {error && filas.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pendiente} onClick={() => cambiar(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={seleccionadas.length === 0 || pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {seleccionadas.length === 1 ? "Agregar 1 empleado" : `Agregar ${seleccionadas.length} empleados`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
