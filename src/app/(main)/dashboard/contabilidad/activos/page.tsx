import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActivosLista } from "@/lib/activos-fijos/consultas";
import { ETIQUETAS_TIPO_ACTIVO, type TipoActivo } from "@/lib/activos-fijos/tipos";
import { getPerfil } from "@/lib/auth/rol";
import { formatoDia } from "@/lib/formato";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const activos = await getActivosLista();
  const puedeEscribir = perfil.rol !== "lector";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Activos fijos</h1>
          <p className="text-muted-foreground text-sm">
            Bienes de la empresa, su valor actual y la depreciación mes a mes.
          </p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/contabilidad/activos/nuevo" />}>
            <Plus />
            Nuevo activo
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activo</TableHead>
              <TableHead>Adquisición</TableHead>
              <TableHead className="text-right">Monto total</TableHead>
              <TableHead className="text-right">Depreciado</TableHead>
              <TableHead className="text-right">Valor actual</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Truck />
                      </EmptyMedia>
                      <EmptyTitle>Sin activos fijos</EmptyTitle>
                      <EmptyDescription>
                        Registra un vehículo, equipo o inmueble para empezar a depreciarlo.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              activos.map((activo) => {
                const montoCentavos = centavos(activo.monto_total);
                const residualCentavos = centavos(activo.valor_residual);
                const depreciadoCentavos = centavos(activo.depreciado);
                const valorActualCentavos = montoCentavos - depreciadoCentavos;
                const totalizado = depreciadoCentavos >= montoCentavos - residualCentavos;
                const tipo = ETIQUETAS_TIPO_ACTIVO[activo.tipo_activo as TipoActivo] ?? activo.tipo_activo;

                return (
                  <TableRow key={activo.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/dashboard/contabilidad/activos/${activo.id}`}>
                        {activo.nombre}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        {tipo}
                        {activo.referencia ? ` · ${activo.referencia}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>{formatoDia(activo.fecha_adquisicion)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(montoCentavos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(depreciadoCentavos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(valorActualCentavos)}</TableCell>
                    <TableCell>
                      {totalizado ? (
                        <Badge variant="secondary">Totalmente depreciado</Badge>
                      ) : (
                        <Badge variant="outline">En curso</Badge>
                      )}
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
