"use client";

import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";

import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  Inbox,
  Info,
  ListFilter,
  MoreVertical,
  RefreshCw,
  Search,
  TriangleAlert,
  Upload,
} from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";

import { type EcfXmlRecibido, type ItemEcfRecibido, parsearXmlEcfRecibido } from "./parser-xml-recibido";

export type EventoDgiiEcf = "acusado" | "aprobado" | "rechazado";
export type EstadoRegistroEcf = "pendiente" | "registrada";

export interface EcfRecibidoBandeja {
  id: string;
  rncEmisor: string;
  razonSocialEmisor: string;
  correoEmisor: string | null;
  rncComprador: string | null;
  tipoEcf: string;
  encf: string;
  fechaEmision: string | null;
  montoGravado: number | null;
  montoExento: number | null;
  totalItbis: number | null;
  montoTotal: number | null;
  codigoSeguridad: string | null;
  eventoDgii: EventoDgiiEcf;
  estadoRegistro: EstadoRegistroEcf;
  facturaCompraId: string | null;
  motivoRechazo: string | null;
  xml: string | null;
  items: ItemEcfRecibido[];
}

interface RecepcionEcfClienteProps {
  recibidos: readonly EcfRecibidoBandeja[];
  tablaDisponible: boolean;
  empresa: { nombre: string | null; rnc: string | null } | null;
}

type FiltroEvento = "todos" | EventoDgiiEcf;
type FiltroEstado = "todos" | EstadoRegistroEcf;

const OPCIONES_EVENTO = [
  { value: "todos", label: "Todos" },
  { value: "acusado", label: "Acusado" },
  { value: "aprobado", label: "Aprobado" },
  { value: "rechazado", label: "Rechazado" },
];

const OPCIONES_ESTADO = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendiente de compra" },
  { value: "registrada", label: "Registrada" },
];

const EVENTO_UI: Record<EventoDgiiEcf, { etiqueta: string; clases: string }> = {
  acusado: {
    etiqueta: "Acusado",
    clases:
      "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300",
  },
  aprobado: {
    etiqueta: "Aprobado",
    clases:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300",
  },
  rechazado: {
    etiqueta: "Rechazado",
    clases:
      "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/35 dark:text-red-300",
  },
};

const TIPOS_DOCUMENTO: Record<string, string> = {
  "31": "Factura de proveedor",
  "32": "Factura de consumo",
  "33": "Nota de débito",
  "34": "Nota de crédito",
  "41": "Compras electrónicas",
  "43": "Gastos menores",
  "44": "Regímenes especiales",
  "45": "Gubernamental",
  "46": "Exportaciones",
  "47": "Pagos al exterior",
};

function tipoDocumentoLegible(tipoEcf: string): string {
  const tipo = tipoEcf.replace(/^E/i, "");
  return TIPOS_DOCUMENTO[tipo] ?? `Comprobante E${tipo}`;
}

