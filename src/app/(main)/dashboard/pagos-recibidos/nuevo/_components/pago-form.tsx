"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { centavosAValor, parsearCentavos, valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { ContactoResumen, CuentaCajaBanco } from "@/lib/facturacion/tipos";
import { registrarPago } from "@/lib/pagos/acciones";
import type { FacturaAbierta, MetodoPago } from "@/lib/pagos/tipos";

interface Props {
  contactos: ContactoResumen[];
  facturas: FacturaAbierta[];
  cuentas: CuentaCajaBanco[];
  initialCliente: string;
  initialFactura: string;
  fechaHoy: string;
}

export function PagoForm({ contactos, facturas, cuentas, initialCliente, initialFactura, fechaHoy }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const facturaInicial = facturas.find((factura) => factura.id === initialFactura);

  const [clienteId, setClienteId] = useState(initialCliente);
  const [facturaId, setFacturaId] = useState(facturaInicial?.id ?? "");
  const [fecha, setFecha] = useState(fechaHoy);
  const [cuentaId, setCuentaId] = useState(
    cuentas.find((cuenta) => cuenta.codigo === "1101")?.id ?? cuentas[0]?.id ?? "",
  );
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState(
    facturaInicial ? saldoDeFactura(facturaInicial.total, facturaInicial.pagado).toFixed(2) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const clientesItems = contactos.map((contacto) => ({ value: contacto.id, label: contacto.nombre }));
  const facturasDelCliente = facturas.filter((factura) => factura.contacto_id === clienteId);
  const facturaSeleccionada = facturasDelCliente.find((factura) => factura.id === facturaId);
  const saldo = facturaSeleccionada ? saldoDeFactura(facturaSeleccionada.total, facturaSeleccionada.pagado) : 0;

  function textoPlaceholderFactura(cliente: string, cantidad: number) {
    if (!cliente) return "Primero selecciona un cliente";
    if (cantidad === 0) return "El cliente no tiene facturas abiertas";
    return "Selecciona una factura";
  }

  function cambiarCliente(id: string) {
    setClienteId(id);
    setFacturaId("");
    setMonto("");
  }

  function cambiarFactura(id: string) {
    setFacturaId(id);
    const factura = facturasDelCliente.find((item) => item.id === id);
    setMonto(factura ? saldoDeFactura(factura.total, factura.pagado).toFixed(2) : "");
  }

  function guardar() {
    setError(null);

    if (!clienteId) {
      setError("Selecciona un cliente.");
      return;
    }
    if (!facturaSeleccionada) {
      setError("Selecciona una factura abierta del cliente.");
      return;
    }
    if (!cuentaId) {
      setError("Selecciona la cuenta de caja o banco.");
      return;
    }

    const valorCentavos = parsearCentavos(monto);
    if (valorCentavos == null || valorCentavos <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }
    if (valorCentavos > valorACentavos(saldo)) {
      setError("El monto no puede superar el saldo de la factura.");
      return;
    }

    iniciar(async () => {
      const resultado = await registrarPago({
        factura_id: facturaSeleccionada.id,
        contacto_id: clienteId,
        fecha,
        cuenta_id: cuentaId,
        metodo,
        monto: centavosAValor(valorCentavos),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push("/dashboard/pagos-recibidos");
    });
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos del pago</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="cliente">Cliente *</Label>
            <Combobox
              items={clientesItems}
              onValueChange={(item: { value: string; label: string } | null) => cambiarCliente(item?.value ?? "")}
            >
              <ComboboxInput id="cliente" className="w-full" placeholder="Buscar cliente…" showClear />
              <ComboboxContent>
                <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                <ComboboxList>
                  {(item: { value: string; label: string }) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="factura">Factura abierta *</Label>
            <NativeSelect
              id="factura"
              className="w-full"
              value={facturaId}
              disabled={!clienteId || facturasDelCliente.length === 0}
              onChange={(evento) => cambiarFactura(evento.target.value)}
            >
              <NativeSelectOption value="">
                {textoPlaceholderFactura(clienteId, facturasDelCliente.length)}
              </NativeSelectOption>
              {facturasDelCliente.map((factura) => (
                <NativeSelectOption key={factura.id} value={factura.id}>
                  #{factura.numero}
                  {factura.ncf ? ` · ${factura.ncf}` : ""} · Saldo{" "}
                  {formatoMoneda(saldoDeFactura(factura.total, factura.pagado))}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {facturaSeleccionada ? (
              <p className="text-muted-foreground text-xs">Saldo disponible: {formatoMoneda(saldo)}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" required value={fecha} onChange={(evento) => setFecha(evento.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="monto">Monto *</Label>
            <Input
              id="monto"
              inputMode="decimal"
              required
              value={monto}
              onChange={(evento) => setMonto(evento.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cuenta">Cuenta *</Label>
            <NativeSelect
              id="cuenta"
              className="w-full"
              value={cuentaId}
              onChange={(evento) => setCuentaId(evento.target.value)}
            >
              {cuentas.map((cuenta) => (
                <NativeSelectOption key={cuenta.id} value={cuenta.id}>
                  {cuenta.codigo} · {cuenta.nombre}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="metodo">Método *</Label>
            <NativeSelect
              id="metodo"
              className="w-full"
              value={metodo}
              onChange={(evento) => setMetodo(evento.target.value as MetodoPago)}
            >
              <NativeSelectOption value="efectivo">Efectivo</NativeSelectOption>
              <NativeSelectOption value="transferencia">Transferencia</NativeSelectOption>
              <NativeSelectOption value="tarjeta">Tarjeta</NativeSelectOption>
              <NativeSelectOption value="cheque">Cheque</NativeSelectOption>
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href="/dashboard/pagos-recibidos" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || facturasDelCliente.length === 0}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Registrar pago
        </Button>
      </div>
    </form>
  );
}
