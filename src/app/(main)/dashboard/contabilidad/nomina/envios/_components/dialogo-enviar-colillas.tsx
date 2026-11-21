"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { FORM_INPUT } from "@/components/formularios/formulario";
import { Loader2, Mail, Send } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatoFechaHora } from "@/lib/formato";
import { registrarEnvioColillas } from "@/lib/nomina/acciones";
import type { EstadoNomina, PeriodoNomina } from "@/lib/nomina/tipos";

import { EstadoNominaPill, etiquetaPeriodo } from "../../periodos/_components/comun-nomina";
import { type FilaColilla, leerColillasPeriodo } from "./acciones-envios";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  periodo: PeriodoNomina;
  puedeEscribir: boolean;
}

function esEnviable(estado: EstadoNomina): boolean {
  return estado === "calculado" || estado === "contabilizado" || estado === "pagado";
}

export function DialogoEnviarColillas({ abierto, onOpenChange, periodo, puedeEscribir }: Props) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [filas, setFilas] = useState<FilaColilla[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [enviadoA, setEnviadoA] = useState("");
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    if (!abierto) return;

    setCargando(true);
    setError(null);
    setSeleccion(new Set());
    setEnviadoA("");

    void leerColillasPeriodo(periodo.id).then((resultado) => {
      if (resultado.ok) {
        setFilas(resultado.filas.filter((fila) => esEnviable(fila.estado)));
      } else {
        setError(resultado.error);
        setFilas([]);
      }
      setCargando(false);
    });
  }, [abierto, periodo.id]);

  const seleccionables = filas.filter((fila) => fila.correo || enviadoA.trim() !== "");
  const seleccionadas = filas.filter((fila) => seleccion.has(fila.recibo_id));
  const sinCorreo = enviadoA.trim() === "" ? seleccionadas.filter((fila) => !fila.correo).length : 0;
  const todasSeleccionadas = seleccionables.length > 0 && seleccionables.every((fila) => seleccion.has(fila.recibo_id));

  function cambiarDestinatario(valor: string) {
    setEnviadoA(valor);
    if (valor.trim() === "") {
      setSeleccion((previas) => {
        const siguiente = new Set(previas);
        for (const fila of filas) {
          if (!fila.correo) siguiente.delete(fila.recibo_id);
        }
        return siguiente;
      });
    }
  }

  function alternar(reciboId: string, marcado: boolean) {
    setSeleccion((previas) => {
      const siguiente = new Set(previas);
      if (marcado) siguiente.add(reciboId);
      else siguiente.delete(reciboId);
      return siguiente;
    });
  }

  function alternarTodo(marcado: boolean) {
    setSeleccion(() => new Set(marcado ? seleccionables.map((fila) => fila.recibo_id) : []));
  }

  function registrar() {
    setError(null);
    const reciboIds = filas.filter((fila) => seleccion.has(fila.recibo_id)).map((fila) => fila.recibo_id);

    if (reciboIds.length === 0) {
      setError("Selecciona al menos una colilla.");
      return;
    }
    if (sinCorreo > 0) {
      setError(`Falta el correo de ${sinCorreo === 1 ? "un empleado" : `${sinCorreo} empleados`}.`);
      return;
    }

    iniciar(async () => {
      const resultado = await registrarEnvioColillas({
        periodo_id: periodo.id,
        recibo_ids: reciboIds,
        ...(enviadoA.trim() ? { enviado_a: enviadoA.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setConfirmarAbierto(false);
      onOpenChange(false);
      toast.add({
        type: "success",
        title: `${resultado.enviados} colillas registradas como enviadas`,
        description: "La constancia quedó guardada. Aún no se envía correo.",
      });
      router.refresh();
    });
  }

  const columnas: readonly ColumnaLista<FilaColilla>[] = [
    {
      clave: "empleado",
      encabezado: "Empleado",
      celda: (fila) => <span className="font-medium">{fila.nombre}</span>,
    },
    {
      clave: "correo",
      encabezado: "Correo",
      celda: (fila) =>
        fila.correo ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Mail className="text-muted-foreground size-3.5" />
            {fila.correo}
          </span>
        ) : (
          <PillEstado tono="neutro">Sin correo</PillEstado>
        ),
    },
    {
      clave: "estado",
      encabezado: "Estado del recibo",
      celda: (fila) => <EstadoNominaPill estado={fila.estado} />,
    },
    {
      clave: "enviada",
      encabezado: "Última colilla enviada",
      celda: (fila) => (fila.colilla_enviada_en ? formatoFechaHora(fila.colilla_enviada_en) : "—"),
    },
  ];

  return (
    <>
      <Dialog open={abierto} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Colillas del periodo {etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin)}</DialogTitle>
            <DialogDescription>
              La constancia de envío se guarda en el sistema. El envío por correo se habilitará cuando se configure un
              proveedor; por ahora no sale ningún correo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="envio-destinatario" className="text-sm font-medium">
                Registrar como enviado a
              </label>
              <Input
                id="envio-destinatario"
                type="email"
                value={enviadoA}
                onChange={(evento) => cambiarDestinatario(evento.target.value)}
                className={FORM_INPUT}
                placeholder="correo@empresa.com (opcional)"
              />
              <p className="text-muted-foreground text-xs">
                Si se deja vacío, se usa el correo de cada empleado. Los empleados sin correo no se pueden seleccionar.
              </p>
            </div>

            {cargando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Cargando colillas…
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
                filas={filas}
                claveFila={(fila) => fila.recibo_id}
                seleccion={
                  puedeEscribir
                    ? {
                        cabecera: (
                          <Checkbox
                            checked={todasSeleccionadas}
                            disabled={seleccionables.length === 0}
                            onCheckedChange={(marcado) => alternarTodo(marcado === true)}
                            aria-label="Seleccionar todas las colillas"
                          />
                        ),
                        celda: (fila) => {
                          const disponible = Boolean(fila.correo) || enviadoA.trim() !== "";
                          return (
                            <Checkbox
                              checked={seleccion.has(fila.recibo_id)}
                              disabled={!disponible}
                              onCheckedChange={(marcado) => alternar(fila.recibo_id, marcado === true)}
                              aria-label={`Seleccionar la colilla de ${fila.nombre}`}
                            />
                          );
                        },
                      }
                    : undefined
                }
                vacio={{
                  titulo: "Sin colillas enviables",
                  descripcion: "Los recibos deben estar calculados, contabilizados o pagados para poder enviarlos.",
                }}
              />
            ) : null}

            {puedeEscribir && !cargando ? (
              <p className="text-muted-foreground text-sm">
                {seleccionadas.length} seleccionados
                {sinCorreo > 0
                  ? ` · falta el correo de ${sinCorreo === 1 ? "1 empleado" : `${sinCorreo} empleados`}`
                  : ""}
              </p>
            ) : null}

            {error && filas.length > 0 ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {puedeEscribir ? (
              <Button
                type="button"
                disabled={seleccionadas.length === 0 || sinCorreo > 0 || pendiente}
                onClick={() => {
                  setError(null);
                  setConfirmarAbierto(true);
                }}
              >
                <Send />
                Registrar envío
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarAbierto} onOpenChange={setConfirmarAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar la constancia de envío</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrará la constancia de envío de {seleccionadas.length}{" "}
              {seleccionadas.length === 1 ? "colilla" : "colillas"}. Aún no se envía correo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button type="button" disabled={pendiente} onClick={registrar}>
              {pendiente ? <Loader2 className="animate-spin" /> : <Send />}
              Registrar envío
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
