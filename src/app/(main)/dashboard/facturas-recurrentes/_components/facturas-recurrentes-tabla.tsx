import { Enlace } from "@/components/enlace";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFacturaRecurrente } from "@/lib/enlaces";
import type { FacturaRecurrenteLista } from "@/lib/facturas-recurrentes/tipos";
import { formatoDia } from "@/lib/formato";

function frecuenciaTexto(meses: number) {
  return meses === 1 ? "Cada mes" : `Cada ${meses} meses`;
}

export function FacturasRecurrentesTabla({
  recurrentes,
  busqueda,
}: {
  recurrentes: FacturaRecurrenteLista[];
  busqueda?: string;
}) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Frecuencia</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Hasta</TableHead>
            <TableHead>Última generación</TableHead>
            <TableHead className="text-right">Facturas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recurrentes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                {busqueda
                  ? "No se encontraron facturas recurrentes con esa búsqueda."
                  : "No hay facturas recurrentes todavía."}
              </TableCell>
            </TableRow>
          ) : (
            recurrentes.map((recurrente) => (
              <TableRow key={recurrente.id}>
                <TableCell className="font-medium">
                  <Enlace href={rutaFacturaRecurrente(recurrente.id)}>{recurrente.numero}</Enlace>
                </TableCell>
                <TableCell>
                  <Enlace href={rutaContacto(recurrente.contacto_id)}>{recurrente.cliente_nombre}</Enlace>
                </TableCell>
                <TableCell>{frecuenciaTexto(recurrente.frecuencia_meses)}</TableCell>
                <TableCell>{formatoDia(recurrente.fecha_inicio)}</TableCell>
                <TableCell>
                  {recurrente.vigencia_hasta ? formatoDia(recurrente.vigencia_hasta) : "Sin límite"}
                </TableCell>
                <TableCell>{recurrente.ultimo_periodo ? formatoDia(recurrente.ultimo_periodo) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{recurrente.generaciones}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
