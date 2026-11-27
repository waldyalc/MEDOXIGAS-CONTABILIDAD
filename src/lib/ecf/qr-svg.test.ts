import { describe, expect, it } from "vitest";

import { generarDataUriQr, generarMatrizQr, generarSvgQr, generarVectorQr } from "./qr-svg";
import { createHash } from "node:crypto";

const URL_DGII =
  "https://ecf.dgii.gov.do/ecf/ConsultaTimbre?RncEmisor=130893489&RncComprador=430069574&ENCF=E450000000122&FechaEmision=25-11-2026&MontoTotal=266916.00&FechaFirma=26-11-2026%2008:25:29&CodigoSeguridad=R067%2BU";

function leer(matriz: boolean[][], x: number, y: number): boolean {
  return matriz[y]?.[x] ?? false;
}

function hashMatriz(matriz: boolean[][]): string {
  const bits = matriz.map((fila) => fila.map((modulo) => (modulo ? "1" : "0")).join("")).join("");
  return createHash("sha256").update(bits).digest("hex");
}

function codewordFormato(nivelBits: number, mascara: number): number {
  const datos = (nivelBits << 3) | mascara;
  let resto = datos;
  for (let indice = 0; indice < 10; indice++) {
    resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  }
  return ((datos << 10) | resto) ^ 0x5412;
}

function distanciaHamming(a: number, b: number): number {
  let diferencia = a ^ b;
  let distancia = 0;
  while (diferencia !== 0) {
    distancia += diferencia & 1;
    diferencia >>>= 1;
  }
  return distancia;
}

function posicionesFormatoPrimeraCopia(): [number, number, number][] {
  const posiciones: [number, number, number][] = [];
  for (let indice = 0; indice <= 5; indice++) posiciones.push([8, indice, indice]);
  posiciones.push([8, 7, 6], [8, 8, 7], [7, 8, 8]);
  for (let indice = 9; indice < 15; indice++) posiciones.push([14 - indice, 8, indice]);
  return posiciones;
}

function leerFormato(matriz: boolean[][]): { nivelBits: number; mascara: number; distancia: number } {
  let bits = 0;
  for (const [x, y, indice] of posicionesFormatoPrimeraCopia()) {
    if (leer(matriz, x, y)) bits |= 1 << indice;
  }

  let mejor: { nivelBits: number; mascara: number; distancia: number } | null = null;
  for (const nivelBits of [0, 1, 2, 3]) {
    for (let mascara = 0; mascara < 8; mascara++) {
      const distancia = distanciaHamming(bits, codewordFormato(nivelBits, mascara));
      if (!mejor || distancia < mejor.distancia) mejor = { nivelBits, mascara, distancia };
    }
  }
  if (!mejor) throw new Error("No hay formato QR válido");
  return mejor;
}

function mascaraActiva(mascara: number, x: number, y: number): boolean {
  switch (mascara) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new Error("Máscara inválida");
  }
}

function marcar(funcionales: boolean[][], x: number, y: number): void {
  const fila = funcionales[y];
  if (fila && x >= 0 && x < fila.length) fila[x] = true;
}

function posicionesAlineacion(version: number, tamano: number): number[] {
  if (version === 1) return [];
  const cantidad = Math.floor(version / 7) + 2;
  const paso = Math.ceil((tamano - 13) / (cantidad * 2 - 2)) * 2;
  const posiciones = [6];
  for (let posicion = tamano - 7; posiciones.length < cantidad; posicion -= paso) {
    posiciones.splice(1, 0, posicion);
  }
  return posiciones;
}

function mapaFuncionales(version: number): boolean[][] {
  const tamano = version * 4 + 17;
  const funcionales = Array.from({ length: tamano }, () => Array.from({ length: tamano }, () => false));

  const finder = (centroX: number, centroY: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) marcar(funcionales, centroX + dx, centroY + dy);
    }
  };
  finder(3, 3);
  finder(tamano - 4, 3);
  finder(3, tamano - 4);

  for (let indice = 0; indice < tamano; indice++) {
    marcar(funcionales, 6, indice);
    marcar(funcionales, indice, 6);
  }

  const posiciones = posicionesAlineacion(version, tamano);
  const ultima = posiciones.length - 1;
  for (let indiceX = 0; indiceX < posiciones.length; indiceX++) {
    for (let indiceY = 0; indiceY < posiciones.length; indiceY++) {
      if (
        (indiceX === 0 && indiceY === 0) ||
        (indiceX === 0 && indiceY === ultima) ||
        (indiceX === ultima && indiceY === 0)
      ) {
        continue;
      }
      const x = posiciones[indiceX] ?? 0;
      const y = posiciones[indiceY] ?? 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) marcar(funcionales, x + dx, y + dy);
      }
    }
  }

  for (const [x, y] of posicionesFormatoPrimeraCopia()) marcar(funcionales, x, y);
  for (let indice = 0; indice < 8; indice++) marcar(funcionales, tamano - 1 - indice, 8);
  for (let indice = 8; indice < 15; indice++) marcar(funcionales, 8, tamano - 15 + indice);
  marcar(funcionales, 8, tamano - 8);

  if (version >= 7) {
    for (let indice = 0; indice < 18; indice++) {
      const a = tamano - 11 + (indice % 3);
      const b = Math.floor(indice / 3);
      marcar(funcionales, a, b);
      marcar(funcionales, b, a);
    }
  }

  return funcionales;
}

