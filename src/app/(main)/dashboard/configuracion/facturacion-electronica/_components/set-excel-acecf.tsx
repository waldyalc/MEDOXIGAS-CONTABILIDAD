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
  ModoEjecucionExcelAcecf,
  ResultadoEnvioAcecfCaso,
  ResultadoValidacionAcecfCaso,
  ResumenEjecucionExcelAcecf,
  ResumenEnvioAcecf,
  ResumenValidacionAcecf,
} from "./ecf-portal-tipos";
import type { AmbienteEcf } from "./pasos-habilitacion";

type RespuestaEjecucionAcecfApi = ({ ok: true } & ResumenEjecucionExcelAcecf) | { ok: false; error?: string };

interface SetExcelAcecfProps {
  rncComprador: string;
  razonSocial: string;
  ambiente: AmbienteEcf;
  archivoCertificado: File | null;
  contrasenaCertificado: string;
}

const TAMANO_MAXIMO_EXCEL_ACECF = 5 * 1024 * 1024;

function ambienteParaApi(ambiente: AmbienteEcf): "testecf" | "certecf" {
  return ambiente === "certecf" ? "certecf" : "testecf";
}

function formatearMonto(valor: number): string {
  return valor.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function montoParaMostrar(caso: { montoTotal: number; montoTotalTexto: string }): string {
  const texto = caso.montoTotalTexto.trim();
  return texto === "" ? formatearMonto(caso.montoTotal) : texto;
}

function nombreArchivoAcecfOficial(caso: { encf: string; nombreArchivoAcecf: string }, rncComprador: string): string {
  return caso.nombreArchivoAcecf || `${rncComprador}${caso.encf}.xml`;
}

function textoFuenteCredenciales(fuente: NonNullable<ResumenEnvioAcecf["fuenteCredenciales"]>): string {
  if (fuente === "formulario") return "archivo adjunto en esta ejecución";
  if (fuente === "base_datos") return "certificado .p12 cifrado guardado en ecf_config";
  return "variables PEM del servidor";
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

function validarArchivoExcelAcecf(archivo: File): string | null {
  if (!archivo.name.toLowerCase().endsWith(".xlsx")) {
    return "El set de Aprobación Comercial debe ser un archivo .xlsx.";
  }
  if (archivo.size > TAMANO_MAXIMO_EXCEL_ACECF) {
    return "El Excel ACECF no puede superar 5 MB.";
  }
  return null;
}

function textoEstadoComercial(estado: "1" | "2"): string {
  return estado === "1" ? "Aceptado" : "Rechazado";
}

function BadgeEstadoComercial({ estado }: { estado: "1" | "2" }) {
  if (estado === "1") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Aceptado</Badge>;
  }
  return <Badge variant="destructive">Rechazado</Badge>;
}

function BadgeEstadoDgiiAcecf({ estado }: { estado: string }) {
  const normalizado = estado.toLowerCase();
  if (normalizado.includes("acept") || normalizado.includes("aprobad")) {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{estado}</Badge>;
  }
  if (normalizado.includes("rechaz") || normalizado.includes("error")) {
    return <Badge variant="destructive">{estado}</Badge>;
  }
  return <Badge variant="secondary">{estado}</Badge>;
}

function mensajesConPersistencia(caso: ResultadoEnvioAcecfCaso): string[] {
  if (!caso.errorPersistencia) return caso.mensajes;
  return [...caso.mensajes, `Trazabilidad local: ${caso.errorPersistencia}`];
}

function TablaValidacionAcecf({
  casos,
  rncComprador,
}: {
  casos: ResultadoValidacionAcecfCaso[];
  rncComprador: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fila</TableHead>
            <TableHead>RNC Emisor</TableHead>
            <TableHead>e-NCF</TableHead>
            <TableHead>Fecha emisión</TableHead>
            <TableHead className="text-right">MontoTotal</TableHead>
            <TableHead>Estado comercial</TableHead>
            <TableHead>Archivo XML</TableHead>
            <TableHead>Validación / Errores</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((caso) => (
            <TableRow key={`${caso.numeroFila}-${caso.rncEmisor}-${caso.encf}`}>
              <TableCell className="font-mono text-xs whitespace-nowrap">{caso.numeroFila}</TableCell>
              <TableCell className="font-mono text-xs whitespace-nowrap">{caso.rncEmisor}</TableCell>
              <TableCell className="font-mono text-xs whitespace-nowrap">{caso.encf}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">{caso.fechaEmision}</TableCell>
              <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                RD$ {montoParaMostrar(caso)}
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex min-w-36 flex-col gap-1">
                  <BadgeEstadoComercial estado={caso.estadoComercial} />
                  <span className="text-muted-foreground text-xs">
                    {textoEstadoComercial(caso.estadoComercial)} el {caso.fechaHoraAprobacionComercial}
                  </span>
                  {caso.detalleMotivoRechazo ? (
                    <span className="text-destructive text-xs">{caso.detalleMotivoRechazo}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="max-w-56 font-mono text-xs break-all whitespace-normal">
                {nombreArchivoAcecfOficial(caso, rncComprador)}
              </TableCell>
              <TableCell className="max-w-md whitespace-normal">
                <div className="flex flex-col gap-2">
                  {caso.valido ? (
                    <Badge className="w-fit bg-emerald-600 text-white hover:bg-emerald-600">Válido XSD</Badge>
                  ) : (
                    <Badge variant="destructive" className="w-fit">
                      Con errores
                    </Badge>
                  )}
                  {caso.errores.length > 0 ? (
                    <ul className="text-destructive flex list-disc flex-col gap-1 pl-4 text-xs">
                      {caso.errores.map((error) => (
                        <li key={`${caso.encf}-${error}`}>{error}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground text-xs">Sin errores XSD/estructurales</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BotonDescargaXmlAcecf({ caso, rncComprador }: { caso: ResultadoEnvioAcecfCaso; rncComprador: string }) {
  if (!caso.xmlFirmado) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-fit px-2 text-xs"
      onClick={() => descargarXml(nombreArchivoAcecfOficial(caso, rncComprador), caso.xmlFirmado ?? "")}
    >
      <Download />
      Descargar XML
    </Button>
  );
}

function TablaEnvioAcecf({ casos, rncComprador }: { casos: ResultadoEnvioAcecfCaso[]; rncComprador: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>e-NCF / RNC Emisor</TableHead>
            <TableHead className="text-right">MontoTotal</TableHead>
            <TableHead>Archivo XML</TableHead>
            <TableHead>Código / Estado DGII</TableHead>
            <TableHead>Mensajes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((caso) => {
            const mensajes = mensajesConPersistencia(caso);
            return (
              <TableRow key={`${caso.numeroFila}-${caso.rncEmisor}-${caso.encf}`}>
                <TableCell className="whitespace-normal">
                  <span className="block font-mono text-xs font-semibold">{caso.encf}</span>
                  <span className="text-muted-foreground font-mono text-xs">RNC Emisor {caso.rncEmisor}</span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                  RD$ {montoParaMostrar(caso)}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs break-all">{nombreArchivoAcecfOficial(caso, rncComprador)}</span>
                    <BotonDescargaXmlAcecf caso={caso} rncComprador={rncComprador} />
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex min-w-36 flex-col gap-1">
                    <span className="font-mono text-xs">{caso.codigo ?? "—"}</span>
                    <div className="flex flex-wrap items-center gap-1">
                      <BadgeEstadoDgiiAcecf estado={caso.estado} />
                      {caso.reutilizado ? <Badge variant="outline">reutilizado</Badge> : null}
                    </div>
                    {caso.estadoOriginal ? (
                      <span className="text-muted-foreground text-xs">Estado original: {caso.estadoOriginal}</span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      {caso.duracionMs} ms · {caso.persistido ? "trazabilidad guardada" : "sin trazabilidad local"}
                    </span>
                  </div>
                </TableCell>
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ResumenValidacionAcecfLocal({ resumen }: { resumen: ResumenValidacionAcecf }) {
  return (
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
          Validación local ACECF completada: {resumen.validos}/{resumen.totalCasos} casos válidos
        </AlertTitle>
        <AlertDescription>
          No se transmitió ninguna aprobación comercial a la DGII. Revisa los errores contra ACECF_v.1.0.xsd antes del
          envío real.
        </AlertDescription>
      </Alert>
      <TablaValidacionAcecf casos={resumen.casos} rncComprador={resumen.rncComprador} />
    </>
  );
}

function ResumenEnvioAcecfReal({ resumen }: { resumen: ResumenEnvioAcecf }) {
  return (
    <>
      <Alert className="border-primary/25 bg-secondary/45">
        <CheckCircle2 />
        <AlertTitle>
          Envío ACECF completado: {resumen.aceptados}/{resumen.totalCasos} aceptados · {resumen.rechazados} rechazados ·{" "}
          {resumen.errores} errores · {resumen.reutilizados} reutilizados
        </AlertTitle>
        <AlertDescription>
          Ambiente {resumen.ambiente === "certecf" ? "CerteCF" : "TesteCF"}. Cada aprobación se firmó como{" "}
          <span className="font-mono">{"<RNCComprador><eNCF>.xml"}</span> y la trazabilidad local se guardó cuando la
          base lo permitió.
          {resumen.fuenteCredenciales ? (
            <span className="block">Certificado usado: {textoFuenteCredenciales(resumen.fuenteCredenciales)}.</span>
          ) : null}
        </AlertDescription>
      </Alert>
      <TablaEnvioAcecf casos={resumen.casos} rncComprador={resumen.rncComprador} />
    </>
  );
}

function BloqueArchivoAcecf({
  archivoExcel,
  onArchivo,
}: {
  archivoExcel: File | null;
  onArchivo: (evento: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="text-sm font-medium">2. Excel oficial de aprobaciones comerciales</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Adjunta el .xlsx oficial completado para validar su formato o enviar los ACECF firmados.
        </p>
      </div>
      <div>
        <Input id="excel-aprobaciones-acecf" type="file" accept=".xlsx" className="sr-only" onChange={onArchivo} />
        <Label
          htmlFor="excel-aprobaciones-acecf"
          className="border-border hover:border-primary/50 hover:bg-secondary/45 flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-center transition-colors"
        >
          <Upload className="text-primary size-5" />
          <span className="text-sm font-medium">Seleccionar Excel ACECF .xlsx</span>
          <span className="text-muted-foreground text-xs">Máximo 5 MB</span>
        </Label>
        {archivoExcel ? (
          <Badge variant="secondary" className="mt-2 max-w-full truncate">
            {archivoExcel.name}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function BloqueCertificadoAcecf({
  adjuntarCertificado,
  certificadoDisponible,
  rncComprador,
  onAdjuntarCertificado,
}: {
  adjuntarCertificado: boolean;
  certificadoDisponible: boolean;
  rncComprador: string;
  onAdjuntarCertificado: (valor: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="adjuntar-certificado-acecf"
          checked={adjuntarCertificado}
          onCheckedChange={(valor) => onAdjuntarCertificado(valor === true)}
          disabled={!certificadoDisponible}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="adjuntar-certificado-acecf" className="leading-5">
            Usar el certificado .p12 y la contraseña seleccionados en el Paso 1
          </Label>
          <p className="text-muted-foreground text-xs">
            Opcional: si no lo adjuntas aquí, el servidor usa automáticamente el certificado .p12 cifrado guardado en
            ecf_config durante el Paso 1. Si no existe, intenta las variables PEM{" "}
            <span className="font-mono">{`ECF_CERT_PEM_${rncComprador}`}</span> y{" "}
            <span className="font-mono">{`ECF_KEY_PEM_${rncComprador}`}</span> del comprador.
          </p>
        </div>
      </div>
      {!certificadoDisponible ? (
        <p className="text-muted-foreground text-xs">
          No hay certificado + contraseña completos en el Paso 1 para reenviarlos; el envío real usará el .p12 cifrado
          guardado en ecf_config o las variables PEM del servidor.
        </p>
      ) : null}
    </div>
  );
}

function BotonesEjecucionAcecf({
  archivoExcel,
  ejecutando,
  produccionBloqueada,
  onEjecutar,
}: {
  archivoExcel: File | null;
  ejecutando: ModoEjecucionExcelAcecf | null;
  produccionBloqueada: boolean;
  onEjecutar: (modo: ModoEjecucionExcelAcecf) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={!archivoExcel || ejecutando !== null}
        onClick={() => onEjecutar("validar_local")}
      >
        {ejecutando === "validar_local" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        Validar Excel ACECF (local)
      </Button>
      <Button
        type="button"
        disabled={!archivoExcel || ejecutando !== null || produccionBloqueada}
        onClick={() => onEjecutar("enviar_dgii")}
      >
        {ejecutando === "enviar_dgii" ? <Loader2 className="animate-spin" /> : <Send />}
        Enviar aprobaciones a CerteCF/TesteCF (DGII)
      </Button>
    </div>
  );
}

interface ParametrosEjecucionAcecf {
  archivoExcel: File;
  modo: ModoEjecucionExcelAcecf;
  ambiente: "testecf" | "certecf";
  rncComprador: string;
  adjuntarCertificado: boolean;
  archivoCertificado: File | null;
  contrasenaCertificado: string;
}

function adjuntarCertificadoCorresponde(params: ParametrosEjecucionAcecf): boolean {
  return (
    params.modo === "enviar_dgii" &&
    params.adjuntarCertificado &&
    params.archivoCertificado !== null &&
    params.contrasenaCertificado.length > 0
  );
}

function construirFormularioAcecf(params: ParametrosEjecucionAcecf): FormData {
  const form = new FormData();
  form.append("archivoExcel", params.archivoExcel);
  form.append("modo", params.modo);
  form.append("ambiente", params.ambiente);
  form.append("rncComprador", params.rncComprador);
  if (adjuntarCertificadoCorresponde(params) && params.archivoCertificado) {
    form.append("certificadoP12", params.archivoCertificado);
    form.append("contrasenaP12", params.contrasenaCertificado);
  }
  return form;
}

function mensajeErrorEjecucionAcecf(data: RespuestaEjecucionAcecfApi): string {
  if ("error" in data && data.error) return data.error;
  return "La ejecución del Excel ACECF no pudo completarse.";
}

async function ejecutarExcelAcecfApi(params: ParametrosEjecucionAcecf): Promise<ResumenEjecucionExcelAcecf> {
  const response = await fetch("/api/ecf/pruebas/ejecutar-acecf", {
    method: "POST",
    body: construirFormularioAcecf(params),
  });
  const data = (await response.json()) as RespuestaEjecucionAcecfApi;
  if (!response.ok || !data.ok) throw new Error(mensajeErrorEjecucionAcecf(data));
  return data;
}

export function SetExcelAcecf({
  rncComprador,
  razonSocial,
  ambiente,
  archivoCertificado,
  contrasenaCertificado,
}: SetExcelAcecfProps) {
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [adjuntarCertificado, setAdjuntarCertificado] = useState(true);
  const [ejecutando, setEjecutando] = useState<ModoEjecucionExcelAcecf | null>(null);
  const [resumen, setResumen] = useState<ResumenEjecucionExcelAcecf | null>(null);
  const [error, setError] = useState<string | null>(null);

  const produccionBloqueada = ambiente === "produccion";
  const ambienteApi = ambienteParaApi(ambiente);
  const certificadoDisponible = Boolean(archivoCertificado && contrasenaCertificado.length > 0);

  function manejarArchivoExcel(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0] ?? null;
    setResumen(null);
    setError(null);
    if (!archivo) {
      setArchivoExcel(null);
      return;
    }
    const errorArchivo = validarArchivoExcelAcecf(archivo);
    if (errorArchivo) {
      setArchivoExcel(null);
      setError(errorArchivo);
      evento.currentTarget.value = "";
      return;
    }
    setArchivoExcel(archivo);
  }

  async function ejecutar(modo: ModoEjecucionExcelAcecf) {
    if (!archivoExcel) {
      setError("Selecciona primero el archivo .xlsx oficial de aprobaciones comerciales.");
      return;
    }
    if (modo === "enviar_dgii" && produccionBloqueada) {
      setError("El envío real de aprobaciones comerciales está bloqueado en Producción.");
      return;
    }
    setError(null);
    setEjecutando(modo);
    try {
      const data = await ejecutarExcelAcecfApi({
        archivoExcel,
        modo,
        ambiente: ambienteApi,
        rncComprador,
        adjuntarCertificado,
        archivoCertificado,
        contrasenaCertificado,
      });
      setResumen(data);
    } catch (errorCapturado) {
      setResumen(null);
      setError(
        errorCapturado instanceof Error ? errorCapturado.message : "La ejecución del Excel ACECF no pudo completarse.",
      );
    } finally {
      setEjecutando(null);
    }
  }

  function ejecutarEnSegundoPlano(modo: ModoEjecucionExcelAcecf) {
    void ejecutar(modo);
  }

  return (
    <Card size="sm" className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-primary size-5" />
          <CardTitle>Set oficial Aprobación Comercial ACECF (Paso 3 DGII — TesteCF / CerteCF)</CardTitle>
        </div>
        <CardDescription>
          Procesa el Excel oficial de Aprobaciones Comerciales <span className="font-mono">ACEECF_Generadas</span>,
          valida localmente contra <span className="font-mono">ACECF_v.1.0.xsd</span> y envía cada XML firmado como{" "}
          <span className="font-mono">{"<RNCComprador><eNCF>.xml"}</span> con el certificado del comprador {razonSocial}{" "}
          (RNC {rncComprador}).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert className="border-primary/25 bg-secondary/45">
          <Info />
          <AlertTitle>Candado de seguridad</AlertTitle>
          <AlertDescription>
            Este runner de aprobaciones comerciales nunca apunta a Producción (ecf). Solo puede ejecutar contra TesteCF
            o CerteCF.
          </AlertDescription>
        </Alert>

        {produccionBloqueada ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
            <TriangleAlert />
            <AlertTitle>Producción bloqueada para el runner ACECF</AlertTitle>
            <AlertDescription>
              Cambia el ambiente superior a TesteCF o CerteCF para habilitar el envío real. La validación local sigue
              disponible porque no transmite nada a la DGII.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">1. Set ACEECF_Generadas</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Usa el Excel oficial de la DGII con las aprobaciones y rechazos comerciales del comprador. Cada fila
                genera un ACECF independiente para el e-NCF y RNC Emisor correspondiente.
              </p>
            </div>
            <div className="bg-secondary/45 text-muted-foreground rounded-lg p-3 text-xs">
              El nombre de salida se construye con el comprador actual:{" "}
              <span className="font-mono">{`${rncComprador}<eNCF>.xml`}</span>.
            </div>
          </div>

          <BloqueArchivoAcecf archivoExcel={archivoExcel} onArchivo={manejarArchivoExcel} />
        </div>

        <BloqueCertificadoAcecf
          adjuntarCertificado={adjuntarCertificado}
          certificadoDisponible={certificadoDisponible}
          rncComprador={rncComprador}
          onAdjuntarCertificado={setAdjuntarCertificado}
        />

        <BotonesEjecucionAcecf
          archivoExcel={archivoExcel}
          ejecutando={ejecutando}
          produccionBloqueada={produccionBloqueada}
          onEjecutar={ejecutarEnSegundoPlano}
        />

        {error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>No se pudo ejecutar el Excel ACECF</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {resumen?.modo === "validar_local" ? <ResumenValidacionAcecfLocal resumen={resumen} /> : null}
        {resumen?.modo === "enviar_dgii" ? <ResumenEnvioAcecfReal resumen={resumen} /> : null}
      </CardContent>
    </Card>
  );
}
