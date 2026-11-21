"use client";

import { useEffect, useState } from "react";

import { Loader2, Search } from "@/components/icons";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DocumentoVista } from "@/lib/cotizaciones/tipos";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { centavosATexto } from "@/lib/pos/calculo";
import type { CotizacionAbiertaPOS } from "@/lib/pos/tipos";

import { cargarCotizacionPOS, cotizacionesAbiertasPOS } from "../acciones-pos";
import { useCarritoPOS } from "../carrito-pos-provider";

function decimalDe(valor: number): string {
  return centavosATexto(Math.round(valor * 100));
}

export function DialogoCargarCotizacion({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const carrito = useCarritoPOS();
  const [q, setQ] = useState("");
  const [cotizaciones, setCotizaciones] = useState<CotizacionAbiertaPOS[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<DocumentoVista | null>(null);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    let activo = true;
    setCargando(true);
    setError(null);
    const temporizador = setTimeout(() => {
      cotizacionesAbiertasPOS(q.trim())
        .then((resultado) => {
          if (!activo) return;
          if (!resultado.ok) {
            setError(resultado.error);
            setCotizaciones([]);
            return;
          }
          setCotizaciones(resultado.data);
        })
        .catch(() => {
          if (activo) setError("No se pudieron cargar las cotizaciones. Revisa tu conexión.");
        })
        .finally(() => {
          if (activo) setCargando(false);
        });
    }, 300);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [abierto, q]);

  async function elegir(id: string) {
    setAplicando(true);
    setError(null);
    try {
      const resultado = await cargarCotizacionPOS(id);
      if (!resultado.ok || !resultado.data) {
        setError(resultado.ok ? "La cotización no existe o no está abierta." : resultado.error);
        return;
      }
      if (carrito.activa.lineas.length > 0) {
        setPendiente(resultado.data);
        return;
      }
      aplicar(resultado.data);
    } catch {
      setError("No se pudo cargar la cotización. Revisa tu conexión.");
    } finally {
      setAplicando(false);
    }
  }

  function aplicar(vista: DocumentoVista) {
    carrito.aplicarCotizacion({
      id: vista.documento.id,
      numero: vista.documento.numero,
      contactoId: vista.documento.contacto_id,
      listaPrecioId: carrito.activa.listaPrecioId,
      lineas: vista.lineas.map((linea) => ({
        productoId: linea.producto_id,
        descripcion: linea.descripcion,
        referencia: null,
        cantidad: decimalDe(linea.cantidad),
        unidadId: null,
        unidadNombre: null,
        precio: decimalDe(linea.precio),
        descuentoPct: decimalDe(linea.descuento_pct),
        itbisTasa: decimalDe(linea.itbis_tasa),
      })),
    });
    setPendiente(null);
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(nuevo) => (nuevo ? null : onCerrar())}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Cargar cotización</DialogTitle>
          <DialogDescription>Busca por número de cotización o por cliente.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(evento) => setQ(evento.target.value)}
            placeholder="Número o cliente…"
            aria-label="Buscar cotización"
            className="pl-8"
          />
          {cargando ? (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="max-h-[45vh] overflow-y-auto">
          {cotizaciones.length === 0 && !cargando ? (
            <div className="border-border rounded-lg border px-4 py-8 text-center">
              <p className="font-medium">No hay cotizaciones abiertas.</p>
              <p className="text-muted-foreground text-sm">Guarda una cotización desde el carrito para verla aquí.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y">
              {cotizaciones.map((cotizacion) => (
                <button
                  key={cotizacion.id}
                  type="button"
                  className="hover:bg-muted flex items-center justify-between gap-3 px-2 py-2 text-left"
                  disabled={aplicando}
                  onClick={() => void elegir(cotizacion.id)}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{`Cotización No ${cotizacion.numero}`}</span>
                    <span className="text-muted-foreground truncate text-xs">{cotizacion.cliente_nombre}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end text-xs">
                    <span className="tabular-nums">{formatoDia(cotizacion.fecha)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      Vence {formatoDia(cotizacion.vencimiento)}
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {formatoMoneda(cotizacion.total)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={pendiente !== null} onOpenChange={(nuevo) => (nuevo ? null : setPendiente(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar el carrito?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Se quitarán los productos actuales y se cargará la cotización No ${pendiente?.documento.numero ?? ""}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => (pendiente ? aplicar(pendiente) : null)}>Reemplazar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
