import { centavos } from "./dinero";
import type { FilaCxc } from "./tipos";

export interface ClienteCxc {
  contactoId: string;
  contactoNombre: string;
  facturas: number;
  total: number;
  pagado: number;
  saldo: number;
  saldoVencido: number;
  diasVencida: number;
  vencidas: number;
}

export interface ResumenCxc {
  clientes: ClienteCxc[];
  totalSaldo: number;
  totalVencido: number;
}

export function agruparCxc(filas: readonly FilaCxc[]): ResumenCxc {
  const porContacto = new Map<string, ClienteCxc>();

  for (const fila of filas) {
    let cliente = porContacto.get(fila.contacto_id);

    if (cliente == null) {
      cliente = {
        contactoId: fila.contacto_id,
        contactoNombre: fila.contacto_nombre,
        facturas: 0,
        total: 0,
        pagado: 0,
        saldo: 0,
        saldoVencido: 0,
        diasVencida: 0,
        vencidas: 0,
      };
      porContacto.set(fila.contacto_id, cliente);
    }

    const saldo = centavos(fila.saldo);
    const dias = fila.dias_vencida ?? 0;

    cliente.facturas += 1;
    cliente.total += centavos(fila.total);
    cliente.pagado += centavos(fila.pagado);
    cliente.saldo += saldo;

    if (saldo > 0 && dias > 0) {
      cliente.vencidas += 1;
      cliente.saldoVencido += saldo;
      cliente.diasVencida = Math.max(cliente.diasVencida, dias);
    }
  }

  const clientes = [...porContacto.values()].sort(
    (a, b) => b.saldo - a.saldo || a.contactoNombre.localeCompare(b.contactoNombre),
  );

  return {
    clientes,
    totalSaldo: clientes.reduce((total, cliente) => total + cliente.saldo, 0),
    totalVencido: clientes.reduce((total, cliente) => total + cliente.saldoVencido, 0),
  };
}
