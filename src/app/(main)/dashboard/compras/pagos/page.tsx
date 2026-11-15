import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft, Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { listarPagosProveedor } from "@/lib/compras/consultas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { MetodoPago, PagoLista } from "@/lib/compras/tipos";
import { rutaCompra, rutaContacto, rutaCuenta, rutaPagoProveedor } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

const RUTA = "/dashboard/compras/pagos";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

function CeldaProveedor({ pago }: { pago: PagoLista }) {
  if (!pago.contactos) return "—";

  return <Enlace href={rutaContacto(pago.contacto_id)}>{pago.contactos.nombre}</Enlace>;
}

function CeldaCuenta({ pago }: { pago: PagoLista }) {
  if (!pago.cuentas) return "—";

  return <Enlace href={rutaCuenta(pago.cuenta_id)}>{pago.cuentas.nombre}</Enlace>;
}

function CeldaFacturaProveedor({ pago }: { pago: PagoLista }) {
  if (pago.aplicaciones > 1) {
    return <span>Varias facturas ({pago.aplicaciones})</span>;
  }

  if (pago.facturas_proveedor) {
    return (
      <Enlace href={rutaCompra(pago.facturas_proveedor.id)}>
        #{pago.facturas_proveedor.numero}
        {pago.facturas_proveedor.ncf ? ` · ${pago.facturas_proveedor.ncf}` : ""}
      </Enlace>
    );
  }

  return "—";
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const [rol, params] = await Promise.all([getRol(), searchParams]);
  if (rol == null) redirect("/unauthorized");

  const opciones = leerOpcionesLista(params);
  const { filas: pagos, resumen } = await listarPagosProveedor(opciones);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pagos a proveedores</h1>
          <p className="text-muted-foreground text-sm">
            Registra pagos contra facturas abiertas y consulta el historial.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            <ArrowLeft data-icon="inline-start" />
            Compras
          </Button>
          {rol !== "lector" ? (
            <Button render={<Link href="/dashboard/compras/pagos/nuevo" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nuevo pago
            </Button>
          ) : null}
        </div>
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número, proveedor o factura…"
        ariaLabel="Buscar pagos a proveedores"
      />

      <div className="flex flex-col gap-3">
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Número</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="pr-(--card-spacing)">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                      {opciones.q ? "No se encontraron pagos con esa búsqueda." : "No hay pagos registrados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagos.map((pago) => (
                    <TableRow key={pago.id}>
                      <TableCell className="pl-(--card-spacing) font-medium">
                        <Enlace href={rutaPagoProveedor(pago.id)}>#{pago.numero}</Enlace>
                      </TableCell>
                      <TableCell>
                        <CeldaProveedor pago={pago} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <CeldaFacturaProveedor pago={pago} />
                      </TableCell>
                      <TableCell>{formatoDia(pago.fecha)}</TableCell>
                      <TableCell>{ETIQUETAS_METODO[pago.metodo]}</TableCell>
                      <TableCell>
                        <CeldaCuenta pago={pago} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(aNumero(pago.monto))}</TableCell>
                      <TableCell className="pr-(--card-spacing)">
                        <Badge variant={pago.estado === "anulado" ? "destructive" : "default"}>
                          {pago.estado === "anulado" ? "Anulado" : "Activo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <PaginadorLista base={RUTA} params={params} resumen={resumen} />
      </div>
    </div>
  );
}