function modulosCrudos(version: number): number {
  let resultado = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alineaciones = Math.floor(version / 7) + 2;
    resultado -= (25 * alineaciones - 10) * alineaciones - 55;
    if (version >= 7) resultado -= 36;
  }
  return resultado;
}

const ECC_PRUEBA: Record<number, readonly number[]> = {
  0: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24],
  1: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22],
};

const BLOQUES_PRUEBA: Record<number, readonly number[]> = {
  0: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10],
  1: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6],
};

function numeroPrueba(valores: readonly number[], indice: number): number {
  const valor = valores[indice];
  if (valor === undefined) throw new Error("Tabla de prueba incompleta");
  return valor;
}

function parametrosCorreccionPrueba(version: number, nivelBits: number): { eccPorBloque: number; bloques: number } {
  const ecc = numeroPrueba(ECC_PRUEBA[nivelBits] ?? [], version);
  const bloques = numeroPrueba(BLOQUES_PRUEBA[nivelBits] ?? [], version);
  return { eccPorBloque: ecc, bloques };
}

function bytesDesdeBits(bits: readonly number[], cantidadBytes: number): number[] {
  const bytes: number[] = [];
  for (let indice = 0; indice < cantidadBytes; indice++) {
    bytes.push(leerBits(bits, indice * 8, 8));
  }
  return bytes;
}

function desentrelazarDatos(codewords: readonly number[], version: number, nivelBits: number): number[] {
  const { eccPorBloque, bloques: cantidadBloques } = parametrosCorreccionPrueba(version, nivelBits);
  const crudos = Math.floor(modulosCrudos(version) / 8);
  const bloquesCortos = cantidadBloques - (crudos % cantidadBloques);
  const largoBloqueCorto = Math.floor(crudos / cantidadBloques);
  const largoEntrelazado = largoBloqueCorto + 1;
  const bloques = Array.from({ length: cantidadBloques }, () => Array.from({ length: largoEntrelazado }, () => 0));
  let indiceCodeword = 0;

  for (let indiceByte = 0; indiceByte < largoEntrelazado; indiceByte++) {
    for (let indiceBloque = 0; indiceBloque < cantidadBloques; indiceBloque++) {
      if (indiceByte === largoBloqueCorto - eccPorBloque && indiceBloque < bloquesCortos) continue;
      const bloque = bloques[indiceBloque];
      const valor = codewords[indiceCodeword];
      if (!bloque || valor === undefined) throw new Error("Secuencia entrelazada QR incompleta");
      bloque[indiceByte] = valor;
      indiceCodeword++;
    }
  }
  if (indiceCodeword !== crudos) throw new Error("Cantidad de codewords QR inesperada");

  const datos: number[] = [];
  for (let indiceBloque = 0; indiceBloque < cantidadBloques; indiceBloque++) {
    const largoDatos = largoBloqueCorto - eccPorBloque + (indiceBloque < bloquesCortos ? 0 : 1);
    const bloque = bloques[indiceBloque];
    if (!bloque) throw new Error("Bloque QR ausente");
    datos.push(...bloque.slice(0, largoDatos));
  }
  return datos;
}

function bitsDeDatos(matriz: boolean[][]): number[] {
  const tamano = matriz.length;
  const version = (tamano - 17) / 4;
  const funcionales = mapaFuncionales(version);
  const formato = leerFormato(matriz);
  const bitsEntrelazados: number[] = [];

  for (let derecha = tamano - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let vertical = 0; vertical < tamano; vertical++) {
      for (let desplazamiento = 0; desplazamiento < 2; desplazamiento++) {
        const x = derecha - desplazamiento;
        const haciaArriba = ((derecha + 1) & 2) === 0;
        const y = haciaArriba ? tamano - 1 - vertical : vertical;
        if (leer(funcionales, x, y)) continue;
        const valor = leer(matriz, x, y) !== mascaraActiva(formato.mascara, x, y);
        bitsEntrelazados.push(valor ? 1 : 0);
      }
    }
  }

  const crudos = Math.floor(modulosCrudos(version) / 8);
  const codewords = bytesDesdeBits(bitsEntrelazados.slice(0, crudos * 8), crudos);
  const datos = desentrelazarDatos(codewords, version, formato.nivelBits);
  return datos.flatMap((byte) => Array.from({ length: 8 }, (_, indice) => (byte >>> (7 - indice)) & 1));
}

