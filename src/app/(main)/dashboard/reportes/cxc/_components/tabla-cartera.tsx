import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaCompra, rutaContacto, rutaFactura } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import type { FilaCartera } from "@/lib/reportes/administrativos/d/tipos";
import { formatearRd } from "@/lib/reportes/dinero";

function Referencia({ fila, href }: { fila: FilaCartera; href: string }) {
  return (
    <Link href={href} prefetch={false} className="text-primary font-medium hover:underline">
      {fila.ncf ?? `#${fila.numero}`}
    </Link>
  );
}

function Contacto({ fila }: { fila: FilaCartera }) {
  return (
    <Link href={rutaContacto(fila.contactoId)} prefetch={false} className="hover:underline">
      {fila.contactoNombre}
    </Link>
  );
}

export function TablaCuentasPorCobrar({ filas, mensajeVacio }: { filas: FilaCartera[]; mensajeVacio: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>NCF/Número</TableHead>
          <TableHead>Tipo de documento</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Creación</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Cobrado</TableHead>
          <TableHead className="text-right">Por cobrar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-muted-foreground h-32 text-center whitespace-normal">
              {mensajeVacio}
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => (
            <TableRow key={fila.id}>
              <TableCell>
                <Referencia fila={fila} href={rutaFactura(fila.id)} />
              </TableCell>
              <TableCell>{fila.tipoDocumento}</TableCell>
              <TableCell>
                <Contacto fila={fila} />
              </TableCell>
              <TableCell>{formatoDia(fila.creado)}</TableCell>
              <TableCell>{formatoDia(fila.vencimiento)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.total)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.pagado)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.saldo)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function TablaCuentasPorPagar({ filas, mensajeVacio }: { filas: FilaCartera[]; mensajeVacio: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo de documento</TableHead>
          <TableHead>NCF/Número</TableHead>
          <TableHead>Proveedor</TableHead>
          <TableHead>Creación</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Pagado</TableHead>
          <TableHead className="text-right">Por pagar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-muted-foreground h-32 text-center whitespace-normal">
              {mensajeVacio}
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => (
            <TableRow key={fila.id}>
              <TableCell>{fila.tipoDocumento}</TableCell>
              <TableCell>
                <Referencia fila={fila} href={rutaCompra(fila.id)} />
              </TableCell>
              <TableCell>
                <Contacto fila={fila} />
              </TableCell>
              <TableCell>{formatoDia(fila.creado)}</TableCell>
              <TableCell>{formatoDia(fila.vencimiento)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.total)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.pagado)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.saldo)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
