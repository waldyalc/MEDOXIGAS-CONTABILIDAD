import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAsientosLista, normalizarFecha } from "@/lib/asientos/consultas";
import { getPerfil } from "@/lib/auth/rol";
import { rutaAsiento, rutaOrigenAsiento } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

const RUTA = "/dashboard/contabilidad/asientos";

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
  searchParams: Promise<ParametrosLista>;
}

async function TablaAsientos({
  opciones,
  params,
  desde,
  hasta,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
  readonly desde?: string;
  readonly hasta?: string;
}) {
  const { filas: asientos, resumen } = await getAsientosLista(opciones, desde, hasta);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 pl-(--card-spacing)">Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                    {opciones.q
                      ? "No se encontraron asientos con esa búsqueda."
                      : "No hay asientos en el período seleccionado."}
                  </TableCell>
                </TableRow>
              ) : (
                asientos.map((asiento) => {
                  const hrefOrigen = rutaOrigenAsiento(asiento.origen_tipo, asiento.origen_id, asiento.id);
                  const etiquetaOrigen = ORIGENES[asiento.origen_tipo] ?? asiento.origen_tipo;

                  return (
                    <TableRow key={asiento.id}>
                      <TableCell className="pl-(--card-spacing) font-medium">
                        <Link className="hover:underline" href={rutaAsiento(asiento.id)} prefetch={false}>
                          #{asiento.numero}
                        </Link>
                      </TableCell>
                      <TableCell>{formatoDia(asiento.fecha)}</TableCell>
                      <TableCell className="whitespace-normal">{asiento.descripcion}</TableCell>
                      <TableCell>
                        {hrefOrigen ? <Enlace href={hrefOrigen}>{etiquetaOrigen}</Enlace> : etiquetaOrigen}
                      </TableCell>
                      <TableCell className="pr-(--card-spacing) text-right font-medium tabular-nums">
                        {formatoMoneda(asiento.total)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginadorLista base={RUTA} params={params} resumen={resumen} />
    </div>
  );
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const desde = normalizarFecha(typeof params.desde === "string" ? params.desde : undefined);
  const hasta = normalizarFecha(typeof params.hasta === "string" ? params.hasta : undefined);
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
        {opciones.q ? <input type="hidden" name="q" value={opciones.q} /> : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {desde || hasta || opciones.q ? (
          <Button type="button" variant="ghost" render={<Link href={RUTA} />}>
            Limpiar
          </Button>
        ) : null}
      </form>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número o descripción…"
        ariaLabel="Buscar asientos"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={5} />}>
        <TablaAsientos opciones={opciones} params={params} desde={desde} hasta={hasta} />
      </Suspense>
    </div>
  );
}
