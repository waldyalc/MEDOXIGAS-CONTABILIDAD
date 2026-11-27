const VERSION_MINIMA = 1;
const VERSION_MAXIMA = 15;
const MODO_BYTE = 0x4;
const MARGEN_MODULOS_DEFECTO = 4;
const TAMANO_SVG_DEFECTO_PX = 128;

type NivelCorreccion = "L" | "M";
type MatrizQr = boolean[][];

interface OpcionesSvgQr {
  tamanoPx?: number;
  margenModulos?: number;
}

export interface VectorQr {
  dimension: number;
  trazado: string;
}

const FORMATO_NIVEL: Record<NivelCorreccion, number> = {
  L: 1,
  M: 0,
};

const ECC_POR_BLOQUE: Record<NivelCorreccion, readonly number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24],
};

const BLOQUES_CORRECCION: Record<NivelCorreccion, readonly number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10],
};

function numeroEn(valores: readonly number[], indice: number, contexto: string): number {
  const valor = valores[indice];
  if (valor === undefined) throw new Error(`Tabla QR incompleta en ${contexto}`);
  return valor;
}

function byteEn(valores: readonly number[], indice: number, contexto: string): number {
  const valor = valores[indice];
  if (valor === undefined) throw new Error(`Secuencia QR incompleta en ${contexto}`);
  return valor;
}

function crearMatriz(tamano: number): MatrizQr {
  return Array.from({ length: tamano }, () => Array.from({ length: tamano }, () => false));
}

function leerModulo(matriz: MatrizQr, x: number, y: number): boolean {
  return matriz[y]?.[x] ?? false;
}

function escribirModulo(matriz: MatrizQr, x: number, y: number, valor: boolean): void {
  const fila = matriz[y];
  if (!fila) throw new Error("Coordenada QR fuera de la matriz");
  fila[x] = valor;
}

function marcarFuncion(modulos: MatrizQr, funcionales: MatrizQr, x: number, y: number, valor: boolean): void {
  escribirModulo(modulos, x, y, valor);
  escribirModulo(funcionales, x, y, true);
}

function bit(valor: number, indice: number): boolean {
  return ((valor >>> indice) & 1) !== 0;
}

function modulosCrudos(version: number): number {
  if (version < VERSION_MINIMA || version > VERSION_MAXIMA) throw new Error("La versión QR debe estar entre 1 y 15");

  let resultado = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alineaciones = Math.floor(version / 7) + 2;
    resultado -= (25 * alineaciones - 10) * alineaciones - 55;
    if (version >= 7) resultado -= 36;
  }
  return resultado;
}

function totalCodewords(version: number): number {
  return Math.floor(modulosCrudos(version) / 8);
}

function parametrosCorreccion(version: number, nivel: NivelCorreccion): { eccPorBloque: number; bloques: number } {
  const eccPorBloque = numeroEn(ECC_POR_BLOQUE[nivel], version, `ECC ${nivel}${version}`);
  const bloques = numeroEn(BLOQUES_CORRECCION[nivel], version, `bloques ${nivel}${version}`);
  if (eccPorBloque <= 0 || bloques <= 0) throw new Error("Parámetros Reed-Solomon QR inválidos");
  return { eccPorBloque, bloques };
}

function codewordsDatos(version: number, nivel: NivelCorreccion): number {
  const { eccPorBloque, bloques } = parametrosCorreccion(version, nivel);
  return totalCodewords(version) - eccPorBloque * bloques;
}

function bitsModoByte(version: number, bytes: number): number {
  return 4 + (version <= 9 ? 8 : 16) + bytes * 8;
}

function elegirVersion(cantidadBytes: number): { version: number; nivel: NivelCorreccion } {
  for (const nivel of ["M", "L"] as const) {
    for (let version = VERSION_MINIMA; version <= VERSION_MAXIMA; version++) {
      if (bitsModoByte(version, cantidadBytes) <= codewordsDatos(version, nivel) * 8) {
        return { version, nivel };
      }
    }
  }

  throw new Error("El texto excede la capacidad QR Byte de la versión 15");
}

function bytesUtf8(texto: string): number[] {
  return Array.from(new TextEncoder().encode(texto));
}

function agregarBits(valor: number, cantidad: number, bits: number[]): void {
  if (cantidad < 0 || valor < 0 || valor >= 2 ** cantidad) throw new Error("Valor fuera de rango para el bitstream QR");
  for (let indice = cantidad - 1; indice >= 0; indice--) {
    bits.push((valor >>> indice) & 1);
  }
}