function fechaVisible(fecha: string | null): string {
  if (!fecha) return "—";
  const dgii = /^(\d{2})-(\d{2})-(\d{4})$/.exec(fecha);
  if (dgii?.[1] && dgii[2] && dgii[3]) return `${dgii[1]}/${dgii[2]}/${dgii[3]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (iso?.[1] && iso[2] && iso[3]) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return fecha;
}

function montoVisible(valor: number | null): string {
  return valor == null ? "—" : formatoMoneda(valor);
}

function inicialProveedor(nombre: string): string {
  const limpio = nombre.trim();
  return limpio[0]?.toUpperCase() ?? "P";
}

function normalizarBusqueda(texto: string): string {
  return texto.trim().toLocaleLowerCase("es-DO");
}

function coincideBusqueda(comprobante: EcfRecibidoBandeja, busqueda: string): boolean {
  const termino = normalizarBusqueda(busqueda);
  if (termino === "") return true;
  return [comprobante.razonSocialEmisor, comprobante.rncEmisor, comprobante.correoEmisor ?? "", comprobante.encf]
    .map(normalizarBusqueda)
    .some((texto) => texto.includes(termino));
}

function esFiltroEvento(valor: string | null): FiltroEvento {
  if (valor === "acusado" || valor === "aprobado" || valor === "rechazado") return valor;
  return "todos";
}

function esFiltroEstado(valor: string | null): FiltroEstado {
  if (valor === "pendiente" || valor === "registrada") return valor;
  return "todos";
}

function comprobanteDesdeXml(ecf: EcfXmlRecibido, xml: string): EcfRecibidoBandeja {
  return {
    id: `local-${crypto.randomUUID()}`,
    rncEmisor: ecf.rncEmisor,
    razonSocialEmisor: ecf.razonSocialEmisor,
    correoEmisor: ecf.correoEmisor,
    rncComprador: ecf.rncComprador,
    tipoEcf: ecf.tipoEcf,
    encf: ecf.encf,
    fechaEmision: ecf.fechaEmision,
    montoGravado: ecf.montoGravado,
    montoExento: ecf.montoExento,
    totalItbis: ecf.totalItbis,
    montoTotal: ecf.montoTotal,
    codigoSeguridad: ecf.codigoSeguridad,
    eventoDgii: "acusado",
    estadoRegistro: "pendiente",
    facturaCompraId: null,
    motivoRechazo: null,
    xml,
    items: ecf.items,
  };
}

function FiltrosRecepcion({
  filtroEvento,
  filtroEstado,
  onEvento,
  onEstado,
}: {
  filtroEvento: FiltroEvento;
  filtroEstado: FiltroEstado;
  onEvento: (valor: FiltroEvento) => void;
  onEstado: (valor: FiltroEstado) => void;
}) {
  const activos = (filtroEvento === "todos" ? 0 : 1) + (filtroEstado === "todos" ? 0 : 1);

  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <ListFilter />
        Filtrar
        {activos > 0 ? <Badge variant="secondary">{activos}</Badge> : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-evento-dgii">Evento DGII</Label>
            <Select
              value={filtroEvento}
              onValueChange={(valor: string | null) => onEvento(esFiltroEvento(valor))}
              items={OPCIONES_EVENTO}
            >
              <SelectTrigger id="filtro-evento-dgii" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_EVENTO.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-estado-compra">Estado</Label>
            <Select
              value={filtroEstado}
              onValueChange={(valor: string | null) => onEstado(esFiltroEstado(valor))}
              items={OPCIONES_ESTADO}
            >
              <SelectTrigger id="filtro-estado-compra" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_ESTADO.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SelectorEventoDgii({
  comprobante,
  onAprobar,
  onRechazar,
}: {
  comprobante: EcfRecibidoBandeja;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
}) {
  const evento = EVENTO_UI[comprobante.eventoDgii];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Cambiar evento DGII de ${comprobante.encf}`}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
              evento.clases,
            )}
          />
        }
      >
        {evento.etiqueta}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem disabled>
          <Check />
          Acuse de recibo enviado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={comprobante.eventoDgii === "aprobado"} onClick={() => onAprobar(comprobante.id)}>
          Aprobar comercialmente
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={comprobante.eventoDgii === "rechazado"}
          onClick={() => onRechazar(comprobante.id)}
        >
          Rechazar comercialmente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EstadoCompra({ comprobante }: { comprobante: EcfRecibidoBandeja }) {
  if (comprobante.facturaCompraId) {
    return (
      <Badge
        variant="outline"
        render={<Link href={`/dashboard/compras/${comprobante.facturaCompraId}`} prefetch={false} />}
        className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300"
      >
        Registrada
      </Badge>
    );
  }

  const ruta = `/dashboard/compras/nueva?encf=${encodeURIComponent(comprobante.encf)}&rnc=${encodeURIComponent(
    comprobante.rncEmisor,
  )}`;
  return (
    <Button variant="outline" size="sm" render={<Link href={ruta} prefetch={false} />}>
      Registrar compra
    </Button>
  );
}

