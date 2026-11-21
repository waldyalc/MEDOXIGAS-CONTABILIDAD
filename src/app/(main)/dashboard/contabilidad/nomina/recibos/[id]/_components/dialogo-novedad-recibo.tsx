"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { FORM_INPUT, FORM_TEXTAREA, FormField } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Loader2, Plus } from "@/components/icons";
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
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { requerido } from "@/lib/formularios/validacion";
import { guardarNovedadRecibo } from "@/lib/nomina/acciones";
import type { ConceptoNomina, Decimal, EstadoNomina, LineaRecibo, ParametrosRD } from "@/lib/nomina/tipos";

import { formatoDias } from "../../../periodos/_components/comun-nomina";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  reciboId: string;
  estado: EstadoNomina;
  clase: "ingreso" | "deduccion";
  conceptos: readonly ConceptoNomina[];
  lineasManuales: readonly LineaRecibo[];
  lineaEditando: LineaRecibo | null;
  salarioMensual: Decimal;
  parametros: ParametrosRD | null;
}

function esHorasExtra(codigo: string): boolean {
  const normalizado = codigo.toLowerCase();
  return normalizado === "horas_extra_35" || normalizado === "horas_extra_100";
}

function tituloDialogo(linea: LineaRecibo | null, clase: "ingreso" | "deduccion"): string {
  if (linea) return "Editar novedad";
  return clase === "ingreso" ? "Agregar ingreso" : "Agregar deducción";
}

function tituloToast(linea: LineaRecibo | null, esHora: boolean): string {
  if (linea) return "Novedad actualizada";
  if (esHora) return "Horas extra agregadas";
  return "Novedad agregada";
}

function factorHoras(codigo: string): string {
  return codigo.toLowerCase() === "horas_extra_100" ? "2.00" : "1.35";
}

