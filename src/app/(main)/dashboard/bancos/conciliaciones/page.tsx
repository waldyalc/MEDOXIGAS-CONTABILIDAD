import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft, Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { getListaConciliaciones } from "@/lib/bancos/conciliaciones";
import { rutaAsiento, rutaBanco, rutaConciliacion } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const conciliaciones = await getListaConciliaciones();
  const puedeEscribir = rol !== "lector";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/bancos" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Bancos
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl tracking-tight">Conciliaciones</h1>
            <p className="text-muted-foreground text-sm">
              Compara los movimientos del sistema con el extracto del banco.
            </p>
          </div>
          {puedeEscribir ? (
            <Button render={<Link href="/dashboard/bancos/conciliaciones/nueva" prefetch={false} />}>
              <Plus />
              Nueva conciliación
            </Button>
          ) : null}
        </div>
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Saldo del extracto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Asiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conciliaciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  Todavía no hay conciliaciones.
                </TableCell>
              </TableRow>
            ) : (
              conciliaciones.map((conciliacion) => (
                <TableRow key={conciliacion.id}>
                  <TableCell className="font-medium">
                    <Enlace href={rutaConciliacion(conciliacion.id)}>{conciliacion.cuentaNombre}</Enlace>
                    <Enlace
                      href={rutaBanco(conciliacion.cuentaId)}
                      className="text-muted-foreground ml-2 text-xs no-underline hover:underline"
                    >
                      Ver cuenta
                    </Enlace>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatoDia(conciliacion.fechaDesde)} — {formatoDia(conciliacion.fechaHasta)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {conciliacion.saldoCentavos === null ? "—" : formatearRd(conciliacion.saldoCentavos)}
                  </TableCell>
                  <TableCell>
                    {conciliacion.estado === "conciliada" ? (
                      <Badge variant="secondary">Conciliada</Badge>
                    ) : (
                      <Badge variant="outline">Borrador</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {conciliacion.asientoId ? (
                      <Enlace href={rutaAsiento(conciliacion.asientoId)}>Ver asiento</Enlace>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
