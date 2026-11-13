import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { formatoDia } from "@/lib/formato";
import { nombreArchivoDgii, textoPeriodo } from "@/lib/reportes/fiscales/comun";
import { type FormatoDgii, tablaDgii } from "@/lib/reportes/fiscales/formatos/tipos";
import type { FilaDgii } from "@/lib/reportes/fiscales/tipos";

import { AlertaError } from "../../_components/alerta-error";
import { BotonDescargar } from "../../_components/boton-descargar";
import { BotonTexto } from "./boton-texto";
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
}: Props) {
  const subtitulo = `${textoPeriodo(periodo)} · Del ${formatoDia(desde)} al ${formatoDia(hasta)}`;
  const tabla = tablaDgii(formato, filas, subtitulo);
  const nombreArchivo = nombreArchivoDgii(formato.codigo, rnc, periodo);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <p className="text-muted-foreground text-sm">{descripcion}</p>
          <p className="text-muted-foreground text-sm">
            Período {textoPeriodo(periodo)} · Del {formatoDia(desde)} al {formatoDia(hasta)}
          </p>
        </div>
        {puedeExportar ? (
          <div className="flex flex-wrap gap-2">
            <BotonDescargar tabla={tabla} nombreArchivo={`${formato.codigo}-${periodo}`} />
            <BotonTexto contenido={textoPlano} nombreArchivo={nombreArchivo} etiqueta="Archivo plano" />
          </div>
        ) : null}
      </div>

      <FiltrosPeriodo desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      {avisos.map((aviso) => (
        <Alert key={aviso}>
          <AlertTitle>Aviso</AlertTitle>
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ))}

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

      <p className="text-muted-foreground text-xs">
        El archivo plano lleva el encabezado y el detalle separados por pipes. Los montos van en pesos con dos
        decimales.
      </p>
    </div>
  );
}
