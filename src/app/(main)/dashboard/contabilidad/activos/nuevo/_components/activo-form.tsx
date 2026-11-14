"use client";

import { type FormEvent, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import {
  FORM_BUTTON,
  FORM_COMBO,
  FORM_INPUT,
  FORM_SELECT,
  FormActions,
  FormCard,
  FormField,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { crearActivoFijo } from "@/lib/activos-fijos/acciones";
import { construirDepreciacion } from "@/lib/activos-fijos/calculo";
import {
  type CuentaActivo,
  type DatosFormularioActivo,
  ETIQUETAS_TIPO_ACTIVO,
  TIPOS_ACTIVO,
} from "@/lib/activos-fijos/tipos";
import { vidaUtilEnMeses } from "@/lib/activos-fijos/validacion";
import { centavosAValor, parsearCantidad, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";

interface Opcion {
  value: string;
  label: string;
}

interface Props {
  datos: DatosFormularioActivo;
  fechaHoy: string;
}

function opcionesCuenta(cuentas: CuentaActivo[]): Opcion[] {
  return cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));
}

function CampoCuenta({
  id,
  etiqueta,
  opciones,
  valor,
  onChange,
  pendiente,
  requerido = false,
}: {
  id: string;
  etiqueta: string;
  opciones: Opcion[];
  valor: string;
  onChange: (valor: string) => void;
  pendiente: boolean;
  requerido?: boolean;
}) {
  const seleccionada = opciones.find((opcion) => opcion.value === valor) ?? null;

  return (
    <FormField htmlFor={id} label={etiqueta} required={requerido}>
      <Combobox
        items={opciones}
        value={seleccionada}
        onValueChange={(item) => onChange(item?.value ?? "")}
        itemToStringLabel={(item) => item.label}
        isItemEqualToValue={(a, b) => a.value === b.value}
      >
        <ComboboxInput
          id={id}
          className={FORM_COMBO}
          placeholder="Buscar cuenta…"
          showClear={false}
          disabled={pendiente}
        />
        <ComboboxContent>
          <ComboboxEmpty>Sin resultados</ComboboxEmpty>
          <ComboboxList>
            {(item: Opcion) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormField>
  );
}

export function ActivoForm({ datos, fechaHoy }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  const [nombre, setNombre] = useState("");
  const [referencia, setReferencia] = useState("");
  const [tipoActivo, setTipoActivo] = useState<string>("otros_tangibles");
  const [proveedorId, setProveedorId] = useState("");
  const [fechaAdquisicion, setFechaAdquisicion] = useState(fechaHoy);
  const [costo, setCosto] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [residual, setResidual] = useState("");
  const [fechaInicio, setFechaInicio] = useState(fechaHoy);
  const [vidaUtil, setVidaUtil] = useState("5");
  const [periodoDepreciacion, setPeriodoDepreciacion] = useState<"anual" | "mensual">("anual");
  const [cuentaActivoId, setCuentaActivoId] = useState(datos.porDefecto.activo);
  const [cuentaDepreciacionId, setCuentaDepreciacionId] = useState(datos.porDefecto.depreciacion);
  const [cuentaGastoId, setCuentaGastoId] = useState(datos.porDefecto.gasto);
  const [contabilizar, setContabilizar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const costoCentavos = parsearCentavos(costo) ?? 0;
  const cantidadNumero = parsearCantidad(cantidad);
  const montoCentavos = Math.round(costoCentavos * cantidadNumero);
  const residualCentavos = parsearCentavos(residual) ?? 0;
  const vidaNumero = parsearCantidad(vidaUtil);
  const meses = vidaUtilEnMeses(vidaNumero, periodoDepreciacion);
  const proyeccion = construirDepreciacion({
    montoTotalCentavos: montoCentavos,
    valorResidualCentavos: residualCentavos,
    vidaUtilMeses: meses,
    fechaInicio,
  });
  const mensualCentavos = proyeccion[0]?.montoCentavos ?? 0;

  const proveedores: Opcion[] = datos.proveedores.map((proveedor) => ({
    value: proveedor.id,
    label: proveedor.nombre,
  }));
  const proveedorSeleccionado = proveedores.find((opcion) => opcion.value === proveedorId) ?? null;

  function validarMontos(): string | null {
    if (costoCentavos <= 0) return "El costo de adquisición debe ser mayor que cero.";
    if (cantidadNumero <= 0) return "La cantidad debe ser mayor que cero.";
    if (montoCentavos <= 0) return "El monto total de inversión debe ser mayor que cero.";
    if (residualCentavos >= montoCentavos) return "El valor residual debe ser menor que el monto total.";
    if (meses < 1) return "La vida útil debe equivaler al menos a un mes.";
    if (proyeccion.length === 0) {
      return "La base a depreciar es menor que un centavo por mes. Revisa el monto o la vida útil.";
    }
    return null;
  }

  function validarFormulario(): string | null {
    if (!nombre.trim()) return "Escribe el nombre del activo.";
    if (!cuentaActivoId || !cuentaDepreciacionId || !cuentaGastoId) {
      return "Selecciona las cuentas contables del activo.";
    }
    return validarMontos();
  }

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const mensaje = validarFormulario();
    if (mensaje) {
      setError(mensaje);
      return;
    }

    iniciar(async () => {
      const resultado = await crearActivoFijo({
        nombre: nombre.trim(),
        ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
        tipo_activo: tipoActivo,
        ...(proveedorId ? { proveedor_contacto_id: proveedorId } : {}),
        fecha_adquisicion: fechaAdquisicion,
        costo_unitario: centavosAValor(costoCentavos),
        cantidad: cantidadNumero,
        monto_total: centavosAValor(montoCentavos),
        valor_residual: centavosAValor(residualCentavos),
        cuenta_activo_id: cuentaActivoId,
        cuenta_depreciacion_id: cuentaDepreciacionId,
        cuenta_gasto_id: cuentaGastoId,
        fecha_inicio_depreciacion: fechaInicio,
        vida_util: vidaNumero,
        periodo_depreciacion: periodoDepreciacion,
        contabilizar_creacion: contabilizar,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/contabilidad/activos/${resultado.id}`);
    });
  }

  return (
    <form onSubmit={guardar} className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      <FormCard>
        <section>
          <FormSectionTitle className="mb-4">Datos del activo</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <FormField htmlFor="nombre" label="Nombre" required className="sm:col-span-2">
              <Input
                id="nombre"
                required
                placeholder="Ej. Camioneta de reparto"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                maxLength={200}
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </FormField>

            <FormField htmlFor="tipo-activo" label="Tipo de activo">
              <Select
                value={tipoActivo}
                onValueChange={(valor) => setTipoActivo(valor ?? "otros_tangibles")}
                disabled={pendiente}
              >
                <SelectTrigger id="tipo-activo" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ACTIVO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {ETIQUETAS_TIPO_ACTIVO[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField htmlFor="fecha-adquisicion" label="Fecha de adquisición" required>
              <DatePicker id="fecha-adquisicion" value={fechaAdquisicion} onChange={setFechaAdquisicion} />
            </FormField>

            <FormField htmlFor="costo" label="Costo de adquisición" required>
              <Input
                id="costo"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={costo}
                onChange={(evento) => setCosto(evento.target.value)}
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </FormField>

            <FormField htmlFor="cantidad" label="Cantidad" required>
              <Input
                id="cantidad"
                inputMode="decimal"
                required
                value={cantidad}
                onChange={(evento) => setCantidad(evento.target.value)}
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </FormField>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm leading-5 font-medium text-slate-700">Monto total de inversión</span>
              <div className="flex h-10 items-center justify-between rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-sm">
                <span className="text-muted-foreground">Costo × cantidad</span>
                <span className="font-medium tabular-nums">{formatoMonedaCentavos(montoCentavos)}</span>
              </div>
            </div>

            <FormField htmlFor="fecha-inicio" label="Inicio de depreciación" required>
              <DatePicker id="fecha-inicio" value={fechaInicio} onChange={setFechaInicio} />
            </FormField>

            <FormField htmlFor="vida-util" label="Vida útil" required>
              <div className="flex items-center gap-2">
                <Input
                  id="vida-util"
                  inputMode="decimal"
                  required
                  value={vidaUtil}
                  onChange={(evento) => setVidaUtil(evento.target.value)}
                  disabled={pendiente}
                  className={`${FORM_INPUT} w-24`}
                />
                <Select
                  value={periodoDepreciacion}
                  onValueChange={(valor) => setPeriodoDepreciacion(valor === "mensual" ? "mensual" : "anual")}
                  disabled={pendiente}
                >
                  <SelectTrigger className={FORM_SELECT} aria-label="Periodo de depreciación">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anual">Años</SelectItem>
                    <SelectItem value="mensual">Meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormField>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:col-span-2">
              <span className="text-muted-foreground">
                {meses > 0 ? `${meses} meses de depreciación` : "Sin depreciación calculada"}
              </span>
              <span className="font-medium tabular-nums">
                {mensualCentavos > 0 ? `${formatoMonedaCentavos(mensualCentavos)} por mes` : "—"}
              </span>
            </div>

            <div className="sm:col-span-2">
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between border-t border-slate-200 py-2 text-sm font-medium">
                  Más opciones
                  <ChevronDown className="size-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-x-8 gap-y-4 pt-2 sm:grid-cols-2">
                    <FormField htmlFor="referencia" label="Referencia">
                      <Input
                        id="referencia"
                        placeholder="Opcional"
                        value={referencia}
                        onChange={(evento) => setReferencia(evento.target.value)}
                        maxLength={100}
                        disabled={pendiente}
                        className={FORM_INPUT}
                      />
                    </FormField>

                    <FormField htmlFor="proveedor" label="Proveedor">
                      <Combobox
                        items={proveedores}
                        value={proveedorSeleccionado}
                        onValueChange={(item) => setProveedorId(item?.value ?? "")}
                        itemToStringLabel={(item) => item.label}
                        isItemEqualToValue={(a, b) => a.value === b.value}
                      >
                        <ComboboxInput
                          id="proveedor"
                          className={FORM_COMBO}
                          placeholder="Buscar proveedor…"
                          showClear
                          disabled={pendiente}
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                          <ComboboxList>
                            {(item: Opcion) => (
                              <ComboboxItem key={item.value} value={item}>
                                {item.label}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </FormField>

                    <FormField htmlFor="residual" label="Valor residual">
                      <Input
                        id="residual"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={residual}
                        onChange={(evento) => setResidual(evento.target.value)}
                        disabled={pendiente}
                        className={FORM_INPUT}
                      />
                      <p className="text-muted-foreground text-xs">No puede ser mayor ni igual al monto total.</p>
                    </FormField>

                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="contabilizar">Contabilizar creación del activo</Label>
                        <p className="text-muted-foreground text-xs">
                          Crea el asiento de compra contra cuentas por pagar.
                        </p>
                      </div>
                      <Switch id="contabilizar" checked={contabilizar} onCheckedChange={setContabilizar} />
                    </div>

                    <CampoCuenta
                      id="cuenta-activo"
                      etiqueta="Cuenta contable del activo"
                      requerido
                      opciones={opcionesCuenta(datos.cuentasActivo)}
                      valor={cuentaActivoId}
                      onChange={setCuentaActivoId}
                      pendiente={pendiente}
                    />
                    <CampoCuenta
                      id="cuenta-depreciacion"
                      etiqueta="Cuenta de depreciación acumulada"
                      requerido
                      opciones={opcionesCuenta(datos.cuentasDepreciacion)}
                      valor={cuentaDepreciacionId}
                      onChange={setCuentaDepreciacionId}
                      pendiente={pendiente}
                    />
                    <CampoCuenta
                      id="cuenta-gasto"
                      etiqueta="Cuenta contable del gasto"
                      requerido
                      opciones={opcionesCuenta(datos.cuentasGasto)}
                      valor={cuentaGastoId}
                      onChange={setCuentaGastoId}
                      pendiente={pendiente}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </section>
      </FormCard>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          render={<Link href="/dashboard/contabilidad/activos" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar activo
        </Button>
      </FormActions>
    </form>
  );
}
