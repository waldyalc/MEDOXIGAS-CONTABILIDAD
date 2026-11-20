"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Plus } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { FORM_TEXTAREA, FormField } from "@/components/formularios/formulario";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { crearPeriodo } from "@/lib/nomina/acciones";
import type { FrecuenciaPago } from "@/lib/nomina/tipos";

import { MESES, RUTA_CONFIG_LABORAL, rutaPeriodoNomina } from "./comun-nomina";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  frecuenciaDefecto: FrecuenciaPago;
  anioActual: number;
  aniosConParametros: readonly number[];
}

export function fechasDePeriodo(
  anio: number,
  mes: number,
  frecuencia: FrecuenciaPago,
  quincena: "q1" | "q2",
): { inicio: string; fin: string; codigo: string } {
  const dos = (valor: number) => String(valor).padStart(2, "0");
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const prefijo = `${anio}-${dos(mes)}`;

  if (frecuencia === "mensual") {
    return { inicio: `${prefijo}-01`, fin: `${prefijo}-${dos(ultimoDia)}`, codigo: `${prefijo}-M` };
  }
  if (quincena === "q1") {
    return { inicio: `${prefijo}-01`, fin: `${prefijo}-15`, codigo: `${prefijo}-Q1` };
  }
  return { inicio: `${prefijo}-16`, fin: `${prefijo}-${dos(ultimoDia)}`, codigo: `${prefijo}-Q2` };
}

function hoyRD(): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);

  return { anio: anio ?? 2026, mes: mes ?? 1, dia: dia ?? 1 };
}

export function DialogoCrearPeriodo({
  abierto,
  onOpenChange,
  frecuenciaDefecto,
  anioActual,
  aniosConParametros,
}: Props) {
  const router = useRouter();
  const hoy = hoyRD();
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>(frecuenciaDefecto);
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState(hoy.mes);
  const [quincena, setQuincena] = useState<"q1" | "q2">(hoy.dia >= 16 ? "q2" : "q1");
  const [fechaPago, setFechaPago] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const calculado = fechasDePeriodo(anio, mes, frecuencia, quincena);
  const fechaPagoEfectiva = fechaPago ?? calculado.fin;
  const sinParametros = !aniosConParametros.includes(anio);
  const anios = Array.from({ length: 5 }, (_, indice) => anioActual - 2 + indice);
  const meses = MESES.map((nombre, indice) => ({
    value: String(indice + 1),
    label: nombre.charAt(0).toUpperCase() + nombre.slice(1),
  }));
  const quincenas =
    frecuencia === "mensual"
      ? [{ value: "mensual", label: "Mes completo (1–fin de mes)" }]
      : [
          { value: "q1", label: "Primera (1–15)" },
          { value: "q2", label: "Segunda (16–fin de mes)" },
        ];

  function cerrar(abrir: boolean) {
    if (pendiente) return;
    if (!abrir) {
      setError(null);
      setFechaPago(null);
    }
    onOpenChange(abrir);
  }

  function guardar() {
    setError(null);
    iniciar(async () => {
      const resultado = await crearPeriodo({
        frecuencia,
        fecha_inicio: calculado.inicio,
        fecha_fin: calculado.fin,
        fecha_pago: fechaPagoEfectiva,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setFechaPago(null);
      setObservaciones("");
      onOpenChange(false);
      router.push(rutaPeriodoNomina(resultado.id));
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear periodo de nómina</DialogTitle>
          <DialogDescription>
            Se crearán los recibos en borrador de los empleados activos de la frecuencia elegida, con sus novedades
            recurrentes vigentes como vista previa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FormField htmlFor="periodo-frecuencia" label="Frecuencia" required>
            <SelectCampo
              id="periodo-frecuencia"
              opciones={[
                { value: "quincenal", label: "Quincenal" },
                { value: "mensual", label: "Mensual" },
              ]}
              valor={frecuencia}
              onCambio={(valor) => {
                if (valor === "quincenal" || valor === "mensual") setFrecuencia(valor);
              }}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField htmlFor="periodo-anio" label="Año" required>
              <SelectCampo
                id="periodo-anio"
                opciones={anios.map((valor) => ({ value: String(valor), label: String(valor) }))}
                valor={String(anio)}
                onCambio={(valor) => setAnio(Number(valor))}
              />
            </FormField>

            <FormField htmlFor="periodo-mes" label="Mes" required>
              <SelectCampo
                id="periodo-mes"
                opciones={meses}
                valor={String(mes)}
                onCambio={(valor) => setMes(Number(valor))}
              />
            </FormField>
          </div>

          <FormField htmlFor="periodo-quincena" label={frecuencia === "mensual" ? "Rango" : "Quincena"} required>
            <SelectCampo
              id="periodo-quincena"
              opciones={quincenas}
              valor={frecuencia === "mensual" ? "mensual" : quincena}
              onCambio={(valor) => {
                if (valor === "q1" || valor === "q2") setQuincena(valor);
              }}
            />
          </FormField>

          <FormField htmlFor="periodo-fecha-pago" label="Fecha de pago">
            <DatePicker id="periodo-fecha-pago" value={fechaPagoEfectiva} onChange={(valor) => setFechaPago(valor)} />
            <p className="text-muted-foreground text-xs">Es la fecha prevista; el pago real puede usar otra.</p>
          </FormField>

          <FormField htmlFor="periodo-observaciones" label="Observaciones">
            <Textarea
              id="periodo-observaciones"
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              className={FORM_TEXTAREA}
              placeholder="Notas internas del periodo"
            />
          </FormField>

          <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
            <p className="font-medium">
              {calculado.inicio.split("-").reverse().join("/")} – {calculado.fin.split("-").reverse().join("/")}
            </p>
            <p className="text-muted-foreground">
              Código <span className="font-mono text-xs">{calculado.codigo}</span>
            </p>
          </div>

          {sinParametros ? (
            <Alert>
              <AlertTitle>No hay parámetros legales para {anio}.</AlertTitle>
              <AlertDescription>
                Créalos antes de calcular.{" "}
                <a className="text-primary underline-offset-4 hover:underline" href={RUTA_CONFIG_LABORAL}>
                  Configurar parámetros
                </a>
                .
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pendiente} onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={pendiente || sinParametros} onClick={guardar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Plus />}
            Crear periodo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