function codewordsDeDatos(bytes: readonly number[], version: number, nivel: NivelCorreccion): number[] {
  const capacidadBits = codewordsDatos(version, nivel) * 8;
  const bits: number[] = [];

  agregarBits(MODO_BYTE, 4, bits);
  agregarBits(bytes.length, version <= 9 ? 8 : 16, bits);
  for (const byte of bytes) agregarBits(byte, 8, bits);

  if (bits.length > capacidadBits) throw new Error("El bitstream QR excede la capacidad de la versión elegida");
  agregarBits(0, Math.min(4, capacidadBits - bits.length), bits);
  agregarBits(0, (8 - (bits.length % 8)) % 8, bits);

  for (let relleno = 0xec; bits.length < capacidadBits; relleno ^= 0xec ^ 0x11) {
    agregarBits(relleno, 8, bits);
  }

  const resultado = Array.from({ length: bits.length / 8 }, () => 0);
  bits.forEach((valor, indice) => {
    const posicion = indice >>> 3;
    const actual = byteEn(resultado, posicion, "empaque de bits");
    resultado[posicion] = actual | (valor << (7 - (indice & 7)));
  });
  return resultado;
}

function multiplicarGf256(x: number, y: number): number {
  let resultado = 0;
  for (let indice = 7; indice >= 0; indice--) {
    resultado = (resultado << 1) ^ ((resultado >>> 7) * 0x11d);
    resultado ^= ((y >>> indice) & 1) * x;
  }
  return resultado & 0xff;
}

function divisorReedSolomon(grado: number): number[] {
  if (grado < 1 || grado > 255) throw new Error("Grado Reed-Solomon fuera de rango");

  const resultado: number[] = Array.from({ length: grado }, (_, indice) => (indice === grado - 1 ? 1 : 0));
  let raiz = 1;
  for (let indice = 0; indice < grado; indice++) {
    for (let coeficiente = 0; coeficiente < resultado.length; coeficiente++) {
      const actual = byteEn(resultado, coeficiente, "divisor Reed-Solomon");
      resultado[coeficiente] = multiplicarGf256(actual, raiz);
      const siguiente = resultado[coeficiente + 1];
      if (siguiente !== undefined)
        resultado[coeficiente] = byteEn(resultado, coeficiente, "divisor Reed-Solomon") ^ siguiente;
    }
    raiz = multiplicarGf256(raiz, 0x02);
  }
  return resultado;
}

function restoReedSolomon(datos: readonly number[], divisor: readonly number[]): number[] {
  const resultado = divisor.map(() => 0);
  for (const byte of datos) {
    const primero = resultado.shift();
    if (primero === undefined) throw new Error("División Reed-Solomon incompleta");
    const factor = byte ^ primero;
    resultado.push(0);
    divisor.forEach((coeficiente, indice) => {
      const actual = byteEn(resultado, indice, "resto Reed-Solomon");
      resultado[indice] = actual ^ multiplicarGf256(coeficiente, factor);
    });
  }
  return resultado;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: El entrelazado Reed-Solomon exige validar bloques cortos/largos y padding en el orden exacto de ISO/IEC 18004.
function agregarCorreccionEntrelazada(datos: readonly number[], version: number, nivel: NivelCorreccion): number[] {
  const { eccPorBloque, bloques: cantidadBloques } = parametrosCorreccion(version, nivel);
  if (datos.length !== codewordsDatos(version, nivel)) throw new Error("Cantidad de codewords de datos QR inválida");

  const crudos = totalCodewords(version);
  const bloquesCortos = cantidadBloques - (crudos % cantidadBloques);
  const largoBloqueCorto = Math.floor(crudos / cantidadBloques);
  const divisor = divisorReedSolomon(eccPorBloque);
  const bloques: number[][] = [];
  let inicio = 0;

  for (let indiceBloque = 0; indiceBloque < cantidadBloques; indiceBloque++) {
    const largoDatos = largoBloqueCorto - eccPorBloque + (indiceBloque < bloquesCortos ? 0 : 1);
    const datosBloque = datos.slice(inicio, inicio + largoDatos);
    inicio += datosBloque.length;
    if (datosBloque.length !== largoDatos) throw new Error("Partición de bloques Reed-Solomon incompleta");

    const correccion = restoReedSolomon(datosBloque, divisor);
    const datosEntrelazados = [...datosBloque];
    if (indiceBloque < bloquesCortos) datosEntrelazados.push(0);
    bloques.push([...datosEntrelazados, ...correccion]);
  }
  if (inicio !== datos.length) throw new Error("Los bloques Reed-Solomon no consumieron todos los datos");

  const resultado: number[] = [];
  const largoEntrelazado = bloques[0]?.length ?? 0;
  for (let indiceByte = 0; indiceByte < largoEntrelazado; indiceByte++) {
    for (let indiceBloque = 0; indiceBloque < bloques.length; indiceBloque++) {
      if (indiceByte === largoBloqueCorto - eccPorBloque && indiceBloque < bloquesCortos) continue;
      const bloque = bloques[indiceBloque];
      if (!bloque) throw new Error("Bloque Reed-Solomon ausente");
      resultado.push(byteEn(bloque, indiceByte, "entrelazado Reed-Solomon"));
    }
  }
  if (resultado.length !== crudos) throw new Error("Entrelazado Reed-Solomon QR inválido");
  return resultado;
}

function dibujarFinder(
  modulos: MatrizQr,
  funcionales: MatrizQr,
  centroX: number,
  centroY: number,
  tamano: number,
): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = centroX + dx;
      const y = centroY + dy;
      if (x < 0 || x >= tamano || y < 0 || y >= tamano) continue;
      const distancia = Math.max(Math.abs(dx), Math.abs(dy));
      marcarFuncion(modulos, funcionales, x, y, distancia !== 2 && distancia !== 4);
    }
  }
}

