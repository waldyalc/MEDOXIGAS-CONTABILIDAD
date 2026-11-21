import { TicketPos } from "@/components/pos/ticket-pos";
import type { TicketPOSPayload } from "@/lib/pos/impresion";

/**
 * Ticket térmico para la vista previa de Configuración → Punto de venta y la
 * impresión de prueba del editor. Delega en `TicketPos`, el mismo componente
 * que imprime el POS, para que la vista coincida con el papel: logo, orden de
 * bloques y anchos de 80/57 mm. El ticket es siempre negro sobre blanco.
 */
export function TicketPosVista({
  payload,
  className,
}: {
  readonly payload: TicketPOSPayload;
  readonly className?: string;
}) {
  return <TicketPos payload={payload} vistaPrevia className={className} />;
}