function MenuAccionesRecibido({
  comprobante,
  copiado,
  onDetalle,
  onCopiar,
}: {
  comprobante: EcfRecibidoBandeja;
  copiado: boolean;
  onDetalle: (id: string) => void;
  onCopiar: (comprobante: EcfRecibidoBandeja) => void;
}) {
  function descargarXml() {
    if (!comprobante.xml) return;
    const blob = new Blob([comprobante.xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `${comprobante.encf}.xml`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${comprobante.encf}`} />}
      >
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onDetalle(comprobante.id)}>
          <Eye />
          Ver detalle del XML
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!comprobante.xml} onClick={descargarXml}>
          <Download />
          Descargar XML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCopiar(comprobante)}>
          <Copy />
          {copiado ? "e-NCF copiado" : "Copiar e-NCF"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DatoDetalle({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
      <dd className={cn("mt-1 text-sm font-medium break-words", mono && "font-mono text-xs")}>{valor}</dd>
    </div>
  );
}

function DialogoDetalleXml({
  comprobante,
  onCerrar,
}: {
  comprobante: EcfRecibidoBandeja | null;
  onCerrar: () => void;
}) {
  return (
    <Dialog
      open={comprobante !== null}
      onOpenChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
    >
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-4xl">
        {comprobante ? (
          <>
            <DialogHeader>
              <DialogTitle>Detalle del XML {comprobante.encf}</DialogTitle>
              <DialogDescription>Cabecera fiscal, líneas y archivo crudo recibido del proveedor.</DialogDescription>
            </DialogHeader>

            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <DatoDetalle etiqueta="Proveedor" valor={comprobante.razonSocialEmisor || "Sin razón social"} />
              <DatoDetalle etiqueta="RNC emisor" valor={comprobante.rncEmisor} mono />
              <DatoDetalle etiqueta="Correo emisor" valor={comprobante.correoEmisor ?? "No viene en el XML"} />
              <DatoDetalle etiqueta="RNC comprador" valor={comprobante.rncComprador ?? "No viene en el XML"} mono />
              <DatoDetalle etiqueta="Documento" valor={tipoDocumentoLegible(comprobante.tipoEcf)} />
              <DatoDetalle etiqueta="Fecha de emisión" valor={fechaVisible(comprobante.fechaEmision)} />
              <DatoDetalle etiqueta="Monto gravado" valor={montoVisible(comprobante.montoGravado)} />
              <DatoDetalle etiqueta="ITBIS total" valor={montoVisible(comprobante.totalItbis)} />
              <DatoDetalle etiqueta="Monto total" valor={montoVisible(comprobante.montoTotal)} />
              <DatoDetalle
                etiqueta="Código de seguridad"
                valor={comprobante.codigoSeguridad ?? "Sin firma visible"}
                mono
              />
            </dl>

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10">Ítem</TableHead>
                    <TableHead className="h-10 text-right">Cantidad</TableHead>
                    <TableHead className="h-10 text-right">Precio unitario</TableHead>
                    <TableHead className="h-10 text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprobante.items.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                        El detalle de líneas estará disponible cuando el XML recibido pueda leerse.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comprobante.items.map((item) => (
                      <TableRow key={`${item.numeroLinea ?? 0}-${item.nombre}`}>
                        <TableCell className="whitespace-normal">{item.nombre || "Ítem sin nombre"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.cantidad == null ? "—" : formatoCantidad(item.cantidad)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{montoVisible(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right tabular-nums">{montoVisible(item.monto)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border bg-slate-950 p-3 text-slate-50 dark:bg-black/40">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="size-4" />
                <span className="text-xs font-medium">XML crudo</span>
              </div>
              {comprobante.xml ? (
                <pre className="max-h-64 overflow-auto font-mono text-xs break-all whitespace-pre-wrap">
                  {comprobante.xml}
                </pre>
              ) : (
                <p className="text-xs text-slate-300">
                  El XML crudo no está disponible en esta fila. Cuando la migración de recepción esté aplicada, se
                  conservará aquí para auditoría.
                </p>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogoRechazoComercial({
  comprobante,
  motivo,
  error,
  onMotivo,
  onConfirmar,
  onCerrar,
}: {
  comprobante: EcfRecibidoBandeja | null;
  motivo: string;
  error: string | null;
  onMotivo: (valor: string) => void;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <Dialog
      open={comprobante !== null}
      onOpenChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rechazar comercialmente</DialogTitle>
          <DialogDescription>
            {comprobante
              ? `El motivo quedará asociado al comprobante ${comprobante.encf} para el ACECF con Estado 2.`
              : "Escribe el motivo del rechazo."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo-rechazo-ecf">Motivo de rechazo</Label>
          <Textarea
            id="motivo-rechazo-ecf"
            value={motivo}
            onChange={(evento) => onMotivo(evento.target.value)}
            placeholder="Ej.: el detalle no corresponde con la compra recibida"
            rows={4}
          />
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirmar}>
            Rechazar comprobante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EstadoVacioBandeja({
  filtrada,
  empresa,
  onImportar,
}: {
  filtrada: boolean;
  empresa: { nombre: string | null; rnc: string | null } | null;
  onImportar: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="bg-secondary text-primary flex size-12 items-center justify-center rounded-2xl">
        <Inbox className="size-7" />
      </div>
      <p className="text-lg font-semibold">
        {filtrada ? "Sin resultados" : "Registra tu primer comprobante electrónico"}
      </p>
      <p className="text-muted-foreground max-w-xl text-sm">
        {filtrada
          ? "La búsqueda o los filtros no arrojaron comprobantes."
          : `Recibe los comprobantes emitidos por tus proveedores, genera los eventos de aprobación y regístralos como factura de proveedor. La bandeja del RNC ${empresa?.rnc ?? "de la empresa"} se llenará automáticamente al activar el Directorio FE.`}
      </p>
      {!filtrada ? (
        <Button type="button" className="mt-3" onClick={onImportar}>
          <Upload />
          Importar XML de proveedor
        </Button>
      ) : null}
    </div>
  );
}

export function RecepcionEcfCliente({ recibidos, tablaDisponible, empresa }: RecepcionEcfClienteProps) {
  const router = useRouter();
  const inputArchivos = useRef<HTMLInputElement>(null);
  const [comprobantes, setComprobantes] = useState<EcfRecibidoBandeja[]>(() =>
    recibidos.map((comprobante) => ({ ...comprobante, items: [...comprobante.items] })),
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtroEvento, setFiltroEvento] = useState<FiltroEvento>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(new Set());
  const [erroresImportacion, setErroresImportacion] = useState<string[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [rechazoId, setRechazoId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const visibles = useMemo(
    () =>
      comprobantes.filter(
        (comprobante) =>
          coincideBusqueda(comprobante, busqueda) &&
          (filtroEvento === "todos" || comprobante.eventoDgii === filtroEvento) &&
          (filtroEstado === "todos" || comprobante.estadoRegistro === filtroEstado),
      ),
    [comprobantes, busqueda, filtroEvento, filtroEstado],
  );
  const idsVisibles = visibles.map((comprobante) => comprobante.id);
  const todosVisiblesSeleccionados = idsVisibles.length > 0 && idsVisibles.every((id) => seleccionados.has(id));
  const detalle = comprobantes.find((comprobante) => comprobante.id === detalleId) ?? null;
  const comprobanteRechazo = comprobantes.find((comprobante) => comprobante.id === rechazoId) ?? null;

  function abrirImportador() {
    inputArchivos.current?.click();
  }

  async function importarArchivos(archivos: readonly File[]) {
    const xmls = archivos.filter((archivo) => archivo.name.toLowerCase().endsWith(".xml"));
    if (xmls.length === 0) {
      setErroresImportacion(["Selecciona uno o varios archivos .xml de comprobantes electrónicos."]);
      return;
    }

    const errores: string[] = [];
    const nuevos: EcfRecibidoBandeja[] = [];
    for (const archivo of xmls) {
      const xml = await archivo.text();
      const resultado = parsearXmlEcfRecibido(xml);
      if (!resultado.ok) {
        errores.push(`${archivo.name}: ${resultado.error}`);
      } else {
        nuevos.push(comprobanteDesdeXml(resultado.ecf, xml));
      }
    }

    if (nuevos.length > 0) setComprobantes((actuales) => [...nuevos, ...actuales]);
    setErroresImportacion(errores);
  }

  async function manejarArchivosSeleccionados(evento: ChangeEvent<HTMLInputElement>) {
    const control = evento.currentTarget;
    await importarArchivos(Array.from(control.files ?? []));
    control.value = "";
  }

  function manejarSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    void importarArchivos(Array.from(evento.dataTransfer.files));
  }

  function alternarSeleccion(id: string, marcado: boolean) {
    setSeleccionados((actuales) => {
      const siguiente = new Set(actuales);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  function alternarTodosVisibles(marcado: boolean) {
    setSeleccionados((actuales) => {
      const siguiente = new Set(actuales);
      for (const id of idsVisibles) {
        if (marcado) siguiente.add(id);
        else siguiente.delete(id);
      }
      return siguiente;
    });
  }

  function marcarAprobado(id: string) {
    setComprobantes((actuales) =>
      actuales.map((comprobante) =>
        comprobante.id === id ? { ...comprobante, eventoDgii: "aprobado", motivoRechazo: null } : comprobante,
      ),
    );
  }

  function pedirRechazo(id: string) {
    setRechazoId(id);
    setMotivoRechazo("");
    setErrorRechazo(null);
  }

  function cerrarRechazo() {
    setRechazoId(null);
    setMotivoRechazo("");
    setErrorRechazo(null);
  }

  function confirmarRechazo() {
    const motivo = motivoRechazo.trim();
    if (motivo === "") {
      setErrorRechazo("Escribe el motivo del rechazo comercial.");
      return;
    }
    if (rechazoId) {
      setComprobantes((actuales) =>
        actuales.map((comprobante) =>
          comprobante.id === rechazoId
            ? { ...comprobante, eventoDgii: "rechazado", motivoRechazo: motivo }
            : comprobante,
        ),
      );
    }
    cerrarRechazo();
  }

  async function copiarEncf(comprobante: EcfRecibidoBandeja) {
    try {
      await navigator.clipboard.writeText(comprobante.encf);
      setCopiadoId(comprobante.id);
    } catch {
      setCopiadoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!tablaDisponible ? (
        <Alert className="border-primary/25 bg-secondary/55">
          <Info />
          <AlertTitle>Bandeja lista para probar con XML local</AlertTitle>
          <AlertDescription>
            La tabla ecf_recibidos se habilitará al aplicar la migración en Supabase. Mientras tanto, puedes importar
            XMLs reales de proveedores y revisar todo el flujo visual sin escribir datos.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: el arrastre de archivos no tiene equivalente de teclado; el botón Importar XML es la vía accesible. */}
      <div
        className={cn(
          "bg-card rounded-xl border transition-colors",
          arrastrando && "border-primary bg-secondary/35 ring-primary/15 ring-3",
        )}
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={manejarSoltar}
      >
        <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <input
            ref={inputArchivos}
            type="file"
            accept=".xml"
            multiple
            className="sr-only"
            onChange={(evento) => {
              void manejarArchivosSeleccionados(evento);
            }}
          />
          <InputGroup className="h-9 w-full sm:max-w-[300px]">
            <InputGroupAddon align="inline-start" className="pl-2.5">
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar proveedor o e-NCF"
              aria-label="Buscar proveedor o e-NCF"
            />
          </InputGroup>
          <FiltrosRecepcion
            filtroEvento={filtroEvento}
            filtroEstado={filtroEstado}
            onEvento={setFiltroEvento}
            onEstado={setFiltroEstado}
          />
          <Button type="button" variant="outline" size="sm" onClick={abrirImportador}>
            <Upload />
            Importar XML
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {seleccionados.size > 0 ? <Badge variant="secondary">{seleccionados.size} seleccionados</Badge> : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Actualizar bandeja"
              onClick={() => router.refresh()}
            >
              <RefreshCw />
            </Button>
          </div>
        </div>

        {erroresImportacion.length > 0 ? (
          <div className="px-4 pt-3">
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>No se pudieron importar algunos XML</AlertTitle>
              <AlertDescription>
                {erroresImportacion.map((error) => (
                  <span key={error} className="block">
                    {error}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        {visibles.length === 0 ? (
          <EstadoVacioBandeja filtrada={comprobantes.length > 0} empresa={empresa} onImportar={abrirImportador} />
        ) : (
          <Table className="min-w-[1060px] text-sm">
            <TableHeader>
              <TableRow className="border-border bg-muted/45 hover:bg-muted/45">
                <TableHead className="h-12 w-11 px-4">
                  <Checkbox
                    checked={todosVisiblesSeleccionados}
                    onCheckedChange={(valor) => alternarTodosVisibles(valor === true)}
                    aria-label="Seleccionar todos los comprobantes visibles"
                  />
                </TableHead>
                <TableHead className="h-12 px-3 text-xs font-medium">Proveedor / Correo</TableHead>
                <TableHead className="h-12 px-3 text-xs font-medium">Documento / Número</TableHead>
                <TableHead className="h-12 px-3 text-xs font-medium">Fecha de emisión</TableHead>
                <TableHead className="h-12 px-3 text-right text-xs font-medium">Total</TableHead>
                <TableHead className="h-12 px-3 text-xs font-medium">Evento DGII</TableHead>
                <TableHead className="h-12 px-3 text-xs font-medium">Estado</TableHead>
                <TableHead className="h-12 w-12 px-3">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((comprobante) => (
                <TableRow key={comprobante.id} className="border-border h-16">
                  <TableCell className="px-4">
                    <Checkbox
                      checked={seleccionados.has(comprobante.id)}
                      onCheckedChange={(valor) => alternarSeleccion(comprobante.id, valor === true)}
                      aria-label={`Seleccionar ${comprobante.encf}`}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-3 whitespace-normal">
                    <div className="flex min-w-[240px] items-center gap-3">
                      <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                        {inicialProveedor(comprobante.razonSocialEmisor)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-semibold">
                          {comprobante.razonSocialEmisor || "Proveedor sin razón social"}
                        </p>
                        <p className="text-muted-foreground text-xs">RNC {comprobante.rncEmisor}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {comprobante.correoEmisor ?? "Correo no informado"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 whitespace-normal">
                    <p className="font-medium">{tipoDocumentoLegible(comprobante.tipoEcf)}</p>
                    <p className="text-muted-foreground font-mono text-xs">{comprobante.encf}</p>
                  </TableCell>
                  <TableCell className="px-3 py-3 whitespace-nowrap">
                    {fechaVisible(comprobante.fechaEmision)}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                    {montoVisible(comprobante.montoTotal)}
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <SelectorEventoDgii
                      comprobante={comprobante}
                      onAprobar={marcarAprobado}
                      onRechazar={pedirRechazo}
                    />
                    {comprobante.eventoDgii === "rechazado" && comprobante.motivoRechazo ? (
                      <p
                        className="text-muted-foreground mt-1 max-w-[220px] truncate text-xs"
                        title={comprobante.motivoRechazo}
                      >
                        Motivo: {comprobante.motivoRechazo}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <EstadoCompra comprobante={comprobante} />
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center">
                    <MenuAccionesRecibido
                      comprobante={comprobante}
                      copiado={copiadoId === comprobante.id}
                      onDetalle={setDetalleId}
                      onCopiar={(fila) => {
                        void copiarEncf(fila);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DialogoDetalleXml comprobante={detalle} onCerrar={() => setDetalleId(null)} />
      <DialogoRechazoComercial
        comprobante={comprobanteRechazo}
        motivo={motivoRechazo}
        error={errorRechazo}
        onMotivo={(valor) => {
          setMotivoRechazo(valor);
          setErrorRechazo(null);
        }}
        onConfirmar={confirmarRechazo}
        onCerrar={cerrarRechazo}
      />
    </div>
  );
}