function dibujarAlineacion(modulos: MatrizQr, funcionales: MatrizQr, centroX: number, centroY: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      marcarFuncion(modulos, funcionales, centroX + dx, centroY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function posicionesAlineacion(version: number, tamano: number): number[] {
  if (version === 1) return [];

  const cantidad = Math.floor(version / 7) + 2;
  const paso = Math.ceil((tamano - 13) / (cantidad * 2 - 2)) * 2;
  const resultado = [6];
  for (let posicion = tamano - 7; resultado.length < cantidad; posicion -= paso) {
    resultado.splice(1, 0, posicion);
  }
  return resultado;
}

function dibujarFormato(
  modulos: MatrizQr,
  funcionales: MatrizQr,
  version: number,
  nivel: NivelCorreccion,
  mascara: number,
  tamano: number,
): void {
  const datos = (FORMATO_NIVEL[nivel] << 3) | mascara;
  let resto = datos;
  for (let indice = 0; indice < 10; indice++) {
    resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  }
  const bits = ((datos << 10) | resto) ^ 0x5412;

  for (let indice = 0; indice <= 5; indice++) marcarFuncion(modulos, funcionales, 8, indice, bit(bits, indice));
  marcarFuncion(modulos, funcionales, 8, 7, bit(bits, 6));
  marcarFuncion(modulos, funcionales, 8, 8, bit(bits, 7));
  marcarFuncion(modulos, funcionales, 7, 8, bit(bits, 8));
  for (let indice = 9; indice < 15; indice++) marcarFuncion(modulos, funcionales, 14 - indice, 8, bit(bits, indice));

  for (let indice = 0; indice < 8; indice++) {
    marcarFuncion(modulos, funcionales, tamano - 1 - indice, 8, bit(bits, indice));
  }
  for (let indice = 8; indice < 15; indice++) {
    marcarFuncion(modulos, funcionales, 8, tamano - 15 + indice, bit(bits, indice));
  }
  marcarFuncion(modulos, funcionales, 8, tamano - 8, true);

  if (version < 1) throw new Error("Versión QR inválida");
}

function dibujarVersion(modulos: MatrizQr, funcionales: MatrizQr, version: number, tamano: number): void {
  if (version < 7) return;

  let resto = version;
  for (let indice = 0; indice < 12; indice++) {
    resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
  }
  const bits = (version << 12) | resto;

  for (let indice = 0; indice < 18; indice++) {
    const color = bit(bits, indice);
    const a = tamano - 11 + (indice % 3);
    const b = Math.floor(indice / 3);
    marcarFuncion(modulos, funcionales, a, b, color);
    marcarFuncion(modulos, funcionales, b, a, color);
  }
}

function dibujarPatronesFuncion(
  modulos: MatrizQr,
  funcionales: MatrizQr,
  version: number,
  nivel: NivelCorreccion,
  tamano: number,
): void {
  for (let indice = 0; indice < tamano; indice++) {
    marcarFuncion(modulos, funcionales, 6, indice, indice % 2 === 0);
    marcarFuncion(modulos, funcionales, indice, 6, indice % 2 === 0);
  }

  dibujarFinder(modulos, funcionales, 3, 3, tamano);
  dibujarFinder(modulos, funcionales, tamano - 4, 3, tamano);
  dibujarFinder(modulos, funcionales, 3, tamano - 4, tamano);

  const posiciones = posicionesAlineacion(version, tamano);
  const ultima = posiciones.length - 1;
  for (let indiceX = 0; indiceX < posiciones.length; indiceX++) {
    for (let indiceY = 0; indiceY < posiciones.length; indiceY++) {
      const esquinaSuperiorIzquierda = indiceX === 0 && indiceY === 0;
      const esquinaInferiorIzquierda = indiceX === 0 && indiceY === ultima;
      const esquinaSuperiorDerecha = indiceX === ultima && indiceY === 0;
      if (esquinaSuperiorIzquierda || esquinaInferiorIzquierda || esquinaSuperiorDerecha) continue;
      const x = numeroEn(posiciones, indiceX, "alineación X");
      const y = numeroEn(posiciones, indiceY, "alineación Y");
      dibujarAlineacion(modulos, funcionales, x, y);
    }
  }

  dibujarFormato(modulos, funcionales, version, nivel, 0, tamano);
  dibujarVersion(modulos, funcionales, version, tamano);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: La colocación en zig-zag de ISO/IEC 18004 requiere controlar dirección, timing pattern y excepción de la columna 6.
function dibujarCodewords(
  modulos: MatrizQr,
  funcionales: MatrizQr,
  codewords: readonly number[],
  tamano: number,
): void {
  let indiceBit = 0;
  for (let derecha = tamano - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let vertical = 0; vertical < tamano; vertical++) {
      for (let desplazamiento = 0; desplazamiento < 2; desplazamiento++) {
        const x = derecha - desplazamiento;
        const haciaArriba = ((derecha + 1) & 2) === 0;
        const y = haciaArriba ? tamano - 1 - vertical : vertical;
        if (leerModulo(funcionales, x, y)) continue;

        let color = false;
        if (indiceBit < codewords.length * 8) {
          const byte = byteEn(codewords, indiceBit >>> 3, "colocación de datos");
          color = bit(byte, 7 - (indiceBit & 7));
          indiceBit++;
        }
        escribirModulo(modulos, x, y, color);
      }
    }
  }
}

function invertirPorMascara(mascara: number, x: number, y: number): boolean {
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
      throw new Error("Máscara QR fuera de rango");
  }
}

function aplicarMascara(modulos: MatrizQr, funcionales: MatrizQr, mascara: number, tamano: number): void {
  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      if (!leerModulo(funcionales, x, y) && invertirPorMascara(mascara, x, y)) {
        escribirModulo(modulos, x, y, !leerModulo(modulos, x, y));
      }
    }
  }
}

