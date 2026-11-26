"use client";

import { type ChangeEvent, useState } from "react";

import Link from "next/link";

import { cn } from "cn";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Hash,
  Info,
  Lock,
  Pencil,
  Printer,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Users,
} from "@/components/icons";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  type AmbienteEcf,
  CASOS_PRUEBA_DGII,
  CHECKLIST_MIGRACION_ALEGRA,
  calcularProgresoHabilitacion,
  calcularSiguienteDesdeEncf,
  DOMINIO_BASE_ECF_DEFECTO,
  type EmisorEcf,
  type EstadoPasoHabilitacion,
  ETIQUETA_AMBIENTE,
  ETIQUETA_ESTADO_PASO,
  esTipoEncf,
  type ModalidadHabilitacion,
  type NumeracionEcf,
  nombreCertificadoDigitalValido,
  PASOS_HABILITACION,
  type PasoHabilitacion,
  type PasoHabilitacionId,
  urlsServiciosEcf,
} from "./pasos-habilitacion";

const AMBIENTES: readonly AmbienteEcf[] = ["testecf", "certecf", "produccion"];

const MUESTRA_IMPRESION = {
  encf: "E310000000001",
  codigoSeguridad: "A1B2C3",
  fechaFirma: "26/11/2026 10:30 a. m.",
  vigencia: "31/12/2026",
  urlQr: "https://ecf.dgii.gov.do/ecf/ConsultaTimbre?rnc=000000000&encf=E310000000001",
} as const;

interface PortalEcfClienteProps {
  empresa: EmisorEcf | null;
  numeraciones: readonly NumeracionEcf[];
  onEjecutarPruebas?: () => void | Promise<void>;
}

function textoOGuion(valor: string | null): string {
  const limpio = valor?.trim() ?? "";
  return limpio === "" ? "Sin configurar" : limpio;
}

