import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAsientosLista, normalizarFecha } from "@/lib/asientos/consultas";
import { getPerfil } from "@/lib/auth/rol";
import { rutaAsiento, rutaOrigenAsiento } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

const ORIGENES: Record<string, string> = {
  factura: "Factura",
  pago_recibido: "Pago recibido",
  factura_proveedor: "Compra",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto",
  manual: "Manual",
  anulacion: "Anulación",
};

interface Props {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const desde = normalizarFecha(params.desde);
  const hasta = normalizarFecha(params.hasta);
  const asientos = await getAsientosLista(desde, hasta);
  const puedeEscribir = perfil.rol !== "lector";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Asientos contables</h1>
          <p className="text-muted-foreground text-sm">Movimientos del libro diario, con o sin documento de origen.</p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/contabilidad/asientos/nuevo" />}>
            <Plus />
            Nuevo asiento
          </Button>
        ) : null}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-40" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {desde || hasta ? (
          <Button type="button" variant="ghost" render={<Link href="/dashboard/contabilidad/asientos" />}>
            Limpiar
          </Button>
        ) : null}
      </form>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asientos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  No hay asientos en el período seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              asientos.map((asiento) => {
                const hrefOrigen = rutaOrigenAsiento(asiento.origen_tipo, asiento.origen_id, asiento.id);
                const etiquetaOrigen = ORIGENES[asiento.origen_tipo] ?? asiento.origen_tipo;

                return (
                  <TableRow key={asiento.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={rutaAsiento(asiento.id)} prefetch={false}>
                        #{asiento.numero}
                      </Link>
                    </TableCell>
                    <TableCell>{formatoDia(asiento.fecha)}</TableCell>
                    <TableCell className="whitespace-normal">{asiento.descripcion}</TableCell>
                    <TableCell>
                      {hrefOrigen ? <Enlace href={hrefOrigen}>{etiquetaOrigen}</Enlace> : etiquetaOrigen}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatoMoneda(asiento.total)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
