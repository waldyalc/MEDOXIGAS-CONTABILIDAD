"use client";

import { useEffect, useMemo, useState } from "react";

import type { ProductoPOS } from "@/lib/pos/tipos";
import { BUCKET_IMAGENES_PRODUCTO } from "@/lib/productos/imagen";
import { createClient } from "@/lib/supabase/client";

const SEGUNDOS_FIRMA = 3600;

/**
 * Firma en lote (una sola llamada) las URLs de las imágenes del catálogo en el
 * bucket privado `productos` y devuelve `producto_id` → URL firmada (1 h).
 * El rol `authenticated` ya puede leer el bucket, así que la firma se hace en
 * el cliente sin tocar las consultas del catálogo. Si un producto no tiene
 * imagen o la firma falla, queda fuera del mapa y su tarjeta muestra el icono.
 */
export function useImagenesCatalogo(productos: ProductoPOS[]): Map<string, string> {
  const [imagenes, setImagenes] = useState<Map<string, string>>(new Map());

  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const rutas = new Map<string, string>();
    for (const producto of productos) {
      if (producto.imagen_path) rutas.set(producto.producto_id, producto.imagen_path);
    }
    if (rutas.size === 0 || !supabase) {
      setImagenes(new Map());
      return;
    }

    let cancelado = false;

    void supabase.storage
      .from(BUCKET_IMAGENES_PRODUCTO)
      .createSignedUrls([...rutas.values()], SEGUNDOS_FIRMA)
      .then(({ data, error }) => {
        if (cancelado || error || !data) return;
        const mapa = new Map<string, string>();
        let indice = 0;
        for (const productoId of rutas.keys()) {
          const firmada = data[indice]?.signedUrl;
          if (firmada) mapa.set(productoId, firmada);
          indice += 1;
        }
        if (!cancelado) setImagenes(mapa);
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, [productos, supabase]);

  return imagenes;
}
