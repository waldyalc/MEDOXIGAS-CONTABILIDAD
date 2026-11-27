"use client";

import { type ChangeEvent, useState } from "react";

import { cn } from "cn";

import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Send,
  TriangleAlert,
  Upload,
} from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type {
  ResultadoEnvioExcelCaso,
  ResultadoValidacionExcelCaso,
  ResumenEjecucionExcelEcf,
} from "./ecf-portal-tipos";
import type { AmbienteEcf } from "./pasos-habilitacion";

type RespuestaEjecucionExcelApi = ({ ok: true } & ResumenEjecucionExcelEcf) | { ok: false; error?: string };

interface SetExcelDgiiProps {
  rncEmisor: string;
  razonSocial: string;
  ambiente: AmbienteEcf;
  archivoCertificado: File | null;
  contrasenaCertificado: string;
}

function ambienteParaApi(ambiente: AmbienteEcf): "testecf" | "certecf" {
  return ambiente === "certecf" ? "certecf" : "testecf";
}

function formatearMonto(valor: number): string {
  return valor.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BadgeEstadoDgii({ estado }: { estado: string }) {
  if (estado === "aceptado" || estado === "aceptado_condicional") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{estado.replace("_", " ")}</Badge>;
  }
  if (estado === "rechazado" || estado === "error_red")
    return <Badge variant="destructive">{estado.replace("_", " ")}</Badge>;
  return <Badge variant="secondary">{estado.replace("_", " ")}</Badge>;
}

function descargarXml(nombreArchivo: string, xml: string) {
  const blob = new Blob([xml], { type: "text/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function BotonesXml({ caso, rncEmisor }: { caso: ResultadoEnvioExcelCaso; rncEmisor: string }) {
  return (
    <div className="flex flex-col gap-1">
      {caso.xmlFirmado ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => descargarXml(`${rncEmisor}${caso.encf}-ecf.xml`, caso.xmlFirmado ?? "")}
        >
          <Download />
          XML e-CF
        </Button>
      ) : null}
      {caso.xmlRfce ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => descargarXml(`${rncEmisor}${caso.encf}-rfce.xml`, caso.xmlRfce ?? "")}
        >
          <Download />
          XML RFCE
        </Button>
      ) : null}
      {!caso.xmlFirmado && !caso.xmlRfce ? <span className="text-muted-foreground text-xs">—</span> : null}
    </div>
  );
}

