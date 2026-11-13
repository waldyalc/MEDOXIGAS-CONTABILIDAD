"use client";

import { type FormEvent, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { registrarPagoProveedor } from "@/lib/compras/acciones";
import { aNumero } from "@/lib/compras/calculo";
import { METODOS_PAGO } from "@/lib/compras/esquema";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { elegirCuentaPagoPorDefecto, facturasAbiertasDeProveedor, saldoFactura } from "@/lib/compras/seleccion";
import type { MetodoPago, OpcionesPago } from "@/lib/compras/tipos";

import { ComboboxCampo, type OpcionCombobox } from "./combobox-campo";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

export function FormularioPago({ contactos, cuentasCajaBanco, facturasAbiertas }: OpcionesPago) {
  const [proveedorId, setProveedorId] = useState("");
  const [facturaId, setFacturaId] = useState("");
  const [fecha, setFecha] = useState(hoyEnRd);
  const [cuentaId, setCuentaId] = useState(() => elegirCuentaPagoPorDefecto(cuentasCajaBanco));
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const opcionesContactos: OpcionCombobox[] = contactos.map((contacto) => ({
    value: contacto.id,
    label: contacto.nombre,
    hint: contacto.rnc_cedula ?? undefined,
  }));

  const opcionesFacturas: OpcionCombobox[] = facturasAbiertasDeProveedor(facturasAbiertas, proveedorId).map(
    (factura) => ({
      value: factura.id,
      label: `#${factura.numero} — ${factura.ncf ?? "—"} — ${formatoMoneda(saldoFactura(factura))}`,
    }),
  );

  const facturaSeleccionada = facturasAbiertas.find((factura) => factura.id === facturaId) ?? null;
  const saldoSeleccionado = facturaSeleccionada ? saldoFactura(facturaSeleccionada) : null;

  function cambiarProveedor(valor: string) {
    setProveedorId(valor);
    setFacturaId("");
    setMonto("");
    setError(null);
    setExito(false);
  }

  function cambiarFactura(valor: string) {
    const factura = facturasAbiertas.find((item) => item.id === valor);
    setFacturaId(valor);
    setMonto(factura ? saldoFactura(factura).toFixed(2) : "");
    setError(null);
    setExito(false);
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

    iniciar(async () => {
      const resultado = await registrarPagoProveedor({
        factura_proveedor_id: facturaId,
        fecha,
        cuenta_id: cuentaId,
        metodo,
        monto: aNumero(monto),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setExito(true);
      setFacturaId("");
      setMonto("");
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
              <ComboboxCampo
                id="proveedor"
                opciones={opcionesContactos}
                valor={proveedorId}
                onCambio={cambiarProveedor}
                placeholder="Buscar proveedor…"
                vacio="No hay proveedores registrados."
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
              <NativeSelect
                id="cuenta"
                value={cuentaId}
                onChange={(evento) => setCuentaId(evento.target.value)}
                className="w-full"
              >
                <option value="">Selecciona…</option>
                {cuentasCajaBanco.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.codigo} {cuenta.nombre}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="metodo">Método *</Label>
              <NativeSelect
                id="metodo"
                value={metodo}
                onChange={(evento) => cambiarMetodo(evento.target.value)}
                className="w-full"
              >
                {METODOS_PAGO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETAS_METODO[opcion]}
                  </option>
                ))}
              </NativeSelect>
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
