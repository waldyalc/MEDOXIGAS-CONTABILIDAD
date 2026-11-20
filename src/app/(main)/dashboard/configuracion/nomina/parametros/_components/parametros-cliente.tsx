"use client";

import { type ReactNode, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_INPUT_GROUP,
  FormActions,
  FormCard,
  FormGrid,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { PillEstado } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { guardarParametrosNomina } from "@/lib/nomina/acciones";
import { mensajeValidacion, parametrosNominaSchema } from "@/lib/nomina/esquemas";
import type { EscalaIsrTramo, ParametrosRD, RiesgoLaboral } from "@/lib/nomina/tipos";
import { parsearMonto } from "@/lib/productos/productos";

interface TramoForm {
  hasta: string;
  tasa: string;
}

interface FormParametros {
  salario_minimo: string;
  tope_sfs_mensual: string;
  tope_afp_mensual: string;
  tope_srl_mensual: string;
  tasa_sfs_empleado: string;
  tasa_sfs_empleador: string;
  tasa_afp_empleado: string;
  tasa_afp_empleador: string;
  tasa_srl_tipo_1: string;
  tasa_srl_tipo_2: string;
  tasa_srl_tipo_3: string;
  tasa_srl_tipo_4: string;
  tasa_infotep: string;
  dias_mes_laboral: string;
  horas_dia_laboral: string;
  escala: TramoForm[];
}

type CampoNumerico = Exclude<keyof FormParametros, "escala">;

const TASA_SRL_POR_RIESGO: Record<RiesgoLaboral, CampoNumerico> = {
  tipo_1: "tasa_srl_tipo_1",
  tipo_2: "tasa_srl_tipo_2",
  tipo_3: "tasa_srl_tipo_3",
  tipo_4: "tasa_srl_tipo_4",
};

const ETIQUETA_RIESGO: Record<RiesgoLaboral, string> = {
  tipo_1: "Tipo I",
  tipo_2: "Tipo II",
  tipo_3: "Tipo III",
  tipo_4: "Tipo IV",
};

function formatear(valor: string | null | undefined, decimales: number): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(decimales) : "";
}

function numero(valor: string): number {
  const leido = parsearMonto(valor);
  return leido ?? 0;
}

function tramosDesde(parametros: ParametrosRD | null): TramoForm[] {
  const base = parametros?.escala_isr_anual ?? [];

  return [0, 1, 2, 3].map((indice) => {
    const tramo = base[indice];
    return {
      hasta: indice === 3 ? "" : formatear(tramo?.hasta, 2),
      tasa: formatear(tramo?.tasa, 3),
    };
  });
}

function formDesde(parametros: ParametrosRD): FormParametros {
  return {
    salario_minimo: formatear(parametros.salario_minimo, 2),
    tope_sfs_mensual: formatear(parametros.tope_sfs_mensual, 2),
    tope_afp_mensual: formatear(parametros.tope_afp_mensual, 2),
    tope_srl_mensual: formatear(parametros.tope_srl_mensual, 2),
    tasa_sfs_empleado: formatear(parametros.tasa_sfs_empleado, 3),
    tasa_sfs_empleador: formatear(parametros.tasa_sfs_empleador, 3),
    tasa_afp_empleado: formatear(parametros.tasa_afp_empleado, 3),
    tasa_afp_empleador: formatear(parametros.tasa_afp_empleador, 3),
    tasa_srl_tipo_1: formatear(parametros.tasa_srl_tipo_1, 3),
    tasa_srl_tipo_2: formatear(parametros.tasa_srl_tipo_2, 3),
    tasa_srl_tipo_3: formatear(parametros.tasa_srl_tipo_3, 3),
    tasa_srl_tipo_4: formatear(parametros.tasa_srl_tipo_4, 3),
    tasa_infotep: formatear(parametros.tasa_infotep, 3),
    dias_mes_laboral: formatear(parametros.dias_mes_laboral, 3),
    horas_dia_laboral: formatear(parametros.horas_dia_laboral, 3),
    escala: tramosDesde(parametros),
  };
}

