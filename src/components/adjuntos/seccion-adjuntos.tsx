"use client";

import { type ChangeEvent, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";

import { usePagina } from "@/components/ficha/ficha-ui";
import { PaginadorLocal } from "@/components/listas/paginador-local";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { borrarAdjunto, descargarAdjunto, registrarAdjunto } from "@/lib/adjuntos/acciones";
import {
  type AdjuntoItem,
  BUCKET_DOCUMENTOS,
  etiquetaTipoAdjunto,
  formatoTamanoAdjunto,
  mensajeSubidaAdjunto,
  rutaAdjunto,
  type TipoEntidadAdjunto,
  validarAdjunto,
} from "@/lib/adjuntos/adjuntos";
import { formatoFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/client";

const ADJUNTOS_POR_PAGINA = 8;

const COLUMNAS: readonly ColumnaLista<AdjuntoItem>[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (adjunto) => (
      <span className="inline-flex max-w-72 items-center gap-2">
        <FileText className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate">{adjunto.nombre}</span>
      </span>
    ),
  },
  {
    clave: "tipo",
    encabezado: "Tipo",
    className: "w-24",
    celda: (adjunto) => <PillEstado tono="neutro">{etiquetaTipoAdjunto(adjunto.mime)}</PillEstado>,
  },
  {
    clave: "tamano",
    encabezado: "Tamaño",
    alineacion: "derecha",
    className: "w-24",
    celda: (adjunto) => formatoTamanoAdjunto(adjunto.bytes),
  },
  {
    clave: "subido",
    encabezado: "Subido por",
    className: "hidden lg:table-cell",
    celda: (adjunto) => <span className="text-muted-foreground">{adjunto.creadoPorNombre ?? "—"}</span>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    className: "hidden sm:table-cell",
    celda: (adjunto) => <span className="text-muted-foreground text-xs">{formatoFechaHora(adjunto.creadoEn)}</span>,
  },
];

interface Props {
  adjuntos: AdjuntoItem[];
  entidadTipo: TipoEntidadAdjunto;
  entidadId: string;
  puedeEscribir: boolean;
  /** true cuando un filtro dejó la lista vacía (no muestra el botón de subir). */
  filtrada?: boolean;
}

/**
 * Lista de adjuntos de una entidad con subida al bucket `documentos`,
 * descarga por URL firmada y borrado con confirmación. Se usa en la ficha de
 * contacto, la ficha de producto y la vista de factura.
 */
export function SeccionAdjuntos({ adjuntos, entidadTipo, entidadId, puedeEscribir, filtrada = false }: Props) {
  const router = useRouter();
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [borrando, setBorrando] = useState<AdjuntoItem | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const { pagina, setPagina } = usePagina(adjuntos.length, ADJUNTOS_POR_PAGINA);
  const visibles = adjuntos.slice(pagina * ADJUNTOS_POR_PAGINA, (pagina + 1) * ADJUNTOS_POR_PAGINA);

  async function subir(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0] ?? null;
    evento.target.value = "";
    if (archivo === null) return;

    const problema = validarAdjunto(archivo);
    if (problema) {
      setError(problema);
      return;
    }

    setError(null);
    setSubiendo(true);

    try {
      const supabase = createClient();
      const ruta = rutaAdjunto(entidadTipo, entidadId, archivo.type);
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .upload(ruta, archivo, { cacheControl: "3600", contentType: archivo.type, upsert: false });

      if (errorSubida) {
        setError(mensajeSubidaAdjunto(errorSubida.message));
        return;
      }

      const resultado = await registrarAdjunto({
        entidadTipo,
        entidadId,
        path: ruta,
        nombre: archivo.name,
        mime: archivo.type,
        bytes: archivo.size,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo subir el archivo. Intenta de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  async function descargar(adjunto: AdjuntoItem) {
    setError(null);
    const resultado = await descargarAdjunto(adjunto.id);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    if (resultado.url === undefined) {
      setError("No se pudo generar el enlace de descarga");
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  function cambiarBorrando(adjunto: AdjuntoItem | null) {
    setBorrando(adjunto);
    setErrorBorrado(null);
  }

  function confirmarBorrado() {
    const adjunto = borrando;
    if (adjunto === null) return;
    setErrorBorrado(null);

    iniciar(async () => {
      const resultado = await borrarAdjunto(adjunto.id);
      if (!resultado.ok) {
        setErrorBorrado(resultado.error);
        return;
      }
      setBorrando(null);
      router.refresh();
    });
  }

  const botonSubir = puedeEscribir ? (
    <Button size="sm" disabled={subiendo} onClick={() => entradaArchivo.current?.click()}>
      {subiendo ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
      Adjuntar archivo
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={entradaArchivo}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={subir}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {adjuntos.length === 1 ? "1 adjunto" : `${adjuntos.length} adjuntos`} · PNG, JPG o PDF de hasta 10 MB
        </p>
        {botonSubir}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <TablaLista
        columnas={COLUMNAS}
        filas={visibles}
        claveFila={(adjunto) => adjunto.id}
        vacio={{
          titulo: filtrada ? "Sin adjuntos de este tipo" : "Sin adjuntos todavía",
          descripcion: filtrada
            ? "Prueba con otro tipo de documento."
            : "Aquí aparecen los contratos, soportes y comprobantes adjuntos.",
          icono: <Paperclip className="size-10" />,
          accion: botonSubir,
          filtrada,
        }}
        acciones={(adjunto) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Descargar ${adjunto.nombre}`}
              onClick={() => void descargar(adjunto)}
            >
              <Download />
            </Button>
            {puedeEscribir ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar ${adjunto.nombre}`}
                onClick={() => cambiarBorrando(adjunto)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            ) : null}
          </div>
        )}
      />

      {adjuntos.length > ADJUNTOS_POR_PAGINA ? (
        <PaginadorLocal
          total={adjuntos.length}
          pagina={pagina}
          setPagina={setPagina}
          porPagina={ADJUNTOS_POR_PAGINA}
          etiqueta="adjuntos"
        />
      ) : null}

      <AlertDialog
        open={borrando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) cambiarBorrando(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{borrando?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>
              El archivo se borrará de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorBorrado ? (
            <Alert variant="destructive">
              <AlertDescription>{errorBorrado}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pendiente} onClick={confirmarBorrado}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Eliminar adjunto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
