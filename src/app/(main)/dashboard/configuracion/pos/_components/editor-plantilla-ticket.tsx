"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "cn";
import { createPortal } from "react-dom";

import { FormField, FormSectionTitle } from "@/components/formularios/formulario";
import { Printer, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TicketPOSPayload } from "@/lib/pos/impresion";
import {
  ANCHOS_TICKET,
  type AnchoTicket,
  type EmpresaPOS,
  ESTILOS_TICKET,
  type EstiloTicket,
  FUENTES_TICKET,
  type FuenteTicket,
  INTERLINEADOS_TICKET,
  type InterlineadoTicket,
  type PlantillaTicket,
  TAMANOS_LETRA_TICKET,
  type TamanoLetraTicket,
} from "@/lib/pos/tipos";

import { TicketPosVista } from "./ticket-pos-vista";
import { armarTicketDeMuestra } from "./vista-previa-ticket";

const ETIQUETAS_ESTILO: Record<EstiloTicket, string> = {
  clasico: "Clásico",
  minimalista: "Minimalista",
  detallado: "Detallado",
};

const ETIQUETAS_FUENTE: Record<FuenteTicket, string> = {
  clasica: "Clásica",
  moderna: "Moderna",
  compacta: "Compacta",
};

const ETIQUETAS_TAMANO: Record<TamanoLetraTicket, string> = {
  pequena: "Pequeña",
  mediana: "Mediana",
  grande: "Grande",
};

const ETIQUETAS_INTERLINEADO: Record<InterlineadoTicket, string> = {
  compacto: "Compacto",
  normal: "Normal",
  amplio: "Amplio",
};

const OPCIONES_ANCHO: readonly { value: AnchoTicket; label: string }[] = ANCHOS_TICKET.map((ancho) => ({
  value: ancho,
  label: `${ancho} mm`,
}));

const OPCIONES_ESTILO: readonly { value: EstiloTicket; label: string }[] = ESTILOS_TICKET.map((estilo) => ({
  value: estilo,
  label: ETIQUETAS_ESTILO[estilo],
}));

const OPCIONES_TAMANO: readonly { value: TamanoLetraTicket; label: string }[] = TAMANOS_LETRA_TICKET.map((tamano) => ({
  value: tamano,
  label: ETIQUETAS_TAMANO[tamano],
}));

const OPCIONES_INTERLINEADO: readonly { value: InterlineadoTicket; label: string }[] = INTERLINEADOS_TICKET.map(
  (interlineado) => ({
    value: interlineado,
    label: ETIQUETAS_INTERLINEADO[interlineado],
  }),
);

const OPCIONES_FUENTE = FUENTES_TICKET.map((fuente) => ({ value: fuente, label: ETIQUETAS_FUENTE[fuente] }));

type ClaveToggle =
  | "mostrar_logo"
  | "mostrar_vendedor"
  | "mostrar_descripcion"
  | "mostrar_referencia"
  | "mostrar_precio_unitario"
  | "mostrar_unidad"
  | "precios_con_impuestos";

const TOGGLES: readonly { clave: ClaveToggle; etiqueta: string; descripcion: string }[] = [
  { clave: "mostrar_logo", etiqueta: "Logo de la empresa", descripcion: "Usa el logo de Configuración → Empresa." },
  { clave: "mostrar_vendedor", etiqueta: "Vendedor", descripcion: "Solo si la venta tiene vendedor." },
  { clave: "mostrar_descripcion", etiqueta: "Descripción de la línea", descripcion: "Debajo del nombre del producto." },
  { clave: "mostrar_referencia", etiqueta: "Referencia", descripcion: "Código o referencia del producto." },
  { clave: "mostrar_precio_unitario", etiqueta: "Precio unitario", descripcion: "Precio de cada unidad en la línea." },
  {
    clave: "mostrar_unidad",
    etiqueta: "Unidad de medida",
    descripcion: "Junto a la cantidad, si el producto la tiene.",
  },
  {
    clave: "precios_con_impuestos",
    etiqueta: "Precios con impuestos",
    descripcion: "El precio unitario se muestra con ITBIS incluido.",
  },
];

function esFuente(valor: string): valor is FuenteTicket {
  return (FUENTES_TICKET as readonly string[]).includes(valor);
}

/**
 * Control segmentado de la plantilla. Es un grupo de botones con `aria-pressed`
 * y estado pintado con tokens (`--primary`): el usuario ve qué opción está
 * activa en claro y en oscuro sin depender de un hover.
 */