function leerBits(bits: readonly number[], inicio: number, cantidad: number): number {
  let valor = 0;
  for (let indice = 0; indice < cantidad; indice++) {
    valor = (valor << 1) | (bits[inicio + indice] ?? 0);
  }
  return valor;
}

function decodificarByteMode(matriz: boolean[][]): string {
  const tamano = matriz.length;
  const version = (tamano - 17) / 4;
  const bits = bitsDeDatos(matriz);
  expect(leerBits(bits, 0, 4)).toBe(0x4);

  const bitsConteo = version <= 9 ? 8 : 16;
  const cantidad = leerBits(bits, 4, bitsConteo);
  const bytes: number[] = [];
  for (let indice = 0; indice < cantidad; indice++) {
    bytes.push(leerBits(bits, 4 + bitsConteo + indice * 8, 8));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function esperarFinder(matriz: boolean[][], inicioX: number, inicioY: number): void {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const borde = x === 0 || x === 6 || y === 0 || y === 6;
      const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      expect(leer(matriz, inicioX + x, inicioY + y)).toBe(borde || centro);
    }
  }
}

describe("generador QR ISO/IEC 18004", () => {
  it("genera una versión 1 de 21×21 con los tres finder patterns exactos", () => {
    const matriz = generarMatrizQr("A");

    expect(matriz).toHaveLength(21);
    for (const fila of matriz) expect(fila).toHaveLength(21);
    esperarFinder(matriz, 0, 0);
    esperarFinder(matriz, 14, 0);
    esperarFinder(matriz, 0, 14);
    expect(hashMatriz(matriz)).toBe("8e0f600c0a22ae3792bd6e5c454180d869e1e59fdbde7e7df9f424522be4fc9c");
    expect(decodificarByteMode(matriz)).toBe("A");
  });

  it("soporta la URL real DGII de 207 bytes en Byte mode versión 10 nivel M", () => {
    expect(new TextEncoder().encode(URL_DGII)).toHaveLength(207);
    const matriz = generarMatrizQr(URL_DGII);

    expect(matriz).toHaveLength(21 + (10 - 1) * 4);
    expect(decodificarByteMode(matriz)).toBe(URL_DGII);

    const formato = leerFormato(matriz);
    expect(formato.distancia).toBe(0);
    expect(formato.nivelBits).toBe(0);
    expect(formato.mascara).toBeGreaterThanOrEqual(0);
    expect(formato.mascara).toBeLessThanOrEqual(7);
    expect(hashMatriz(matriz)).toBe("e3aee48d90963f55cbc004189175f8a40000d87c9f03dfb50013bca5d36713a5");
  });

  it("usa el contador de 16 bits desde la versión 10 y conserva UTF-8", () => {
    const texto = `comprobante áéíóú ${"x".repeat(180)}`;
    const matriz = generarMatrizQr(texto);

    expect(matriz.length).toBeGreaterThanOrEqual(57);
    expect(decodificarByteMode(matriz)).toBe(texto);
  });

  it("cae automáticamente a nivel L cuando el texto supera la capacidad M de la versión 15", () => {
    const texto = "x".repeat(459);
    const matriz = generarMatrizQr(texto);

    expect(matriz).toHaveLength(21 + (15 - 1) * 4);
    expect(decodificarByteMode(matriz)).toBe(texto);
    const formato = leerFormato(matriz);
    expect(formato.distancia).toBe(0);
    expect(formato.nivelBits).toBe(1);
  });

  it("rechaza textos por encima de la capacidad L de la versión 15", () => {
    expect(() => generarMatrizQr("x".repeat(521))).toThrow(/excede la capacidad/);
  });

  it("emite SVG vectorial compacto con quiet zone de 4 módulos y un único path", () => {
    const svg = generarSvgQr(URL_DGII, { tamanoPx: 184 });

    expect(svg).toContain('viewBox="0 0 65 65"');
    expect(svg).toContain('width="184"');
    expect(svg).toContain('height="184"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect width="100%" height="100%" fill="#ffffff"/>');
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("<rect x=");
  });

  it("expone el trazado con margen y un data URI listo para img", () => {
    const vector = generarVectorQr("A");
    const dataUri = generarDataUriQr("A", { tamanoPx: 84 });

    expect(vector.dimension).toBe(29);
    expect(vector.trazado).toMatch(/^M4 4h7v1h-7z/);
    expect(dataUri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(decodeURIComponent(dataUri.slice("data:image/svg+xml;utf8,".length))).toContain('width="84"');
  });
});
