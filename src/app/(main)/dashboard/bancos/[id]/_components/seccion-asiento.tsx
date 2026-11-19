import { BotonImprimir } from "@/components/boton-imprimir";
import { Enlace } from "@/components/enlace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AsientoBanco } from "@/lib/bancos/consultas";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

import { PapelImpresion } from "./papel-impresion";

function TablaAsiento({ asiento }: { asiento: AsientoBanco }) {
  const debitos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const creditos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tercero</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Cuenta contable</TableHead>
          <TableHead>Centro de costo</TableHead>
          <TableHead className="text-right">Débito</TableHead>
          <TableHead className="text-right">Crédito</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {asiento.lineas.map((linea) => (
          <TableRow key={linea.id}>
            <TableCell className="whitespace-normal">
              {linea.contacto ? <Enlace href={rutaContacto(linea.contacto.id)}>{linea.contacto.nombre}</Enlace> : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">{linea.cuenta?.codigo ?? "—"}</TableCell>
            <TableCell className="whitespace-normal">
              {linea.cuenta ? <Enlace href={rutaCuenta(linea.cuenta.id)}>{linea.cuenta.nombre}</Enlace> : "—"}
            </TableCell>
            <TableCell>{linea.centroCosto ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">
              {linea.debito === 0 ? "—" : formatoMoneda(linea.debito)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {linea.credito === 0 ? "—" : formatoMoneda(linea.credito)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4} className="text-right font-semibold">
            Totales
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{formatoMoneda(debitos / 100)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{formatoMoneda(creditos / 100)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

/** Panel "Asiento contable" bajo la tabla de movimientos (del movimiento elegido o del último). */
export function SeccionAsiento({
  asiento,
  empresa,
  origenEtiqueta,
}: {
  asiento: AsientoBanco;
  empresa: Empresa | null;
  origenEtiqueta: string;
}) {
  return (
    <section id="seccion-asiento" className="flex flex-col gap-4">
      <Card className="gap-4 rounded-2xl">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-[15px] font-medium">Asiento contable</CardTitle>
          <BotonImprimir />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="px-(--card-spacing)">
            <p className="bg-muted/50 text-muted-foreground rounded-lg px-4 py-3 text-sm">
              Movimiento contable del documento seleccionado en la tabla.
            </p>
          </div>
          <p className="px-(--card-spacing) text-sm">
            <Enlace href={rutaAsiento(asiento.id)} className="font-medium">
              Asiento #{asiento.numero}
            </Enlace>{" "}
            <span className="text-muted-foreground">· {formatoDia(asiento.fecha)}</span>
          </p>
          <div className="px-(--card-spacing)">
            <TablaAsiento asiento={asiento} />
          </div>
        </CardContent>
      </Card>

      <PapelImpresion>
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{empresa?.nombre ?? "MEDOXIGAS"}</h1>
          <p className="text-sm">Asiento contable #{asiento.numero}</p>
          <p className="text-sm">
            {formatoDia(asiento.fecha)} · {origenEtiqueta}
          </p>
          {asiento.descripcion ? <p className="text-sm">{asiento.descripcion}</p> : null}
        </div>
        <TablaAsiento asiento={asiento} />
      </PapelImpresion>
    </section>
  );
}
