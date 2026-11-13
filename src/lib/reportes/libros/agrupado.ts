import { centavos } from "../dinero";
import { etiquetaTercero, signoNeto } from "./comun";
import { ETIQUETAS_DOCUMENTO } from "./parametros";
import type { FilaMovimiento, FilaSaldoCuenta, FilaSaldoTercero } from "./tipos";

export type AgruparPor = "cuenta" | "tercero";

export interface DetalleAgrupado {
  clave: string;
  asientoNumero: number;
  fecha: string;
  estado: string;
  tercero: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  tipoDocumento: string;
  debito: number;
  credito: number;
  neto: number;
}

export interface GrupoAgrupado {
  clave: string;
  etiqueta: string;
  saldoInicial: number;
  debito: number;
  credito: number;
  neto: number;
  saldoFinal: number;
  detalles: DetalleAgrupado[];
}

export interface TotalesAgrupado {
  saldoInicial: number;
  debito: number;
  credito: number;
  neto: number;
  saldoFinal: number;
}

export interface AgrupadoCalculado {
  grupos: GrupoAgrupado[];
  total: TotalesAgrupado;
}

export function calcularAgrupado(
  filas: readonly FilaMovimiento[],
  saldosCuenta: readonly FilaSaldoCuenta[],
  saldosTercero: readonly FilaSaldoTercero[],
  agruparPor: AgruparPor,
): AgrupadoCalculado {
  const grupos = new Map<string, GrupoAgrupado>();

  function obtenerGrupo(clave: string, etiqueta: string, saldoInicial: number): GrupoAgrupado {
    const existente = grupos.get(clave);
    if (existente) return existente;

    const grupo: GrupoAgrupado = {
      clave,
      etiqueta,
      saldoInicial,
      debito: 0,
      credito: 0,
      neto: 0,
      saldoFinal: saldoInicial,
      detalles: [],
    };
    grupos.set(clave, grupo);
    return grupo;
  }

  const iniciales = new Map<string, { etiqueta: string; saldo: number }>();

  if (agruparPor === "cuenta") {
    for (const saldo of saldosCuenta) {
      const clave = `cuenta:${saldo.cuenta_codigo}`;
      const actual = iniciales.get(clave);
      iniciales.set(clave, {
        etiqueta: `${saldo.cuenta_codigo} · ${saldo.cuenta_nombre}`,
        saldo: (actual?.saldo ?? 0) + centavos(saldo.saldo_inicial),
      });
    }
  } else {
    for (const saldo of saldosTercero) {
      const clave = `tercero:${saldo.contacto_id ?? "sin-tercero"}`;
      const actual = iniciales.get(clave);
      iniciales.set(clave, {
        etiqueta: etiquetaTercero(saldo.tercero),
        saldo: (actual?.saldo ?? 0) + centavos(saldo.saldo_inicial),
      });
    }
  }

  for (const [clave, inicial] of iniciales) {
    obtenerGrupo(clave, inicial.etiqueta, inicial.saldo);
  }

  for (const fila of filas) {
    const debito = centavos(fila.debito);
    const credito = centavos(fila.credito);
    const neto = signoNeto(fila.cuenta_naturaleza, debito, credito);

    const clave =
      agruparPor === "cuenta" ? `cuenta:${fila.cuenta_codigo}` : `tercero:${fila.contacto_id ?? "sin-tercero"}`;
    const etiqueta =
      agruparPor === "cuenta" ? `${fila.cuenta_codigo} · ${fila.cuenta_nombre}` : etiquetaTercero(fila.tercero);

    const grupo = obtenerGrupo(clave, etiqueta, 0);
    grupo.debito += debito;
    grupo.credito += credito;
    grupo.neto += neto;
    grupo.saldoFinal = grupo.saldoInicial + grupo.neto;
    grupo.detalles.push({
      clave: `${fila.asiento_id}-${fila.cuenta_id}-${grupo.detalles.length}`,
      asientoNumero: fila.asiento_numero,
      fecha: fila.fecha,
      estado: fila.estado || "Contabilizado",
      tercero: fila.tercero ?? "Sin tercero",
      cuentaCodigo: fila.cuenta_codigo,
      cuentaNombre: fila.cuenta_nombre,
      tipoDocumento: ETIQUETAS_DOCUMENTO[fila.origen_tipo] ?? fila.origen_tipo,
      debito,
      credito,
      neto,
    });
  }

  const ordenados = [...grupos.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true }));

  const total = ordenados.reduce<TotalesAgrupado>(
    (acumulado, grupo) => ({
      saldoInicial: acumulado.saldoInicial + grupo.saldoInicial,
      debito: acumulado.debito + grupo.debito,
      credito: acumulado.credito + grupo.credito,
      neto: acumulado.neto + grupo.neto,
      saldoFinal: acumulado.saldoFinal + grupo.saldoFinal,
    }),
    { saldoInicial: 0, debito: 0, credito: 0, neto: 0, saldoFinal: 0 },
  );

  return { grupos: ordenados, total };
}
