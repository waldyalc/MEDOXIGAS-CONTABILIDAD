import { TriangleAlert } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AlertaError({ mensaje }: { mensaje: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>No se pudo cargar el reporte</AlertTitle>
      <AlertDescription>{mensaje}</AlertDescription>
    </Alert>
  );
}