function formVacio(): FormParametros {
  return {
    salario_minimo: "",
    tope_sfs_mensual: "",
    tope_afp_mensual: "",
    tope_srl_mensual: "",
    tasa_sfs_empleado: "",
    tasa_sfs_empleador: "",
    tasa_afp_empleado: "",
    tasa_afp_empleador: "",
    tasa_srl_tipo_1: "",
    tasa_srl_tipo_2: "",
    tasa_srl_tipo_3: "",
    tasa_srl_tipo_4: "",
    tasa_infotep: "",
    dias_mes_laboral: "",
    horas_dia_laboral: "",
    escala: tramosDesde(null),
  };
}

/** Calcula `desde` y `monto_fijo` de la escala (configuración tributaria, no un recibo). */
function calcularTramos(tramos: TramoForm[]): EscalaIsrTramo[] {
  let desde = 0;
  let montoFijo = 0;

  return tramos.map((tramo, indice) => {
    const esUltimo = indice === tramos.length - 1;
    const hasta = esUltimo ? null : numero(tramo.hasta);
    const tasa = tramo.tasa.trim() === "" ? "0" : String(numero(tramo.tasa));
    const fila: EscalaIsrTramo = {
      desde: desde.toFixed(2),
      hasta: hasta === null ? null : hasta.toFixed(2),
      tasa,
      monto_fijo: montoFijo.toFixed(2),
    };

    if (hasta !== null) {
      montoFijo += (numero(tramo.tasa) / 100) * (hasta - desde);
      desde = hasta;
    }

    return fila;
  });
}

function mostrarMonto(valor: string): string {
  return valor.trim() === "" ? "—" : formatoMoneda(numero(valor));
}

function mostrarPct(valor: string): string {
  return valor.trim() === "" ? "—" : `${formatear(valor, 3)} %`;
}

function CampoDecimal({
  id,
  etiqueta,
  valor,
  onCambio,
  prefijo,
  sufijo,
  requerido,
  deshabilitado,
  ayuda,
  chip,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  prefijo?: string;
  sufijo?: string;
  requerido?: boolean;
  deshabilitado: boolean;
  ayuda?: string;
  chip?: ReactNode;
}) {
  return (
    <CampoFormulario htmlFor={id} label={etiqueta} required={requerido}>
      <div className="flex items-center gap-2">
        <InputGroup className={FORM_INPUT_GROUP}>
          {prefijo ? <InputGroupAddon>{prefijo}</InputGroupAddon> : null}
          <InputGroupInput
            id={id}
            value={valor}
            onChange={(evento) => onCambio(evento.target.value)}
            inputMode="decimal"
            autoComplete="off"
            disabled={deshabilitado}
          />
          {sufijo ? <InputGroupAddon align="inline-end">{sufijo}</InputGroupAddon> : null}
        </InputGroup>
        {chip}
      </div>
      {ayuda ? <p className="text-muted-foreground text-xs">{ayuda}</p> : null}
    </CampoFormulario>
  );
}

