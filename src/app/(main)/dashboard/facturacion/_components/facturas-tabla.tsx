import Link from "next/link";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import type { FacturaFila } from "@/lib/facturacion/consultas";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { EstadoFactura } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

const ETIQUETAS: Record<EstadoFactura, string> = {
  abierta: "Abierta",
  pagada: "Pagada",
  anulada: "Anulada",
};

function EstadoBadge({ estado }: { estado: EstadoFactura }) {
  if (estado === "anulada") return <Badge variant="destructive">{ETIQUETAS[estado]}</Badge>;
  if (estado === "pagada")
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {ETIQUETAS[estado]}
      </Badge>
    );
  return <Badge>{ETIQUETAS[estado]}</Badge>;
}

export function FacturasTabla({ facturas, puedeEscribir }: { facturas: FacturaFila[]; puedeEscribir: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Facturación</h1>
          <p className="text-muted-foreground text-sm">Facturas de venta con comprobante fiscal (NCF).</p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/facturacion/nueva" />}>
            <Plus />
            Nueva factura
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Por cobrar</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facturas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                  No hay facturas todavía.
                </TableCell>
              </TableRow>
            ) : (
              facturas.map((factura) => (
                <TableRow key={factura.id}>
                  <TableCell className="font-medium">
                    <Enlace href={rutaFactura(factura.id)}>{factura.numero}</Enlace>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{factura.ncf ?? "—"}</TableCell>
                  <TableCell>
                    <Enlace href={rutaContacto(factura.contacto_id)}>{factura.cliente_nombre}</Enlace>
                  </TableCell>
                  <TableCell>{formatoDia(factura.fecha)}</TableCell>
                  <TableCell>{formatoDia(factura.vencimiento)}</TableCell>
                  <TableCell className="text-right font-medium">{formatoMoneda(factura.total)}</TableCell>
                  <TableCell className="text-right">
                    {factura.estado === "anulada" ? "—" : formatoMoneda(saldoDeFactura(factura.total, factura.pagado))}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge estado={factura.estado} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
