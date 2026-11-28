"use client";

import { useState } from "react";

import { cn } from "cn";

import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Hash,
  Info,
  Loader2,
  Send,
  ShieldCheck,
  TriangleAlert,
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
  CategoriaSimulacionPaso4,
  FaseOrdenPaso4,
  ModoEjecucionSimulacionPaso4,
  ResultadoEnvioSimulacionPaso4Caso,
  ResultadoValidacionSimulacionPaso4Caso,
  ResumenEjecucionSimulacionPaso4,
  ResumenEnvioSimulacionPaso4,
  ResumenValidacionSimulacionPaso4,
} from "./ecf-portal-tipos";
import type { AmbienteEcf } from "./pasos-habilitacion";

type RespuestaEjecucionSimulacionApi = ({ ok: true } & ResumenEjecucionSimulacionPaso4) | { ok: false; error?: string };

type CasoSimulacionPaso4 = ResultadoValidacionSimulacionPaso4Caso | ResultadoEnvioSimulacionPaso4Caso;

export interface SetSimulacionPaso4Props {
  rncEmisor: string;
  razonSocial: string;
  direccionEmisor?: string | null;
  telefonoEmisor?: string | null;
  correoEmisor?: string | null;
  ambiente: AmbienteEcf;
  archivoCertificado: File | null;
  contrasenaCertificado: string;
}

const SECUENCIA_BASE_MINIMA = 100;
const SECUENCIA_BASE_MAXIMA = 9_999_900;
const SECUENCIA_BASE_DEFECTO = "1001";

const CATEGORIAS_PASO4 = [
  { id: "31", etiqueta: "E31", esperados: 4, tipoEncf: "31", inicioOffset: 0, cantidadSecuencias: 4 },
  {
    id: "32_mayor_250k",
    etiqueta: "E32 >= 250Mil",
    esperados: 2,
    tipoEncf: "32",
    inicioOffset: 0,
    cantidadSecuencias: 2,
  },
  { id: "33", etiqueta: "E33", esperados: 1, tipoEncf: "33", inicioOffset: 0, cantidadSecuencias: 1 },
  { id: "34", etiqueta: "E34", esperados: 2, tipoEncf: "34", inicioOffset: 0, cantidadSecuencias: 2 },
  { id: "41", etiqueta: "E41", esperados: 2, tipoEncf: "41", inicioOffset: 0, cantidadSecuencias: 2 },
  { id: "43", etiqueta: "E43", esperados: 2, tipoEncf: "43", inicioOffset: 0, cantidadSecuencias: 2 },
  { id: "44", etiqueta: "E44", esperados: 2, tipoEncf: "44", inicioOffset: 0, cantidadSecuencias: 2 },
  { id: "45", etiqueta: "E45", esperados: 2, tipoEncf: "45", inicioOffset: 0, cantidadSecuencias: 2 },
  { id: "46", etiqueta: "E46", esperados: 2, tipoEncf: "46", inicioOffset: 0, cantidadSecuencias: 2 },
  { id: "47", etiqueta: "E47", esperados: 2, tipoEncf: "47", inicioOffset: 0, cantidadSecuencias: 2 },
  { id: "32_rfce", etiqueta: "E32 RFCE", esperados: 4, tipoEncf: "32", inicioOffset: 2, cantidadSecuencias: 4 },
] as const satisfies readonly {
  id: CategoriaSimulacionPaso4;
  etiqueta: string;
  esperados: number;
  tipoEncf: string;
  inicioOffset: number;
  cantidadSecuencias: number;
}[];

type CategoriaPaso4Metadata = (typeof CATEGORIAS_PASO4)[number];

const ORDEN_OFICIAL_PASO4 = [
  { id: "base", numero: "1º", texto: "18 comprobantes base (31, 32≥250k, 41, 43, 44, 45, 46, 47)" },
  { id: "notas", numero: "2º", texto: "3 notas (33, 34)" },
  { id: "rfce", numero: "3º", texto: "4 RFCE (<250k)" },
  { id: "portal", numero: "4º", texto: "Subir los 4 XML íntegros <250k en el portal DGII" },
] as const;

const DESCRIPCION_FASE: Record<FaseOrdenPaso4, string> = {
  1: "Comprobantes base",
  2: "Notas",
  3: "RFCE",
};

function ambienteParaApi(ambiente: AmbienteEcf): "testecf" | "certecf" {
  return ambiente === "certecf" ? "certecf" : "testecf";
}

function nombreAmbienteCorto(ambiente: "testecf" | "certecf"): string {
  return ambiente === "certecf" ? "CerteCF" : "TesteCF";
}