export function ParametrosCliente({
  anio,
  anioActual,
  parametros,
  anterior,
  riesgo,
  puedeEditar,
}: {
  readonly anio: number;
  readonly anioActual: number;
  readonly parametros: ParametrosRD | null;
  readonly anterior: ParametrosRD | null;
  readonly riesgo: RiesgoLaboral;
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [formulario, setFormulario] = useState<FormParametros>(() =>
    parametros ? formDesde(parametros) : formVacio(),
  );
  const [base, setBase] = useState<FormParametros>(() => (parametros ? formDesde(parametros) : formVacio()));
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const hayCambios = JSON.stringify(formulario) !== JSON.stringify(base);
  const puedeGuardar = parametros !== null || creando;
  const riesgoEnUso = TASA_SRL_POR_RIESGO[riesgo];

  function irAnio(siguiente: number) {
    router.push(`/dashboard/configuracion/nomina/parametros?anio=${siguiente}`);
  }

  function crearDesdeAnterior() {
    setFormulario(anterior ? formDesde(anterior) : formVacio());
    setBase(formVacio());
    setCreando(true);
    setError(null);
  }

  function cambiar(campo: CampoNumerico, valor: string) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
    setError(null);
  }

  function cambiarTramo(indice: number, campo: keyof TramoForm, valor: string) {
    setFormulario((previo) => ({
      ...previo,
      escala: previo.escala.map((tramo, posicion) => (posicion === indice ? { ...tramo, [campo]: valor } : tramo)),
    }));
    setError(null);
  }

  function descartar() {
    const inicial = parametros ? formDesde(parametros) : formVacio();
    setFormulario(inicial);
    setBase(inicial);
    setCreando(false);
    setError(null);
  }

  function guardar() {
    setError(null);

    const hastaCerrados = formulario.escala.slice(0, 3).map((tramo, indice) => ({
      indice,
      hasta: tramo.hasta,
    }));
    const incompleto = hastaCerrados.find((tramo) => tramo.hasta.trim() === "");

    if (incompleto) {
      setError(`Completa el hasta del tramo ${incompleto.indice + 1} de la escala de ISR.`);
      document.getElementById("parametros-isr")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const limites = hastaCerrados.map((tramo) => numero(tramo.hasta));
    const desordenado = limites.findIndex(
      (limite, indice) => limite <= (indice === 0 ? 0 : (limites[indice - 1] ?? 0)),
    );

    if (desordenado >= 0) {
      setError("Cada tramo de la escala debe terminar después del anterior, sin solapes.");
      document.getElementById("parametros-isr")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const entrada = {
      anio,
      salario_minimo: formulario.salario_minimo,
      tope_sfs_mensual: formulario.tope_sfs_mensual,
      tope_afp_mensual: formulario.tope_afp_mensual,
      tope_srl_mensual: formulario.tope_srl_mensual,
      tasa_sfs_empleado: formulario.tasa_sfs_empleado,
      tasa_sfs_empleador: formulario.tasa_sfs_empleador,
      tasa_afp_empleado: formulario.tasa_afp_empleado,
      tasa_afp_empleador: formulario.tasa_afp_empleador,
      tasa_srl_tipo_1: formulario.tasa_srl_tipo_1,
      tasa_srl_tipo_2: formulario.tasa_srl_tipo_2,
      tasa_srl_tipo_3: formulario.tasa_srl_tipo_3,
      tasa_srl_tipo_4: formulario.tasa_srl_tipo_4,
      tasa_infotep: formulario.tasa_infotep,
      dias_mes_laboral: formulario.dias_mes_laboral,
      horas_dia_laboral: formulario.horas_dia_laboral,
      escala_isr_anual: calcularTramos(formulario.escala),
    };

    const validado = parametrosNominaSchema.safeParse(entrada);
    if (!validado.success) {
      setError(mensajeValidacion(validado.error));
      const primero = String(validado.error.issues[0]?.path[0] ?? "");
      const seccion = primero.startsWith("escala")
        ? "parametros-isr"
        : primero.includes("tasa")
          ? "parametros-tasas"
          : primero.includes("dias") || primero.includes("horas")
            ? "parametros-jornada"
            : "parametros-salariales";
      document.getElementById(seccion)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    iniciar(async () => {
      const resultado = await guardarParametrosNomina(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setBase(formulario);
      setCreando(false);
      toast.add({
        type: "success",
        title: `Parámetros de ${anio} guardados.`,
        description: "Los periodos nuevos usan estas tasas y topes.",
      });
      router.refresh();
    });
  }

  const tramosCalculados = calcularTramos(formulario.escala);
  const anios = Array.from({ length: 101 }, (_, indice) => {
    const valor = String(2000 + indice);
    return { value: valor, label: valor };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Año anterior"
          onClick={() => irAnio(anio - 1)}
          disabled={anio <= 2000}
        >
          <ChevronLeft />
        </Button>
        <div className="w-28">
          <SelectCampo
            buscable
            opciones={anios}
            valor={String(anio)}
            onCambio={(valor) => {
              if (valor !== "") irAnio(Number(valor));
            }}
            aria-label="Año de los parámetros"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Año siguiente"
          onClick={() => irAnio(anio + 1)}
          disabled={anio >= 2100}
        >
          <ChevronRight />
        </Button>
        <Button type="button" variant="ghost" onClick={() => irAnio(anioActual)}>
          Año actual
        </Button>
        {anio === anioActual ? <PillEstado tono="exito">Vigente</PillEstado> : null}
        {anio === 2026 ? <PillEstado tono="info">Sembrado</PillEstado> : null}
      </div>

      {parametros == null && !creando ? (
        <FormCard>
          <FormSectionTitle descripcion="El cálculo de un periodo exige las tasas y topes de su año.">
            Sin parámetros para {anio}
          </FormSectionTitle>
          <p className="text-muted-foreground text-sm">
            {anterior
              ? `Puedes crear el año a partir de ${anio - 1} y ajustar solo lo que cambió.`
              : "No hay un año anterior sembrado para copiar. Captura las tasas y topes vigentes."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={crearDesdeAnterior}>
              {anterior ? `Crear año a partir de ${anio - 1}` : `Capturar parámetros de ${anio}`}
            </Button>
            <Button type="button" variant="outline" onClick={() => irAnio(anioActual)}>
              Cancelar
            </Button>
          </div>
        </FormCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-muted-foreground text-xs font-medium">Salario mínimo</span>
                <span className="text-xl font-semibold tabular-nums">{mostrarMonto(formulario.salario_minimo)}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-muted-foreground text-xs font-medium">Tope SFS</span>
                <span className="text-xl font-semibold tabular-nums">{mostrarMonto(formulario.tope_sfs_mensual)}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-muted-foreground text-xs font-medium">Tope AFP</span>
                <span className="text-xl font-semibold tabular-nums">{mostrarMonto(formulario.tope_afp_mensual)}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-muted-foreground text-xs font-medium">Tope SRL</span>
                <span className="text-xl font-semibold tabular-nums">{mostrarMonto(formulario.tope_srl_mensual)}</span>
              </CardContent>
            </Card>
          </div>

          <div id="parametros-salariales" className="scroll-mt-24">
            <FormCard>
              <FormSectionTitle descripcion="Montos mensuales en pesos dominicanos.">Salario y topes</FormSectionTitle>
              <FormGrid>
                <CampoDecimal
                  id="parametros-salario-minimo"
                  etiqueta="Salario mínimo"
                  valor={formulario.salario_minimo}
                  onCambio={(valor) => cambiar("salario_minimo", valor)}
                  prefijo="RD$"
                  requerido
                  deshabilitado={!puedeEditar}
                />
                <CampoDecimal
                  id="parametros-tope-sfs"
                  etiqueta="Tope SFS mensual"
                  valor={formulario.tope_sfs_mensual}
                  onCambio={(valor) => cambiar("tope_sfs_mensual", valor)}
                  prefijo="RD$"
                  requerido
                  deshabilitado={!puedeEditar}
                  ayuda="El tope SFS es 10 salarios mínimos."
                />
                <CampoDecimal
                  id="parametros-tope-afp"
                  etiqueta="Tope AFP mensual"
                  valor={formulario.tope_afp_mensual}
                  onCambio={(valor) => cambiar("tope_afp_mensual", valor)}
                  prefijo="RD$"
                  requerido
                  deshabilitado={!puedeEditar}
                  ayuda="El tope AFP es 20 salarios mínimos."
                />
                <CampoDecimal
                  id="parametros-tope-srl"
                  etiqueta="Tope SRL mensual"
                  valor={formulario.tope_srl_mensual}
                  onCambio={(valor) => cambiar("tope_srl_mensual", valor)}
                  prefijo="RD$"
                  requerido
                  deshabilitado={!puedeEditar}
                  ayuda="El tope SRL es 4 salarios mínimos."
                />
              </FormGrid>
              <p className="text-muted-foreground text-xs">
                Puedes ajustar los topes; el cálculo usa siempre el valor guardado.
              </p>
            </FormCard>
          </div>

          <div id="parametros-tasas" className="scroll-mt-24">
            <FormCard>
              <FormSectionTitle descripcion="Porcentajes de aportes; se guardan con hasta 3 decimales.">
                Tasas
              </FormSectionTitle>
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">SFS</h3>
                <FormGrid>
                  <CampoDecimal
                    id="parametros-tasa-sfs-empleado"
                    etiqueta="SFS empleado"
                    valor={formulario.tasa_sfs_empleado}
                    onCambio={(valor) => cambiar("tasa_sfs_empleado", valor)}
                    sufijo="%"
                    requerido
                    deshabilitado={!puedeEditar}
                  />
                  <CampoDecimal
                    id="parametros-tasa-sfs-empleador"
                    etiqueta="SFS empleador"
                    valor={formulario.tasa_sfs_empleador}
                    onCambio={(valor) => cambiar("tasa_sfs_empleador", valor)}
                    sufijo="%"
                    requerido
                    deshabilitado={!puedeEditar}
                  />
                </FormGrid>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">AFP</h3>
                <FormGrid>
                  <CampoDecimal
                    id="parametros-tasa-afp-empleado"
                    etiqueta="AFP empleado"
                    valor={formulario.tasa_afp_empleado}
                    onCambio={(valor) => cambiar("tasa_afp_empleado", valor)}
                    sufijo="%"
                    requerido
                    deshabilitado={!puedeEditar}
                  />
                  <CampoDecimal
                    id="parametros-tasa-afp-empleador"
                    etiqueta="AFP empleador"
                    valor={formulario.tasa_afp_empleador}
                    onCambio={(valor) => cambiar("tasa_afp_empleador", valor)}
                    sufijo="%"
                    requerido
                    deshabilitado={!puedeEditar}
                  />
                </FormGrid>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">SRL</h3>
                <FormGrid>
                  {([1, 2, 3, 4] as const).map((tipo) => {
                    const campo = `tasa_srl_tipo_${tipo}` as CampoNumerico;
                    return (
                      <CampoDecimal
                        key={campo}
                        id={`parametros-${campo.replaceAll("_", "-")}`}
                        etiqueta={`SRL tipo ${tipo}`}
                        valor={formulario[campo]}
                        onCambio={(valor) => cambiar(campo, valor)}
                        sufijo="%"
                        requerido
                        deshabilitado={!puedeEditar}
                        chip={
                          riesgoEnUso === campo ? (
                            <PillEstado tono="info">En uso · {ETIQUETA_RIESGO[riesgo]}</PillEstado>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </FormGrid>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">INFOTEP</h3>
                <FormGrid>
                  <CampoDecimal
                    id="parametros-tasa-infotep"
                    etiqueta="INFOTEP"
                    valor={formulario.tasa_infotep}
                    onCambio={(valor) => cambiar("tasa_infotep", valor)}
                    sufijo="%"
                    requerido
                    deshabilitado={!puedeEditar}
                  />
                </FormGrid>
              </div>
            </FormCard>
          </div>

          <div id="parametros-jornada" className="scroll-mt-24">
            <FormCard>
              <FormSectionTitle descripcion="Se usan para el valor de la hora extra y las provisiones.">
                Jornada
              </FormSectionTitle>
              <FormGrid>
                <CampoDecimal
                  id="parametros-dias-mes"
                  etiqueta="Días del mes laboral"
                  valor={formulario.dias_mes_laboral}
                  onCambio={(valor) => cambiar("dias_mes_laboral", valor)}
                  requerido
                  deshabilitado={!puedeEditar}
                  ayuda="Ej. 23.830"
                />
                <CampoDecimal
                  id="parametros-horas-dia"
                  etiqueta="Horas del día laboral"
                  valor={formulario.horas_dia_laboral}
                  onCambio={(valor) => cambiar("horas_dia_laboral", valor)}
                  requerido
                  deshabilitado={!puedeEditar}
                  ayuda="Ej. 8.000"
                />
              </FormGrid>
            </FormCard>
          </div>

          <div id="parametros-isr" className="scroll-mt-24">
            <FormCard>
              <FormSectionTitle descripcion="Cuatro tramos anuales. El desde y el monto fijo se calculan con el tramo anterior.">
                Escala de ISR anual
              </FormSectionTitle>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border h-12 border-b">
                      <TableHead className="h-12">Desde</TableHead>
                      <TableHead className="h-12">Hasta</TableHead>
                      <TableHead className="h-12">Tasa</TableHead>
                      <TableHead className="h-12 text-right">Monto fijo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tramosCalculados.map((tramo, indice) => (
                      <TableRow key={`tramo-${indice}`} className="border-border border-b">
                        <TableCell className="tabular-nums">{formatoMoneda(tramo.desde)}</TableCell>
                        <TableCell>
                          {indice === 3 ? (
                            <span className="text-muted-foreground">En adelante</span>
                          ) : (
                            <InputGroup className={FORM_INPUT_GROUP}>
                              <InputGroupAddon>RD$</InputGroupAddon>
                              <InputGroupInput
                                id={`parametros-tramo-${indice}-hasta`}
                                value={formulario.escala[indice]?.hasta ?? ""}
                                onChange={(evento) => cambiarTramo(indice, "hasta", evento.target.value)}
                                inputMode="decimal"
                                autoComplete="off"
                                aria-label={`Hasta del tramo ${indice + 1}`}
                                disabled={!puedeEditar}
                              />
                            </InputGroup>
                          )}
                        </TableCell>
                        <TableCell>
                          <InputGroup className={FORM_INPUT_GROUP}>
                            <InputGroupInput
                              id={`parametros-tramo-${indice}-tasa`}
                              value={formulario.escala[indice]?.tasa ?? ""}
                              onChange={(evento) => cambiarTramo(indice, "tasa", evento.target.value)}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`Tasa del tramo ${indice + 1}`}
                              disabled={!puedeEditar}
                            />
                            <InputGroupAddon align="inline-end">%</InputGroupAddon>
                          </InputGroup>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatoMoneda(tramo.monto_fijo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-muted-foreground text-xs">
                La escala es de 4 tramos en esta fase. El RPC valida que no haya huecos ni solapes.
              </p>
            </FormCard>
          </div>

          <Alert>
            <AlertDescription>
              Los recibos ya calculados no cambian si editas las tasas: el cálculo guarda sus bases y montos. Los
              periodos nuevos usan estos parámetros.
            </AlertDescription>
          </Alert>

          <p className="text-muted-foreground text-sm">
            SFS empleado {mostrarPct(formulario.tasa_sfs_empleado)} · AFP empleado{" "}
            {mostrarPct(formulario.tasa_afp_empleado)} · SRL en uso {mostrarPct(formulario[riesgoEnUso])}
          </p>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {puedeEditar ? (
            <FormActions>
              {hayCambios || creando ? (
                <Button type="button" variant="ghost" onClick={descartar} disabled={pendiente} className={FORM_BUTTON}>
                  Descartar
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={guardar}
                disabled={pendiente || !puedeGuardar || (!hayCambios && parametros !== null)}
                className={FORM_BUTTON}
              >
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Guardar cambios
              </Button>
            </FormActions>
          ) : null}
        </>
      )}
    </div>
  );
}
