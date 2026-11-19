"use client";

import { useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2, Plus, Trash2 } from "lucide-react";

import { type ContactoOpcion, SelectorContacto } from "@/components/contactos/selector-contacto";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_INPUT,
  FORM_SELECT,
  FormActions,
  FormCard,
  FormDivider,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { crearAsientoManual } from "@/lib/asientos/acciones";
import type { CentroCostoAsiento, ContactoAsiento, CuentaAsiento, TipoEntradaAsiento } from "@/lib/asientos/tipos";
import { rutaAsiento } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { type ReglaCampo, requerido } from "@/lib/formularios/validacion";

const SIN_CENTRO = "__ninguno";

interface LineaForm {
  clave: string;
  cuentaId: string;
  contactoId: string;
  centroCostoId: string;
  debito: string;
  credito: string;
}

interface ItemCombobox {
  value: string;
  label: string;
}

interface Props {
  cuentas: CuentaAsiento[];
  contactos: ContactoAsiento[];
  centrosCosto: CentroCostoAsiento[];
  tiposEntrada: TipoEntradaAsiento[];
  fechaHoy: string;
}

function lineaVacia(clave: string): LineaForm {
  return { clave, cuentaId: "", contactoId: "", centroCostoId: "", debito: "", credito: "" };
}

function montoCentavos(texto: string): number {
  return parsearCentavos(texto) ?? 0;
}

function tieneUnSoloLado(debito: number, credito: number): boolean {
  const hayDebito = debito > 0;
  const hayCredito = credito > 0;
  return hayDebito !== hayCredito;
}

function reglasDeLinea(linea: LineaForm): ReglaCampo[] {
  const debito = linea.debito.trim();
  const credito = linea.credito.trim();
  const reglas: ReglaCampo[] = [requerido(`cuenta-${linea.clave}`, linea.cuentaId, "Seleccione una cuenta.")];

  if (debito !== "" && parsearCentavos(debito) == null) {
    reglas.push({ campo: `debito-${linea.clave}`, invalido: true, mensaje: "Use un número con hasta dos decimales." });
  }
  if (credito !== "" && parsearCentavos(credito) == null) {
    reglas.push({ campo: `credito-${linea.clave}`, invalido: true, mensaje: "Use un número con hasta dos decimales." });
  }
  if (debito === "" && credito === "") {
    reglas.push({ campo: `debito-${linea.clave}`, invalido: true, mensaje: "Escriba el débito o el crédito." });
  }
  if (debito !== "" && credito !== "") {
    reglas.push({
      campo: `credito-${linea.clave}`,
      invalido: true,
      mensaje: "Cada línea lleva débito o crédito, no ambos.",
    });
  }
  if (debito !== "" && credito === "" && montoCentavos(debito) <= 0) {
    reglas.push({ campo: `debito-${linea.clave}`, invalido: true, mensaje: "El monto debe ser mayor que cero." });
  }
  if (credito !== "" && debito === "" && montoCentavos(credito) <= 0) {
    reglas.push({ campo: `credito-${linea.clave}`, invalido: true, mensaje: "El monto debe ser mayor que cero." });
  }

  return reglas;
}

function reglasDelAsiento(fecha: string, descripcion: string, lineas: LineaForm[]): ReglaCampo[] {
  return [
    requerido("fecha", fecha, "La fecha es requerida."),
    requerido("descripcion", descripcion, "La descripción es requerida."),
    ...lineas.flatMap(reglasDeLinea),
  ];
}