function OpcionSegmentada({
  activa,
  children,
  className,
  onClick,
}: {
  activa: boolean;
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors outline-none focus-visible:ring-3",
        activa
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function TarjetaEstado({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card size="sm" className="min-h-[124px]">
      <CardContent className="flex h-full flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</span>
        {children}
      </CardContent>
    </Card>
  );
}

function clasesPuntoEstado(estado: EstadoPasoHabilitacion): string {
  if (estado === "finalizado") return "border-primary bg-primary text-primary-foreground";
  if (estado === "en-proceso") return "border-primary bg-primary/15 text-primary";
  return "border-muted-foreground/35 bg-background text-muted-foreground";
}

function IconoEstadoPaso({ estado }: { estado: EstadoPasoHabilitacion }) {
  if (estado === "finalizado") return <Check className="size-3" stroke={2.5} />;
  if (estado === "en-proceso") return <Clock className="size-3" />;
  return <span className="size-1.5 rounded-full bg-current" />;
}

function ListaPasos({
  modalidad,
  pasoActivo,
  onSeleccionar,
}: {
  modalidad: ModalidadHabilitacion;
  pasoActivo: PasoHabilitacionId;
  onSeleccionar: (paso: PasoHabilitacionId) => void;
}) {
  const titulo = modalidad === "migracion" ? "Pasos para migrar a Desarrollo Propio" : "Pasos de la habilitación";

  return (
    <aside className="border-border bg-muted/25 border-b lg:border-r lg:border-b-0">
      <div className="border-border border-b px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
        <p className="text-muted-foreground mt-1 text-xs">Toca un paso para revisar lo que falta.</p>
      </div>
      <ol className="relative flex flex-col gap-1 px-4 py-4">
        {PASOS_HABILITACION.map((paso, indice) => {
          const estadoBase = paso.estados[modalidad];
          const activo = paso.id === pasoActivo;
          const estado = activo && estadoBase === "pendiente" ? "en-proceso" : estadoBase;

          return (
            <li key={paso.id} className="relative">
              {indice < PASOS_HABILITACION.length - 1 ? (
                <span aria-hidden="true" className="bg-border absolute top-[29px] bottom-[-5px] left-[15px] w-px" />
              ) : null}
              <button
                type="button"
                onClick={() => onSeleccionar(paso.id)}
                aria-current={activo ? "step" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 relative z-10 flex w-full items-start gap-3 rounded-xl border border-transparent px-2 py-2.5 text-left transition-colors outline-none focus-visible:ring-3",
                  activo ? "border-primary/20 bg-secondary/70" : "hover:bg-muted/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    clasesPuntoEstado(estado),
                  )}
                >
                  <IconoEstadoPaso estado={estado} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm leading-5 font-medium">
                      {paso.numero}. {paso.titulo}
                    </span>
                    <ChevronRight
                      className={cn(
                        "text-muted-foreground mt-1 size-4 shrink-0 transition-transform",
                        activo && "rotate-90",
                      )}
                    />
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">{ETIQUETA_ESTADO_PASO[estado]}</span>
                  {activo ? (
                    <span className="border-border mt-2 flex flex-col gap-1 border-l pl-3">
                      {paso.subpasos.map((subpaso) => (
                        <span
                          key={subpaso}
                          className={cn("text-xs", indice === 0 ? "text-foreground" : "text-muted-foreground")}
                        >
                          {subpaso}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function EncabezadoPaso({ paso, modalidad }: { paso: PasoHabilitacion; modalidad: ModalidadHabilitacion }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Paso {paso.numero} de 6</Badge>
        <Badge variant="outline">{modalidad === "migracion" ? "Migración desde Alegra" : "Primera habilitación"}</Badge>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{paso.titulo}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{paso.resumen}</p>
      </div>
    </div>
  );
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[150px_1fr] sm:gap-3">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{etiqueta}</dt>
      <dd className="text-sm font-medium">{textoOGuion(valor)}</dd>
    </div>
  );
}

function PasoCertificado({
  empresa,
  modalidad,
  nombreCertificado,
  contrasena,
  onCertificado,
  onContrasena,
}: {
  empresa: EmisorEcf | null;
  modalidad: ModalidadHabilitacion;
  nombreCertificado: string;
  contrasena: string;
  onCertificado: (nombre: string) => void;
  onContrasena: (valor: string) => void;
}) {
  const nombreLimpio = nombreCertificado.trim();
  const certificadoValido = nombreLimpio !== "" && nombreCertificadoDigitalValido(nombreLimpio);
  const certificadoInvalido = nombreLimpio !== "" && !certificadoValido;

  function manejarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    onCertificado(archivo?.name ?? "");
  }

  return (
    <div className="flex flex-col gap-5">
      {modalidad === "migracion" ? (
        <Alert className="border-primary/25 bg-secondary/55">
          <ShieldCheck />
          <AlertTitle>Tu certificado actual sirve</AlertTitle>
          <AlertDescription>
            Tu certificado digital pertenece a tu RNC, no a Alegra. No necesitas comprar otro mientras siga vigente.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="text-primary size-5" />
              <CardTitle>Datos fiscales del emisor</CardTitle>
            </div>
            <CardDescription>Deben coincidir exactamente con la DGII y la OFV.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-border divide-y">
              <FilaDato etiqueta="RNC" valor={empresa?.rnc ?? null} />
              <FilaDato etiqueta="Razón social" valor={empresa?.nombre ?? null} />
              <FilaDato etiqueta="Dirección" valor={empresa?.direccion ?? null} />
              <FilaDato etiqueta="Teléfono" valor={empresa?.telefono ?? null} />
              <FilaDato etiqueta="Correo" valor={empresa?.correo ?? null} />
            </dl>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboard/configuracion/empresa" prefetch={false} />}
            >
              <Pencil />
              Editar datos de empresa
            </Button>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="text-primary size-5" />
              <CardTitle>Certificado digital</CardTitle>
            </div>
            <CardDescription>
              Preparación local del archivo .p12 o .pfx; todavía no se sube al servidor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Input
                id="certificado-digital"
                type="file"
                accept=".p12,.pfx"
                className="sr-only"
                onChange={manejarArchivo}
              />
              <Label
                htmlFor="certificado-digital"
                className="border-border hover:border-primary/50 hover:bg-secondary/45 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center transition-colors"
              >
                <Upload className="text-primary size-6" />
                <span className="text-sm font-medium">Seleccionar certificado .p12 o .pfx</span>
                <span className="text-muted-foreground text-xs">
                  Solo se valida el nombre y la extensión en esta fase.
                </span>
              </Label>
              {nombreLimpio !== "" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={certificadoValido ? "secondary" : "destructive"}>{nombreLimpio}</Badge>
                  {certificadoValido ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Extensión válida</span>
                  ) : null}
                </div>
              ) : null}
              {certificadoInvalido ? (
                <p className="text-destructive mt-2 text-xs">El certificado debe terminar en .p12 o .pfx.</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="contrasena-certificado">Contraseña del certificado</Label>
              <Input
                id="contrasena-certificado"
                type="password"
                autoComplete="off"
                value={contrasena}
                onChange={(evento) => onContrasena(evento.target.value)}
                placeholder="Contraseña del certificado"
              />
            </div>

            <Alert>
              <Lock />
              <AlertTitle>Aviso de seguridad</AlertTitle>
              <AlertDescription>
                El archivo no se guarda en el navegador. Cuando se active el almacenamiento, se cifrará con AES-256-GCM
                en el servidor y la contraseña nunca se mostrará ni se registrará en logs.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <Card size="sm" className="bg-muted/30">
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="font-medium">1. Semilla</p>
            <p className="text-muted-foreground text-xs">La DGII entrega una semilla XML para iniciar sesión.</p>
          </div>
          <div>
            <p className="font-medium">2. Firma y token</p>
            <p className="text-muted-foreground text-xs">
              El certificado firma la semilla y la DGII devuelve un token temporal.
            </p>
          </div>
          <div>
            <p className="font-medium">3. Postulación OFV</p>
            <p className="text-muted-foreground text-xs">
              El representante legal postula el Desarrollo Propio en la Oficina Virtual.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PasoPruebas({
  preparado,
  ejecutando,
  error,
  onEjecutar,
}: {
  preparado: boolean;
  ejecutando: boolean;
  error: string | null;
  onEjecutar: () => void;
}) {
  let textoBoton = "Preparar set de pruebas";
  if (ejecutando) textoBoton = "Preparando…";
  else if (preparado) textoBoton = "Volver a preparar";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-sm font-medium">Los 9 casos oficiales quedan listos para conectarse al motor e-CF.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Esta pantalla prepara la vista y la estructura; no envía comprobantes a la DGII hasta conectar la Server
            Action del motor.
          </p>
        </div>
        <Button type="button" onClick={onEjecutar} disabled={ejecutando}>
          <FileText />
          {textoBoton}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo preparar el set</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caso</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CASOS_PRUEBA_DGII.map((caso) => (
              <TableRow key={caso.id}>
                <TableCell className="font-medium whitespace-nowrap">{caso.tipo}</TableCell>
                <TableCell className="whitespace-normal">{caso.descripcion}</TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-normal">{caso.objetivo}</TableCell>
                <TableCell>
                  {preparado ? (
                    <Badge variant="secondary">Preparado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Pendiente
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Vista de resultados lista para conectar</CardTitle>
          <CardDescription>
            Cuando el motor esté integrado, aquí se verán el e-NCF, código de seguridad, QR y XML de cada envío.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">e-NCF</p>
              <p className="mt-1 font-mono text-sm font-medium">{preparado ? MUESTRA_IMPRESION.encf : "—"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Código de Seguridad</p>
              <p className="mt-1 font-mono text-sm font-medium">
                {preparado ? MUESTRA_IMPRESION.codigoSeguridad : "—"}
              </p>
            </div>
            <div className="rounded-lg border p-3 sm:col-span-2 xl:col-span-1">
              <p className="text-muted-foreground text-xs">URL QR</p>
              <p className="mt-1 font-mono text-xs break-all">
                {preparado ? MUESTRA_IMPRESION.urlQr : "Pendiente de generar"}
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-slate-950 p-3 text-slate-50 dark:bg-black/40">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Visor de XML</span>
              <Badge variant="outline" className="border-slate-600 text-slate-300">
                {preparado ? "Ejemplo local" : "Sin datos"}
              </Badge>
            </div>
            <pre className="overflow-x-auto font-mono text-xs leading-5 whitespace-pre">
              {preparado
                ? `<ECF>\n  <Encabezado>\n    <Emisor>\n      <RNCEmisor>000000000</RNCEmisor>\n      <eNCF>${MUESTRA_IMPRESION.encf}</eNCF>\n    </Emisor>\n  </Encabezado>\n</ECF>`
                : "<ECF>\n  <!-- El XML firmado aparecerá aquí -->\n</ECF>"}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function dentroFinder(x: number, y: number, inicioX: number, inicioY: number): boolean {
  return x >= inicioX && x < inicioX + 7 && y >= inicioY && y < inicioY + 7;
}

function puntoFinderActivo(x: number, y: number): boolean {
  const centroX = Math.abs(x - 3);
  const centroY = Math.abs(y - 3);
  const anillo = Math.max(centroX, centroY);
  return anillo === 3 || anillo <= 1;
}

function qrActivo(x: number, y: number): boolean {
  const zonas = [
    { x: 0, y: 0 },
    { x: 14, y: 0 },
    { x: 0, y: 14 },
  ];
  for (const zona of zonas) {
    if (dentroFinder(x, y, zona.x, zona.y)) return puntoFinderActivo(x - zona.x, y - zona.y);
  }
  if (x === 6 || y === 6) return x % 2 === 0 || y % 2 === 0;
  return (x * 19 + y * 31 + x * y * 7 + 11) % 9 < 4;
}

function QrSimulado({ className }: { className?: string }) {
  const celdas: { x: number; y: number }[] = [];
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      if (qrActivo(x, y)) celdas.push({ x, y });
    }
  }

  return (
    <svg viewBox="0 0 21 21" role="img" aria-label="Código QR simulado" className={cn("block bg-white", className)}>
      <title>Código QR simulado</title>
      <rect width="21" height="21" className="fill-white" />
      <g className="fill-slate-950">
        {celdas.map((celda) => (
          <rect key={`${celda.x}-${celda.y}`} x={celda.x} y={celda.y} width="1" height="1" />
        ))}
      </g>
    </svg>
  );
}

function DatosObligatoriosEcf({ compacto = false }: { compacto?: boolean }) {
  return (
    <dl className={cn("grid gap-x-3 gap-y-1", compacto ? "text-[10px]" : "text-xs")}>
      <div>
        <dt className="text-slate-500">e-NCF</dt>
        <dd className="font-mono font-semibold">{MUESTRA_IMPRESION.encf}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Código de Seguridad</dt>
        <dd className="font-mono font-semibold">{MUESTRA_IMPRESION.codigoSeguridad}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Fecha Firma Digital</dt>
        <dd className="font-medium">{MUESTRA_IMPRESION.fechaFirma}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Vigencia de secuencia</dt>
        <dd className="font-medium">Hasta {MUESTRA_IMPRESION.vigencia}</dd>
      </div>
    </dl>
  );
}

function VistaPreviaCarta() {
  return (
    <div className="rounded-xl border bg-white p-4 text-slate-950 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-sm font-semibold">MEDOXIGAS ALC, SRL</p>
          <p className="text-xs text-slate-500">Factura de crédito fiscal electrónica</p>
        </div>
        <Badge variant="outline" className="border-slate-300 text-slate-600">
          Hoja Carta
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 rounded-xl border border-slate-300 p-3 sm:grid-cols-[96px_1fr]">
        <QrSimulado className="size-24 border" />
        <div className="flex flex-col justify-center">
          <DatosObligatoriosEcf />
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        Representación impresa simulada. El QR oficial apuntará a la URL de consulta de la DGII con los datos reales del
        comprobante.
      </p>
    </div>
  );
}

function VistaPreviaTicket() {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-xl border bg-white p-3 font-mono text-slate-950 shadow-sm">
      <div className="text-center">
        <p className="text-xs font-bold">MEDOXIGAS ALC, SRL</p>
        <p className="text-[10px]">FACTURA ELECTRÓNICA</p>
        <p className="mt-1 text-[9px] text-slate-500">Ticket térmico 80 mm</p>
      </div>
      <div className="my-2 border-t border-dashed border-slate-300" />
      <div className="flex justify-center">
        <QrSimulado className="size-24" />
      </div>
      <div className="mt-2">
        <DatosObligatoriosEcf compacto />
      </div>
      <div className="my-2 border-t border-dashed border-slate-300" />
      <p className="text-center text-[9px] text-slate-500">Consulta este comprobante con el QR de la DGII</p>
    </div>
  );
}

function PasoRepresentaciones() {
  return (
    <div className="flex flex-col gap-5">
      <Alert>
        <Printer />
        <AlertTitle>Bloque obligatorio DGII</AlertTitle>
        <AlertDescription>
          La representación impresa debe mostrar el QR, el e-NCF, el Código de Seguridad, la Fecha de Firma Digital y la
          vigencia de la secuencia. Esta es una simulación visual; no es un comprobante válido.
        </AlertDescription>
      </Alert>
      <div className="grid items-start gap-5 xl:grid-cols-[1.35fr_0.8fr]">
        <VistaPreviaCarta />
        <VistaPreviaTicket />
      </div>
    </div>
  );
}

function PasoUrls({
  dominio,
  copiadoId,
  errorCopiado,
  onDominio,
  onCopiar,
}: {
  dominio: string;
  copiadoId: string | null;
  errorCopiado: string | null;
  onDominio: (valor: string) => void;
  onCopiar: (id: string, url: string) => void;
}) {
  const urls = urlsServiciosEcf(dominio);

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-2xl">
        <Label htmlFor="dominio-base-ecf">Dominio base configurable</Label>
        <Input
          id="dominio-base-ecf"
          type="url"
          value={dominio}
          onChange={(evento) => onDominio(evento.target.value)}
          className="mt-2"
        />
        <p className="text-muted-foreground mt-2 text-xs">
          Se usa para calcular las URLs que se copiarán en la OFV. Cambiarlo aquí no cambia el despliegue real de
          Vercel.
        </p>
      </div>

      {errorCopiado ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo copiar</AlertTitle>
          <AlertDescription>{errorCopiado}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3">
        {urls.map((servicio) => (
          <div
            key={servicio.id}
            className="grid gap-3 rounded-xl border p-3 lg:grid-cols-[190px_1fr_auto] lg:items-center"
          >
            <div>
              <p className="text-sm font-medium">{servicio.titulo}</p>
              <p className="text-muted-foreground mt-1 text-xs">{servicio.descripcion}</p>
            </div>
            <code className="bg-muted rounded-lg px-3 py-2 font-mono text-xs break-all">{servicio.url}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => onCopiar(servicio.id, servicio.url)}>
              <Copy />
              {copiadoId === servicio.id ? "Copiada" : "Copiar"}
            </Button>
          </div>
        ))}
      </div>

      <Alert>
        <Info />
        <AlertTitle>Antes de producción</AlertTitle>
        <AlertDescription>
          Estas rutas son la forma estándar esperada para Desarrollo Propio. Se activarán cuando el motor e-CF y sus
          endpoints estén integrados; por ahora sirven para validar la estructura y preparar la postulación.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function PasoDeclaracion({
  confirmada,
  onConfirmada,
}: {
  confirmada: boolean;
  onConfirmada: (valor: boolean) => void;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Alert>
        <Info />
        <AlertTitle>La confirmación final se hace en la OFV</AlertTitle>
        <AlertDescription>
          Medoxigas te deja el checklist listo, pero la declaración jurada se completa por el representante legal dentro
          de la Oficina Virtual de la DGII.
        </AlertDescription>
      </Alert>

      <Accordion>
        <AccordionItem value="ofv" className="border-border rounded-xl border px-3">
          <AccordionTrigger>¿Cómo completar este paso en la OFV?</AccordionTrigger>
          <AccordionContent>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              <li>Entra a la Oficina Virtual con el usuario del representante legal.</li>
              <li>Abre la postulación de facturación electrónica como Desarrollo Propio.</li>
              <li>Revisa RNC, razón social, certificado, URLs de servicio y roles propuestos.</li>
              <li>Acepta la declaración jurada solamente cuando las pruebas de CerteCF estén aprobadas.</li>
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex items-start gap-3 rounded-xl border p-4">
        <Checkbox
          id="confirmacion-declaracion"
          checked={confirmada}
          onCheckedChange={(valor) => onConfirmada(valor === true)}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="confirmacion-declaracion" className="leading-5">
            Confirmo que el representante legal revisará y aceptará la declaración jurada en la OFV antes de pasar a
            producción.
          </Label>
          <p className="text-muted-foreground text-xs">
            Esta casilla es una preparación local; no envía ninguna declaración a la DGII.
          </p>
        </div>
      </div>
    </div>
  );
}

function serieVisibleNumeracion(numeracion: NumeracionEcf): string {
  const prefijo = numeracion.prefijo.trim().toUpperCase();
  return prefijo === "" ? numeracion.tipo_comprobante.trim().toUpperCase() : prefijo;
}

function TarjetaNumeraciones({ titulo, numeraciones }: { titulo: string; numeraciones: readonly NumeracionEcf[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{titulo}</CardTitle>
          <Badge variant="outline">{numeraciones.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {numeraciones.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay series activas en este grupo.</p>
        ) : null}
        {numeraciones.map((numeracion) => (
          <div key={numeracion.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{numeracion.nombre}</p>
              <Badge variant="secondary" className="font-mono">
                {serieVisibleNumeracion(numeracion)}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-2 grid gap-1 text-xs sm:grid-cols-3">
              <span>Siguiente: {numeracion.siguiente.toLocaleString("es-DO")}</span>
              <span>Hasta: {numeracion.hasta == null ? "—" : numeracion.hasta.toLocaleString("es-DO")}</span>
              <span>Vence: {numeracion.vence ?? "—"}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PasoRoles({
  numeraciones,
  ultimoEncf,
  onUltimoEncf,
}: {
  numeraciones: readonly NumeracionEcf[];
  ultimoEncf: string;
  onUltimoEncf: (valor: string) => void;
}) {
  const electronicas = numeraciones.filter((numeracion) => esTipoEncf(numeracion.tipo_comprobante, numeracion.prefijo));
  const tradicionales = numeraciones.filter((numeracion) => numeracion.prefijo.trim().toUpperCase().startsWith("B"));
  const internas = numeraciones.filter((numeracion) => {
    const esElectronica = esTipoEncf(numeracion.tipo_comprobante, numeracion.prefijo);
    const esSerieB = numeracion.prefijo.trim().toUpperCase().startsWith("B");
    return !esElectronica && !esSerieB;
  });
  const siguiente = calcularSiguienteDesdeEncf(ultimoEncf);
  const ultimoLimpio = ultimoEncf.trim();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="text-primary size-5" />
              <CardTitle>Asignación de roles</CardTitle>
            </div>
            <CardDescription>La DGII notifica por correo o por la OFV antes de habilitar los roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              <li>Aceptar la asignación del rol de Representante Legal.</li>
              <li>Asignar los roles operativos para emitir, consultar y administrar comprobantes.</li>
              <li>Verificar que cada usuario interno tenga el rol correcto en Medoxigas Contabilidad.</li>
            </ol>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hash className="text-primary size-5" />
              <CardTitle>Estado de series</CardTitle>
            </div>
            <CardDescription>Lectura real de las numeraciones activas en Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Series B tradicionales</p>
                <p className="mt-1 text-xl font-semibold">{tradicionales.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Series E31–E47</p>
                <p className="mt-1 text-xl font-semibold">{electronicas.length}</p>
              </div>
            </div>
            {electronicas.length === 0 ? (
              <Alert>
                <Info />
                <AlertTitle>Aún no hay series electrónicas</AlertTitle>
                <AlertDescription>
                  Las series E31–E47 se crearán cuando la DGII autorice los rangos e-NCF.
                </AlertDescription>
              </Alert>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboard/contabilidad/numeraciones" prefetch={false} />}
            >
              <Hash />
              Abrir numeraciones
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <TarjetaNumeraciones titulo="Series B tradicionales activas" numeraciones={tradicionales} />
        <TarjetaNumeraciones titulo="Series E31–E47 activas" numeraciones={electronicas} />
        <TarjetaNumeraciones titulo="Otras series internas" numeraciones={internas} />
      </div>

      <Card size="sm" className="border-primary/20 bg-secondary/35">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary size-5" />
            <CardTitle>Calculadora de corte desde Alegra</CardTitle>
          </div>
          <CardDescription>
            Prepara la continuidad sin apagar tu operación. No guarda ni cambia ninguna numeración.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-end">
          <div>
            <Label htmlFor="ultimo-encf-alegra">Último e-NCF emitido en Alegra</Label>
            <Input
              id="ultimo-encf-alegra"
              value={ultimoEncf}
              onChange={(evento) => onUltimoEncf(evento.target.value.toUpperCase())}
              placeholder="Ej.: E310000000123"
              className="mt-2 font-mono"
              autoComplete="off"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              Regla de oro: las secuencias e-NCF pertenecen a tu empresa, no a Alegra. El día del corte configura aquí
              último + 1 por cada serie.
            </p>
          </div>
          <div className="bg-card rounded-xl border p-3">
            <p className="text-muted-foreground text-xs">Primer e-NCF en Medoxigas</p>
            {siguiente ? <p className="text-primary mt-1 font-mono text-lg font-semibold">{siguiente}</p> : null}
            {!siguiente && ultimoLimpio === "" ? (
              <p className="text-muted-foreground mt-1 text-sm">Escribe el último e-NCF</p>
            ) : null}
            {!siguiente && ultimoLimpio !== "" ? (
              <p className="text-destructive mt-1 text-sm">Formato inválido o secuencia agotada</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GuiaMigracion() {
  return (
    <Card size="sm">
      <Accordion>
        <AccordionItem value="guia-migracion" className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-5" />
              <span className="text-base font-semibold">Guía de migración desde Alegra (sin apagar tu operación)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid gap-3 pt-2 lg:grid-cols-5">
              {CHECKLIST_MIGRACION_ALEGRA.map((paso, indice) => (
                <div key={paso.id} className="rounded-xl border p-3">
                  <Badge variant="secondary">{indice + 1}</Badge>
                  <p className="mt-2 text-sm font-medium">{paso.titulo}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">{paso.descripcion}</p>
                </div>
              ))}
            </div>
            <Alert className="mt-4">
              <Info />
              <AlertTitle>Ventana de corte limpia</AlertTitle>
              <AlertDescription>
                Alegra puede seguir facturando en producción mientras Medoxigas se certifica. El cambio se hace al
                final, idealmente al cierre del día o en fin de semana, después de copiar el último e-NCF por serie.
              </AlertDescription>
            </Alert>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function PanelPaso({
  pasoActivo,
  empresa,
  modalidad,
  nombreCertificado,
  contrasenaCertificado,
  pruebasPreparadas,
  ejecutandoPruebas,
  errorPruebas,
  declaracionConfirmada,
  dominioBase,
  copiadoId,
  errorCopiado,
  numeraciones,
  ultimoEncf,
  onCertificado,
  onContrasena,
  onEjecutarPruebas,
  onDeclaracion,
  onDominioBase,
  onCopiar,
  onUltimoEncf,
}: {
  pasoActivo: PasoHabilitacionId;
  empresa: EmisorEcf | null;
  modalidad: ModalidadHabilitacion;
  nombreCertificado: string;
  contrasenaCertificado: string;
  pruebasPreparadas: boolean;
  ejecutandoPruebas: boolean;
  errorPruebas: string | null;
  declaracionConfirmada: boolean;
  dominioBase: string;
  copiadoId: string | null;
  errorCopiado: string | null;
  numeraciones: readonly NumeracionEcf[];
  ultimoEncf: string;
  onCertificado: (nombre: string) => void;
  onContrasena: (valor: string) => void;
  onEjecutarPruebas: () => void;
  onDeclaracion: (valor: boolean) => void;
  onDominioBase: (valor: string) => void;
  onCopiar: (id: string, url: string) => void;
  onUltimoEncf: (valor: string) => void;
}) {
  if (pasoActivo === "certificado") {
    return (
      <PasoCertificado
        empresa={empresa}
        modalidad={modalidad}
        nombreCertificado={nombreCertificado}
        contrasena={contrasenaCertificado}
        onCertificado={onCertificado}
        onContrasena={onContrasena}
      />
    );
  }
  if (pasoActivo === "pruebas") {
    return (
      <PasoPruebas
        preparado={pruebasPreparadas}
        ejecutando={ejecutandoPruebas}
        error={errorPruebas}
        onEjecutar={onEjecutarPruebas}
      />
    );
  }
  if (pasoActivo === "representaciones") return <PasoRepresentaciones />;
  if (pasoActivo === "urls") {
    return (
      <PasoUrls
        dominio={dominioBase}
        copiadoId={copiadoId}
        errorCopiado={errorCopiado}
        onDominio={onDominioBase}
        onCopiar={onCopiar}
      />
    );
  }
  if (pasoActivo === "declaracion")
    return <PasoDeclaracion confirmada={declaracionConfirmada} onConfirmada={onDeclaracion} />;
  return <PasoRoles numeraciones={numeraciones} ultimoEncf={ultimoEncf} onUltimoEncf={onUltimoEncf} />;
}

export function PortalEcfCliente({ empresa, numeraciones, onEjecutarPruebas }: PortalEcfClienteProps) {
  const [ambiente, setAmbiente] = useState<AmbienteEcf>("testecf");
  const [modalidad, setModalidad] = useState<ModalidadHabilitacion>("migracion");
  const [pasoActivo, setPasoActivo] = useState<PasoHabilitacionId>("certificado");
  const [nombreCertificado, setNombreCertificado] = useState("");
  const [contrasenaCertificado, setContrasenaCertificado] = useState("");
  const [pruebasPreparadas, setPruebasPreparadas] = useState(false);
  const [ejecutandoPruebas, setEjecutandoPruebas] = useState(false);
  const [errorPruebas, setErrorPruebas] = useState<string | null>(null);
  const [declaracionConfirmada, setDeclaracionConfirmada] = useState(false);
  const [dominioBase, setDominioBase] = useState(DOMINIO_BASE_ECF_DEFECTO);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [errorCopiado, setErrorCopiado] = useState<string | null>(null);
  const [ultimoEncf, setUltimoEncf] = useState("");

  const progreso = calcularProgresoHabilitacion(modalidad);
  const pasoSeleccionado = PASOS_HABILITACION.find((paso) => paso.id === pasoActivo);
  const indiceActivo = PASOS_HABILITACION.findIndex((paso) => paso.id === pasoActivo);
  const pasoAnterior = indiceActivo > 0 ? PASOS_HABILITACION[indiceActivo - 1] : undefined;
  const pasoSiguiente = indiceActivo >= 0 ? PASOS_HABILITACION[indiceActivo + 1] : undefined;
  const puedeAvanzar = pasoActivo !== "declaracion" || declaracionConfirmada;

  async function manejarEjecutarPruebas() {
    setErrorPruebas(null);
    if (!onEjecutarPruebas) {
      setPruebasPreparadas(true);
      return;
    }

    setEjecutandoPruebas(true);
    try {
      await onEjecutarPruebas();
      setPruebasPreparadas(true);
    } catch {
      setErrorPruebas("La acción del motor e-CF no pudo completarse. Revisa la bitácora del servidor.");
    } finally {
      setEjecutandoPruebas(false);
    }
  }

  async function copiarUrl(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiadoId(id);
      setErrorCopiado(null);
    } catch {
      setCopiadoId(null);
      setErrorCopiado("El navegador no permitió usar el portapapeles. Selecciona y copia la URL manualmente.");
    }
  }

  if (!pasoSeleccionado) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TarjetaEstado titulo="Ambiente actual">
          <Badge
            variant={ambiente === "produccion" ? "destructive" : "secondary"}
            className={cn(
              "w-fit",
              ambiente === "testecf" &&
                "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
            )}
          >
            {ETIQUETA_AMBIENTE[ambiente]}
          </Badge>
          <div className="bg-muted mt-auto grid grid-cols-3 gap-1 rounded-xl p-1">
            {AMBIENTES.map((opcion) => (
              <OpcionSegmentada
                key={opcion}
                activa={ambiente === opcion}
                onClick={() => setAmbiente(opcion)}
                className="px-2 text-center"
              >
                {opcion === "testecf" ? "TesteCF" : null}
                {opcion === "certecf" ? "CerteCF" : null}
                {opcion === "produccion" ? "Producción" : null}
              </OpcionSegmentada>
            ))}
          </div>
        </TarjetaEstado>

        <TarjetaEstado titulo="Emisor">
          <div className="flex min-h-12 items-center gap-3">
            <div className="bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-xl">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{empresa?.nombre ?? "Empresa sin configurar"}</p>
              <p className="text-muted-foreground text-xs">RNC: {empresa?.rnc ?? "Sin configurar"}</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-auto truncate text-xs">
            {empresa?.correo ?? "Completa los datos fiscales antes de postular."}
          </p>
        </TarjetaEstado>

        <TarjetaEstado titulo="Modalidad">
          <div className="bg-muted mt-1 grid gap-1 rounded-xl p-1">
            <OpcionSegmentada activa={modalidad === "migracion"} onClick={() => setModalidad("migracion")}>
              <span className="block">Migración desde Alegra</span>
              <span className="block text-[10px] font-normal opacity-80">(ya soy facturador e-CF)</span>
            </OpcionSegmentada>
            <OpcionSegmentada activa={modalidad === "primera"} onClick={() => setModalidad("primera")}>
              Primera habilitación DGII
            </OpcionSegmentada>
          </div>
        </TarjetaEstado>

        <TarjetaEstado titulo="Progreso del asistente">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-semibold tracking-tight">{progreso}%</span>
            <Badge variant="outline">preparación</Badge>
          </div>
          <Progress value={progreso} className="mt-2" />
          <p className="text-muted-foreground mt-auto text-xs">
            La DGII confirma el avance real; este panel prepara el trabajo.
          </p>
        </TarjetaEstado>
      </div>

      {ambiente === "produccion" ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Producción no está activa</AlertTitle>
          <AlertDescription>
            Estás viendo la ruta de producción solo como referencia. Para activarla hace falta completar certificación,
            declaración jurada, roles y una confirmación explícita del responsable fiscal.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden rounded-2xl">
        <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
          <ListaPasos modalidad={modalidad} pasoActivo={pasoActivo} onSeleccionar={setPasoActivo} />

          <section className="min-w-0 p-5 sm:p-7">
            <EncabezadoPaso paso={pasoSeleccionado} modalidad={modalidad} />
            <div className="border-border mt-5 border-t pt-5">
              <PanelPaso
                pasoActivo={pasoActivo}
                empresa={empresa}
                modalidad={modalidad}
                nombreCertificado={nombreCertificado}
                contrasenaCertificado={contrasenaCertificado}
                pruebasPreparadas={pruebasPreparadas}
                ejecutandoPruebas={ejecutandoPruebas}
                errorPruebas={errorPruebas}
                declaracionConfirmada={declaracionConfirmada}
                dominioBase={dominioBase}
                copiadoId={copiadoId}
                errorCopiado={errorCopiado}
                numeraciones={numeraciones}
                ultimoEncf={ultimoEncf}
                onCertificado={setNombreCertificado}
                onContrasena={setContrasenaCertificado}
                onEjecutarPruebas={() => {
                  void manejarEjecutarPruebas();
                }}
                onDeclaracion={setDeclaracionConfirmada}
                onDominioBase={setDominioBase}
                onCopiar={(id, url) => {
                  void copiarUrl(id, url);
                }}
                onUltimoEncf={setUltimoEncf}
              />
            </div>

            <div className="border-border mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={!pasoAnterior}
                onClick={() => {
                  if (pasoAnterior) setPasoActivo(pasoAnterior.id);
                }}
              >
                <ChevronLeft />
                Anterior
              </Button>
              <div className="text-muted-foreground text-xs">
                {pasoActivo === "declaracion" && !declaracionConfirmada
                  ? "Confirma la casilla para continuar."
                  : `Paso ${indiceActivo + 1} de 6`}
              </div>
              <Button
                type="button"
                disabled={!pasoSiguiente || !puedeAvanzar}
                onClick={() => {
                  if (pasoSiguiente) setPasoActivo(pasoSiguiente.id);
                }}
              >
                Continuar
                <ChevronRight />
              </Button>
            </div>
          </section>
        </div>
      </Card>

      <GuiaMigracion />
    </div>
  );
}
