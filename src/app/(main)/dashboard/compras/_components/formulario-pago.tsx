"use client";

import { type FormEvent, useState, useTransition } from "react";

import { ChevronDown } from "lucide-react";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { RetencionesCampo } from "@/components/retenciones/retenciones-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { registrarPagoProveedor } from "@/lib/compras/acciones";
import { aNumero } from "@/lib/compras/calculo";
import { METODOS_PAGO } from "@/lib/compras/esquema";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { elegirCuentaPagoPorDefecto, facturasAbiertasDeProveedor, saldoFactura } from "@/lib/compras/seleccion";
import type { MetodoPago, OpcionesPago } from "@/lib/compras/tipos";
import { calcularRetenciones, totalRetenido } from "@/lib/retenciones/calculo";

import { ComboboxCampo, type OpcionCombobox } from "./combobox-campo";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

const OPCIONES_METODO = METODOS_PAGO.map((metodo) => ({ value: metodo, label: ETIQUETAS_METODO[metodo] }));

export function FormularioPago({ contactos, cuentasCajaBanco, facturasAbiertas, retenciones }: OpcionesPago) {
  const [proveedorId, setProveedorId] = useState("");
  const [facturaId, setFacturaId] = useState("");
  const [fecha, setFecha] = useState(hoyEnRd);
  const [cuentaId, setCuentaId] = useState(() => elegirCuentaPagoPorDefecto(cuentasCajaBanco));
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState("");
  const [retencionesIds, setRetencionesIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const opcionesFacturas: OpcionCombobox[] = facturasAbiertasDeProveedor(facturasAbiertas, proveedorId).map(
    (factura) => ({
      value: factura.id,
      label: `#${factura.numero} — ${factura.ncf ?? "—"} — ${formatoMoneda(saldoFactura(factura))}`,
    }),
  );

  const opcionesCuentas = cuentasCajaBanco.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} ${cuenta.nombre}`,
  }));

  const facturaSeleccionada = facturasAbiertas.find((factura) => factura.id === facturaId) ?? null;
  const saldoSeleccionado = facturaSeleccionada ? saldoFactura(facturaSeleccionada) : null;
  const base = facturaSeleccionada
    ? { subtotal: facturaSeleccionada.subtotal, itbis: facturaSeleccionada.itbis }
    : { subtotal: 0, itbis: 0 };
  const retenido = totalRetenido(calcularRetenciones(retencionesIds, retenciones, base));

  function ajustarMonto(factura: NonNullable<typeof facturaSeleccionada>, ids: string[]) {
    const nuevoRetenido = totalRetenido(
      calcularRetenciones(ids, retenciones, { subtotal: factura.subtotal, itbis: factura.itbis }),
    );
    setMonto(Math.max(0, Math.round((saldoFactura(factura) - nuevoRetenido) * 100) / 100).toFixed(2));
  }

  function cambiarProveedor(contacto: { id: string } | null) {
    setProveedorId(contacto?.id ?? "");
    setFacturaId("");
    setMonto("");
    setRetencionesIds([]);
    setError(null);
    setExito(false);
  }

  function cambiarFactura(valor: string) {
    const factura = facturasAbiertas.find((item) => item.id === valor);
    setFacturaId(valor);
    setRetencionesIds([]);
    setMonto(factura ? saldoFactura(factura).toFixed(2) : "");
    setError(null);
    setExito(false);
  }

  function cambiarRetenciones(ids: string[]) {
    setRetencionesIds(ids);
    if (facturaSeleccionada) ajustarMonto(facturaSeleccionada, ids);
  }

  function cambiarMetodo(valor: string) {
    const siguiente = METODOS_PAGO.find((item) => item === valor);
    if (siguiente) setMetodo(siguiente);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setExito(false);

    if (!proveedorId) {
      setError("Selecciona un proveedor.");
      return;
    }
    if (!facturaId) {
      setError("Selecciona una factura abierta.");
      return;
    }
    if (!cuentaId) {
      setError("Selecciona una cuenta de caja o banco.");
      return;
    }
    if (aNumero(monto) <= 0) {
      setError("El monto debe ser mayor que 0.");
      return;
    }

    if (
      saldoSeleccionado != null &&
      Math.round((aNumero(monto) + retenido) * 100) > Math.round(saldoSeleccionado * 100)
    ) {
      setError("El monto más las retenciones no puede superar el saldo de la factura.");
      return;
    }

    iniciar(async () => {
      const resultado = await registrarPagoProveedor({
        factura_proveedor_id: facturaId,
        fecha,
        cuenta_id: cuentaId,
        metodo,
        monto: aNumero(monto),
        retenciones: retencionesIds.map((id) => ({ retencion_id: id })),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setExito(true);
      if (resultado.aviso) {
        toast.add({ type: "warning", title: "Saldo negativo", description: resultado.aviso });
      }
      setFacturaId("");
      setMonto("");
      setRetencionesIds([]);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar pago</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="proveedor">Proveedor *</Label>
              <SelectorContacto
                id="proveedor"
                contactos={contactos}
                valor={proveedorId}
                onCambio={cambiarProveedor}
                tipoInicial="proveedor"
                placeholder="Buscar proveedor…"
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="factura">Factura abierta *</Label>
              <ComboboxCampo
                id="factura"
                opciones={opcionesFacturas}
                valor={facturaId}
                onCambio={cambiarFactura}
                placeholder={proveedorId ? "Buscar factura…" : "Selecciona un proveedor primero"}
                vacio="No hay facturas abiertas para este proveedor."
                disabled={!proveedorId}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(evento) => setFecha(evento.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuenta">Cuenta caja/banco *</Label>
              <Select
                items={opcionesCuentas}
                value={cuentaId || null}
                onValueChange={(valor: string | null) => setCuentaId(valor ?? "")}
              >
                <SelectTrigger id="cuenta" className="w-full">
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {opcionesCuentas.map((cuenta) => (
                    <SelectItem key={cuenta.value} value={cuenta.value}>
                      {cuenta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="metodo">Método *</Label>
              <Select
                items={[...OPCIONES_METODO]}
                value={metodo}
                onValueChange={(valor: string | null) => cambiarMetodo(valor ?? "")}
              >
                <SelectTrigger id="metodo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCIONES_METODO.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="monto">Monto *</Label>
                {saldoSeleccionado != null ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    Saldo: {formatoMoneda(saldoSeleccionado)}
                  </span>
                ) : null}
              </div>
              <Input
                id="monto"
                inputMode="decimal"
                value={monto}
                placeholder="0.00"
                onChange={(evento) => setMonto(evento.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium [&[data-panel-open]>svg]:rotate-180">
                  Más opciones
                  <ChevronDown className="size-4 transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-2">
                    <RetencionesCampo
                      retenciones={retenciones}
                      base={base}
                      seleccionadas={retencionesIds}
                      onCambiar={cambiarRetenciones}
                      deshabilitado={!facturaSeleccionada}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {facturaSeleccionada ? (
              <p className="text-muted-foreground text-xs sm:col-span-2">
                Total aplicado: {formatoMoneda(aNumero(monto) + retenido)} (monto + retenciones)
              </p>
            ) : null}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {exito ? (
            <Alert>
              <AlertDescription>Pago registrado.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Registrando…" : "Registrar pago"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
