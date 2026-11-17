"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2 } from "lucide-react";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_COMBO,
  FORM_INPUT,
  FORM_SELECT,
  FormActions,
  FormCard,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { SelectorImpuesto } from "@/components/selector-impuesto";
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
import { toast } from "@/components/ui/toast";
import { calcularLinea, centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import type { ContactoResumen } from "@/lib/facturacion/tipos";
import { requerido } from "@/lib/formularios/validacion";
import { crearGastoMenor } from "@/lib/gastos/acciones";
import { etiquetaCuenta } from "@/lib/gastos/seleccion";
import type { CuentaCajaBanco, CuentaGasto } from "@/lib/gastos/tipos";
import { type Impuesto, impuestoNinguno } from "@/lib/impuestos/tipos";

interface Props {
  cuentas: CuentaGasto[];
  cuentasCajaBanco: CuentaCajaBanco[];
  proveedores: ContactoResumen[];
  cuentaPorDefecto: string;
  cuentaPagoPorDefecto: string;
  impuestos: Impuesto[];
  fechaHoy: string;
}

interface OpcionCuenta {
  value: string;
  label: string;
}

export function GastoForm({
  cuentas,
  cuentasCajaBanco,
  proveedores,
  cuentaPorDefecto,
  cuentaPagoPorDefecto,
  impuestos,
  fechaHoy,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [impuestoId, setImpuestoId] = useState(impuestoNinguno(impuestos)?.id ?? "");
  const [itbisTasa, setItbisTasa] = useState("0");
  const [cuentaId, setCuentaId] = useState(cuentaPorDefecto);
  const [cuentaPagoId, setCuentaPagoId] = useState(cuentaPagoPorDefecto);
  const [proveedorId, setProveedorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const validacion = useValidacionFormulario();

  const cuentasItems: OpcionCuenta[] = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: etiquetaCuenta(cuenta),
  }));
  const cuentasPagoItems: OpcionCuenta[] = cuentasCajaBanco.map((cuenta) => ({
    value: cuenta.id,
    label: etiquetaCuenta(cuenta),
  }));
  const cuentaSeleccionada = cuentasItems.find((item) => item.value === cuentaId) ?? null;
  const cuentaPagoSeleccionada = cuentasPagoItems.find((item) => item.value === cuentaPagoId) ?? null;
  const subtotalCentavos = parsearCentavos(monto) ?? 0;
  const calculo = calcularLinea({
    cantidad: 1,
    precioCentavos: subtotalCentavos,
    itbisTasa: Number(itbisTasa),
  });

  function guardar() {
    setError(null);

    if (
      !validacion.validar([
        requerido("descripcion", descripcion, "La descripción es requerida."),
        requerido("monto", monto, "El monto es requerido."),
        { campo: "monto", invalido: parsearCentavos(monto) === null, mensaje: "El monto no es válido." },
        { campo: "monto", invalido: subtotalCentavos <= 0, mensaje: "El monto debe ser mayor que cero." },
        requerido("fecha", fecha, "La fecha es requerida."),
        requerido("cuenta", cuentaId, "La cuenta de gasto es requerida."),
      ])
    ) {
      return;
    }

    iniciar(async () => {
      const resultado = await crearGastoMenor({
        fecha,
        descripcion: descripcion.trim(),
        subtotal: centavosAValor(subtotalCentavos),
        itbis_tasa: Number(itbisTasa),
        impuesto_id: impuestoId || null,
        cuenta_gasto_id: cuentaId,
        cuenta_pago_id: cuentaPagoId || undefined,
        contacto_id: proveedorId || undefined,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (resultado.aviso) {
        toast.add({ type: "warning", title: "Saldo negativo", description: resultado.aviso });
      }

      router.push("/dashboard/gastos");
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
          <FormSectionTitle className="mb-4">Datos del gasto</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <CampoFormulario
              htmlFor="descripcion"
              label="Descripción"
              required
              error={validacion.errorDe("descripcion")}
              className="md:col-span-2"
            >
              <Input
                id="descripcion"
                required
                placeholder="Ej. Compra de útiles de oficina"
                value={descripcion}
                onChange={(evento) => {
                  setDescripcion(evento.target.value);
                  validacion.limpiar("descripcion");
                }}
                className={FORM_INPUT}
              />
            </CampoFormulario>

            <CampoFormulario htmlFor="monto" label="Monto" required error={validacion.errorDe("monto")}>
              <Input
                id="monto"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={monto}
                onChange={(evento) => {
                  setMonto(evento.target.value);
                  validacion.limpiar("monto");
                }}
                className={FORM_INPUT}
              />
              <p className="text-muted-foreground text-xs">Monto sin ITBIS.</p>
            </CampoFormulario>

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

            <CampoFormulario
              htmlFor="cuenta"
              label="Cuenta de gasto"
              required
              error={validacion.errorDe("cuenta")}
              className="md:col-span-2"
            >
              <Combobox
                items={cuentasItems}
                value={cuentaSeleccionada}
                onValueChange={(item) => {
                  setCuentaId(item?.value ?? "");
                  validacion.limpiar("cuenta");
                }}
                itemToStringLabel={(item) => item.label}
                isItemEqualToValue={(a, b) => a.value === b.value}
              >
                <ComboboxInput id="cuenta" className={FORM_COMBO} placeholder="Buscar cuenta…" showClear={false} />
                <ComboboxContent>
                  <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                  <ComboboxList>
                    {(item: OpcionCuenta) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </CampoFormulario>

            <p className="text-muted-foreground text-xs md:col-span-2">El comprobante B13 se asigna al guardar.</p>

            <div className="col-span-full">
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between border-t py-2 text-sm font-medium">
                  Más opciones
                  <ChevronDown className="size-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-x-8 gap-y-4 pt-2 md:grid-cols-2">
                    <CampoFormulario htmlFor="cuenta-pago" label="Pagado desde">
                      <Combobox
                        items={cuentasPagoItems}
                        value={cuentaPagoSeleccionada}
                        onValueChange={(item) => setCuentaPagoId(item?.value ?? "")}
                        itemToStringLabel={(item) => item.label}
                        isItemEqualToValue={(a, b) => a.value === b.value}
                      >
                        <ComboboxInput
                          id="cuenta-pago"
                          className={FORM_COMBO}
                          placeholder="Buscar cuenta…"
                          showClear={false}
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                          <ComboboxList>
                            {(item: OpcionCuenta) => (
                              <ComboboxItem key={item.value} value={item}>
                                {item.label}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </CampoFormulario>
                    <CampoFormulario htmlFor="itbis" label="Impuesto">
                      <SelectorImpuesto
                        id="itbis"
                        className={FORM_SELECT}
                        impuestos={impuestos}
                        value={impuestoId}
                        onValueChange={(id) => {
                          const impuesto = impuestos.find((item) => item.id === id);
                          setImpuestoId(id);
                          setItbisTasa(String(impuesto?.tarifa ?? 0));
                        }}
                      />
                    </CampoFormulario>
                    <CampoFormulario htmlFor="proveedor" label="Proveedor" className="md:col-span-2">
                      <SelectorContacto
                        id="proveedor"
                        contactos={proveedores}
                        valor={proveedorId}
                        onCambio={(contacto) => setProveedorId(contacto?.id ?? "")}
                        tipoInicial="proveedor"
                        placeholder="Buscar proveedor…"
                        className={FORM_COMBO}
                      />
                    </CampoFormulario>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </section>

        <FormTotal>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatoMonedaCentavos(calculo.subtotalCentavos)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Impuestos</span>
            <span>{formatoMonedaCentavos(calculo.itbisCentavos)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatoMonedaCentavos(calculo.totalCentavos)}</span>
          </div>
        </FormTotal>
      </FormCard>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button type="button" variant="outline" className={FORM_BUTTON} render={<Link href="/dashboard/gastos" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar gasto
        </Button>
      </FormActions>
    </form>
  );
}
