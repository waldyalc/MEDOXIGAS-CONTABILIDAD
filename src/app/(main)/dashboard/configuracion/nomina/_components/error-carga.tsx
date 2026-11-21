"use client";

import { useRouter } from "next/navigation";

import { AlertTriangle } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Error de carga con el patrón común: alerta dentro del marco y “Reintentar”. */
export function ErrorCarga({ titulo, mensaje }: { readonly titulo: string; readonly mensaje: string }) {
  const router = useRouter();

  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{mensaje}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
