const UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];

const ESPECIALES: Record<number, string> = {
  10: "diez",
  11: "once",
  12: "doce",
  13: "trece",
  14: "catorce",
  15: "quince",
  16: "dieciséis",
  17: "diecisiete",
  18: "dieciocho",
  19: "diecinueve",
  20: "veinte",
  21: "veintiuno",
  22: "veintidós",
  23: "veintitrés",
  24: "veinticuatro",
  25: "veinticinco",
  26: "veintiséis",
  27: "veintisiete",
  28: "veintiocho",
  29: "veintinueve",
};

const DECENAS: Record<number, string> = {
  3: "treinta",
  4: "cuarenta",
  5: "cincuenta",
  6: "sesenta",
  7: "setenta",
  8: "ochenta",
  9: "noventa",
};

const CENTENAS: Record<number, string> = {
  1: "ciento",
  2: "doscientos",
  3: "trescientos",
  4: "cuatrocientos",
  5: "quinientos",
  6: "seiscientos",
  7: "setecientos",
  8: "ochocientos",
  9: "novecientos",
};

const LIMITE = 999999999999;

function tresDigitos(numero: number): string {
  if (numero === 0) return "";
  if (numero === 100) return "cien";
  if (numero < 10) return UNIDADES[numero] ?? "";
  if (numero < 30) return ESPECIALES[numero] ?? "";

  if (numero < 100) {
    const decena = DECENAS[Math.floor(numero / 10)] ?? "";
    const unidad = numero % 10;
    return unidad === 0 ? decena : `${decena} y ${UNIDADES[unidad] ?? ""}`;
  }

  const centena = CENTENAS[Math.floor(numero / 100)] ?? "";
  const resto = numero % 100;
  return resto === 0 ? centena : `${centena} ${tresDigitos(resto)}`;
}

function apocopar(texto: string): string {
  if (texto.endsWith("veintiuno")) return `${texto.slice(0, -"veintiuno".length)}veintiún`;
  if (texto.endsWith("uno")) return `${texto.slice(0, -"uno".length)}un`;
  return texto;
}

function convertir(numero: number): string {
  if (numero === 0) return "cero";
  if (numero < 1000) return tresDigitos(numero);

  if (numero < 1000000) {
    const miles = Math.floor(numero / 1000);
    const resto = numero % 1000;
    const parteMiles = miles === 1 ? "mil" : `${apocopar(tresDigitos(miles))} mil`;
    return resto === 0 ? parteMiles : `${parteMiles} ${tresDigitos(resto)}`;
  }

  const millones = Math.floor(numero / 1000000);
  const resto = numero % 1000000;
  const parteMillones = millones === 1 ? "un millón" : `${apocopar(convertir(millones))} millones`;
  return resto === 0 ? parteMillones : `${parteMillones} ${convertir(resto)}`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function montoEnLetras(monto: number): string {
  if (!Number.isFinite(monto) || monto < 0) return "Cero";

  const centavos = Math.round(monto * 100);
  const entero = Math.floor(centavos / 100);
  const decimales = centavos % 100;

  if (entero > LIMITE) return "Cero";

  const letras = convertir(entero);
  if (decimales === 0) return capitalizar(letras);

  return capitalizar(`${letras} con ${String(decimales).padStart(2, "0")}/100`);
}