function Segmentado<Valor extends string | number>({
  etiqueta,
  opciones,
  valor,
  deshabilitado,
  onCambio,
}: {
  readonly etiqueta: string;
  readonly opciones: readonly { value: Valor; label: string }[];
  readonly valor: Valor;
  readonly deshabilitado: boolean;
  readonly onCambio: (valor: Valor) => void;
}) {
  return (
    <fieldset aria-label={etiqueta} className="border-input m-0 flex w-full overflow-hidden rounded-lg border p-0">
      {opciones.map((opcion, indice) => {
        const activo = opcion.value === valor;

        return (
          <button
            key={opcion.value}
            type="button"
            aria-pressed={activo}
            disabled={deshabilitado}
            onClick={() => onCambio(opcion.value)}
            className={cn(
              "h-10 flex-1 px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              indice > 0 && "border-input border-l",
              activo
                ? "bg-primary/10 text-primary border-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {opcion.label}
          </button>
        );
      })}
    </fieldset>
  );
}

export function EditorPlantillaTicket({
  plantilla,
  empresa,
  terminal,
  deshabilitado,
  onCambio,
}: {
  readonly plantilla: PlantillaTicket;
  readonly empresa: EmpresaPOS | null;
  readonly terminal: string;
  readonly deshabilitado: boolean;
  readonly onCambio: (plantilla: PlantillaTicket) => void;
}) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const cerrarImpresion = useCallback(() => setImprimiendo(false), []);

  function cambiar<Clave extends keyof PlantillaTicket>(clave: Clave, valor: PlantillaTicket[Clave]) {
    onCambio({ ...plantilla, [clave]: valor });
  }

  const payload = armarTicketDeMuestra({
    empresa,
    plantilla,
    terminal: terminal.trim() || "Caja 1",
  });

  return (
    <div className="@container">
      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4">
            <FormSectionTitle descripcion="Cómo se distribuye el papel y cómo se lee el ticket.">
              Papel y estilo
            </FormSectionTitle>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Ancho del papel</span>
              <Segmentado
                etiqueta="Ancho del papel"
                opciones={OPCIONES_ANCHO}
                valor={plantilla.ancho_mm}
                deshabilitado={deshabilitado}
                onCambio={(ancho) => cambiar("ancho_mm", ancho)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Estilo</span>
              <Segmentado
                etiqueta="Estilo del ticket"
                opciones={OPCIONES_ESTILO}
                valor={plantilla.estilo}
                deshabilitado={deshabilitado}
                onCambio={(estilo) => cambiar("estilo", estilo)}
              />
            </div>

            <FormField htmlFor="ticket-fuente" label="Fuente">
              <Select
                items={OPCIONES_FUENTE}
                value={plantilla.fuente}
                onValueChange={(valor) => {
                  if (valor != null && esFuente(valor)) cambiar("fuente", valor);
                }}
                disabled={deshabilitado}
              >
                <SelectTrigger id="ticket-fuente" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {OPCIONES_FUENTE.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Tamaño de letra</span>
                <Segmentado
                  etiqueta="Tamaño de letra"
                  opciones={OPCIONES_TAMANO}
                  valor={plantilla.tamano_letra}
                  deshabilitado={deshabilitado}
                  onCambio={(tamano) => cambiar("tamano_letra", tamano)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Interlineado</span>
                <Segmentado
                  etiqueta="Interlineado"
                  opciones={OPCIONES_INTERLINEADO}
                  valor={plantilla.interlineado}
                  deshabilitado={deshabilitado}
                  onCambio={(interlineado) => cambiar("interlineado", interlineado)}
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <FormSectionTitle descripcion="Cada interruptor manda: si está apagado, el estilo no lo inventa.">
              Qué se imprime
            </FormSectionTitle>

            <div className="divide-border border-border flex flex-col divide-y rounded-xl border">
              {TOGGLES.map((toggle) => (
                <div key={toggle.clave} className="flex items-center justify-between gap-4 px-3 py-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Label htmlFor={`ticket-${toggle.clave}`} className="text-sm font-medium">
                      {toggle.etiqueta}
                    </Label>
                    <p className="text-muted-foreground text-xs">{toggle.descripcion}</p>
                  </div>
                  <Switch
                    id={`ticket-${toggle.clave}`}
                    checked={plantilla[toggle.clave]}
                    onCheckedChange={(valor) => cambiar(toggle.clave, valor)}
                    disabled={deshabilitado}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <FormSectionTitle descripcion="Si lo dejas vacío, el ticket no imprime pie.">
              Pie del ticket
            </FormSectionTitle>
            <FormField htmlFor="ticket-pie" label="Texto del pie">
              <Textarea
                id="ticket-pie"
                value={plantilla.pie_ticket ?? ""}
                onChange={(evento) => cambiar("pie_ticket", evento.target.value)}
                maxLength={500}
                rows={3}
                disabled={deshabilitado}
                placeholder="Ej. ¡Gracias por su compra!"
              />
            </FormField>
          </section>
        </div>

        <div className="flex flex-col gap-3 @3xl:sticky @3xl:top-4 @3xl:self-start">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Vista previa</p>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => setImprimiendo(true)}
              disabled={imprimiendo}
            >
              <Printer />
              Imprimir prueba
            </Button>
          </div>

          <div className="border-border bg-muted/40 flex justify-center overflow-x-auto rounded-xl border p-4">
            <TicketPosVista payload={payload} className="shadow-sm" />
          </div>

          <p className="text-muted-foreground text-xs">
            Los productos, montos y el NCF son de muestra para ver el diseño. El encabezado y el logo salen de la
            empresa.
          </p>

          {imprimiendo ? (
            <Button type="button" variant="ghost" className="h-9 justify-start" onClick={cerrarImpresion}>
              <X />
              Cancelar impresión
            </Button>
          ) : null}
        </div>

        {imprimiendo ? <ImpresionPrueba payload={payload} alTerminar={cerrarImpresion} /> : null}
      </div>
    </div>
  );
}

/**
 * Monta el ticket en el portal de impresión (`data-print-root`) y abre el
 * diálogo del navegador. El CSS de impresión existente oculta el resto de la
 * aplicación, así que solo sale el ticket.
 */
function ImpresionPrueba({
  payload,
  alTerminar,
}: {
  readonly payload: TicketPOSPayload;
  readonly alTerminar: () => void;
}) {
  useEffect(() => {
    const cerrar = () => alTerminar();
    window.addEventListener("afterprint", cerrar);
    const temporizador = window.setTimeout(() => window.print(), 250);

    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("afterprint", cerrar);
    };
  }, [alTerminar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div data-print-root="" data-print-paper="" className="flex justify-center">
      <TicketPosVista payload={payload} />
    </div>,
    document.body,
  );
}