export function AsientoForm({ cuentas, contactos, centrosCosto, tiposEntrada, fechaHoy }: Props) {
  const router = useRouter();
  const contador = useRef(2);
  const [pendiente, iniciar] = useTransition();

  const [fecha, setFecha] = useState(fechaHoy);
  const [tipoId, setTipoId] = useState(
    () => tiposEntrada.find((tipo) => tipo.prefijo === "AC")?.id ?? tiposEntrada[0]?.id ?? "",
  );
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia("l1"), lineaVacia("l2")]);
  const [error, setError] = useState<string | null>(null);
  const validacion = useValidacionFormulario();

  const cuentasItems: ItemCombobox[] = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
  const contactosOpciones: ContactoOpcion[] = contactos.map((contacto) => ({ ...contacto, rnc_cedula: null }));
  const centrosItems = [
    { value: SIN_CENTRO, label: "Sin centro" },
    ...centrosCosto.map((centro) => ({ value: centro.id, label: `${centro.codigo} · ${centro.nombre}` })),
  ];
  const tiposItems = tiposEntrada.map((tipo) => ({
    value: tipo.id,
    label: `${tipo.nombre} (${tipo.prefijo})`,
  }));
  const tipoSeleccionado = tiposEntrada.find((tipo) => tipo.id === tipoId);

  const debitosCentavos = lineas.reduce((total, linea) => total + montoCentavos(linea.debito), 0);
  const creditosCentavos = lineas.reduce((total, linea) => total + montoCentavos(linea.credito), 0);
  const descuadrado = debitosCentavos !== creditosCentavos;

  function actualizarLinea(clave: string, cambios: Partial<LineaForm>) {
    setLineas((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
  }

  function agregarLinea() {
    contador.current += 1;
    setLineas((actuales) => [...actuales, lineaVacia(`l${contador.current}`)]);
  }

  function quitarLinea(clave: string) {
    setLineas((actuales) => (actuales.length > 2 ? actuales.filter((linea) => linea.clave !== clave) : actuales));
  }

  function guardar() {
    setError(null);

    if (!validacion.validar(reglasDelAsiento(fecha, descripcion, lineas))) return;

    if (lineas.length < 2) {
      setError("Un asiento requiere al menos dos líneas.");
      return;
    }
    if (lineas.some((linea) => !linea.cuentaId)) {
      setError("Selecciona la cuenta en todas las líneas.");
      return;
    }
    if (
      lineas.some(
        (linea) =>
          (linea.debito.trim() !== "" && parsearCentavos(linea.debito) == null) ||
          (linea.credito.trim() !== "" && parsearCentavos(linea.credito) == null),
      )
    ) {
      setError("Revisa los montos: usa números con hasta dos decimales.");
      return;
    }
    if (lineas.some((linea) => !tieneUnSoloLado(montoCentavos(linea.debito), montoCentavos(linea.credito)))) {
      setError("Cada línea debe llevar débito o crédito, nunca ambos.");
      return;
    }
    if (debitosCentavos !== creditosCentavos) {
      setError(
        `El asiento está descuadrado: débitos ${formatoMonedaCentavos(debitosCentavos)} y créditos ${formatoMonedaCentavos(creditosCentavos)}.`,
      );
      return;
    }
    if (debitosCentavos <= 0) {
      setError("El asiento debe tener un monto mayor que cero.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearAsientoManual({
        fecha,
        descripcion: descripcion.trim(),
        ...(tipoId ? { tipo_entrada_id: tipoId } : {}),
        lineas: lineas.map((linea) => ({
          cuenta_id: linea.cuentaId,
          ...(linea.contactoId ? { contacto_id: linea.contactoId } : {}),
          ...(linea.centroCostoId ? { centro_costo_id: linea.centroCostoId } : {}),
          debito: centavosAValor(montoCentavos(linea.debito)),
          credito: centavosAValor(montoCentavos(linea.credito)),
        })),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaAsiento(resultado.id));
    });
  }

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-[1040px] flex-col gap-6"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
    >
      <FormCard>
        <section>
          <FormSectionTitle className="mb-4">Datos del asiento</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <CampoFormulario htmlFor="fecha" label="Fecha" required error={validacion.errorDe("fecha")}>
              <Input
                id="fecha"
                type="date"
                required
                value={fecha}
                onChange={(evento) => {
                  setFecha(evento.target.value);
                  validacion.limpiar("fecha");
                }}
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="tipo-entrada" label="Tipo de entrada de diario">
              <Select
                items={tiposItems}
                value={tipoId || null}
                onValueChange={(valor: string | null) => setTipoId(valor ?? "")}
              >
                <SelectTrigger id="tipo-entrada" className={FORM_SELECT}>
                  <SelectValue placeholder="Ajuste contable" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {tiposItems.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoFormulario>
            <CampoFormulario htmlFor="codigo" label="Código">
              <Input
                id="codigo"
                value={tipoSeleccionado ? `${tipoSeleccionado.prefijo}-${tipoSeleccionado.siguiente}` : "—"}
                disabled
                readOnly
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <CampoFormulario
              htmlFor="descripcion"
              label="Descripción"
              required
              error={validacion.errorDe("descripcion")}
              className="md:col-span-3"
            >
              <Input
                id="descripcion"
                required
                maxLength={500}
                value={descripcion}
                placeholder="Concepto del asiento"
                onChange={(evento) => {
                  setDescripcion(evento.target.value);
                  validacion.limpiar("descripcion");
                }}
                className={FORM_INPUT}
              />
            </CampoFormulario>
          </div>
        </section>

        <FormDivider />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <FormSectionTitle>Líneas</FormSectionTitle>
            <Button type="button" variant="outline" size="sm" onClick={agregarLinea}>
              <Plus />
              Agregar línea
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-muted-foreground hidden gap-2 px-1 text-xs md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
              <span>Cuenta *</span>
              <span>Tercero</span>
              <span>Centro de costo</span>
              <span className="text-right">Débito</span>
              <span className="text-right">Crédito</span>
              <span className="w-8" />
            </div>

            {lineas.map((linea, indice) => (
              <div
                key={linea.clave}
                className="grid grid-cols-2 items-end gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] md:border-0 md:p-0"
              >
                <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                  <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`cuenta-${linea.clave}`}>
                    Cuenta {indice === 0 ? "*" : null}
                  </Label>
                  <Combobox
                    items={cuentasItems}
                    onValueChange={(item: ItemCombobox | null) => {
                      actualizarLinea(linea.clave, { cuentaId: item?.value ?? "" });
                      validacion.limpiar(`cuenta-${linea.clave}`);
                    }}
                  >
                    <ComboboxInput
                      id={`cuenta-${linea.clave}`}
                      className={FORM_SELECT}
                      placeholder="Buscar cuenta…"
                      aria-invalid={Boolean(validacion.errorDe(`cuenta-${linea.clave}`))}
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>Sin cuentas</ComboboxEmpty>
                      <ComboboxList>
                        {(item: ItemCombobox) => (
                          <ComboboxItem key={item.value} value={item}>
                            {item.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {validacion.errorDe(`cuenta-${linea.clave}`) ? (
                    <p role="alert" className="text-destructive text-xs">
                      Seleccione una cuenta.
                    </p>
                  ) : null}
                </div>

                <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                  <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`tercero-${linea.clave}`}>
                    Tercero
                  </Label>
                  <SelectorContacto
                    id={`tercero-${linea.clave}`}
                    contactos={contactosOpciones}
                    valor={linea.contactoId}
                    onCambio={(contacto: ContactoOpcion | null) =>
                      actualizarLinea(linea.clave, { contactoId: contacto?.id ?? "" })
                    }
                    tipoInicial="todos"
                    className={FORM_SELECT}
                    placeholder="Opcional"
                  />
                </div>

                <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                  <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`centro-${linea.clave}`}>
                    Centro de costo
                  </Label>
                  <Select
                    items={centrosItems}
                    value={linea.centroCostoId || SIN_CENTRO}
                    onValueChange={(valor: string | null) =>
                      actualizarLinea(linea.clave, {
                        centroCostoId: valor == null || valor === SIN_CENTRO ? "" : valor,
                      })
                    }
                  >
                    <SelectTrigger id={`centro-${linea.clave}`} className={FORM_SELECT}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {centrosItems.map((centro) => (
                        <SelectItem key={centro.value} value={centro.value}>
                          {centro.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`debito-${linea.clave}`}>
                    Débito
                  </Label>
                  <Input
                    id={`debito-${linea.clave}`}
                    className={`${FORM_INPUT} text-right`}
                    inputMode="decimal"
                    value={linea.debito}
                    onChange={(evento) => {
                      actualizarLinea(linea.clave, { debito: evento.target.value });
                      validacion.limpiar(`debito-${linea.clave}`);
                    }}
                    aria-invalid={Boolean(validacion.errorDe(`debito-${linea.clave}`))}
                  />
                  {validacion.errorDe(`debito-${linea.clave}`) ? (
                    <p role="alert" className="text-destructive text-xs">
                      {validacion.errorDe(`debito-${linea.clave}`)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`credito-${linea.clave}`}>
                    Crédito
                  </Label>
                  <Input
                    id={`credito-${linea.clave}`}
                    className={`${FORM_INPUT} text-right`}
                    inputMode="decimal"
                    value={linea.credito}
                    onChange={(evento) => {
                      actualizarLinea(linea.clave, { credito: evento.target.value });
                      validacion.limpiar(`credito-${linea.clave}`);
                    }}
                    aria-invalid={Boolean(validacion.errorDe(`credito-${linea.clave}`))}
                  />
                  {validacion.errorDe(`credito-${linea.clave}`) ? (
                    <p role="alert" className="text-destructive text-xs">
                      {validacion.errorDe(`credito-${linea.clave}`)}
                    </p>
                  ) : null}
                </div>

                <div className="col-span-2 flex justify-end md:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={lineas.length <= 2}
                    onClick={() => quitarLinea(linea.clave)}
                  >
                    <Trash2 />
                    <span className="sr-only">Quitar línea</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <FormTotal>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total débitos</span>
            <span className="tabular-nums">{formatoMonedaCentavos(debitosCentavos)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total créditos</span>
            <span className="tabular-nums">{formatoMonedaCentavos(creditosCentavos)}</span>
          </div>
          <div
            className={`mt-3 flex items-center justify-between text-xl leading-7 font-semibold ${
              descuadrado ? "text-destructive" : "text-slate-900"
            }`}
          >
            <span>Diferencia</span>
            <span className="tabular-nums">{formatoMonedaCentavos(Math.abs(debitosCentavos - creditosCentavos))}</span>
          </div>
          {descuadrado ? (
            <p className="text-destructive mt-2 text-xs">
              El asiento está descuadrado: los débitos y los créditos deben ser iguales para poder guardar.
            </p>
          ) : null}
        </FormTotal>
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
          render={<Link href="/dashboard/contabilidad/asientos" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || descuadrado} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar asiento
        </Button>
      </FormActions>
    </form>
  );
}