function agregarHistoriaFinder(largoCorrida: number, historia: number[], tamano: number): void {
  let largo = largoCorrida;
  if ((historia[0] ?? 0) === 0) largo += tamano;
  for (let indice = historia.length - 1; indice > 0; indice--) {
    historia[indice] = historia[indice - 1] ?? 0;
  }
  historia[0] = largo;
}

function contarPatronesFinder(historia: readonly number[]): number {
  const nucleo = historia[1] ?? 0;
  const coincide =
    nucleo > 0 &&
    (historia[2] ?? 0) === nucleo &&
    (historia[3] ?? 0) === nucleo * 3 &&
    (historia[4] ?? 0) === nucleo &&
    (historia[5] ?? 0) === nucleo;

  return (
    (coincide && (historia[0] ?? 0) >= nucleo * 4 && (historia[6] ?? 0) >= nucleo ? 1 : 0) +
    (coincide && (historia[6] ?? 0) >= nucleo * 4 && (historia[0] ?? 0) >= nucleo ? 1 : 0)
  );
}

function terminarYContarFinder(colorActual: boolean, largoActual: number, historia: number[], tamano: number): number {
  let largo = largoActual;
  if (colorActual) {
    agregarHistoriaFinder(largo, historia, tamano);
    largo = 0;
  }
  agregarHistoriaFinder(largo + tamano, historia, tamano);
  return contarPatronesFinder(historia);
}

function penalizarLinea(modulos: MatrizQr, tamano: number, horizontal: boolean, indiceLinea: number): number {
  let penalidad = 0;
  let colorCorrida = false;
  let largoCorrida = 0;
  const historia = [0, 0, 0, 0, 0, 0, 0];

  for (let indice = 0; indice < tamano; indice++) {
    const color = horizontal ? leerModulo(modulos, indice, indiceLinea) : leerModulo(modulos, indiceLinea, indice);
    if (color === colorCorrida) {
      largoCorrida++;
      if (largoCorrida === 5) penalidad += 3;
      else if (largoCorrida > 5) penalidad++;
    } else {
      agregarHistoriaFinder(largoCorrida, historia, tamano);
      if (!colorCorrida) penalidad += contarPatronesFinder(historia) * 40;
      colorCorrida = color;
      largoCorrida = 1;
    }
  }

  return penalidad + terminarYContarFinder(colorCorrida, largoCorrida, historia, tamano) * 40;
}

