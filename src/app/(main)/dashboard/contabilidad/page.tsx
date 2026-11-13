import { Fragment } from "react";

import Link from "next/link";

import { BookOpen, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaCuenta } from "@/lib/enlaces";
import { obtenerCatalogoContable } from "@/lib/reportes/consultas";
import { construirArbolCuentas, type NodoCuenta } from "@/lib/reportes/contabilidad";
import { formatearRd } from "@/lib/reportes/dinero";

import { NuevaCuenta } from "./_components/cuenta-formulario";

const CONFIGURACION_CONTABLE = [
  { clave: "caja", etiqueta: "Caja" },
  { clave: "banco", etiqueta: "Banco" },
  { clave: "cxc", etiqueta: "Cuentas por cobrar" },
  { clave: "inventario", etiqueta: "Inventario" },
  { clave: "itbis_adelantado", etiqueta: "ITBIS adelantado en compras" },
  { clave: "cxp", etiqueta: "Cuentas por pagar" },
  { clave: "itbis_por_pagar", etiqueta: "ITBIS por pagar" },
  { clave: "ventas", etiqueta: "Ventas de productos" },
  { clave: "ventas_servicios", etiqueta: "Ventas de servicios" },
  { clave: "costo_ventas", etiqueta: "Costo de ventas" },
  { clave: "gastos_generales", etiqueta: "Gastos generales" },
];

function FilasCuenta({ nodos, nivel }: { nodos: readonly NodoCuenta[]; nivel: number }) {
  const sangria = { paddingLeft: `${nivel * 20}px` };

  return (
    <>
      {nodos.map((nodo) => (
        <Fragment key={nodo.cuenta.id}>
          <TableRow>
            <TableCell className="text-muted-foreground tabular-nums">
              <Link
                href={rutaCuenta(nodo.cuenta.id)}
                prefetch={false}
                style={sangria}
                className="hover:text-foreground inline-block hover:underline"
              >
                {nodo.cuenta.codigo}
              </Link>
            </TableCell>
            <TableCell>
              <Link
                href={rutaCuenta(nodo.cuenta.id)}
                prefetch={false}
                style={sangria}
                className={`hover:text-foreground inline-block hover:underline ${
                  nodo.cuenta.acepta_movimientos ? "" : "font-medium"
                }`}
              >
                {nodo.cuenta.nombre}
              </Link>
            </TableCell>
            <TableCell className="capitalize">{nodo.cuenta.tipo}</TableCell>
            <TableCell className={`text-right tabular-nums ${nodo.saldo < 0 ? "text-destructive" : ""}`}>
              {formatearRd(nodo.saldo)}
            </TableCell>
          </TableRow>
          <FilasCuenta nodos={nodo.hijos} nivel={nivel + 1} />
        </Fragment>
      ))}
    </>
  );
}

export default async function Page() {
  const [{ cuentas, configuracion, saldos, error }, rol] = await Promise.all([obtenerCatalogoContable(), getRol()]);
  const arbol = construirArbolCuentas(cuentas, saldos);
  const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
  const configuracionPorClave = new Map(configuracion.map((fila) => [fila.clave, fila]));
  const puedeEditar = rol === "admin" || rol === "contador";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Contabilidad</h1>
          <p className="text-muted-foreground text-balance">
            Catálogo de cuentas y configuración contable del motor. Las cuentas las usa automáticamente cada documento.
          </p>
        </div>
        {puedeEditar ? <NuevaCuenta cuentas={cuentas} /> : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar la contabilidad</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          {arbol.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>Sin cuentas</EmptyTitle>
                <EmptyDescription>No hay cuentas contables registradas.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <FilasCuenta nodos={arbol} nivel={0} />
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración contable</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead>Clave</TableHead>
                <TableHead>Cuenta contable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONFIGURACION_CONTABLE.map((config) => {
                const fila = configuracionPorClave.get(config.clave);
                const cuenta = fila == null ? undefined : cuentasPorId.get(fila.cuenta_id);

                return (
                  <TableRow key={config.clave}>
                    <TableCell>{config.etiqueta}</TableCell>
                    <TableCell className="text-muted-foreground">{config.clave}</TableCell>
                    <TableCell>
                      {cuenta == null ? (
                        "—"
                      ) : (
                        <Link
                          href={rutaCuenta(cuenta.id)}
                          prefetch={false}
                          className="hover:text-foreground hover:underline"
                        >
                          <span className="text-muted-foreground">{cuenta.codigo}</span> {cuenta.nombre}
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
