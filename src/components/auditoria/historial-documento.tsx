"use client";

import { useEffect, useState } from "react";

import { cn } from "cn";

import { Ban, History, Loader2, Pencil, Plus } from "@/components/icons";
import { consultarAuditoria, type EntradaAuditoria } from "@/lib/auditoria/consultas";
import { formatoFechaHora } from "@/lib/formato";

// ---------------------------------------------------------------------------
// Etiquetas compartidas de la auditoría (pantalla de administración y esta
// pestaña). Viven aquí porque `consultas.ts` es "use server" y solo puede
// exportar funciones async: las constantes no pueden salir de ahí.
// ---------------------------------------------------------------------------

export const ENTIDADES_AUDITADAS: readonly { value: string; label: string }[] = [
  { value: "factura", label: "Factura" },
  { value: "factura_proveedor", label: "Factura de proveedor" },
  { value: "contacto", label: "Contacto" },
  { value: "producto", label: "Producto" },
  { value: "pago_recibido", label: "Pago recibido" },
  { value: "pago_proveedor", label: "Pago a proveedor" },
  { value: "nota_credito", label: "Nota de crédito" },
  { value: "asiento", label: "Asiento" },
];

export const ACCIONES_AUDITORIA: readonly { value: string; label: string }[] = [
  { value: "crear", label: "Crear" },
  { value: "modificar", label: "Modificar" },
  { value: "anular", label: "Anular" },
];

export function etiquetaEntidad(entidad: string): string {
  return ENTIDADES_AUDITADAS.find((opcion) => opcion.value === entidad)?.label ?? entidad;
}

export function etiquetaAccion(accion: string): string {
  return ACCIONES_AUDITORIA.find((opcion) => opcion.value === accion)?.label ?? accion;
}

export function verboAccion(accion: string): string {
  if (accion === "crear") return "creó";
  if (accion === "anular") return "anuló";
  return "modificó";
}

export function tonoAccion(accion: string): "exito" | "pendiente" | "peligro" {
  if (accion === "crear") return "exito";
  if (accion === "anular") return "peligro";
  return "pendiente";
}

const ETIQUETAS_CAMPO: Record<string, string> = {
  estado: "Estado",
  total: "Total",
  vencimiento: "Vencimiento",
  contacto_id: "Contacto",
  nombre: "Nombre",
  rnc_cedula: "RNC / Cédula",
  correo: "Correo",
  telefono: "Teléfono",
  activo: "Activo",
  precio: "Precio",
  costo: "Costo",
  cantidad: "Cantidad",
  monto: "Monto",
  metodo: "Método",
  ncf: "NCF",
  descripcion: "Descripción",
  limite_credito: "Límite de crédito",
};

export function etiquetaCampo(campo: string): string {
  return ETIQUETAS_CAMPO[campo] ?? campo.charAt(0).toLocaleUpperCase("es") + campo.slice(1);
}

const CAMPOS_MONEDA = new Set(["total", "monto", "precio", "costo", "limite_credito"]);

/** Valores crudos de la base ('true', '1534.00', 'efectivo') en español legible. */
export function formatearValorCampo(campo: string, valor: string | null): string {
  if (valor == null || valor === "") return "(vacío)";
  if (campo === "activo") return valor === "true" ? "Activo" : "Inactivo";
  if (campo === "metodo" || campo === "estado") {
    return valor.charAt(0).toLocaleUpperCase("es") + valor.slice(1);
  }
  if (CAMPOS_MONEDA.has(campo) && /^-?\d+(\.\d+)?$/.test(valor)) {
    return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2 }).format(Number(valor));
  }
  return valor;
}

// ---------------------------------------------------------------------------
// Pestaña "Historial": timeline del documento (ficha de factura, contacto,
// producto, etc.).
// ---------------------------------------------------------------------------

const LIMITE = 50;

const CLASES_ACCION: Record<string, string> = {
  crear: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  modificar: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  anular: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const ICONOS_ACCION: Record<string, typeof Plus> = {
  crear: Plus,
  modificar: Pencil,
  anular: Ban,
};

const CLASES_NEUTRAS = "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";

function ListaCambios({ entrada }: { readonly entrada: EntradaAuditoria }) {
  if (entrada.cambios.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {entrada.cambios.map((cambio) => (
        <li key={cambio.campo} className="text-muted-foreground text-xs">
          <span className="text-slate-700 dark:text-slate-300">{etiquetaCampo(cambio.campo)}:</span>{" "}
          <span className="line-through">{formatearValorCampo(cambio.campo, cambio.anterior)}</span>
          <span aria-hidden> → </span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {formatearValorCampo(cambio.campo, cambio.nuevo)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ItemHistorial({ entrada }: { readonly entrada: EntradaAuditoria }) {
  const clases = CLASES_ACCION[entrada.accion] ?? CLASES_NEUTRAS;
  const Icono = ICONOS_ACCION[entrada.accion] ?? History;

  return (
    <li className="relative">
      <span className={cn("absolute top-0 -left-9 flex size-6 items-center justify-center rounded-full", clases)}>
        <Icono className="size-3.5" aria-hidden />
      </span>

      <p className="text-sm">
        <span className="font-medium">{entrada.usuario_nombre.trim() || "Usuario"}</span> {verboAccion(entrada.accion)}{" "}
        <span className="text-muted-foreground">· {formatoFechaHora(entrada.creado_en)}</span>
      </p>

      <ListaCambios entrada={entrada} />
    </li>
  );
}

type Carga = { estado: "cargando" } | { estado: "error" } | { estado: "lista"; entradas: EntradaAuditoria[] };

/**
 * Historial de un documento: cada entrada dice quién actuó, cuándo y qué
 * campo cambió. Se usa como pestaña en la ficha de factura, contacto,
 * producto, etc.: recibe la entidad (`factura`, `contacto`, …) y su id.
 */
export function HistorialDocumento({ entidad, entidadId }: { readonly entidad: string; readonly entidadId: string }) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });

  useEffect(() => {
    let vigente = true;
    setCarga({ estado: "cargando" });

    consultarAuditoria({ entidad, entidadId, limite: LIMITE })
      .then((respuesta) => {
        if (!vigente) return;
        setCarga(respuesta == null ? { estado: "error" } : { estado: "lista", entradas: respuesta.entradas });
      })
      .catch(() => {
        if (vigente) setCarga({ estado: "error" });
      });

    return () => {
      vigente = false;
    };
  }, [entidad, entidadId]);

  if (carga.estado === "cargando") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Cargando historial…
      </div>
    );
  }

  if (carga.estado === "error") {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">No se pudo cargar el historial</p>
        <p className="text-muted-foreground text-sm">Recarga la página e inténtalo de nuevo.</p>
      </div>
    );
  }

  if (carga.entradas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-16 text-center">
        <History className="size-10 text-slate-300 dark:text-slate-600" />
        <p className="text-lg font-semibold">Sin actividad registrada</p>
        <p className="text-muted-foreground text-sm">Lo que los usuarios hagan con este documento aparecerá aquí.</p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-6 border-l pl-6">
      {carga.entradas.map((entrada) => (
        <ItemHistorial key={entrada.id} entrada={entrada} />
      ))}
    </ol>
  );
}