function puntajePenalizacion(modulos: MatrizQr, tamano: number): number {
  let resultado = 0;

  for (let indice = 0; indice < tamano; indice++) {
    resultado += penalizarLinea(modulos, tamano, true, indice);
    resultado += penalizarLinea(modulos, tamano, false, indice);
  }

  for (let y = 0; y < tamano - 1; y++) {
    for (let x = 0; x < tamano - 1; x++) {
      const color = leerModulo(modulos, x, y);
      if (
        color === leerModulo(modulos, x + 1, y) &&
        color === leerModulo(modulos, x, y + 1) &&
        color === leerModulo(modulos, x + 1, y + 1)
      ) {
        resultado += 3;
      }
    }
  }

  let negros = 0;
  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      if (leerModulo(modulos, x, y)) negros++;
    }
  }
  const total = tamano * tamano;
  const desviacion = Math.ceil(Math.abs(negros * 20 - total * 10) / total) - 1;
  return resultado + desviacion * 10;
}

function construirMatrizQr(texto: string): {
  matriz: MatrizQr;
  version: number;
  nivel: NivelCorreccion;
  mascara: number;
} {
  const bytes = bytesUtf8(texto);
  const { version, nivel } = elegirVersion(bytes.length);
  const tamano = version * 4 + 17;
  const modulos = crearMatriz(tamano);
  const funcionales = crearMatriz(tamano);

  dibujarPatronesFuncion(modulos, funcionales, version, nivel, tamano);
  const datos = codewordsDeDatos(bytes, version, nivel);
  const codewords = agregarCorreccionEntrelazada(datos, version, nivel);
  dibujarCodewords(modulos, funcionales, codewords, tamano);

  let mascaraElegida = 0;
  let menorPenalizacion = Number.POSITIVE_INFINITY;
  for (let mascara = 0; mascara < 8; mascara++) {
    aplicarMascara(modulos, funcionales, mascara, tamano);
    dibujarFormato(modulos, funcionales, version, nivel, mascara, tamano);
    const penalizacion = puntajePenalizacion(modulos, tamano);
    if (penalizacion < menorPenalizacion) {
      menorPenalizacion = penalizacion;
      mascaraElegida = mascara;
    }
    aplicarMascara(modulos, funcionales, mascara, tamano);
  }

  aplicarMascara(modulos, funcionales, mascaraElegida, tamano);
  dibujarFormato(modulos, funcionales, version, nivel, mascaraElegida, tamano);

  return { matriz: modulos, version, nivel, mascara: mascaraElegida };
}

export function generarMatrizQr(texto: string): boolean[][] {
  return construirMatrizQr(texto).matriz.map((fila) => [...fila]);
}

export function generarVectorQr(texto: string, margenModulos = MARGEN_MODULOS_DEFECTO): VectorQr {
  if (!Number.isInteger(margenModulos) || margenModulos < 0)
    throw new Error("El margen QR debe ser un entero no negativo");

  const matriz = generarMatrizQr(texto);
  const dimension = matriz.length + margenModulos * 2;
  const partes: string[] = [];

  for (let y = 0; y < matriz.length; y++) {
    let x = 0;
    while (x < matriz.length) {
      if (!leerModulo(matriz, x, y)) {
        x++;
        continue;
      }
      const inicio = x;
      while (x < matriz.length && leerModulo(matriz, x, y)) x++;
      const largo = x - inicio;
      partes.push(`M${inicio + margenModulos} ${y + margenModulos}h${largo}v1h-${largo}z`);
    }
  }

  return { dimension, trazado: partes.join("") };
}

export function generarSvgQr(texto: string, opciones: OpcionesSvgQr = {}): string {
  const tamanoPx = opciones.tamanoPx ?? TAMANO_SVG_DEFECTO_PX;
  const margenModulos = opciones.margenModulos ?? MARGEN_MODULOS_DEFECTO;
  if (!Number.isFinite(tamanoPx) || tamanoPx <= 0) throw new Error("El tamaño SVG QR debe ser positivo");

  const { dimension, trazado } = generarVectorQr(texto, margenModulos);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${tamanoPx}" height="${tamanoPx}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${trazado}" fill="#000000"/></svg>`;
}

export function generarDataUriQr(texto: string, opciones: OpcionesSvgQr = {}): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(generarSvgQr(texto, opciones))}`;
}