function TablaValidacionExcel({ casos }: { casos: ResultadoValidacionExcelCaso[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Caso</TableHead>
            <TableHead>e-NCF</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Validación</TableHead>
            <TableHead>Errores de formato</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((caso) => (
            <TableRow key={`${caso.numeroFila}-${caso.encf}`}>
              <TableCell className="whitespace-normal">
                <span className="block font-medium">{caso.casoPrueba}</span>
                <span className="text-muted-foreground text-xs">Fila {caso.numeroFila}</span>
              </TableCell>
              <TableCell className="font-mono text-xs whitespace-nowrap">{caso.encf}</TableCell>
              <TableCell>
                <Badge variant="secondary">E{caso.tipo}</Badge>
                {caso.esRfce ? (
                  <Badge variant="outline" className="ml-1">
                    RFCE
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                RD$ {formatearMonto(caso.montoTotal)}
              </TableCell>
              <TableCell>
                {caso.valido ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Válido</Badge>
                ) : (
                  <Badge variant="destructive">Con errores</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-md whitespace-normal">
                {caso.errores.length > 0 ? (
                  <ul className="text-destructive flex list-disc flex-col gap-1 pl-4 text-xs">
                    {caso.errores.map((error) => (
                      <li key={`${caso.encf}-${error}`}>{error}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground text-xs">Sin errores XSD/estructurales</span>
                )}
                {caso.columnasNoReconocidas.length > 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Columnas no reconocidas: {caso.columnasNoReconocidas.join(", ")}
                  </p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaEnvioExcel({ casos, rncEmisor }: { casos: ResultadoEnvioExcelCaso[]; rncEmisor: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>e-NCF</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>TrackId</TableHead>
            <TableHead>Estado DGII</TableHead>
            <TableHead>Código seguridad</TableHead>
            <TableHead>Mensajes</TableHead>
            <TableHead>XML firmado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((caso) => {
            const mensajes = [...caso.mensajes];
            if (caso.errorPersistencia) mensajes.push(`Trazabilidad local: ${caso.errorPersistencia}`);
            return (
              <TableRow key={`${caso.numeroFila}-${caso.encf}`}>
                <TableCell className="whitespace-normal">
                  <span className="block font-mono text-xs font-semibold">{caso.encf}</span>
                  <span className="text-muted-foreground text-xs">{caso.casoPrueba}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">E{caso.tipo}</Badge>
                  {caso.esRfce ? (
                    <Badge variant="outline" className="ml-1">
                      RFCE
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-xs break-all">{caso.trackId ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <BadgeEstadoDgii estado={caso.estado} />
                    <span className="text-muted-foreground text-xs">{caso.duracionMs} ms</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{caso.codigoSeguridad ?? "—"}</TableCell>
                <TableCell className="max-w-md whitespace-normal">
                  {mensajes.length > 0 ? (
                    <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
                      {mensajes.map((mensaje) => (
                        <li key={`${caso.encf}-${mensaje}`}>{mensaje}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground text-xs">Sin mensajes de la DGII</span>
                  )}
                  {caso.urlQr ? (
                    <p className="mt-1 font-mono text-[10px] break-all text-slate-500">{caso.urlQr}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <BotonesXml caso={caso} rncEmisor={rncEmisor} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la tarjeta concentra plantilla, carga, candado de ambiente y resultados DGII para mantener el flujo de certificación en un solo paso
export function SetExcelDgii({
  rncEmisor,
  razonSocial,
  ambiente,
  archivoCertificado,
  contrasenaCertificado,
}: SetExcelDgiiProps) {
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [adjuntarCertificado, setAdjuntarCertificado] = useState(true);
  const [ejecutando, setEjecutando] = useState<"validar_local" | "enviar_testecf" | null>(null);
  const [resumen, setResumen] = useState<ResumenEjecucionExcelEcf | null>(null);
  const [error, setError] = useState<string | null>(null);

  const produccionBloqueada = ambiente === "produccion";
  const ambienteApi = ambienteParaApi(ambiente);
  const certificadoDisponible = Boolean(archivoCertificado && contrasenaCertificado.length > 0);
  const urlPlantilla = `/api/ecf/pruebas/plantilla?rnc=${encodeURIComponent(rncEmisor)}&razonSocial=${encodeURIComponent(razonSocial)}`;

  function manejarArchivoExcel(evento: ChangeEvent<HTMLInputElement>) {
    setArchivoExcel(evento.target.files?.[0] ?? null);
    setResumen(null);
    setError(null);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: valida adjuntos, arma el multipart y normaliza errores de red/API sin filtrar secretos
  async function ejecutar(modo: "validar_local" | "enviar_testecf") {
    if (!archivoExcel) {
      setError("Selecciona primero el archivo .xlsx oficial de la DGII.");
      return;
    }
    setError(null);
    setEjecutando(modo);
    try {
      const form = new FormData();
      form.append("archivoExcel", archivoExcel);
      form.append("modo", modo);
      form.append("ambiente", ambienteApi);
      form.append("rncEmisor", rncEmisor);
      form.append("razonSocial", razonSocial);
      if (modo === "enviar_testecf" && adjuntarCertificado && archivoCertificado && contrasenaCertificado.length > 0) {
        form.append("certificadoP12", archivoCertificado);
        form.append("contrasenaP12", contrasenaCertificado);
      }

      const response = await fetch("/api/ecf/pruebas/ejecutar-excel", { method: "POST", body: form });
      const data = (await response.json()) as RespuestaEjecucionExcelApi;
      if (!response.ok || !data.ok) {
        throw new Error(
          "error" in data && data.error ? data.error : "La ejecución del Excel DGII no pudo completarse.",
        );
      }
      setResumen(data);
    } catch (errorCapturado) {
      setResumen(null);
      setError(
        errorCapturado instanceof Error ? errorCapturado.message : "La ejecución del Excel DGII no pudo completarse.",
      );
    } finally {
      setEjecutando(null);
    }
  }

  return (
    <Card size="sm" className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-primary size-5" />
          <CardTitle>Set oficial Excel de la DGII (TesteCF / CerteCF)</CardTitle>
        </div>
        <CardDescription>
          Descarga la plantilla piloto, valida el Excel localmente o envía el set real firmado a la DGII.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert className="border-primary/25 bg-secondary/45">
          <Info />
          <AlertTitle>Candado de seguridad</AlertTitle>
          <AlertDescription>
            Este runner nunca apunta a Producción (ecf). Solo puede ejecutar contra TesteCF o CerteCF.
          </AlertDescription>
        </Alert>

        {produccionBloqueada ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
            <TriangleAlert />
            <AlertTitle>Producción bloqueada para el runner</AlertTitle>
            <AlertDescription>
              Cambia el ambiente superior a TesteCF o CerteCF para habilitar el envío real. La validación local sigue
              disponible porque no transmite nada a la DGII.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">1. Plantilla piloto</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Generada con el RNC y la razón social del emisor seleccionado.
              </p>
            </div>
            <Button type="button" variant="outline" nativeButton={false} render={<a href={urlPlantilla} download />}>
              <Download />
              Descargar plantilla Excel piloto
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">2. Excel oficial de la DGII</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Adjunta el .xlsx oficial completado para validar su formato o enviarlo firmado.
              </p>
            </div>
            <div>
              <Input
                id="excel-pruebas-dgii"
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={manejarArchivoExcel}
              />
              <Label
                htmlFor="excel-pruebas-dgii"
                className="border-border hover:border-primary/50 hover:bg-secondary/45 flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-center transition-colors"
              >
                <Upload className="text-primary size-5" />
                <span className="text-sm font-medium">Seleccionar Excel .xlsx de la DGII</span>
                <span className="text-muted-foreground text-xs">Máximo 5 MB</span>
              </Label>
              {archivoExcel ? (
                <Badge variant="secondary" className="mt-2 max-w-full truncate">
                  {archivoExcel.name}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="adjuntar-certificado-excel"
              checked={adjuntarCertificado}
              onCheckedChange={(valor) => setAdjuntarCertificado(valor === true)}
              disabled={!certificadoDisponible}
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="adjuntar-certificado-excel" className="leading-5">
                Usar el certificado .p12 y la contraseña seleccionados en el Paso 1
              </Label>
              <p className="text-muted-foreground text-xs">
                Si no lo adjuntas, el servidor intentará usar ECF_CERT_PEM_{rncEmisor} y ECF_KEY_PEM_{rncEmisor}.
              </p>
            </div>
          </div>
          {!certificadoDisponible ? (
            <p className="text-muted-foreground text-xs">
              No hay certificado + contraseña completos en el Paso 1; el envío real dependerá de las variables PEM del
              servidor.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!archivoExcel || ejecutando !== null}
            onClick={() => void ejecutar("validar_local")}
          >
            {ejecutando === "validar_local" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            Validar Excel (local)
          </Button>
          <Button
            type="button"
            disabled={!archivoExcel || ejecutando !== null || produccionBloqueada}
            onClick={() => void ejecutar("enviar_testecf")}
          >
            {ejecutando === "enviar_testecf" ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar set real a {ambienteApi === "certecf" ? "CerteCF" : "TesteCF"} (DGII)
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>No se pudo ejecutar el Excel DGII</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {resumen?.modo === "validar_local" ? (
          <>
            <Alert
              className={cn(
                resumen.invalidos === 0
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100"
                  : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100",
              )}
            >
              <CheckCircle2 />
              <AlertTitle>
                Validación local completada: {resumen.validos}/{resumen.totalCasos} casos válidos
              </AlertTitle>
              <AlertDescription>
                No se transmitió ningún XML a la DGII. Revisa los errores XSD/estructurales antes del envío real.
              </AlertDescription>
            </Alert>
            <TablaValidacionExcel casos={resumen.casos} />
          </>
        ) : null}

        {resumen?.modo === "enviar_testecf" ? (
          <>
            <Alert className="border-primary/25 bg-secondary/45">
              <CheckCircle2 />
              <AlertTitle>
                Envío real completado: {resumen.aceptados}/{resumen.totalCasos} aceptados · {resumen.rechazados}{" "}
                rechazados · {resumen.errores} errores
              </AlertTitle>
              <AlertDescription>
                Ambiente {resumen.ambiente === "certecf" ? "CerteCF" : "TesteCF"} · {resumen.enProceso} casos en
                proceso. La trazabilidad se guardó en ecf_envios como documento_tipo "prueba" cuando la base lo
                permitió.
              </AlertDescription>
            </Alert>
            <TablaEnvioExcel casos={resumen.casos} rncEmisor={rncEmisor} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
