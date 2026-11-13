import { valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { AsientoVista } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

export function AsientoContable({ asiento }: { asiento: AsientoVista }) {
  if (!asiento.asiento) {
    return (
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-medium">Asiento contable</h2>
        <p className="text-muted-foreground text-sm">Esta factura no tiene asiento contable.</p>
      </div>
    );
  }

  const debito = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const credito = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);
  const cuadrado = debito === credito;

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="border-b p-4">
        <h2 className="font-heading text-lg font-medium">Asiento contable</h2>
        <p className="text-muted-foreground text-sm">
          #{asiento.asiento.numero} · {formatoDia(asiento.asiento.fecha)} · {asiento.asiento.descripcion}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3 font-medium">Cuenta</th>
              <th className="p-3 font-medium">Descripción</th>
              <th className="p-3 text-right font-medium">Débito</th>
              <th className="p-3 text-right font-medium">Crédito</th>
            </tr>
          </thead>
          <tbody>
            {asiento.lineas.map((linea) => (
              <tr key={linea.id} className="border-b last:border-0">
                <td className="p-3">
                  <span className="font-mono text-xs">{linea.codigo}</span> {linea.nombre}
                </td>
                <td className="text-muted-foreground p-3">{linea.descripcion}</td>
                <td className="p-3 text-right">{linea.debito > 0 ? formatoMoneda(linea.debito) : "—"}</td>
                <td className="p-3 text-right">{linea.credito > 0 ? formatoMoneda(linea.credito) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="p-3" colSpan={2}>
                Totales
              </td>
              <td className="p-3 text-right">{formatoMoneda(debito / 100)}</td>
              <td className="p-3 text-right">{formatoMoneda(credito / 100)}</td>
            </tr>
            <tr>
              <td className="px-3 pb-3 text-right" colSpan={4}>
                {cuadrado ? (
                  <span className="font-medium text-emerald-600 text-sm">Cuadrado ✓</span>
                ) : (
                  <span className="font-medium text-destructive text-sm">Descuadrado</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