export function DialogoNovedadRecibo({
  abierto,
  onOpenChange,
  reciboId,
  estado,
  clase,
  conceptos,
  lineasManuales,
  lineaEditando,
  salarioMensual,
  parametros,
}: Props) {
  const router = useRouter();
  const [conceptoId, setConceptoId] = useState(lineaEditando?.concepto_id ?? "");
  const [tipoValor, setTipoValor] = useState<"monto" | "porcentaje">(
    lineaEditando?.porcentaje ? "porcentaje" : "monto",
  );
  const [cantidad, setCantidad] = useState(lineaEditando?.cantidad ?? "");
  const [monto, setMonto] = useState(lineaEditando && !lineaEditando.porcentaje ? lineaEditando.monto : "");
  const [porcentaje, setPorcentaje] = useState(lineaEditando?.porcentaje ?? "");
  const [notas, setNotas] = useState(lineaEditando?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const { errorDe, validar } = useValidacionFormulario();

  const opciones = conceptos
    .filter(
      (concepto) =>
        concepto.activo && concepto.clase === clase && (!concepto.es_sistema || esHorasExtra(concepto.codigo)),
    )
    .map((concepto) => ({ value: concepto.id, label: `${concepto.codigo} — ${concepto.nombre}` }));

  const concepto = conceptos.find((opcion) => opcion.id === conceptoId);
  const esHora = concepto != null && esHorasExtra(concepto.codigo);
  const diasMes = parametros?.dias_mes_laboral ?? null;
  const horasDia = parametros?.horas_dia_laboral ?? null;

  function cambiarConcepto(valor: string) {
    setConceptoId(valor);
    setCantidad("");
    setMonto("");
    setPorcentaje("");
  }

  function cerrar(abrir: boolean) {
    if (pendiente) return;
    if (!abrir) setError(null);
    onOpenChange(abrir);
  }

  function guardar() {
    setError(null);

    const reglas = [requerido("novedad-concepto", conceptoId, "Selecciona un concepto.")];
    if (esHora) {
      reglas.push(requerido("novedad-cantidad", cantidad, "Indica las horas extra."));
    } else if (tipoValor === "porcentaje") {
      reglas.push(requerido("novedad-porcentaje", porcentaje, "Indica el porcentaje del salario."));
    } else {
      reglas.push(requerido("novedad-monto", monto, "Indica el monto."));
    }

    if (!validar(reglas)) return;

    iniciar(async () => {
      const resultado = await guardarNovedadRecibo({
        ...(lineaEditando ? { id: lineaEditando.id } : {}),
        recibo_id: reciboId,
        concepto_id: conceptoId,
        ...(esHora ? { cantidad } : {}),
        ...(!esHora && tipoValor === "monto" ? { monto } : {}),
        ...(!esHora && tipoValor === "porcentaje" ? { porcentaje } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: tituloToast(lineaEditando, esHora),
        description: `Monto calculado por el servidor: ${formatoMoneda(resultado.monto)}.`,
      });
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tituloDialogo(lineaEditando, clase)}</DialogTitle>
          <DialogDescription>
            Solo se agregan ingresos y deducciones manuales. Las líneas del sistema y las recurrentes se regeneran al
            calcular.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FormField htmlFor="novedad-concepto" label="Concepto" required error={errorDe("novedad-concepto")}>
            <SelectCampo
              id="novedad-concepto"
              buscable
              opciones={opciones}
              valor={conceptoId}
              onCambio={cambiarConcepto}
              etiquetaVacia="Selecciona el concepto"
            />
          </FormField>

          {esHora ? (
            <>
              <FormField htmlFor="novedad-cantidad" label="Horas" required error={errorDe("novedad-cantidad")}>
                <Input
                  id="novedad-cantidad"
                  inputMode="decimal"
                  value={cantidad}
                  onChange={(evento) => setCantidad(evento.target.value)}
                  className={FORM_INPUT}
                  placeholder="0.000"
                />
              </FormField>

              <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-xs">
                <p className="font-medium">Así lo calcula el servidor</p>
                <p className="text-muted-foreground">
                  {formatoMoneda(salarioMensual)} ÷ {diasMes ? formatoDias(diasMes) : "—"} ÷{" "}
                  {horasDia ? formatoDias(horasDia) : "—"} × {factorHoras(concepto?.codigo ?? "")} × horas
                </p>
                <p className="text-muted-foreground">
                  El monto se conoce al guardar: lo devuelve el servidor y se muestra en la tabla.
                </p>
              </div>
            </>
          ) : (
            <>
              <Tabs
                value={tipoValor}
                onValueChange={(valor) => setTipoValor(valor === "porcentaje" ? "porcentaje" : "monto")}
              >
                <TabsList>
                  <TabsTrigger value="monto">Monto</TabsTrigger>
                  <TabsTrigger value="porcentaje">Porcentaje del salario</TabsTrigger>
                </TabsList>
              </Tabs>

              {tipoValor === "monto" ? (
                <FormField htmlFor="novedad-monto" label="Monto" required error={errorDe("novedad-monto")}>
                  <InputGroup className="h-10 rounded-[10px]">
                    <InputGroupAddon>RD$</InputGroupAddon>
                    <InputGroupInput
                      id="novedad-monto"
                      inputMode="decimal"
                      value={monto}
                      onChange={(evento) => setMonto(evento.target.value)}
                      placeholder="0.00"
                    />
                  </InputGroup>
                </FormField>
              ) : (
                <FormField
                  htmlFor="novedad-porcentaje"
                  label="Porcentaje del salario"
                  required
                  error={errorDe("novedad-porcentaje")}
                >
                  <InputGroup className="h-10 rounded-[10px]">
                    <InputGroupAddon>%</InputGroupAddon>
                    <InputGroupInput
                      id="novedad-porcentaje"
                      inputMode="decimal"
                      value={porcentaje}
                      onChange={(evento) => setPorcentaje(evento.target.value)}
                      placeholder="0.000"
                    />
                  </InputGroup>
                </FormField>
              )}
            </>
          )}

          <FormField htmlFor="novedad-notas" label="Notas">
            <Textarea
              id="novedad-notas"
              value={notas}
              onChange={(evento) => setNotas(evento.target.value)}
              className={FORM_TEXTAREA}
              placeholder="Motivo o detalle de la novedad"
            />
          </FormField>

          {estado === "calculado" ? (
            <Alert>
              <AlertTitle>El recibo volverá a borrador</AlertTitle>
              <AlertDescription>
                Al guardar una novedad, el recibo vuelve a borrador y debes recalcular para actualizar los totales.
              </AlertDescription>
            </Alert>
          ) : null}

          {lineasManuales.length > 0 && !lineaEditando ? (
            <p className="text-muted-foreground text-xs">
              Este recibo ya tiene {lineasManuales.length} novedades manuales; se pueden repetir conceptos.
            </p>
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
          <Button type="button" disabled={pendiente} onClick={guardar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Plus />}
            {lineaEditando ? "Guardar novedad" : "Agregar al recibo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
