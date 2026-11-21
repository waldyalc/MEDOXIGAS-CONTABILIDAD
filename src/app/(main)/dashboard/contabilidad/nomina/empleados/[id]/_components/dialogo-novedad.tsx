"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT_GROUP, FORM_TEXTAREA, FormGrid } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { ReglaCampo } from "@/lib/formularios/validacion";
import { guardarNovedadRecurrente } from "@/lib/nomina/acciones";
import type { ClaseConcepto, ConceptoNomina, NovedadRecurrente } from "@/lib/nomina/tipos";
import { parsearMonto } from "@/lib/productos/productos";

interface Props {
  readonly abierto: boolean;
  readonly onAbiertoChange: (abierto: boolean) => void;
  readonly empleadoId: string;
  readonly conceptos: readonly ConceptoNomina[];
  readonly clase: Extract<ClaseConcepto, "ingreso" | "deduccion">;
  readonly novedad: NovedadRecurrente | null;
  readonly fechaHoy: string;
}

export function DialogoNovedad({ abierto, onAbiertoChange, empleadoId, conceptos, clase, novedad, fechaHoy }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();
  const { limpiarTodo } = validacion;
  const [error, setError] = useState<string | null>(null);

  const [conceptoId, setConceptoId] = useState("");
  const [tipoValor, setTipoValor] = useState<"monto" | "porcentaje">("monto");
  const [monto, setMonto] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [fechaInicio, setFechaInicio] = useState(fechaHoy);
  const [fechaFin, setFechaFin] = useState("");
  const [notas, setNotas] = useState("");
  const [activa, setActiva] = useState(true);

  useEffect(() => {
    if (!abierto) return;
    setConceptoId(novedad?.concepto_id ?? "");
    setTipoValor(novedad?.porcentaje !== null && novedad?.porcentaje !== undefined ? "porcentaje" : "monto");
    setMonto(novedad?.monto ?? "");
    setPorcentaje(novedad?.porcentaje ?? "");
    setFechaInicio(novedad?.fecha_inicio ?? fechaHoy);
    setFechaFin(novedad?.fecha_fin ?? "");
    setNotas(novedad?.notas ?? "");
    setActiva(novedad?.activa ?? true);
    setError(null);
    limpiarTodo();
  }, [abierto, novedad, fechaHoy, limpiarTodo]);

  const opcionesConcepto = conceptos
    .filter((concepto) => concepto.clase === clase)
    .map((concepto) => ({ value: concepto.id, label: `${concepto.nombre} · ${concepto.codigo}` }));

  function reglas(): ReglaCampo[] {
    const valor = tipoValor === "monto" ? monto : porcentaje;
    const numero = parsearMonto(valor);

    return [
      {
        campo: "novedad_concepto",
        invalido: conceptoId === "",
        mensaje: "Selecciona el concepto de la novedad.",
      },
      {
        campo: tipoValor === "monto" ? "novedad_monto" : "novedad_porcentaje",
        invalido: numero === null || numero <= 0 || (tipoValor === "porcentaje" && numero > 100),
        mensaje:
          tipoValor === "monto"
            ? "El monto debe ser mayor que cero."
            : "El porcentaje debe ser mayor que cero y máximo 100.",
      },
      {
        campo: "novedad_fecha_inicio",
        invalido: fechaInicio === "",
        mensaje: "La fecha de inicio es obligatoria.",
      },
      {
        campo: "novedad_fecha_fin",
        invalido: fechaFin !== "" && fechaInicio !== "" && fechaFin < fechaInicio,
        mensaje: "La fecha de fin no puede ser anterior a la fecha de inicio.",
      },
    ];
  }

  function guardar() {
    if (!validacion.validar(reglas())) return;

    const entrada = {
      ...(novedad ? { id: novedad.id } : {}),
      empleado_id: empleadoId,
      concepto_id: conceptoId,
      ...(tipoValor === "monto" ? { monto } : { porcentaje }),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      activa,
      notas,
    };

    setError(null);

    iniciar(async () => {
      const resultado = await guardarNovedadRecurrente(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onAbiertoChange(false);
      toast.add({ type: "success", title: novedad ? "Novedad actualizada." : "Novedad agregada." });
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{novedad ? "Editar novedad recurrente" : "Nueva novedad recurrente"}</DialogTitle>
          <DialogDescription>
            {clase === "ingreso"
              ? "Ingreso fijo que se suma en cada periodo."
              : "Deducción fija que se resta en cada periodo."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <CampoFormulario
            htmlFor="novedad_concepto"
            label="Concepto"
            required
            error={validacion.errorDe("novedad_concepto")}
          >
            <SelectCampo
              id="novedad_concepto"
              valor={conceptoId}
              opciones={opcionesConcepto}
              buscable
              etiquetaVacia="Buscar concepto…"
              onCambio={setConceptoId}
              className="h-10 w-full"
              aria-label="Concepto de la novedad"
            />
          </CampoFormulario>

          <div className="flex flex-col gap-2">
            <Tabs
              value={tipoValor}
              onValueChange={(valor) => {
                if (valor === "monto" || valor === "porcentaje") setTipoValor(valor);
              }}
            >
              <TabsList>
                <TabsTrigger value="monto">Monto</TabsTrigger>
                <TabsTrigger value="porcentaje">Porcentaje del salario</TabsTrigger>
              </TabsList>
            </Tabs>

            {tipoValor === "monto" ? (
              <CampoFormulario
                htmlFor="novedad_monto"
                label="Monto"
                required
                error={validacion.errorDe("novedad_monto")}
              >
                <InputGroup className={FORM_INPUT_GROUP}>
                  <InputGroupAddon align="inline-start">RD$</InputGroupAddon>
                  <InputGroupInput
                    id="novedad_monto"
                    inputMode="decimal"
                    value={monto}
                    placeholder="0.00"
                    onChange={(evento) => setMonto(evento.target.value)}
                    className="h-full min-w-0 pl-1 tabular-nums"
                  />
                </InputGroup>
              </CampoFormulario>
            ) : (
              <CampoFormulario
                htmlFor="novedad_porcentaje"
                label="Porcentaje del salario"
                required
                error={validacion.errorDe("novedad_porcentaje")}
              >
                <InputGroup className={FORM_INPUT_GROUP}>
                  <InputGroupAddon align="inline-end">%</InputGroupAddon>
                  <InputGroupInput
                    id="novedad_porcentaje"
                    inputMode="decimal"
                    value={porcentaje}
                    placeholder="0.000"
                    onChange={(evento) => setPorcentaje(evento.target.value)}
                    className="h-full min-w-0 pr-1 tabular-nums"
                  />
                </InputGroup>
              </CampoFormulario>
            )}
          </div>

          <FormGrid className="sm:grid-cols-2 lg:grid-cols-2">
            <CampoFormulario
              htmlFor="novedad_fecha_inicio"
              label="Fecha de inicio"
              required
              error={validacion.errorDe("novedad_fecha_inicio")}
            >
              <DatePicker id="novedad_fecha_inicio" value={fechaInicio} onChange={setFechaInicio} />
            </CampoFormulario>

            <CampoFormulario
              htmlFor="novedad_fecha_fin"
              label="Fecha de fin"
              error={validacion.errorDe("novedad_fecha_fin")}
            >
              <DatePicker id="novedad_fecha_fin" value={fechaFin} onChange={setFechaFin} placeholder="Sin fin" />
            </CampoFormulario>
          </FormGrid>

          <CampoFormulario htmlFor="novedad_notas" label="Notas">
            <Textarea
              id="novedad_notas"
              value={notas}
              maxLength={500}
              onChange={(evento) => setNotas(evento.target.value)}
              className={FORM_TEXTAREA}
            />
          </CampoFormulario>

          {novedad ? (
            <div className="border-border flex items-center justify-between gap-3 rounded-xl border p-3">
              <Label htmlFor="novedad_activa">Activa</Label>
              <Switch id="novedad_activa" checked={activa} onCheckedChange={setActiva} />
            </div>
          ) : null}

          <p className="text-muted-foreground text-sm">
            Se aplica una vez por periodo, sin prorrata. Si empieza a mitad de periodo, se paga completa.
          </p>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar la novedad</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-[12px] px-6" />}>
            Cancelar
          </DialogClose>
          <Button type="button" onClick={guardar} disabled={pendiente} className="h-11 rounded-[12px] px-6">
            {pendiente ? <Loader2 className="animate-spin" /> : null}
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
