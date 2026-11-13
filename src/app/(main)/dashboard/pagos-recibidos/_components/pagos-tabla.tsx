import Link from "next/link";

import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura, rutaPagoRecibido } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { PagoLista } from "@/lib/pagos/tipos";

const METODOS: Record<PagoLista["metodo"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

export function PagosTabla({ pagos, puedeEscribir }: { pagos: PagoLista[]; puedeEscribir: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Pagos recibidos</h1>
          <p className="text-muted-foreground text-sm">Cobros aplicados a facturas de venta.</p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/pagos-recibidos/nuevo" />}>
            <Plus />
            Nuevo pago
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                  No hay pagos registrados todavía.
                </TableCell>
              </TableRow>
            ) : (
              pagos.map((pago) => (
                <TableRow key={pago.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={rutaPagoRecibido(pago.id)}>
                      {pago.numero}
                    </Link>
                  </TableCell>
                  <TableCell>{formatoDia(pago.fecha)}</TableCell>
                  <TableCell>
                    <Link className="hover:underline" href={rutaContacto(pago.contacto_id)}>
                      {pago.cliente_nombre}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {pago.factura_id ? (
                      <Link className="hover:underline" href={rutaFactura(pago.factura_id)}>
                        #{pago.factura_numero} {pago.factura_ncf ? `· ${pago.factura_ncf}` : ""}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{METODOS[pago.metodo]}</TableCell>
                  <TableCell className="text-right font-medium">{formatoMoneda(pago.monto)}</TableCell>
                  <TableCell>
                    {pago.estado === "anulado" ? (
                      <Badge variant="destructive">Anulado</Badge>
                    ) : (
                      <Badge variant="secondary">Activo</Badge>
                    )}
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
