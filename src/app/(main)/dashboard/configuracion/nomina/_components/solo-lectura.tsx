import { InfoIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Aviso que se muestra al perfil `lector` encima de la configuración. */
export function AvisoSoloLectura() {
  return (
    <Alert>
      <InfoIcon aria-hidden="true" />
      <AlertDescription>Solo lectura. Un administrador o contador puede editar esta configuración.</AlertDescription>
    </Alert>
  );
}
