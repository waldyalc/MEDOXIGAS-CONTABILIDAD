"use client";

import { type ChangeEvent, useState } from "react";

import { CheckCircle2, FileText, ShieldCheck, TriangleAlert, Upload } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FirmarXmlPostulacionProps {
  rncEmisor: string;
  tieneCertificadoGuardado: boolean;
  archivoCertificadoLocal: File | null;
  contrasenaLocal: string;
}

function nombreDesdeDisposition(header: string | null, original: string): string {
  const match = header?.match(/filename="([^"]+)"/i);
  if (match?.[1]) return match[1];
  return `${original.replace(/\.xml$/i, "")}-firmado.xml`;
}

async function leerMensajeErrorRespuesta(response: Response): Promise<string> {
  const texto = await response.text();
  try {
    const parsed = JSON.parse(texto) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    if (texto.trim() !== "") return texto;
  }
  return "No se pudo firmar el archivo XML.";
}

function descargarBlob(blob: Blob, nombreSalida: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreSalida;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export function FirmarXmlPostulacion({
  rncEmisor,
  tieneCertificadoGuardado,
  archivoCertificadoLocal,
  contrasenaLocal,
}: FirmarXmlPostulacionProps) {
  const [archivoXml, setArchivoXml] = useState<File | null>(null);
  const [firmando, setFirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descargado, setDescargado] = useState<string | null>(null);

  const nombreXml = archivoXml?.name.trim() ?? "";
  const xmlValido = nombreXml !== "" && nombreXml.toLowerCase().endsWith(".xml");
  const tieneCertificadoLocal = Boolean(archivoCertificadoLocal) && contrasenaLocal.length > 0;
  const puedeFirmar = xmlValido && rncEmisor !== "" && (tieneCertificadoGuardado || tieneCertificadoLocal) && !firmando;

  function manejarCambioXml(evento: ChangeEvent<HTMLInputElement>) {
    setArchivoXml(evento.target.files?.[0] ?? null);
    setError(null);
    setDescargado(null);
  }

  async function manejarFirmar() {
    if (!archivoXml) return;
    setError(null);
    setDescargado(null);
    setFirmando(true);
    try {
      const form = new FormData();
      form.append("rnc", rncEmisor);
      form.append("archivoXml", archivoXml);
      if (!tieneCertificadoGuardado && archivoCertificadoLocal && contrasenaLocal.length > 0) {
        form.append("certificadoP12", archivoCertificadoLocal);
        form.append("contrasenaP12", contrasenaLocal);
      }

      const response = await fetch("/api/ecf/config/firmar-xml", { method: "POST", body: form });
      if (!response.ok) throw new Error(await leerMensajeErrorRespuesta(response));

      const blob = await response.blob();
      const nombreSalida = nombreDesdeDisposition(response.headers.get("Content-Disposition"), archivoXml.name);
      descargarBlob(blob, nombreSalida);
      setDescargado(nombreSalida);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo firmar el archivo XML.");
    } finally {
      setFirmando(false);
    }
  }

  return (
    <Card size="sm" className="xl:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="text-primary size-5" />
            <div>
              <CardTitle>Firmar XML de postulación DGII</CardTitle>
              <CardDescription>
                Sube el XML sin firmar que descargaste del portal de certificación (ej. 202611275421801.xml) para
                firmarlo con tu certificado digital y subirlo en «Envío de archivo de postulación firmado».
              </CardDescription>
            </div>
          </div>
          <Badge variant={tieneCertificadoGuardado ? "secondary" : "outline"}>
            {tieneCertificadoGuardado ? "Usa .p12 guardado" : "Requiere .p12"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>No se pudo firmar el XML</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {descargado ? (
          <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
            <CheckCircle2 />
            <AlertTitle>XML firmado y descargado</AlertTitle>
            <AlertDescription>
              Se descargó <span className="font-mono font-medium">{descargado}</span>. Súbelo ahora en la DGII en «Envío
              de archivo de postulación firmado → ENVIAR ARCHIVO».
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Input
              key={`xml-postulacion-${rncEmisor}`}
              id="xml-postulacion-dgii"
              type="file"
              accept=".xml"
              className="sr-only"
              onChange={manejarCambioXml}
            />
            <Label
              htmlFor="xml-postulacion-dgii"
              className="border-border hover:border-primary/50 hover:bg-secondary/45 flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors"
            >
              <span className="flex items-center gap-2.5 text-sm font-medium">
                <Upload className="text-primary size-4 shrink-0" />
                {nombreXml !== "" ? nombreXml : "Seleccionar XML de postulación (.xml)"}
              </span>
              <span className="text-muted-foreground text-xs">XMLDSig RSA-SHA256</span>
            </Label>
          </div>
          <Button type="button" onClick={manejarFirmar} disabled={!puedeFirmar}>
            <ShieldCheck />
            {firmando ? "Firmando XML…" : "Firmar y descargar XML"}
          </Button>
        </div>

        {!tieneCertificadoGuardado && !tieneCertificadoLocal ? (
          <p className="text-muted-foreground text-xs">
            Primero guarda tu certificado .p12 arriba (o selecciónalo junto con su contraseña) para habilitar la firma.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
