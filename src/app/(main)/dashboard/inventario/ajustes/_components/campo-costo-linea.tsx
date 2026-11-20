import { FORM_INPUT_GROUP } from "@/components/formularios/formulario";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { bloqueaCosto } from "@/lib/inventario/ajuste-formulario";
import type { ProductoInventario } from "@/lib/inventario/tipos";
import type { TipoAjuste } from "@/lib/inventario/validacion";

export const NOTA_COSTO_SALIDA = "El costo de la salida es siempre el promedio vigente";

/**
 * Costo unitario de una línea del ajuste. En la salida se muestra bloqueado el
 * costo promedio del producto, como en Alegra; en la entrada es editable.
 */
export function CampoCostoLinea({
  id,
  indice,
  tipo,
  producto,
  costo,
  error,
  disabled,
  onCambiar,
}: {
  readonly id: string;
  readonly indice: number;
  readonly tipo: TipoAjuste;
  readonly producto: ProductoInventario | null;
  readonly costo: string;
  readonly error: string | null;
  readonly disabled: boolean;
  readonly onCambiar: (valor: string) => void;
}) {
  const bloqueado = bloqueaCosto(tipo);
  const promedio = producto ? formatoMonedaCentavos(valorACentavos(producto.costo)) : "—";

  return (
    <InputGroup className={FORM_INPUT_GROUP}>
      {bloqueado ? null : (
        <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
          RD$
        </InputGroupAddon>
      )}
      <InputGroupInput
        id={id}
        inputMode="decimal"
        value={bloqueado ? promedio : costo}
        onChange={(evento) => onCambiar(evento.target.value)}
        readOnly={bloqueado}
        aria-readonly={bloqueado || undefined}
        title={bloqueado ? NOTA_COSTO_SALIDA : undefined}
        aria-label={`Costo unitario de la línea ${indice + 1}`}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        className={bloqueado ? "text-slate-700 dark:text-slate-300" : undefined}
      />
    </InputGroup>
  );
}
