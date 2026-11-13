import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getRol } from "@/lib/auth/rol";
import {
  calcularEstadoCuenta,
  OPCIONES_ANTIGUEDAD,
  type ParametrosEstadoCuenta,
  parsearFiltrosEstadoCuenta,
  tablaEstadoCuenta,
} from "@/lib/contactos/estado-cuenta";
import { obtenerEstadoCuentaContacto } from "@/lib/contactos/estado-cuenta-consultas";
import { rutaContacto } from "@/lib/enlaces";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

import { BotonDescargar } from "../../../reportes/_components/boton-descargar";
import { BotonImprimir } from "./_components/boton-imprimir";
import { EstadoCuentaImpresion } from "./_components/estado-cuenta-impresion";
import { TablaEstadoCuenta } from "./_components/tabla-estado-cuenta";

function TarjetaTotal({ titulo, centavos }: { readonly titulo: string; readonly centavos: number }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{titulo}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatoMonedaCentavos(centavos)}</p>
      </CardContent>
    </Card>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosEstadoCuenta>;
}) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const { id } = await params;
  const datos = await obtenerEstadoCuentaContacto(id);
  if (!datos) notFound();

  const filtros = parsearFiltrosEstadoCuenta(await searchParams);
  const resumen = calcularEstadoCuenta(datos.facturas, datos.pagos, filtros.corte, filtros.antiguedad);
  const tabla = tablaEstadoCuenta(datos.contacto.nombre, filtros, resumen);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit print:hidden"
          render={<Link href={rutaContacto(datos.contacto.id)} prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          {datos.contacto.nombre}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Estado de cuenta</h1>
            <p className="text-muted-foreground text-sm">
              {datos.contacto.nombre} · Corte al {formatoDia(filtros.corte)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <BotonDescargar tabla={tabla} nombreArchivo={`estado-cuenta-${filtros.corte}`} />
            <BotonImprimir />
          </div>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="corte">Fecha de corte</Label>
          <Input id="corte" name="corte" type="date" defaultValue={filtros.corte} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="antiguedad">Antigüedad</Label>
          <NativeSelect id="antiguedad" name="antiguedad" defaultValue={filtros.antiguedad} className="w-44">
            {OPCIONES_ANTIGUEDAD.map((opcion) => (
              <NativeSelectOption key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          Aplicar
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3 print:hidden">
        <TarjetaTotal titulo="Total en ventas" centavos={resumen.totales.ventas} />
        <TarjetaTotal titulo="Total cobrado" centavos={resumen.totales.cobrado} />
        <TarjetaTotal titulo="Saldo por cobrar" centavos={resumen.totales.porCobrar} />
      </div>

      <p className="text-muted-foreground -mt-3 text-sm print:hidden">
        El cobrado incluye los pagos activos con fecha hasta la fecha de corte.
      </p>

      <Card className="py-0 print:hidden">
        <CardContent className="p-0">
          <TablaEstadoCuenta filas={resumen.filas} totales={resumen.totales} />
        </CardContent>
      </Card>

      <EstadoCuentaImpresion
        contactoNombre={datos.contacto.nombre}
        corte={filtros.corte}
        filas={resumen.filas}
        totales={resumen.totales}
      />
    </div>
  );
}
