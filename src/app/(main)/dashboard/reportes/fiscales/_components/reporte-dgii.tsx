import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoDia } from "@/lib/formato";
import { nombreArchivoDgii, textoPeriodo } from "@/lib/reportes/fiscales/comun";
import type { DocumentoExcluido } from "@/lib/reportes/fiscales/excluidos";
import { type FormatoDgii, tablaDgii } from "@/lib/reportes/fiscales/formatos/tipos";
import type { FilaDgii } from "@/lib/reportes/fiscales/tipos";

import { AlertaError } from "../../_components/alerta-error";
import { EncabezadoReporte } from "../../_components/encabezado-reporte";
import { ModalExportar } from "../../_components/modal-exportar";
import { FiltrosPeriodo } from "./filtros-periodo";
import { TablaFormato } from "./tabla-formato";
import { type TarjetaResumen, TarjetasResumen } from "./tarjetas-resumen";

interface Props {
  titulo: string;
  descripcion: string;
  formato: FormatoDgii;
  filas: readonly FilaDgii[];
  desde: string;
  hasta: string;
  periodo: string;
  rnc: string | null;
  tarjetas: readonly TarjetaResumen[];
  error?: string | null;
  avisos?: readonly string[];
  puedeExportar?: boolean;
  textoPlano: string;
  /** Documentos fuera del TXT con su motivo (606/607, como Alegra). */
  excluidos?: readonly DocumentoExcluido[];
}

function TablaExcluidos({ excluidos }: { excluidos: readonly DocumentoExcluido[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-12">Número</TableHead>
            <TableHead className="h-12">Tipo</TableHead>
            <TableHead className="h-12">Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {excluidos.map((excluido) => (
            <TableRow key={excluido.id}>
              <TableCell className="font-medium whitespace-nowrap">{excluido.numero}</TableCell>
              <TableCell className="whitespace-nowrap">{excluido.tipo}</TableCell>
              <TableCell className="min-w-[420px] text-sm whitespace-normal">{excluido.motivo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ReporteDgii({
  titulo,
  descripcion,
  formato,
  filas,
  desde,
  hasta,
  periodo,
  rnc,
  tarjetas,
  error = null,
  avisos = [],
  puedeExportar = true,
  textoPlano,
  excluidos = [],
}: Props) {
  const subtitulo = `${textoPeriodo(periodo)} · Del ${formatoDia(desde)} al ${formatoDia(hasta)}`;
  const tabla = tablaDgii(formato, filas, subtitulo);
  const nombreArchivo = nombreArchivoDgii(formato.codigo, rnc, periodo);
  const sinRnc = (rnc ?? "").replace(/\D/g, "") === "";

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo={titulo}
        descripcion={descripcion}
        rango={`Período ${subtitulo}`}
        mostrarImprimir={false}
        acciones={
          puedeExportar ? (
            <ModalExportar
              codigo={formato.codigo}
              periodo={periodo}
              rnc={rnc}
              nombreArchivo={nombreArchivo}
              textoPlano={textoPlano}
              tabla={tabla}
              excluidos={excluidos}
            />
          ) : null
        }
      />

      <FiltrosPeriodo desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      {avisos.map((aviso) => (
        <Alert key={aviso}>
          <AlertTitle>Aviso</AlertTitle>
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ))}

      {sinRnc ? (
        <Alert variant="destructive">
          <AlertTitle>Actualiza tu identificación</AlertTitle>
          <AlertDescription>
            La empresa no tiene RNC configurado. Configúralo en Configuración → Empresa para poder exportar este reporte
            a la DGII.
          </AlertDescription>
        </Alert>
      ) : null}

      <TarjetasResumen tarjetas={tarjetas} />

      <Card className="py-0">
        <CardContent className="p-0">
          <TablaFormato
            columnas={formato.detalle}
            filas={filas}
            vacio={`No hay registros para ${textoPeriodo(periodo)}.`}
          />
        </CardContent>
      </Card>

      {excluidos.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Documentos no incluidos">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Documentos no incluidos</h2>
            <p className="text-muted-foreground text-sm">
              {excluidos.length} documento(s) no entran al TXT. Corrige el RNC/cédula del contacto o clasifica la cuenta
              para incluirlos.
            </p>
          </div>
          <Card className="py-0">
            <CardContent className="p-0">
              <TablaExcluidos excluidos={excluidos} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      <p className="text-muted-foreground text-xs">
        El archivo plano lleva el encabezado y el detalle separados por pipes. Los montos van en pesos con dos
        decimales.
      </p>
    </div>
  );
}
