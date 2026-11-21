"use client";

import { useEffect } from "react";

import { RotateCcw, TriangleAlert } from "@/components/icons";
import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Frontera de error del módulo: una consulta caída no deja la pantalla en blanco. */
export default function ErrorProductos({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ContenedorLista>
      <EncabezadoPagina titulo="Productos" migas={[{ etiqueta: "Productos" }]} />
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>No se pudieron cargar los productos</AlertTitle>
        <AlertDescription>
          Ocurrió un problema al leer el catálogo o su inventario. Vuelve a intentarlo; si persiste, revisa tu conexión.
        </AlertDescription>
      </Alert>
      <div>
        <Button type="button" variant="outline" onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          Reintentar
        </Button>
      </div>
    </ContenedorLista>
  );
}
