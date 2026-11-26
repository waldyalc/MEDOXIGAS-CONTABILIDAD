import { Enlace } from "@/components/enlace";
import { BookOpen } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerTamanoConDefecto, resumirPagina, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { obtenerMovimientos } from "@/lib/reportes/libros/consultas";
import { calcularLibroDiario } from "@/lib/reportes/libros/libro-diario";
import { leerEntero, leerTexto, normalizarOrigenes } from "@/lib/reportes/libros/parametros";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { EstadoAsiento } from "../_components/libros/estado-asiento";
import { FiltroLibroDiario } from "../_components/libros/filtro-libro-diario";

function leerTamanoLibro(params: ParametrosFecha): number {
  const tamano = leerTexto(params.tamano) ?? leerTexto(params.porPagina) ?? "";
  return leerTamanoConDefecto({ ...params, tamano }, 10);
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const origenes = normalizarOrigenes(params.origen);
  const tamano = leerTamanoLibro(params);
  const pagina = leerEntero(params.pagina, 1, 1, 100000);

  const { filas, error } = await obtenerMovimientos({ desde, hasta, origenes });
  const libro = calcularLibroDiario(filas, { pagina, porPagina: tamano });
  const resumenPagina = resumirPagina(libro.pagina, tamano, libro.totalFilas);
  const parametrosPaginacion: ParametrosFecha = { ...params, tamano: String(tamano) };
  delete parametrosPaginacion.porPagina;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Libro diario"
        descripcion="Todos los asientos del período con sus débitos y créditos."
        desde={desde}
        hasta={hasta}
      />

      <FiltroLibroDiario desde={desde} hasta={hasta} origenes={origenes} tamano={tamano} />

      {error ? <AlertaError mensaje={error} /> : null}

      {libro.totalFilas === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>Sin movimientos</EmptyTitle>
            <EmptyDescription>No hay asientos contables en el período seleccionado.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tercero</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Cuenta contable</TableHead>
                    <TableHead>Centro de costo</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {libro.filas.map((fila) => (
                    <FilaNavegable key={fila.clave} href={rutaAsiento(fila.asientoId)}>
                      <TableCell className="tabular-nums">
                        <Enlace href={rutaAsiento(fila.asientoId)}>#{fila.asientoNumero}</Enlace>
                      </TableCell>
                      <TableCell>
                        <EstadoAsiento estado={fila.estado} />
                      </TableCell>
                      <TableCell>{formatoDia(fila.fecha)}</TableCell>
                      <TableCell>
                        {fila.contactoId ? (
                          <Enlace href={rutaContacto(fila.contactoId)}>{fila.tercero || "—"}</Enlace>
                        ) : (
                          fila.tercero || "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        <Enlace href={rutaCuenta(fila.cuentaId)}>{fila.cuentaCodigo}</Enlace>
                      </TableCell>
                      <TableCell>
                        <Enlace href={rutaCuenta(fila.cuentaId)}>{fila.cuentaNombre}</Enlace>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fila.centroCosto || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fila.debito === 0 ? "" : formatearRd(fila.debito)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fila.credito === 0 ? "" : formatearRd(fila.credito)}
                      </TableCell>
                    </FilaNavegable>
                  ))}
                </TableBody>
              </Table>
              <PaginadorLista
                base="/dashboard/reportes/libro-diario"
                params={parametrosPaginacion}
                resumen={resumenPagina}
                tamano={tamano}
                opciones={TAMANOS_PAGINA}
                className="print:hidden"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
