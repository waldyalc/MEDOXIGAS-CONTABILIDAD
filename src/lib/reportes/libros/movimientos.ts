import { centavos } from "../dinero";
import { signoNeto } from "./comun";
import { ETIQUETAS_DOCUMENTO } from "./parametros";
import type { FilaMovimiento } from "./tipos";

export interface OpcionesMovimientosCuenta {
  saldoInicial: number;
  buscarAsiento: string;
}

export interface FilaMovimientoCuenta {
  clave: string;
  tipoDocumento: string;
  fecha: string;
  asientoNumero: number;
  estado: string;
  tercero: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  saldoInicial: number;
  debito: number;
  credito: number;
  neto: number;
  saldoFinal: number;
}

export interface TotalesMovimientosCuenta {
  saldoInicial: number;
  debitos: number;
  creditos: number;
  neto: number;
  saldoFinal: number;
}

export interface MovimientosCuentaCalculado {
  filas: FilaMovimientoCuenta[];
  totales: TotalesMovimientosCuenta;
}

export function calcularMovimientosCuenta(
  filas: readonly FilaMovimiento[],
  opciones: OpcionesMovimientosCuenta,
): MovimientosCuentaCalculado {
  const consulta = opciones.buscarAsiento.trim();
  const filtradas = consulta ? filas.filter((fila) => String(fila.asiento_numero).includes(consulta)) : [...filas];

  let corrido = opciones.saldoInicial;
  const calculadas = filtradas.map<FilaMovimientoCuenta>((fila, indice) => {
    const debito = centavos(fila.debito);
    const credito = centavos(fila.credito);
    const neto = signoNeto(fila.cuenta_naturaleza, debito, credito);
    const saldoInicial = corrido;
    corrido += neto;

    return {
      clave: `${fila.asiento_id}-${indice}`,
      tipoDocumento: ETIQUETAS_DOCUMENTO[fila.origen_tipo] ?? fila.origen_tipo,
      fecha: fila.fecha,
      asientoNumero: fila.asiento_numero,
      estado: fila.estado || "Contabilizado",
      tercero: fila.tercero ?? "Sin tercero",
      cuentaCodigo: fila.cuenta_codigo,
      cuentaNombre: fila.cuenta_nombre,
      saldoInicial,
      debito,
      credito,
      neto,
      saldoFinal: corrido,
    };
  });

  const debitos = calculadas.reduce((total, fila) => total + fila.debito, 0);
  const creditos = calculadas.reduce((total, fila) => total + fila.credito, 0);
  const neto = calculadas.reduce((total, fila) => total + fila.neto, 0);

  return {
    filas: calculadas,
    totales: {
      saldoInicial: opciones.saldoInicial,
      debitos,
      creditos,
      neto,
      saldoFinal: opciones.saldoInicial + neto,
    },
  };
}
