import { centavos } from "../../dinero";
import { normalizar } from "./texto";
import type { ClienteVentas, FilaVentaCliente, ResumenVentasCliente, TotalesVentas } from "./tipos";

function sumarClientes(clientes: readonly ClienteVentas[]): TotalesVentas {
  return clientes.reduce<TotalesVentas>(
    (totales, cliente) => ({
      numeroVentas: totales.numeroVentas + cliente.numeroVentas,
      subtotal: totales.subtotal + cliente.subtotal,
      descuentos: totales.descuentos + cliente.descuentos,
      devoluciones: totales.devoluciones + cliente.devoluciones,
      antesImpuestos: totales.antesImpuestos + cliente.antesImpuestos,
      impuestos: totales.impuestos + cliente.impuestos,
      despuesImpuestos: totales.despuesImpuestos + cliente.despuesImpuestos,
    }),
    {
      numeroVentas: 0,
      subtotal: 0,
      descuentos: 0,
      devoluciones: 0,
      antesImpuestos: 0,
      impuestos: 0,
      despuesImpuestos: 0,
    },
  );
}

/** Agrupa facturas por cliente; los montos van a centavos enteros. */
export function calcularVentasPorCliente(filas: readonly FilaVentaCliente[]): ResumenVentasCliente {
  const porContacto = new Map<string, ClienteVentas>();

  for (const fila of filas) {
    let cliente = porContacto.get(fila.contactoId);

    if (cliente == null) {
      cliente = {
        contactoId: fila.contactoId,
        contactoNombre: fila.contactoNombre,
        numeroVentas: 0,
        subtotal: 0,
        descuentos: 0,
        devoluciones: 0,
        antesImpuestos: 0,
        impuestos: 0,
        despuesImpuestos: 0,
      };
      porContacto.set(fila.contactoId, cliente);
    }

    const descuento = centavos(fila.descuento);
    const neto = centavos(fila.subtotal);

    cliente.numeroVentas += 1;
    cliente.subtotal += neto + descuento;
    cliente.descuentos += descuento;
    cliente.antesImpuestos += neto;
    cliente.impuestos += centavos(fila.itbis);
    cliente.despuesImpuestos += centavos(fila.total);
  }

  const clientes = [...porContacto.values()].sort(
    (a, b) => b.despuesImpuestos - a.despuesImpuestos || a.contactoNombre.localeCompare(b.contactoNombre, "es"),
  );

  return { clientes, totales: sumarClientes(clientes) };
}

export function filtrarClientes(clientes: readonly ClienteVentas[], busqueda: string): ClienteVentas[] {
  const texto = normalizar(busqueda);
  if (texto === "") return [...clientes];

  return clientes.filter((cliente) => normalizar(cliente.contactoNombre).includes(texto));
}

export function resumirClientes(clientes: readonly ClienteVentas[]): TotalesVentas {
  return sumarClientes(clientes);
}

export function mejoresPorIngresos(clientes: readonly ClienteVentas[], limite = 5): ClienteVentas[] {
  return [...clientes].sort((a, b) => b.despuesImpuestos - a.despuesImpuestos).slice(0, limite);
}

export function mejoresPorVentas(clientes: readonly ClienteVentas[], limite = 5): ClienteVentas[] {
  return [...clientes]
    .sort((a, b) => b.numeroVentas - a.numeroVentas || b.despuesImpuestos - a.despuesImpuestos)
    .slice(0, limite);
}

export function totalPaginas(totalFilas: number, porPagina = 10): number {
  return Math.max(1, Math.ceil(totalFilas / porPagina));
}

export function paginar<T>(filas: readonly T[], pagina: number, porPagina = 10): T[] {
  const inicio = (pagina - 1) * porPagina;
  return filas.slice(inicio, inicio + porPagina);
}
