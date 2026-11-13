import { centavos, formatearRd } from "../../dinero";
import { calcularEstadoResultados } from "../../resultados";
import type { FilaEstadoResultados } from "../../tipos";

export interface VentaFecha {
  fecha: string;
  monto: number | string | null;
}

export interface ItemRankingAnual {
  id: string | null;
  nombre: string;
  monto: number | string | null;
}

export interface DatosReporteAnual {
  anio: number;
  hoy: string;
  comparar: boolean;
  estado: readonly FilaEstadoResultados[];
  estadoAnterior: readonly FilaEstadoResultados[];
  ventas: readonly VentaFecha[];
  ventasAnterior: readonly VentaFecha[];
  productos: readonly ItemRankingAnual[];
  clientes: readonly ItemRankingAnual[];
  gastos: readonly ItemRankingAnual[];
}

export interface PuntoSerieAnual {
  clave: string;
  etiqueta: string;
  actual: number;
  anterior: number;
}

export interface FilaParticipacionAnual {
  id: string | null;
  nombre: string;
  monto: number;
  participacion: number;
}

export interface ResumenAnual {
  promedioMensual: number;
  promedioSemanal: number;
  promedioDiario: number;
  ventas: number;
  costosYGastos: number;
  utilidadNeta: number;
  margenNeto: number;
  ventasAnterior: number;
  variacionVentas: number;
}

