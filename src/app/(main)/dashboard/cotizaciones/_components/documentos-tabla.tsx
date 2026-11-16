import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocumentoFila, EstadoDocumento, TipoDocumento } from "@/lib/cotizaciones/tipos";
import { rutaConduce, rutaContacto, rutaCotizacion } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

export const TEXTOS_DOCUMENTO: Record<
  TipoDocumento,
  { titulo: string; descripcion: string; nueva: string; rutaNueva: string; rutaBase: string; vacio: string }
> = {
  cotizacion: {
    titulo: "Cotizaciones",
    descripcion: "Propuestas de venta sin asiento contable.",
    nueva: "Nueva cotización",
    rutaNueva: "/dashboard/cotizaciones/nueva",
    rutaBase: "/dashboard/cotizaciones",
    vacio: "No hay cotizaciones todavía.",
  },
  remision: {
    titulo: "Conduces",
    descripcion: "Entregas sin movimiento de inventario ni asiento contable.",
    nueva: "Nuevo conduce",
    rutaNueva: "/dashboard/conduces/nueva",
    rutaBase: "/dashboard/conduces",
    vacio: "No hay conduces todavía.",
  },
};

const ESTADOS: Record<EstadoDocumento, string> = {
  abierta: "Abierta",
  convertida: "Convertida",
  anulada: "Anulada",
};

function EstadoBadge({ estado }: { estado: EstadoDocumento }) {
  if (estado === "anulada") return <Badge variant="destructive">{ESTADOS[estado]}</Badge>;
  if (estado === "convertida")
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {ESTADOS[estado]}
      </Badge>
    );
  return <Badge>{ESTADOS[estado]}</Badge>;
}

interface Props {
  tipo: TipoDocumento;
  documentos: DocumentoFila[];
  busqueda?: string;
}

export function DocumentosTabla({ tipo, documentos, busqueda }: Props) {
  const textos = TEXTOS_DOCUMENTO[tipo];

  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Creación</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documentos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                {busqueda ? "No se encontraron documentos con esa búsqueda." : textos.vacio}
              </TableCell>
            </TableRow>
          ) : (
            documentos.map((documento) => (
              <TableRow key={documento.id}>
                <TableCell className="font-medium">
                  <Enlace href={tipo === "cotizacion" ? rutaCotizacion(documento.id) : rutaConduce(documento.id)}>
                    {documento.numero}
                  </Enlace>
                </TableCell>
                <TableCell>
                  <Enlace href={rutaContacto(documento.contacto_id)}>{documento.cliente_nombre}</Enlace>
                </TableCell>
                <TableCell>{formatoDia(documento.fecha)}</TableCell>
                <TableCell>
                  <EstadoBadge estado={documento.estado} />
                </TableCell>
                <TableCell className="text-right font-medium">{formatoMoneda(documento.total)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
