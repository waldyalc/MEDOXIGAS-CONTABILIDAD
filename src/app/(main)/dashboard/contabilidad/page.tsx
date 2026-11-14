import { BookOpen, TriangleAlert } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { CONFIGURACION_CONTABLE } from "@/lib/contabilidad/catalogo";
import { rutaCuenta } from "@/lib/enlaces";
import { obtenerCatalogoContable } from "@/lib/reportes/consultas";

import { CatalogoCuentas } from "./_components/catalogo-cuentas";
import { NuevaCuenta } from "./_components/cuenta-formulario";

export default async function Page() {
  const [{ cuentas, configuracion, saldos, error }, rol] = await Promise.all([obtenerCatalogoContable(), getRol()]);
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

      {cuentas.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>Sin cuentas</EmptyTitle>
                <EmptyDescription>No hay cuentas contables registradas.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <CatalogoCuentas cuentas={cuentas} saldos={saldos} configuracion={configuracion} puedeEditar={puedeEditar} />
      )}

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
                        <Enlace href={rutaCuenta(cuenta.id)}>
                          <span className="text-muted-foreground">{cuenta.codigo}</span> {cuenta.nombre}
                        </Enlace>
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