function formatearMonto(valor: number): string {
  return valor.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function estadoEsAceptado(estado: string): boolean {
  return estado.toLowerCase().includes("acept");
}

function estadoEsRechazado(estado: string): boolean {
  return estado.toLowerCase().includes("rechaz");
}

function BadgeEstadoDgii({ estado }: { estado: string }) {
  if (estadoEsAceptado(estado)) {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{estado.replaceAll("_", " ")}</Badge>;
  }
  if (estadoEsRechazado(estado) || estado.toLowerCase().includes("error")) {
    return <Badge variant="destructive">{estado.replaceAll("_", " ")}</Badge>;
  }
  return <Badge variant="secondary">{estado.replaceAll("_", " ")}</Badge>;
}

function descargarArchivo(nombreArchivo: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function descargarXml(nombreArchivo: string, xml: string) {
  descargarArchivo(nombreArchivo, xml, "text/xml;charset=utf-8");
}

function descargarJson(nombreArchivo: string, json: string) {
  descargarArchivo(nombreArchivo, json, "application/json;charset=utf-8");
}

function nombreArchivoEcfOficial(caso: ResultadoEnvioSimulacionPaso4Caso, rncEmisor: string): string {
  return caso.nombreArchivoEcf || `${rncEmisor}${caso.encf}.xml`;
}

function nombreArchivoRfceOficial(caso: ResultadoEnvioSimulacionPaso4Caso, rncEmisor: string): string {
  const base = nombreArchivoEcfOficial(caso, rncEmisor);
  return base.toLowerCase().endsWith(".xml") ? base.replace(/\.xml$/i, "-rfce.xml") : `${base}-rfce.xml`;
}

function errorSecuenciaBase(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === "") return "La secuencia base es obligatoria.";
  if (!/^\d+$/.test(limpio)) return "La secuencia base solo puede contener dígitos.";
  const numero = Number.parseInt(limpio, 10);
  if (numero < SECUENCIA_BASE_MINIMA || numero > SECUENCIA_BASE_MAXIMA) {
    return `La secuencia base debe estar entre ${SECUENCIA_BASE_MINIMA} y ${SECUENCIA_BASE_MAXIMA}.`;
  }
  return null;
}

function encfParaSecuencia(tipoEncf: string, secuencia: number): string {
  return `E${tipoEncf}${String(secuencia).padStart(10, "0")}`;
}

function rangoCategoriaPaso4(categoria: CategoriaPaso4Metadata, secuenciaBase: number): string {
  const inicio = secuenciaBase + categoria.inicioOffset;
  const fin = inicio + categoria.cantidadSecuencias - 1;
  const encfInicio = encfParaSecuencia(categoria.tipoEncf, inicio);
  if (inicio === fin) return encfInicio;
  return `${encfInicio}..${encfParaSecuencia(categoria.tipoEncf, fin)}`;
}

function textoFuenteCredenciales(fuente: NonNullable<ResumenEnvioSimulacionPaso4["fuenteCredenciales"]>): string {
  if (fuente === "formulario") return "archivo adjunto en esta ejecución";
  if (fuente === "base_datos") return "certificado .p12 cifrado guardado en ecf_config";
  return "variables PEM del servidor";
}

function esCasoEnvio(caso: CasoSimulacionPaso4): caso is ResultadoEnvioSimulacionPaso4Caso {
  return "trackId" in caso;
}

function casoCompletado(caso: CasoSimulacionPaso4): boolean {
  if (esCasoEnvio(caso)) return estadoEsAceptado(caso.estado);
  return caso.valido;
}

function textoSecuenciaUtilizada(secuenciaUtilizada: boolean | null): string {
  if (secuenciaUtilizada === null) return "secuencia no informada";
  if (secuenciaUtilizada) return "secuencia utilizada";
  return "secuencia no utilizada";
}

interface ParametrosEjecucionSimulacionPaso4 {
  modo: ModoEjecucionSimulacionPaso4;
  ambiente: "testecf" | "certecf";
  rncEmisor: string;
  razonSocial: string;
  direccionEmisor?: string | null;
  telefonoEmisor?: string | null;
  correoEmisor?: string | null;
  secuenciaBase: string;
  adjuntarCertificado: boolean;
  archivoCertificado: File | null;
  contrasenaCertificado: string;
}

function agregarCampoOpcional(form: FormData, nombre: string, valor: string | null | undefined) {
  if (typeof valor !== "string") return;
  const limpio = valor.trim();
  if (limpio !== "") form.append(nombre, limpio);
}

function construirFormularioSimulacion(params: ParametrosEjecucionSimulacionPaso4): FormData {
  const form = new FormData();
  form.append("modo", params.modo);
  form.append("ambiente", params.ambiente);
  form.append("rncEmisor", params.rncEmisor);
  form.append("razonSocial", params.razonSocial);
  agregarCampoOpcional(form, "direccionEmisor", params.direccionEmisor);
  agregarCampoOpcional(form, "telefonoEmisor", params.telefonoEmisor);
  agregarCampoOpcional(form, "correoEmisor", params.correoEmisor);
  form.append("secuenciaBase", params.secuenciaBase);
  if (
    params.modo === "enviar_dgii" &&
    params.adjuntarCertificado &&
    params.archivoCertificado !== null &&
    params.contrasenaCertificado.length > 0
  ) {
    form.append("certificadoP12", params.archivoCertificado);
    form.append("contrasenaP12", params.contrasenaCertificado);
  }
  return form;
}

function mensajeErrorEjecucionSimulacion(data: RespuestaEjecucionSimulacionApi): string {
  if ("error" in data && data.error) return data.error;
  return "La ejecución de las pruebas de simulación del Paso 4 no pudo completarse.";
}

async function ejecutarSimulacionPaso4Api(
  params: ParametrosEjecucionSimulacionPaso4,
): Promise<ResumenEjecucionSimulacionPaso4> {
  const response = await fetch("/api/ecf/pruebas/ejecutar-simulacion", {
    method: "POST",
    body: construirFormularioSimulacion(params),
  });
  const data = (await response.json()) as RespuestaEjecucionSimulacionApi;
  if (!response.ok || !data.ok) throw new Error(mensajeErrorEjecucionSimulacion(data));
  return data;
}

function BadgeAmbientePaso4({ ambiente }: { ambiente: AmbienteEcf }) {
  if (ambiente === "produccion") return <Badge variant="destructive">Producción bloqueada</Badge>;
  if (ambiente === "certecf") return <Badge variant="secondary">CerteCF</Badge>;
  return <Badge variant="secondary">TesteCF</Badge>;
}

function AlertaProduccionPaso4() {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
      <TriangleAlert />
      <AlertTitle>Producción bloqueada para las pruebas de simulación</AlertTitle>
      <AlertDescription>
        Cambia el ambiente superior a TesteCF o CerteCF para habilitar el envío real. La validación local sigue
        disponible porque no transmite comprobantes a la DGII.
      </AlertDescription>
    </Alert>
  );
}

