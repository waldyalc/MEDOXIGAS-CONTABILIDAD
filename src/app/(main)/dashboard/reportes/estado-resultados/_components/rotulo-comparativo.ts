const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

interface Dia {
  anio: number;
  mes: number;
  dia: number;
}

function partes(iso: string): Dia {
  return {
    anio: Number(iso.slice(0, 4)),
    mes: Number(iso.slice(5, 7)),
    dia: Number(iso.slice(8, 10)),
  };
}

function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? "";
}

/**
 * Rótulo del encabezado de la tabla comparativa con el período en palabras y
 * los dos años comparados: "Del 1 al 30 de noviembre: Comparativo 2026 - 2025".
 * Un mes natural completo se lee con sus días y su nombre, como en Alegra.
 */
export function rotuloComparativo(desde: string, hasta: string): string {
  const inicio = partes(desde);
  const fin = partes(hasta);

  let periodo: string;
  if (inicio.anio === fin.anio && inicio.mes === fin.mes) {
    periodo = `Del ${inicio.dia} al ${fin.dia} de ${nombreMes(fin.mes)}`;
  } else if (inicio.anio === fin.anio) {
    periodo = `Del ${inicio.dia} de ${nombreMes(inicio.mes)} al ${fin.dia} de ${nombreMes(fin.mes)}`;
  } else {
    periodo = `Del ${inicio.dia} de ${nombreMes(inicio.mes)} de ${inicio.anio} al ${fin.dia} de ${nombreMes(fin.mes)} de ${fin.anio}`;
  }

  return `${periodo}: Comparativo ${fin.anio} - ${fin.anio - 1}`;
}
