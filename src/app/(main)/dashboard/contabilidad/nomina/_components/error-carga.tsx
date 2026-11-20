import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { BotonReintentar } from "./reintentar";

/** Error de carga con el patrón del módulo: aviso, mensaje y "Reintentar". */
export function ErrorCarga({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <Alert variant="destructive" className="items-start">
      <TriangleAlert />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{mensaje}</span>
        <BotonReintentar />
      </AlertDescription>
    </Alert>
  );
}