function OrdenOficialPaso4() {
  return (
    <section className="border-primary/25 bg-secondary/35 rounded-xl border p-4">
      <div className="flex items-start gap-2">
        <ClipboardList className="text-primary mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Orden oficial de emisión DGII</p>
          <p className="text-muted-foreground mt-1 text-xs">
            El runner respeta las tres fases automáticas y separa el cuarto paso manual del portal.
          </p>
        </div>
      </div>
      <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {ORDEN_OFICIAL_PASO4.map((fase) => (
          <li key={fase.id} className="bg-background rounded-lg border p-3">
            <Badge variant="outline">{fase.numero}</Badge>
            <p className="mt-2 text-xs leading-5">{fase.texto}</p>
          </li>
        ))}
      </ol>
      <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
        <TriangleAlert />
        <AlertTitle>Aviso anti-reinicio</AlertTitle>
        <AlertDescription>
          En CerteCF un solo rechazo reinicia las pruebas y las secuencias enviadas no se reutilizan. Ensaya primero
          25/25 en TesteCF; ante cualquier rechazo en CerteCF el runner detiene el lote de inmediato.
        </AlertDescription>
      </Alert>
    </section>
  );
}

function BloqueSecuenciaBasePaso4({
  secuenciaBase,
  errorSecuencia,
  onSecuenciaBase,
}: {
  secuenciaBase: string;
  errorSecuencia: string | null;
  onSecuenciaBase: (valor: string) => void;
}) {
  const secuenciaValida = errorSecuencia === null;
  const numeroSecuencia = secuenciaValida ? Number.parseInt(secuenciaBase, 10) : null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-2">
        <Hash className="text-primary mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Secuencia base e-NCF</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Por defecto 1001 para no colisionar con secuencias del Paso 2; si DGII reinicia por un rechazo, sube la base
            p. ej. a 2001.
          </p>
        </div>
      </div>
      <div className="max-w-52">
        <Label htmlFor="secuencia-base-paso4">Secuencia base</Label>
        <Input
          id="secuencia-base-paso4"
          type="number"
          inputMode="numeric"
          min={SECUENCIA_BASE_MINIMA}
          max={SECUENCIA_BASE_MAXIMA}
          step={1}
          value={secuenciaBase}
          aria-invalid={!secuenciaValida}
          onChange={(evento) => onSecuenciaBase(evento.target.value)}
        />
      </div>
      {errorSecuencia ? <p className="text-destructive text-xs">{errorSecuencia}</p> : null}
      {numeroSecuencia !== null ? (
        <div className="bg-secondary/40 rounded-lg p-3">
          <p className="text-muted-foreground text-xs font-medium">Rangos que se emitirán con esta base</p>
          <div className="mt-2 grid gap-2 xl:grid-cols-2">
            {CATEGORIAS_PASO4.map((categoria) => (
              <div key={categoria.id} className="min-w-0">
                <p className="text-muted-foreground text-[11px]">{categoria.etiqueta}</p>
                <p className="font-mono text-[11px] break-all">{rangoCategoriaPaso4(categoria, numeroSecuencia)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BloqueCertificadoPaso4({
  adjuntarCertificado,
  certificadoDisponible,
  rncEmisor,
  onAdjuntarCertificado,
}: {
  adjuntarCertificado: boolean;
  certificadoDisponible: boolean;
  rncEmisor: string;
  onAdjuntarCertificado: (valor: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="adjuntar-certificado-simulacion-paso4"
          checked={adjuntarCertificado}
          onCheckedChange={(valor) => onAdjuntarCertificado(valor === true)}
          disabled={!certificadoDisponible}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="adjuntar-certificado-simulacion-paso4" className="leading-5">
            Usar el certificado .p12 y la contraseña seleccionados en el Paso 1
          </Label>
          <p className="text-muted-foreground text-xs">
            Opcional: si no lo adjuntas aquí, el servidor usa automáticamente el certificado .p12 cifrado guardado en
            ecf_config durante el Paso 1. Si no existe, intenta las variables PEM{" "}
            <span className="font-mono">{`ECF_CERT_PEM_${rncEmisor}`}</span> y{" "}
            <span className="font-mono">{`ECF_KEY_PEM_${rncEmisor}`}</span>.
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

function ConfirmacionEnvioPaso4({
  ambienteApi,
  confirmado,
  produccionBloqueada,
  onConfirmado,
}: {
  ambienteApi: "testecf" | "certecf";
  confirmado: boolean;
  produccionBloqueada: boolean;
  onConfirmado: (valor: boolean) => void;
}) {
  return (
    <div className="border-primary/25 bg-secondary/35 flex items-start gap-3 rounded-xl border p-4">
      <Checkbox
        id="confirmar-envio-simulacion-paso4"
        checked={confirmado}
        onCheckedChange={(valor) => onConfirmado(valor === true)}
        disabled={produccionBloqueada}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor="confirmar-envio-simulacion-paso4" className="leading-5">
          Confirmo el envío real de los 25 casos a {nombreAmbienteCorto(ambienteApi)}
        </Label>
        <p className="text-muted-foreground text-xs">
          Se firmarán y transmitirán comprobantes electrónicos de prueba al ambiente seleccionado usando el certificado
          .p12 cifrado guardado en ecf_config o el certificado adjunto en memoria.
        </p>
      </div>
    </div>
  );
}

function BotonesEjecucionPaso4({
  ambienteApi,
  confirmado,
  ejecutando,
  produccionBloqueada,
  secuenciaValida,
  onEjecutar,
}: {
  ambienteApi: "testecf" | "certecf";
  confirmado: boolean;
  ejecutando: ModoEjecucionSimulacionPaso4 | null;
  produccionBloqueada: boolean;
  secuenciaValida: boolean;
  onEjecutar: (modo: ModoEjecucionSimulacionPaso4) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={ejecutando !== null || !secuenciaValida}
        onClick={() => onEjecutar("validar_local")}
      >
        {ejecutando === "validar_local" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        Validar 25 casos localmente (XSD)
      </Button>
      <Button
        type="button"
        disabled={ejecutando !== null || !confirmado || produccionBloqueada || !secuenciaValida}
        onClick={() => onEjecutar("enviar_dgii")}
      >
        {ejecutando === "enviar_dgii" ? <Loader2 className="animate-spin" /> : <Send />}
        Ejecutar Paso 4 en {nombreAmbienteCorto(ambienteApi)}
      </Button>
    </div>
  );
}

function PanelContadoresPaso4({ casos, criterio }: { casos: readonly CasoSimulacionPaso4[]; criterio: string }) {
  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold">Contadores DGII (11 categorías)</p>
        <p className="text-muted-foreground text-xs">Progreso contado como {criterio} por categoría oficial.</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORIAS_PASO4.map((categoria) => {
          const completados = casos.filter((caso) => caso.categoria === categoria.id && casoCompletado(caso)).length;
          const completo = completados === categoria.esperados;
          return (
            <div
              key={categoria.id}
              className={cn(
                "flex min-h-14 items-center justify-between gap-2 rounded-lg border px-3 py-2",
                completo ? "border-primary/40 bg-secondary/45" : "bg-background",
              )}
            >
              <Badge variant={completo ? "default" : "outline"}>
                {completados}/{categoria.esperados} {categoria.etiqueta}
              </Badge>
              {completo ? <CheckCircle2 className="text-primary size-4 shrink-0" /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AlertaDetenidoPorRechazo({ resumen }: { resumen: ResumenEnvioSimulacionPaso4 }) {
  const casoRechazado = resumen.casos.find((caso) => estadoEsRechazado(caso.estado));
  const encfRechazado = casoRechazado ? casoRechazado.encf : "no identificado en la respuesta";
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Lote detenido por rechazo de la DGII</AlertTitle>
      <AlertDescription>
        El e-NCF <span className="font-mono font-semibold">{encfRechazado}</span> fue rechazado y el runner detuvo el
        lote de inmediato para evitar un reinicio mayor. Corrige la causa, incrementa la secuencia base antes de
        reintentar y no reutilices las secuencias ya enviadas.
      </AlertDescription>
    </Alert>
  );
}

interface ArchivoRfcePaso4 {
  nombreArchivo: string;
  xml: string;
  encf: string;
  codigoSeguridad: string | null;
  montoTotal: number;
  numeroCaso: number;
}

function archivosRfcePaso4(casos: readonly ResultadoEnvioSimulacionPaso4Caso[], rncEmisor: string): ArchivoRfcePaso4[] {
  const archivos: ArchivoRfcePaso4[] = [];
  for (const caso of casos) {
    if (!caso.esRfce || !caso.xmlFirmado) continue;
    archivos.push({
      nombreArchivo: nombreArchivoEcfOficial(caso, rncEmisor),
      xml: caso.xmlFirmado,
      encf: caso.encf,
      codigoSeguridad: caso.codigoSeguridad,
      montoTotal: caso.montoTotal,
      numeroCaso: caso.numeroCaso,
    });
  }
  return archivos;
}

function BloqueCuartoPasoDgii({ archivos }: { archivos: readonly ArchivoRfcePaso4[] }) {
  if (archivos.length === 0) return null;
  return (
    <section className="border-primary/30 bg-secondary/40 rounded-xl border p-4">
      <div className="flex items-start gap-2">
        <FileText className="text-primary mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-primary text-sm font-semibold">
            Cuarto paso DGII — 4 XML íntegros de Facturas de Consumo &lt; RD$250,000
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Descarga cada archivo y súbelo en la caja inferior del portal DGII. Se recomienda descargarlos uno a uno
            (ERR-010) para evitar que Chrome bloquee descargas múltiples.
          </p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 xl:grid-cols-2">
        {archivos.map((archivo) => (
          <li
            key={archivo.encf}
            className="bg-background flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold break-all">{archivo.nombreArchivo}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Caso {archivo.numeroCaso} · {archivo.encf} · Código seguridad{" "}
                <span className="font-mono">{archivo.codigoSeguridad ?? "—"}</span> · RD${" "}
                {formatearMonto(archivo.montoTotal)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => descargarXml(archivo.nombreArchivo, archivo.xml)}
            >
              <Download />
              Descargar XML
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function construirManifiestoPaso5(resumen: ResumenEnvioSimulacionPaso4) {
  return {
    generadoEn: new Date().toISOString(),
    ambiente: resumen.ambiente,
    rncEmisor: resumen.rncEmisor,
    secuenciaBase: resumen.secuenciaBase,
    totalCasos: resumen.totalCasos,
    casos: resumen.casos.map((caso) => ({
      numeroCaso: caso.numeroCaso,
      faseOrden: caso.faseOrden,
      categoria: caso.categoria,
      encf: caso.encf,
      tipo: caso.tipo,
      montoTotal: caso.montoTotal,
      codigoSeguridad: caso.codigoSeguridad,
      fechaHoraFirma: caso.fechaHoraFirma,
      urlQr: caso.urlQr,
      trackId: caso.trackId,
    })),
  };
}

function descargarManifiestoPaso5(resumen: ResumenEnvioSimulacionPaso4) {
  const nombreArchivo = `paso5-respaldo-simulacion-${resumen.rncEmisor}-${resumen.ambiente}-${resumen.secuenciaBase}.json`;
  descargarJson(nombreArchivo, JSON.stringify(construirManifiestoPaso5(resumen), null, 2));
}

function BloqueRespaldoPaso5({ resumen }: { resumen: ResumenEnvioSimulacionPaso4 }) {
  const aceptadosConXml = resumen.casos.filter((caso) => estadoEsAceptado(caso.estado) && caso.xmlFirmado).length;
  if (aceptadosConXml === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-2">
        <FileText className="text-primary mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Respaldo para Paso 5 (Representación Impresa PDF + QR)</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Descarga el manifiesto JSON de los 25 casos con e-NCF, tipo, monto, código de seguridad, fecha/hora de
            firma, URL QR y TrackId. No contiene certificados, contraseñas ni XML completos.
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" className="shrink-0" onClick={() => descargarManifiestoPaso5(resumen)}>
        <Download />
        Descargar manifiesto JSON
      </Button>
    </section>
  );
}

function BotonesXmlSimulacion({ caso, rncEmisor }: { caso: ResultadoEnvioSimulacionPaso4Caso; rncEmisor: string }) {
  return (
    <div className="flex flex-col gap-1">
      {caso.xmlFirmado ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => descargarXml(nombreArchivoEcfOficial(caso, rncEmisor), caso.xmlFirmado ?? "")}
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
          onClick={() => descargarXml(nombreArchivoRfceOficial(caso, rncEmisor), caso.xmlRfce ?? "")}
        >
          <Download />
          XML RFCE
        </Button>
      ) : null}
      {!caso.xmlFirmado && !caso.xmlRfce ? <span className="text-muted-foreground text-xs">—</span> : null}
    </div>
  );
}

function CeldaEstadoCaso({ caso }: { caso: CasoSimulacionPaso4 }) {
  if (!esCasoEnvio(caso)) {
    return (
      <div className="flex min-w-32 flex-col gap-1">
        {caso.valido ? (
          <Badge className="w-fit bg-emerald-600 text-white hover:bg-emerald-600">Válido XSD</Badge>
        ) : (
          <Badge variant="destructive" className="w-fit">
            Con errores
          </Badge>
        )}
        <span className="text-muted-foreground text-xs">{caso.errores.length} errores locales</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <BadgeEstadoDgii estado={caso.estado} />
        {caso.reutilizado ? <Badge variant="outline">reutilizado</Badge> : null}
      </div>
      <span className="text-muted-foreground text-xs">
        {caso.duracionMs} ms · {caso.persistido ? "trazabilidad guardada" : "sin trazabilidad local"}
      </span>
      <span className="text-muted-foreground text-xs">{textoSecuenciaUtilizada(caso.secuenciaUtilizada)}</span>
    </div>
  );
}

function CeldaTrackSeguridadCaso({ caso }: { caso: CasoSimulacionPaso4 }) {
  if (!esCasoEnvio(caso)) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <span className="font-mono text-xs break-all">{caso.trackId ?? "—"}</span>
      <span className="text-muted-foreground text-xs">
        Cód. Seg. <span className="font-mono">{caso.codigoSeguridad ?? "—"}</span>
      </span>
    </div>
  );
}

function mensajesCasoEnvio(caso: ResultadoEnvioSimulacionPaso4Caso): string[] {
  if (!caso.errorPersistencia) return caso.mensajes;
  return [...caso.mensajes, `Trazabilidad local: ${caso.errorPersistencia}`];
}

function CeldaMensajesCaso({ caso }: { caso: CasoSimulacionPaso4 }) {
  if (!esCasoEnvio(caso)) {
    if (caso.errores.length === 0)
      return <span className="text-muted-foreground text-xs">Sin errores XSD/estructurales</span>;
    return (
      <ul className="text-destructive flex list-disc flex-col gap-1 pl-4 text-xs">
        {caso.errores.map((error) => (
          <li key={`${caso.encf}-${error}`}>{error}</li>
        ))}
      </ul>
    );
  }
  const mensajes = mensajesCasoEnvio(caso);
  return (
    <div className="max-w-md">
      {mensajes.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
          {mensajes.map((mensaje) => (
            <li key={`${caso.encf}-${mensaje}`}>{mensaje}</li>
          ))}
        </ul>
      ) : (
        <span className="text-muted-foreground text-xs">Sin mensajes de la DGII</span>
      )}
      {caso.fechaHoraFirma ? <p className="text-muted-foreground mt-1 text-xs">Firma: {caso.fechaHoraFirma}</p> : null}
      {caso.urlQr ? <p className="text-muted-foreground mt-1 font-mono text-[10px] break-all">{caso.urlQr}</p> : null}
    </div>
  );
}

function FilaCasoSimulacion({ caso, rncEmisor }: { caso: CasoSimulacionPaso4; rncEmisor: string }) {
  const envio = esCasoEnvio(caso);
  return (
    <TableRow key={`${caso.numeroCaso}-${caso.encf}`}>
      <TableCell className="font-mono text-xs whitespace-nowrap">{caso.numeroCaso}</TableCell>
      <TableCell className="whitespace-normal">
        <span className="block font-medium">Fase {caso.faseOrden}</span>
        <span className="text-muted-foreground text-xs">{DESCRIPCION_FASE[caso.faseOrden]}</span>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex min-w-40 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary">E{caso.tipo}</Badge>
            {caso.esRfce ? <Badge variant="outline">RFCE</Badge> : null}
          </div>
          <span className="font-mono text-xs font-semibold">{caso.encf}</span>
          {caso.ncfModificado ? (
            <span className="text-muted-foreground text-xs">
              Modifica <span className="font-mono">{caso.ncfModificado}</span>
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="max-w-72 whitespace-normal">
        <span className="text-xs leading-5">{caso.descripcion}</span>
      </TableCell>
      <TableCell className="text-right font-mono text-xs whitespace-nowrap">
        RD$ {formatearMonto(caso.montoTotal)}
      </TableCell>
      <TableCell>
        <CeldaEstadoCaso caso={caso} />
      </TableCell>
      <TableCell>
        <CeldaTrackSeguridadCaso caso={caso} />
      </TableCell>
      <TableCell className="whitespace-normal">
        <CeldaMensajesCaso caso={caso} />
      </TableCell>
      <TableCell>
        {envio ? (
          <BotonesXmlSimulacion caso={caso} rncEmisor={rncEmisor} />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function TablaCasosSimulacionPaso4({ casos, rncEmisor }: { casos: readonly CasoSimulacionPaso4[]; rncEmisor: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Tipo / e-NCF</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>TrackId / Cód. Seg.</TableHead>
            <TableHead>Mensajes</TableHead>
            <TableHead>XML</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((caso) => (
            <FilaCasoSimulacion key={`${caso.numeroCaso}-${caso.encf}`} caso={caso} rncEmisor={rncEmisor} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ResumenValidacionPaso4Local({ resumen }: { resumen: ResumenValidacionSimulacionPaso4 }) {
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
          Validación local completada: {resumen.validos}/{resumen.totalCasos} casos válidos
        </AlertTitle>
        <AlertDescription>
          No se transmitió ningún comprobante a la DGII. Revisa los errores XSD/estructurales antes del envío real.
        </AlertDescription>
      </Alert>
      {resumen.erroresGlobales.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Errores globales de la simulación</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {resumen.erroresGlobales.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <PanelContadoresPaso4 casos={resumen.casos} criterio="válidos XSD" />
      <TablaCasosSimulacionPaso4 casos={resumen.casos} rncEmisor={resumen.rncEmisor} />
    </>
  );
}

function ResumenEnvioPaso4Real({ resumen }: { resumen: ResumenEnvioSimulacionPaso4 }) {
  return (
    <>
      {resumen.detenidoPorRechazo ? <AlertaDetenidoPorRechazo resumen={resumen} /> : null}
      <Alert className="border-primary/25 bg-secondary/45">
        <CheckCircle2 />
        <AlertTitle>
          Ejecución Paso 4 finalizada: {resumen.aceptados}/{resumen.totalCasos} aceptados · {resumen.rechazados}{" "}
          rechazados · {resumen.errores} errores · {resumen.enProceso} en proceso · {resumen.reutilizados} reutilizados
        </AlertTitle>
        <AlertDescription>
          Ambiente {resumen.ambiente === "certecf" ? "CerteCF" : "TesteCF"} · secuencia base {resumen.secuenciaBase}. La
          trazabilidad local se guardó cuando la base lo permitió.
          {resumen.fuenteCredenciales ? (
            <span className="block">Certificado usado: {textoFuenteCredenciales(resumen.fuenteCredenciales)}.</span>
          ) : null}
        </AlertDescription>
      </Alert>
      <PanelContadoresPaso4 casos={resumen.casos} criterio="aceptados DGII" />
      <BloqueCuartoPasoDgii archivos={archivosRfcePaso4(resumen.casos, resumen.rncEmisor)} />
      <BloqueRespaldoPaso5 resumen={resumen} />
      <TablaCasosSimulacionPaso4 casos={resumen.casos} rncEmisor={resumen.rncEmisor} />
    </>
  );
}

export function SetSimulacionPaso4({
  rncEmisor,
  razonSocial,
  direccionEmisor,
  telefonoEmisor,
  correoEmisor,
  ambiente,
  archivoCertificado,
  contrasenaCertificado,
}: SetSimulacionPaso4Props) {
  const claveContexto = `${ambiente}:${rncEmisor}`;
  const [secuenciaBase, setSecuenciaBase] = useState(SECUENCIA_BASE_DEFECTO);
  const [confirmacion, setConfirmacion] = useState<{ claveContexto: string; valor: boolean }>({
    claveContexto,
    valor: false,
  });
  const [adjuntarCertificado, setAdjuntarCertificado] = useState(true);
  const [ejecutando, setEjecutando] = useState<ModoEjecucionSimulacionPaso4 | null>(null);
  const [resumen, setResumen] = useState<ResumenEjecucionSimulacionPaso4 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const produccionBloqueada = ambiente === "produccion";
  const ambienteApi = ambienteParaApi(ambiente);
  const certificadoDisponible = Boolean(archivoCertificado && contrasenaCertificado.length > 0);
  const errorSecuencia = errorSecuenciaBase(secuenciaBase);
  const secuenciaValida = errorSecuencia === null;
  const confirmado = confirmacion.claveContexto === claveContexto && confirmacion.valor;

  function manejarConfirmado(valor: boolean) {
    setConfirmacion({ claveContexto, valor });
  }

  function manejarSecuenciaBase(valor: string) {
    setSecuenciaBase(valor);
    setResumen(null);
    setError(null);
  }

  async function ejecutar(modo: ModoEjecucionSimulacionPaso4) {
    if (!secuenciaValida) {
      setError(errorSecuencia ?? "La secuencia base no es válida.");
      return;
    }
    if (modo === "enviar_dgii" && produccionBloqueada) {
      setError("El envío real del Paso 4 está bloqueado en Producción.");
      return;
    }
    if (modo === "enviar_dgii" && !confirmado) {
      setError(`Confirma explícitamente el envío real a ${nombreAmbienteCorto(ambienteApi)} antes de ejecutar.`);
      return;
    }
    setError(null);
    setEjecutando(modo);
    try {
      const data = await ejecutarSimulacionPaso4Api({
        modo,
        ambiente: ambienteApi,
        rncEmisor,
        razonSocial,
        direccionEmisor,
        telefonoEmisor,
        correoEmisor,
        secuenciaBase,
        adjuntarCertificado,
        archivoCertificado,
        contrasenaCertificado,
      });
      setResumen(data);
    } catch (errorCapturado) {
      setResumen(null);
      setError(
        errorCapturado instanceof Error
          ? errorCapturado.message
          : "La ejecución de las pruebas de simulación del Paso 4 no pudo completarse.",
      );
    } finally {
      setEjecutando(null);
    }
  }

  function ejecutarEnSegundoPlano(modo: ModoEjecucionSimulacionPaso4) {
    void ejecutar(modo);
  }

  return (
    <Card size="sm" className="border-primary/20">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-primary size-5" />
            <CardTitle>Pruebas de Simulación e-CF</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Paso 4 DGII · 25 casos</Badge>
            <BadgeAmbientePaso4 ambiente={ambiente} />
          </div>
        </div>
        <CardDescription>
          Genera los 25 casos oficiales en cuatro fases, valida sus XML localmente o ejecútalos firmados contra{" "}
          {nombreAmbienteCorto(ambienteApi)} para {razonSocial} (RNC {rncEmisor}).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert className="border-primary/25 bg-secondary/45">
          <Info />
          <AlertTitle>Candado de seguridad</AlertTitle>
          <AlertDescription>
            Este runner nunca apunta a Producción (ecf). Solo puede validar localmente o ejecutar contra TesteCF o
            CerteCF.
          </AlertDescription>
        </Alert>

        {produccionBloqueada ? <AlertaProduccionPaso4 /> : null}

        <OrdenOficialPaso4 />

        <div className="grid gap-4 xl:grid-cols-2">
          <BloqueSecuenciaBasePaso4
            secuenciaBase={secuenciaBase}
            errorSecuencia={errorSecuencia}
            onSecuenciaBase={manejarSecuenciaBase}
          />
          <BloqueCertificadoPaso4
            adjuntarCertificado={adjuntarCertificado}
            certificadoDisponible={certificadoDisponible}
            rncEmisor={rncEmisor}
            onAdjuntarCertificado={setAdjuntarCertificado}
          />
        </div>

        <ConfirmacionEnvioPaso4
          ambienteApi={ambienteApi}
          confirmado={confirmado}
          produccionBloqueada={produccionBloqueada}
          onConfirmado={manejarConfirmado}
        />

        <BotonesEjecucionPaso4
          ambienteApi={ambienteApi}
          confirmado={confirmado}
          ejecutando={ejecutando}
          produccionBloqueada={produccionBloqueada}
          secuenciaValida={secuenciaValida}
          onEjecutar={ejecutarEnSegundoPlano}
        />

        {error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>No se pudo ejecutar la simulación del Paso 4</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {resumen?.modo === "validar_local" ? <ResumenValidacionPaso4Local resumen={resumen} /> : null}
        {resumen?.modo === "enviar_dgii" ? <ResumenEnvioPaso4Real resumen={resumen} /> : null}
      </CardContent>
    </Card>
  );
}