export interface ReporteAnualCalculado {
  resumen: ResumenAnual;
  serieMensual: PuntoSerieAnual[];
  serieDiaria: PuntoSerieAnual[];
  productos: FilaParticipacionAnual[];
  clientes: FilaParticipacionAnual[];
  gastos: FilaParticipacionAnual[];
  gastosTotales: number;
  participacionGastosEnVentas: number;
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const FORMATO_NUMERO = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

function fechaIso(anio: number, mes: number, dia: number): string {
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

function diasDelAnio(anio: number): number {
  return Math.floor((Date.UTC(anio + 1, 0, 1) - Date.UTC(anio, 0, 1)) / 86_400_000);
}

function diaDelAnio(fecha: string): number {
  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  const dia = Number(fecha.slice(8, 10));
  return Math.floor((Date.UTC(anio, mes - 1, dia) - Date.UTC(anio, 0, 1)) / 86_400_000) + 1;
}

function diasParaPromedio(anio: number, hoy: string): number {
  const anioHoy = Number(hoy.slice(0, 4));
  const dias = diasDelAnio(anio);

  if (anio !== anioHoy) return dias;
  return Math.min(Math.max(1, diaDelAnio(hoy)), dias);
}

function sumarVentas(ventas: readonly VentaFecha[]): number {
  return ventas.reduce((total, venta) => total + centavos(venta.monto), 0);
}

function agruparVentas(ventas: readonly VentaFecha[], tipo: "mes" | "dia"): Map<string, number> {
  const grupos = new Map<string, number>();

  for (const venta of ventas) {
    const clave = tipo === "mes" ? venta.fecha.slice(0, 7) : venta.fecha.slice(0, 10);
    grupos.set(clave, (grupos.get(clave) ?? 0) + centavos(venta.monto));
  }

  return grupos;
}

function serieMensual(
  ventas: readonly VentaFecha[],
  ventasAnterior: readonly VentaFecha[],
  anio: number,
): PuntoSerieAnual[] {
  const actual = agruparVentas(ventas, "mes");
  const anterior = agruparVentas(ventasAnterior, "mes");

  return MESES_CORTOS.map((etiqueta, indice) => {
    const mes = indice + 1;
    return {
      clave: `${anio}-${dosDigitos(mes)}`,
      etiqueta,
      actual: actual.get(`${anio}-${dosDigitos(mes)}`) ?? 0,
      anterior: anterior.get(`${anio - 1}-${dosDigitos(mes)}`) ?? 0,
    };
  });
}

function serieDiaria(
  ventas: readonly VentaFecha[],
  ventasAnterior: readonly VentaFecha[],
  anio: number,
): PuntoSerieAnual[] {
  const actual = agruparVentas(ventas, "dia");
  const anterior = agruparVentas(ventasAnterior, "dia");
  const dias = diasDelAnio(anio);
  const puntos: PuntoSerieAnual[] = [];

  for (let dia = 1; dia <= dias; dia += 1) {
    const fecha = new Date(Date.UTC(anio, 0, dia));
    const mes = fecha.getUTCMonth() + 1;
    const numeroDia = fecha.getUTCDate();
    const clave = fechaIso(anio, mes, numeroDia);
    const fechaAnterior = new Date(Date.UTC(anio - 1, fecha.getUTCMonth(), numeroDia));
    const claveAnterior = fechaAnterior.getUTCMonth() === fecha.getUTCMonth() ? fechaIso(anio - 1, mes, numeroDia) : "";

    puntos.push({
      clave,
      etiqueta: `${numeroDia} ${MESES_CORTOS[mes - 1] ?? ""}`,
      actual: actual.get(clave) ?? 0,
      anterior: claveAnterior ? (anterior.get(claveAnterior) ?? 0) : 0,
    });
  }

  return puntos;
}

function agregarRanking(items: readonly ItemRankingAnual[]): Map<string, FilaParticipacionAnual> {
  const grupos = new Map<string, FilaParticipacionAnual>();

  for (const item of items) {
    const clave = item.id ?? `nombre:${item.nombre}`;
    const existente = grupos.get(clave);

    if (existente) {
      existente.monto += centavos(item.monto);
      continue;
    }

    grupos.set(clave, {
      id: item.id,
      nombre: item.nombre,
      monto: centavos(item.monto),
      participacion: 0,
    });
  }

  return grupos;
}

function ranking(items: readonly ItemRankingAnual[], total: number): FilaParticipacionAnual[] {
  return [...agregarRanking(items).values()]
    .map((fila) => ({
      ...fila,
      participacion: total > 0 ? redondear2((fila.monto / total) * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre));
}

export function calcularReporteAnual(datos: DatosReporteAnual): ReporteAnualCalculado {
  const estado = calcularEstadoResultados(datos.estado);
  const ventas = sumarVentas(datos.ventas);
  const ventasAnterior = sumarVentas(datos.ventasAnterior);
  const costosYGastos = estado.totalCostos + estado.totalGastos;
  const utilidadNeta = ventas - costosYGastos;
  const dias = diasParaPromedio(datos.anio, datos.hoy);
  const gastosTotales = datos.gastos.reduce((total, gasto) => total + centavos(gasto.monto), 0);

  return {
    resumen: {
      promedioMensual: Math.round(ventas / 12),
      promedioSemanal: Math.round(ventas / (dias / 7)),
      promedioDiario: Math.round(ventas / dias),
      ventas,
      costosYGastos,
      utilidadNeta,
      margenNeto: ventas > 0 ? redondear2((utilidadNeta / ventas) * 100) : 0,
      ventasAnterior,
      variacionVentas: ventasAnterior > 0 ? redondear2(((ventas - ventasAnterior) / ventasAnterior) * 100) : 0,
    },
    serieMensual: serieMensual(datos.ventas, datos.ventasAnterior, datos.anio),
    serieDiaria: serieDiaria(datos.ventas, datos.ventasAnterior, datos.anio),
    productos: ranking(datos.productos, ventas),
    clientes: ranking(datos.clientes, ventas),
    gastos: ranking(datos.gastos, gastosTotales),
    gastosTotales,
    participacionGastosEnVentas: ventas > 0 ? redondear2((gastosTotales / ventas) * 100) : 0,
  };
}

export function formatearPorcentajeAnual(valor: number): string {
  return `${FORMATO_NUMERO.format(valor)}%`;
}

export function describirVariacionVentas(resumen: ResumenAnual, anio: number): string {
  const verbo = resumen.variacionVentas < 0 ? "disminuyeron" : "aumentaron";
  return `Las ventas netas fueron ${formatearRd(resumen.ventas)} y ${verbo} ${formatearPorcentajeAnual(
    Math.abs(resumen.variacionVentas),
  )} frente a ${anio - 1}`;
}
