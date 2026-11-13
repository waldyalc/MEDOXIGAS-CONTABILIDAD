import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TablaReporte } from "@/lib/reportes/exportar/tipos";
import type { ParametrosFecha } from "@/lib/reportes/fechas";
import { parsearRango } from "@/lib/reportes/fechas";
import { agruparPorVendedor } from "@/lib/reportes/ventas/v3/vendedor";

import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const { desde, hasta } = parsearRango(await searchParams);
  const vendedores = agruparPorVendedor([]);

  const tabla: TablaReporte = {
    titulo: "Ventas por vendedor",
    subtitulo: `Del ${desde} al ${hasta}`,
    columnas: [
      { clave: "vendedor", titulo: "Vendedor", tipo: "texto" },
      { clave: "ventas", titulo: "Número de ventas", tipo: "texto" },
      { clave: "antesImpuestos", titulo: "Antes de impuestos", tipo: "dinero" },
      { clave: "impuestos", titulo: "Impuestos", tipo: "dinero" },
      { clave: "despuesImpuestos", titulo: "Después de impuestos", tipo: "dinero" },
    ],
    filas: vendedores.map((vendedor) => ({
      celdas: {
        vendedor: vendedor.vendedor,
        ventas: vendedor.numeroVentas,
        antesImpuestos: vendedor.antesImpuestos,
        impuestos: vendedor.impuestos,
        despuesImpuestos: vendedor.despuesImpuestos,
      },
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Ventas por vendedor"
        descripcion="Ventas del período agrupadas por vendedor."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desde">Desde</Label>
            <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hasta">Hasta</Label>
            <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vendedor">Vendedores</Label>
            <NativeSelect id="vendedor" name="vendedor" disabled defaultValue="" className="w-52">
              <NativeSelectOption value="">Todos los vendedores</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="almacen">Almacén</Label>
            <NativeSelect id="almacen" name="almacen" disabled defaultValue="" className="w-44">
              <NativeSelectOption value="">Todos los almacenes</NativeSelectOption>
            </NativeSelect>
          </div>
          <Button type="submit" variant="secondary">
            Aplicar
          </Button>
        </form>
        <BotonDescargar tabla={tabla} nombreArchivo={`ventas-por-vendedor-${desde}-${hasta}`} />
      </div>

      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRound />
          </EmptyMedia>
          <EmptyTitle>No encontramos ventas que coincidan con tu búsqueda</EmptyTitle>
          <EmptyDescription>
            Todavía no hay vendedores registrados en el sistema. El reporte quedará disponible cuando exista ese dato.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
