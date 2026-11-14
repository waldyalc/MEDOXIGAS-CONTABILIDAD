"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2 } from "lucide-react";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { RetencionesCampo } from "@/components/retenciones/retenciones-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RetencionOpcion } from "@/lib/configuracion/tipos";
import { centavosAValor, parsearCentavos, valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { ContactoResumen, CuentaCajaBanco } from "@/lib/facturacion/tipos";
import { registrarPago } from "@/lib/pagos/acciones";
import type { FacturaAbierta, MetodoPago } from "@/lib/pagos/tipos";
import { calcularRetenciones, totalRetenido } from "@/lib/retenciones/calculo";

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "cheque", label: "Cheque" },
] as const;

interface Props {
  contactos: ContactoResumen[];
  facturas: FacturaAbierta[];
  cuentas: CuentaCajaBanco[];
  retenciones: RetencionOpcion[];
  initialCliente: string;
  initialFactura: string;
  fechaHoy: string;
}

function saldoDisponible(factura: FacturaAbierta): number {
  return saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido);
}

export function PagoForm({
  contactos,
  facturas,
  cuentas,
  retenciones,
  initialCliente,
  initialFactura,
  fechaHoy,
}: Props) {
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
  const [monto, setMonto] = useState(facturaInicial ? saldoDisponible(facturaInicial).toFixed(2) : "");
  const [retencionesIds, setRetencionesIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const facturasDelCliente = facturas.filter((factura) => factura.contacto_id === clienteId);
  const facturaSeleccionada = facturasDelCliente.find((factura) => factura.id === facturaId);
  const saldo = facturaSeleccionada ? saldoDisponible(facturaSeleccionada) : 0;
  const base = facturaSeleccionada
    ? { subtotal: facturaSeleccionada.subtotal, itbis: facturaSeleccionada.itbis }
    : { subtotal: 0, itbis: 0 };
  const filasRetencion = calcularRetenciones(retencionesIds, retenciones, base);
  const retenido = totalRetenido(filasRetencion);

  const facturasItems = facturasDelCliente.map((factura) => ({
    value: factura.id,
    label: `#${factura.numero}${factura.ncf ? ` · ${factura.ncf}` : ""} · Saldo ${formatoMoneda(
      saldoDisponible(factura),
    )}`,
  }));

  const cuentasItems = cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));

  function textoPlaceholderFactura(cliente: string, cantidad: number) {
    if (!cliente) return "Primero selecciona un cliente";
    if (cantidad === 0) return "El cliente no tiene facturas abiertas";
    return "Selecciona una factura";
  }

  function ajustarMonto(factura: FacturaAbierta, ids: string[]) {
    const nuevoSaldo = saldoDisponible(factura);
    const nuevoRetenido = totalRetenido(
      calcularRetenciones(ids, retenciones, { subtotal: factura.subtotal, itbis: factura.itbis }),
    );
    const nuevoMonto = Math.max(0, Math.round((nuevoSaldo - nuevoRetenido) * 100) / 100);
    setMonto(nuevoMonto.toFixed(2));
  }

  function cambiarCliente(id: string) {
    setClienteId(id);
    setFacturaId("");
    setMonto("");
    setRetencionesIds([]);
  }

  function cambiarFactura(id: string) {
    setFacturaId(id);
    setRetencionesIds([]);
    const factura = facturasDelCliente.find((item) => item.id === id);
    setMonto(factura ? saldoDisponible(factura).toFixed(2) : "");
  }

  function cambiarRetenciones(ids: string[]) {
    setRetencionesIds(ids);
    if (facturaSeleccionada) ajustarMonto(facturaSeleccionada, ids);
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

    const totalCentavos = valorCentavos + Math.round(retenido * 100);
    if (totalCentavos > valorACentavos(saldo)) {
      setError("El monto más las retenciones no puede superar el saldo de la factura.");
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
        retenciones: retencionesIds.map((id) => ({ retencion_id: id })),
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
            <SelectorContacto
              id="cliente"
              contactos={contactos}
              valor={clienteId}
              onCambio={(contacto) => cambiarCliente(contacto?.id ?? "")}
              tipoInicial="cliente"
              placeholder="Buscar cliente…"
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="factura">Factura abierta *</Label>
            <Select
              items={facturasItems}
              value={facturaId || null}
              onValueChange={(valor: string | null) => cambiarFactura(valor ?? "")}
            >
              <SelectTrigger id="factura" className="w-full" disabled={!clienteId || facturasDelCliente.length === 0}>
                <SelectValue placeholder={textoPlaceholderFactura(clienteId, facturasDelCliente.length)} />
              </SelectTrigger>
              <SelectContent>
                {facturasItems.map((factura) => (
                  <SelectItem key={factura.value} value={factura.value}>
                    {factura.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select
              items={cuentasItems}
              value={cuentaId}
              onValueChange={(valor: string | null) => setCuentaId(valor ?? "")}
            >
              <SelectTrigger id="cuenta" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cuentasItems.map((cuenta) => (
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
              items={[...METODOS]}
              value={metodo}
              onValueChange={(valor: string | null) => {
                if (valor === "efectivo" || valor === "transferencia" || valor === "tarjeta" || valor === "cheque") {
                  setMetodo(valor);
                }
              }}
            >
              <SelectTrigger id="metodo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODOS.map((metodoPago) => (
                  <SelectItem key={metodoPago.value} value={metodoPago.value}>
                    {metodoPago.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
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
            <p className="text-muted-foreground text-xs md:col-span-2">
              Total aplicado: {formatoMoneda((parsearCentavos(monto) ?? 0) / 100 + retenido)} (monto + retenciones)
            </p>
          ) : null}
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
