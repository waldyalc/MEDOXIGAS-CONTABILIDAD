"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, FilePlus2, Loader2, Printer, ReceiptText } from "lucide-react";
import { createPortal } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { convertirRemisionAFactura } from "@/lib/conduces/acciones";
import { convertirCotizacionAFactura } from "@/lib/cotizaciones/acciones";
import type { DocumentoVista, EstadoDocumento, TipoDocumento } from "@/lib/cotizaciones/tipos";
import { rutaFactura } from "@/lib/enlaces";

import { DocumentoPapel } from "./documento-papel";

const TEXTOS: Record<
  TipoDocumento,
  { singular: string; rutaBase: string; aviso: string; convertirTitulo: string; convertirTexto: string }
> = {
  cotizacion: {
    singular: "Cotización",
    rutaBase: "/dashboard/cotizaciones",
    aviso: "Esta cotización no genera asiento contable. La venta se registra cuando se convierte a factura.",
    convertirTitulo: "Convertir cotización a factura",
    convertirTexto: "Se creará una factura con el mismo cliente, fechas y líneas. Esta acción no se puede deshacer.",
  },
  remision: {
    singular: "Conduce",
    rutaBase: "/dashboard/conduces",
    aviso:
      "Este conduce no mueve existencias ni genera asiento contable. La venta se registra cuando se convierte a factura.",
    convertirTitulo: "Convertir conduce a factura",
    convertirTexto: "Se creará una factura con el mismo cliente, fechas y líneas. Esta acción no se puede deshacer.",
  },
};

const ESTADOS: Record<EstadoDocumento, string> = {
  abierta: "Abierta",
  convertida: "Convertida",
  anulada: "Anulada",
};

function EstadoBadge({ estado }: { estado: EstadoDocumento }) {
  if (estado === "anulada") return <Badge variant="destructive">{ESTADOS[estado]}</Badge>;
  if (estado === "convertida")
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {ESTADOS[estado]}
      </Badge>
    );
  return <Badge>{ESTADOS[estado]}</Badge>;
}

interface Props {
  tipo: TipoDocumento;
  vista: DocumentoVista;
  puedeEscribir: boolean;
}

export function VistaDocumento({ tipo, vista, puedeEscribir }: Props) {
  const router = useRouter();
  const textos = TEXTOS[tipo];
  const { documento } = vista;

  const [montado, setMontado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState("02");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    setMontado(true);
  }, []);

  const puedeConvertir = puedeEscribir && documento.estado === "abierta";

  function cambiarAbierto(valor: boolean) {
    setAbierto(valor);
    if (!valor) setError(null);
  }

  function convertir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    iniciar(async () => {
      const resultado =
        tipo === "cotizacion"
          ? await convertirCotizacionAFactura(documento.id, tipoComprobante)
          : await convertirRemisionAFactura(documento.id, tipoComprobante);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/facturacion/${resultado.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon-sm" render={<Link href={textos.rutaBase} />}>
            <ArrowLeft />
            <span className="sr-only">Volver</span>
          </Button>
          <h1 className="text-2xl tracking-tight">
            {textos.singular} #{documento.numero}
          </h1>
          <EstadoBadge estado={documento.estado} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Imprimir
          </Button>
          {documento.estado === "convertida" && documento.factura_id ? (
            <Button variant="outline" render={<Link href={rutaFactura(documento.factura_id)} />}>
              <ReceiptText />
              Ver factura{vista.facturaNumero ? ` #${vista.facturaNumero}` : ""}
            </Button>
          ) : null}
          {puedeConvertir ? (
            <Dialog open={abierto} onOpenChange={cambiarAbierto}>
              <DialogTrigger render={<Button disabled={pendiente} />}>
                <FilePlus2 />
                Convertir a factura
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{textos.convertirTitulo}</DialogTitle>
                  <DialogDescription>{textos.convertirTexto}</DialogDescription>
                </DialogHeader>
                <form onSubmit={convertir} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="tipo-comprobante">Tipo de comprobante</Label>
                    <NativeSelect
                      id="tipo-comprobante"
                      className="w-full"
                      value={tipoComprobante}
                      disabled={pendiente}
                      onChange={(evento) => setTipoComprobante(evento.target.value)}
                    >
                      <NativeSelectOption value="02">02 Consumo</NativeSelectOption>
                      <NativeSelectOption value="01">01 Crédito fiscal</NativeSelectOption>
                    </NativeSelect>
                    <p className="text-muted-foreground text-xs">El NCF se asigna al crear la factura.</p>
                  </div>
                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" disabled={pendiente} />}>
                      Cancelar
                    </DialogClose>
                    <Button type="submit" disabled={pendiente}>
                      {pendiente ? <Loader2 className="animate-spin" /> : null}
                      Convertir a factura
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <Alert className="print:hidden">
        <AlertDescription>{textos.aviso}</AlertDescription>
      </Alert>

      <div className="ring-foreground/10 mx-auto w-full max-w-[8.5in] overflow-hidden rounded-xl bg-white shadow-sm ring-1">
        <DocumentoPapel tipo={tipo} vista={vista} enlaces />
      </div>

      {montado
        ? createPortal(
            <div data-print-root>
              <div data-print-paper>
                <DocumentoPapel tipo={tipo} vista={vista} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
