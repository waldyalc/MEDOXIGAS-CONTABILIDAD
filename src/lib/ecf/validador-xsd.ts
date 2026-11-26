import type { TipoEcf } from "./tipos";

export type TipoEsquemaDgii = "ECF" | "RFCE" | "ARECF" | "ACECF" | "ANECF";

export interface ResultadoValidacionXsdDgii {
  valido: boolean;
  tipoDetectado: string | null;
  errores: string[];
}

interface NodoXml {
  nombre: string;
  atributos: Record<string, string>;
  hijos: NodoXml[];
  texto: string;
}

interface ReglaHijo {
  nombre: string;
  min: number;
  max: number;
}

const RE_DECLARACION = /^<\?xml version="1\.0" encoding="utf-8"\?>/i;
const RE_ENCF = /^E(31|32|33|34|41|43|44|45|46|47)\d{10}$/;
const RE_RNC = /^\d{9}(\d{2})?$/;
const RE_FECHA = /^\d{2}-\d{2}-\d{4}$/;
const RE_FECHA_HORA = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/;
const RE_MONTO = /^\d+(\.\d{2})?$/;
const RE_PRECIO = /^\d+(\.\d{1,4})?$/;
const RE_ENTERO = /^\d+$/;
const TIPOS_ECF_VALIDOS = new Set(["31", "32", "33", "34", "41", "43", "44", "45", "46", "47"]);

function nodo(nombre: string, min = 0, max = 1): ReglaHijo {
  return { nombre, min, max };
}

function reglasDesdeOrden(nombres: readonly string[], obligatorios: readonly string[] = []): ReglaHijo[] {
  return nombres.map((nombre) => nodo(nombre, obligatorios.includes(nombre) ? 1 : 0, 1));
}

const ORDEN_IDDOC_POR_TIPO: Record<TipoEcf, readonly string[]> = {
  "31": [
    "TipoeCF",
    "eNCF",
    "FechaVencimientoSecuencia",
    "IndicadorEnvioDiferido",
    "IndicadorMontoGravado",
    "IndicadorServicioTodoIncluido",
    "TipoIngresos",
    "TipoPago",
    "FechaLimitePago",
    "TerminoPago",
    "TablaFormasPago",
    "FechaDesde",
    "FechaHasta",
    "TotalPaginas",
  ],
  "32": [
    "TipoeCF",
    "eNCF",
    "IndicadorEnvioDiferido",
    "IndicadorMontoGravado",
    "IndicadorServicioTodoIncluido",
    "TipoIngresos",
    "TipoPago",
    "FechaLimitePago",
    "TerminoPago",
    "TablaFormasPago",
    "FechaDesde",
    "FechaHasta",
    "TotalPaginas",
  ],
  "33": [
    "TipoeCF",
    "eNCF",
    "FechaVencimientoSecuencia",
    "IndicadorEnvioDiferido",
    "IndicadorMontoGravado",
    "IndicadorServicioTodoIncluido",
    "TipoIngresos",
    "TipoPago",
    "FechaLimitePago",
    "TerminoPago",
    "TablaFormasPago",
  ],
  "34": [
    "TipoeCF",
    "eNCF",
    "IndicadorNotaCredito",
    "IndicadorEnvioDiferido",
    "IndicadorMontoGravado",
    "IndicadorServicioTodoIncluido",
    "TipoIngresos",
    "TipoPago",
    "FechaLimitePago",
  ],
  "41": [
    "TipoeCF",
    "eNCF",
    "FechaVencimientoSecuencia",
    "IndicadorMontoGravado",
    "IndicadorServicioTodoIncluido",
    "TipoPago",
    "FechaLimitePago",
    "TerminoPago",
    "TablaFormasPago",
    "TotalPaginas",
  ],
  "43": ["TipoeCF", "eNCF", "FechaVencimientoSecuencia", "TipoPago", "TotalPaginas"],
  "44": [
    "TipoeCF",
    "eNCF",
    "FechaVencimientoSecuencia",
    "IndicadorEnvioDiferido",
    "IndicadorServicioTodoIncluido",
    "TipoIngresos",
    "TipoPago",
    "FechaLimitePago",
    "TerminoPago",
    "TablaFormasPago",
    "TotalPaginas",
  ],
  "45": [
    "TipoeCF",
    "eNCF",
    "FechaVencimientoSecuencia",
    "IndicadorEnvioDiferido",
    "IndicadorMontoGravado",
    "IndicadorServicioTodoIncluido",
    "TipoIngresos",
    "TipoPago",
    "FechaLimitePago",
    "TerminoPago",
    "TablaFormasPago",
    "FechaDesde",
    "FechaHasta",
    "TotalPaginas",
  ],
  "46": [
    "TipoeCF",
    "eNCF",
    "FechaVencimientoSecuencia",
    "IndicadorEnvioDiferido",
    "IndicadorServicioTodoIncluido",
    "TipoIngresos",
    "TipoPago",
    "FechaLimitePago",
    "TerminoPago",
    "TablaFormasPago",
    "TotalPaginas",
  ],
  "47": ["TipoeCF", "eNCF", "FechaVencimientoSecuencia", "TipoPago", "TotalPaginas"],
};

const ORDEN_EMISOR = [
  "RNCEmisor",
  "RazonSocialEmisor",
  "NombreComercial",
  "Sucursal",
  "DireccionEmisor",
  "Municipio",
  "Provincia",
  "TablaTelefonoEmisor",
  "CorreoEmisor",
  "WebSite",
  "ActividadEconomica",
  "CodigoVendedor",
  "NumeroFacturaInterna",
  "NumeroPedidoInterno",
  "ZonaVenta",
  "RutaVenta",
  "InformacionAdicionalEmisor",
  "FechaEmision",
] as const;

const ORDEN_COMPRADOR = [
  "RNCComprador",
  "IdentificadorExtranjero",
  "RazonSocialComprador",
  "ContactoComprador",
  "CorreoComprador",
  "DireccionComprador",
  "MunicipioComprador",
  "ProvinciaComprador",
  "PaisComprador",
  "FechaEntrega",
  "ContactoEntrega",
  "DireccionEntrega",
  "TelefonoAdicional",
  "FechaOrdenCompra",
  "NumeroOrdenCompra",
  "CodigoInternoComprador",
  "ResponsablePago",
  "InformacionAdicionalComprador",
] as const;

const ORDEN_TOTALES_BASE = [
  "MontoGravadoTotal",
  "MontoGravadoI1",
  "MontoGravadoI2",
  "MontoGravadoI3",
  "MontoExento",
  "ITBIS1",
  "ITBIS2",
  "ITBIS3",
  "TotalITBIS",
  "TotalITBIS1",
  "TotalITBIS2",
  "TotalITBIS3",
  "MontoImpuestoAdicional",
  "ImpuestosAdicionales",
  "MontoTotal",
  "MontoNoFacturable",
  "MontoPeriodo",
  "SaldoAnterior",
  "MontoAvancePago",
  "ValorPagar",
  "TotalITBISRetenido",
  "TotalISRRetencion",
  "TotalITBISPercepcion",
  "TotalISRPercepcion",
] as const;

const ORDEN_ITEM = [
  "NumeroLinea",
  "TablaCodigosItem",
  "IndicadorFacturacion",
  "Retencion",
  "NombreItem",
  "IndicadorBienoServicio",
  "DescripcionItem",
  "CantidadItem",
  "UnidadMedida",
  "CantidadReferencia",
  "UnidadReferencia",
  "TablaSubcantidad",
  "GradosAlcohol",
  "PrecioUnitarioReferencia",
  "FechaElaboracion",
  "FechaVencimientoItem",
  "Mineria",
  "PrecioUnitarioItem",
  "DescuentoMonto",
  "TablaSubDescuento",
  "RecargoMonto",
  "TablaSubRecargo",
  "OtraMonedaDetalle",
  "MontoItem",
] as const;

function crearNodo(nombre: string, atributos: Record<string, string>): NodoXml {
  return { nombre, atributos, hijos: [], texto: "" };
}

function extraerApertura(
  contenido: string,
): { nombre: string; atributos: Record<string, string>; autocierre: boolean } | null {
  const autocierre = /\/\s*>$/.test(contenido);
  const interior = contenido.replace(/^</, "").replace(/\/?>$/, "").trim();
  const coincidencia = interior.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);
  const nombre = coincidencia?.[1];
  if (!nombre) return null;
  const atributos: Record<string, string> = {};
  const resto = coincidencia[2] ?? "";
  for (const atributo of resto.matchAll(/([\w:.-]+)="([^"]*)"/g)) {
    if (atributo[1] && atributo[2] !== undefined) atributos[atributo[1]] = atributo[2];
  }
  return { nombre, atributos, autocierre };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tokeniza XML sin dependencias preservando errores estructurales en español
function parsearCuerpoXml(cuerpo: string, errores: string[]): NodoXml | null {
  const pila: NodoXml[] = [];
  let raiz: NodoXml | null = null;
  let posicion = 0;
  while (posicion < cuerpo.length) {
    const inicio = cuerpo.indexOf("<", posicion);
    const texto = inicio === -1 ? cuerpo.slice(posicion) : cuerpo.slice(posicion, inicio);
    const actual = pila[pila.length - 1];
    if (actual) actual.texto += texto;
    else if (texto.trim() !== "") errores.push("Hay contenido fuera del elemento raíz del XML");
    if (inicio === -1) break;
    const fin = cuerpo.indexOf(">", inicio);
    if (fin === -1) {
      errores.push("El XML tiene una etiqueta sin cerrar sintácticamente");
      break;
    }
    const etiqueta = cuerpo.slice(inicio, fin + 1);
    if (etiqueta.startsWith("<?") || etiqueta.startsWith("<!")) {
      errores.push("El XML contiene declaraciones, comentarios o instrucciones fuera de la estructura permitida");
    } else if (etiqueta.startsWith("</")) {
      const nombreCierre = etiqueta.slice(2, -1).trim();
      const abierto = pila.pop();
      if (!abierto || abierto.nombre !== nombreCierre)
        errores.push(`La etiqueta </${nombreCierre}> no cierra su apertura correspondiente`);
    } else {
      const apertura = extraerApertura(etiqueta);
      if (!apertura) {
        errores.push(`No se pudo interpretar la etiqueta ${etiqueta}`);
      } else {
        const nuevo = crearNodo(apertura.nombre, apertura.atributos);
        const padre = pila[pila.length - 1];
        if (padre) padre.hijos.push(nuevo);
        else {
          if (raiz) errores.push("El XML tiene más de un elemento raíz");
          else raiz = nuevo;
        }
        if (!apertura.autocierre) pila.push(nuevo);
      }
    }
    posicion = fin + 1;
  }
  if (pila.length > 0) errores.push(`La etiqueta <${pila[pila.length - 1]?.nombre ?? "desconocida"}> quedó sin cerrar`);
  return raiz;
}

function recorrerNodos(nodoActual: NodoXml, visitar: (nodo: NodoXml, ruta: string) => void, ruta = ""): void {
  const rutaActual = ruta ? `${ruta}/${nodoActual.nombre}` : nodoActual.nombre;
  visitar(nodoActual, rutaActual);
  for (const hijo of nodoActual.hijos) recorrerNodos(hijo, visitar, rutaActual);
}

function validarSinEtiquetasVacias(raiz: NodoXml, errores: string[]): void {
  recorrerNodos(raiz, (nodoActual, ruta) => {
    if (nodoActual.hijos.length === 0 && nodoActual.texto.trim() === "" && !ruta.includes("/Signature/")) {
      errores.push(`La etiqueta ${ruta} está vacía y el XSD v1.0 de DGII no admite etiquetas vacías`);
    }
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: reproduce cardinalidad y orden XSD en una sola pasada
function validarOrdenHijos(nodoActual: NodoXml, contexto: string, reglas: ReglaHijo[], errores: string[]): void {
  let posicion = 0;
  const vistos = new Map<string, number>();
  for (const hijo of nodoActual.hijos) {
    let encontrado = -1;
    for (let indice = posicion; indice < reglas.length; indice += 1) {
      if (reglas[indice]?.nombre === hijo.nombre) {
        encontrado = indice;
        break;
      }
    }
    if (encontrado === -1) {
      errores.push(`El elemento <${hijo.nombre}> no es válido o está fuera de orden dentro de ${contexto}`);
      continue;
    }
    const usos = (vistos.get(hijo.nombre) ?? 0) + 1;
    vistos.set(hijo.nombre, usos);
    const regla = reglas[encontrado];
    if (regla && usos > regla.max)
      errores.push(`El elemento <${hijo.nombre}> excede su cardinalidad dentro de ${contexto}`);
    if (regla && usos >= regla.max) posicion = encontrado + 1;
  }
  for (const regla of reglas) {
    const usos = vistos.get(regla.nombre) ?? 0;
    if (usos < regla.min) errores.push(`Falta el elemento obligatorio <${regla.nombre}> dentro de ${contexto}`);
  }
}

function hijo(nodoActual: NodoXml | undefined, nombre: string): NodoXml | undefined {
  return nodoActual?.hijos.find((item) => item.nombre === nombre);
}

function textoHijo(nodoActual: NodoXml | undefined, nombre: string): string {
  return hijo(nodoActual, nombre)?.texto.trim() ?? "";
}

function reglasTotalesPorTipo(tipo: TipoEcf): ReglaHijo[] {
  const obligatorios = ["MontoTotal"];
  if (tipo === "43" || tipo === "47") obligatorios.push("MontoExento");
  else {
    obligatorios.push("MontoGravadoTotal", "TotalITBIS");
    if (tipo !== "46")
      obligatorios.push("MontoGravadoI1", "MontoGravadoI2", "MontoExento", "TotalITBIS1", "TotalITBIS2");
  }
  return reglasDesdeOrden(ORDEN_TOTALES_BASE, obligatorios);
}

function validarRetencionItem(retencion: NodoXml, errores: string[]): void {
  validarOrdenHijos(
    retencion,
    "Retencion",
    [nodo("IndicadorAgenteRetencionoPercepcion", 1), nodo("MontoITBISRetenido"), nodo("MontoISRRetenido")],
    errores,
  );
}

function validarItem(item: NodoXml, indice: number, errores: string[]): void {
  const reglas = reglasDesdeOrden(ORDEN_ITEM, [
    "NumeroLinea",
    "IndicadorFacturacion",
    "NombreItem",
    "IndicadorBienoServicio",
    "CantidadItem",
    "PrecioUnitarioItem",
    "MontoItem",
  ]);
  validarOrdenHijos(item, `DetallesItems/Item[${indice}]`, reglas, errores);
  const retencion = hijo(item, "Retencion");
  if (retencion) validarRetencionItem(retencion, errores);
  const otraMoneda = hijo(item, "OtraMonedaDetalle");
  if (otraMoneda) {
    validarOrdenHijos(
      otraMoneda,
      "OtraMonedaDetalle",
      [
        nodo("PrecioOtraMoneda"),
        nodo("DescuentoOtraMoneda"),
        nodo("RecargoOtraMoneda"),
        nodo("MontoItemOtraMoneda", 1),
      ],
      errores,
    );
  }
}

function validarDescuentosORecargos(seccion: NodoXml, errores: string[]): void {
  validarOrdenHijos(seccion, "DescuentosORecargos", [nodo("DescuentoORecargo", 1, 999)], errores);
  seccion.hijos.forEach((ajuste, indice) => {
    validarOrdenHijos(
      ajuste,
      `DescuentoORecargo[${indice + 1}]`,
      [
        nodo("NumeroLinea", 1),
        nodo("TipoAjuste", 1),
        nodo("DescripcionDescuentooRecargo"),
        nodo("TipoValor"),
        nodo("ValorDescuentooRecargo"),
        nodo("MontoDescuentooRecargo", 1),
        nodo("IndicadorFacturacionDescuentooRecargo"),
      ],
      errores,
    );
  });
}

function validarInformacionReferencia(referencia: NodoXml, errores: string[]): void {
  validarOrdenHijos(
    referencia,
    "InformacionReferencia",
    [
      nodo("NCFModificado", 1),
      nodo("RNCOtroContribuyente"),
      nodo("FechaNCFModificado", 1),
      nodo("CodigoModificacion", 1),
      nodo("RazonModificacion"),
    ],
    errores,
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz oficial E31-E47 exige validaciones por tipo en orden XSD
function validarEstructuraEcf(raiz: NodoXml, errores: string[]): string | null {
  validarOrdenHijos(
    raiz,
    "ECF",
    [
      nodo("Encabezado", 1),
      nodo("DetallesItems", 1),
      nodo("Subtotales"),
      nodo("DescuentosORecargos"),
      nodo("Paginacion"),
      nodo("InformacionReferencia"),
      nodo("FechaHoraFirma", 1),
      nodo("Signature"),
    ],
    errores,
  );
  const encabezado = hijo(raiz, "Encabezado");
  if (!encabezado) return null;
  validarOrdenHijos(
    encabezado,
    "ECF/Encabezado",
    [
      nodo("Version", 1),
      nodo("IdDoc", 1),
      nodo("Emisor", 1),
      nodo("Comprador"),
      nodo("Totales", 1),
      nodo("OtraMoneda"),
      nodo("InformacionesAdicionales"),
      nodo("Transporte"),
    ],
    errores,
  );
  const idDoc = hijo(encabezado, "IdDoc");
  const tipoTexto = textoHijo(idDoc, "TipoeCF");
  if (!TIPOS_ECF_VALIDOS.has(tipoTexto)) {
    errores.push(`El TipoeCF ${tipoTexto || "(vacío)"} no es uno de los tipos E31 a E47 admitidos por DGII`);
    return tipoTexto || null;
  }
  const tipo = tipoTexto as TipoEcf;
  validarOrdenHijos(
    idDoc ?? crearNodo("IdDoc", {}),
    "IdDoc",
    reglasDesdeOrden(ORDEN_IDDOC_POR_TIPO[tipo], ["TipoeCF", "eNCF", "TipoPago"]),
    errores,
  );
  const emisor = hijo(encabezado, "Emisor");
  if (emisor) {
    validarOrdenHijos(
      emisor,
      "Emisor",
      reglasDesdeOrden(ORDEN_EMISOR, ["RNCEmisor", "RazonSocialEmisor", "DireccionEmisor", "FechaEmision"]),
      errores,
    );
  }
  const comprador = hijo(encabezado, "Comprador");
  if (tipo === "43" && comprador) errores.push("El E43 no debe contener el elemento Comprador según el XSD DGII");
  if (tipo !== "43" && !comprador && tipo !== "32" && tipo !== "34")
    errores.push(`El E${tipo} debe contener el elemento Comprador`);
  if (comprador)
    validarOrdenHijos(comprador, "Comprador", reglasDesdeOrden(ORDEN_COMPRADOR, ["RazonSocialComprador"]), errores);
  const totales = hijo(encabezado, "Totales");
  if (totales) validarOrdenHijos(totales, "Totales", reglasTotalesPorTipo(tipo), errores);
  const otraMoneda = hijo(encabezado, "OtraMoneda");
  if (otraMoneda) {
    validarOrdenHijos(
      otraMoneda,
      "OtraMoneda",
      [
        nodo("TipoMoneda", 1),
        nodo("TipoCambio", 1),
        nodo("MontoGravadoTotalOtraMoneda"),
        nodo("MontoExentoOtraMoneda"),
        nodo("TotalITBISOtraMoneda"),
        nodo("MontoTotalOtraMoneda", 1),
      ],
      errores,
    );
  }
  const detalles = hijo(raiz, "DetallesItems");
  if (!detalles || detalles.hijos.length === 0) errores.push("DetallesItems debe contener al menos un Item");
  detalles?.hijos.forEach((item, indice) => {
    if (item.nombre === "Item") validarItem(item, indice + 1, errores);
  });
  const descuentos = hijo(raiz, "DescuentosORecargos");
  if (descuentos) {
    if (tipo === "43" || tipo === "47") errores.push(`El E${tipo} no admite DescuentosORecargos según el XSD DGII`);
    validarDescuentosORecargos(descuentos, errores);
  }
  const referencia = hijo(raiz, "InformacionReferencia");
  if (referencia) validarInformacionReferencia(referencia, errores);
  return tipo;
}

function validarRfce(raiz: NodoXml, errores: string[]): void {
  validarOrdenHijos(raiz, "RFCE", [nodo("Encabezado", 1), nodo("Signature")], errores);
  const encabezado = hijo(raiz, "Encabezado");
  if (!encabezado) return;
  validarOrdenHijos(
    encabezado,
    "RFCE/Encabezado",
    [
      nodo("Version", 1),
      nodo("IdDoc", 1),
      nodo("Emisor", 1),
      nodo("Comprador", 1),
      nodo("Totales", 1),
      nodo("CodigoSeguridadeCF", 1),
    ],
    errores,
  );
  const idDoc = hijo(encabezado, "IdDoc");
  if (idDoc)
    validarOrdenHijos(
      idDoc,
      "RFCE/IdDoc",
      [nodo("TipoeCF", 1), nodo("eNCF", 1), nodo("TipoIngresos", 1), nodo("TipoPago", 1)],
      errores,
    );
  const emisor = hijo(encabezado, "Emisor");
  if (emisor)
    validarOrdenHijos(
      emisor,
      "RFCE/Emisor",
      [nodo("RNCEmisor", 1), nodo("RazonSocialEmisor", 1), nodo("FechaEmision", 1)],
      errores,
    );
  const comprador = hijo(encabezado, "Comprador");
  if (comprador)
    validarOrdenHijos(comprador, "RFCE/Comprador", [nodo("RNCComprador"), nodo("RazonSocialComprador", 1)], errores);
  const totales = hijo(encabezado, "Totales");
  if (totales) {
    validarOrdenHijos(
      totales,
      "RFCE/Totales",
      reglasDesdeOrden(ORDEN_TOTALES_BASE.slice(0, 15), [
        "MontoGravadoTotal",
        "MontoGravadoI1",
        "MontoGravadoI2",
        "MontoExento",
        "TotalITBIS",
        "TotalITBIS1",
        "TotalITBIS2",
        "MontoTotal",
      ]),
      errores,
    );
  }
}

function validarArecf(raiz: NodoXml, errores: string[]): void {
  validarOrdenHijos(raiz, "ARECF", [nodo("DetalleAcusedeRecibo", 1), nodo("Signature")], errores);
  const detalle = hijo(raiz, "DetalleAcusedeRecibo");
  if (!detalle) return;
  validarOrdenHijos(
    detalle,
    "DetalleAcusedeRecibo",
    [
      nodo("Version", 1),
      nodo("RNCEmisor", 1),
      nodo("RNCComprador", 1),
      nodo("eNCF", 1),
      nodo("Estado", 1),
      nodo("CodigoMotivoNoRecibido"),
      nodo("FechaHoraAcuseRecibo", 1),
    ],
    errores,
  );
}

function validarAcecf(raiz: NodoXml, errores: string[]): void {
  validarOrdenHijos(raiz, "ACECF", [nodo("DetalleAprobacionComercial", 1), nodo("Signature")], errores);
  const detalle = hijo(raiz, "DetalleAprobacionComercial");
  if (!detalle) return;
  validarOrdenHijos(
    detalle,
    "DetalleAprobacionComercial",
    [
      nodo("Version", 1),
      nodo("RNCEmisor", 1),
      nodo("eNCF", 1),
      nodo("FechaEmision", 1),
      nodo("MontoTotal", 1),
      nodo("RNCComprador", 1),
      nodo("Estado", 1),
      nodo("DetalleMotivoRechazo"),
      nodo("FechaHoraAprobacionComercial", 1),
    ],
    errores,
  );
}

function validarAnecf(raiz: NodoXml, errores: string[]): void {
  validarOrdenHijos(raiz, "ANECF", [nodo("Encabezado", 1), nodo("DetalleAnulacion", 1), nodo("Signature")], errores);
  const encabezado = hijo(raiz, "Encabezado");
  if (encabezado) {
    validarOrdenHijos(
      encabezado,
      "ANECF/Encabezado",
      [nodo("Version", 1), nodo("RncEmisor", 1), nodo("CantidadeNCFAnulados", 1), nodo("FechaHoraAnulacioneNCF", 1)],
      errores,
    );
  }
  const detalle = hijo(raiz, "DetalleAnulacion");
  if (!detalle) return;
  validarOrdenHijos(detalle, "DetalleAnulacion", [nodo("Anulacion", 1, 999)], errores);
  detalle.hijos.forEach((anulacion, indice) => {
    validarOrdenHijos(
      anulacion,
      `Anulacion[${indice + 1}]`,
      [
        nodo("NoLinea", 1),
        nodo("TipoeCF", 1),
        nodo("TablaRangoSecuenciasAnuladaseNCF", 1),
        nodo("CantidadeNCFAnulados", 1),
      ],
      errores,
    );
    const tabla = hijo(anulacion, "TablaRangoSecuenciasAnuladaseNCF");
    if (tabla) validarOrdenHijos(tabla, "TablaRangoSecuenciasAnuladaseNCF", [nodo("Secuencias", 1, 999)], errores);
    for (const secuencias of tabla?.hijos ?? []) {
      validarOrdenHijos(
        secuencias,
        "Secuencias",
        [nodo("SecuenciaeNCFDesde", 1), nodo("SecuenciaeNCFHasta", 1)],
        errores,
      );
    }
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: concentra las restricciones XMLDSig publicadas por DGII
function validarSignature(firma: NodoXml, errores: string[]): void {
  validarOrdenHijos(
    firma,
    "Signature",
    [nodo("SignedInfo", 1), nodo("SignatureValue", 1), nodo("KeyInfo", 1)],
    errores,
  );
  const signedInfo = hijo(firma, "SignedInfo");
  if (!signedInfo) return;
  validarOrdenHijos(
    signedInfo,
    "SignedInfo",
    [nodo("CanonicalizationMethod", 1), nodo("SignatureMethod", 1), nodo("Reference", 1)],
    errores,
  );
  const canonicalization = hijo(signedInfo, "CanonicalizationMethod");
  const algoritmoC14n = canonicalization?.atributos.Algorithm ?? "";
  if (algoritmoC14n.toLowerCase().includes("exc-c14n"))
    errores.push("DGII prohíbe la canonicalización exclusiva exc-c14n en la firma XMLDSig");
  if (algoritmoC14n !== "http://www.w3.org/TR/2001/REC-xml-c14n-20010315") {
    errores.push("CanonicalizationMethod debe ser http://www.w3.org/TR/2001/REC-xml-c14n-20010315");
  }
  const algoritmoFirma = hijo(signedInfo, "SignatureMethod")?.atributos.Algorithm ?? "";
  if (algoritmoFirma !== "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256")
    errores.push("SignatureMethod debe ser rsa-sha256");
  const reference = hijo(signedInfo, "Reference");
  if (!reference) return;
  if (reference.atributos.URI !== "") errores.push('La Reference XMLDSig debe tener URI=""');
  validarOrdenHijos(
    reference,
    "Reference",
    [nodo("Transforms", 1), nodo("DigestMethod", 1), nodo("DigestValue", 1)],
    errores,
  );
  const transforms = hijo(reference, "Transforms");
  const algoritmosTransform = (transforms?.hijos ?? []).map((transform) => transform.atributos.Algorithm ?? "");
  if (!algoritmosTransform.includes("http://www.w3.org/2000/09/xmldsig#enveloped-signature")) {
    errores.push("La firma XMLDSig debe usar el Transform enveloped-signature");
  }
  if (algoritmosTransform.some((algoritmo) => algoritmo.toLowerCase().includes("exc-c14n"))) {
    errores.push("Los Transform de la firma no pueden usar canonicalización exclusiva exc-c14n");
  }
  const digest = hijo(reference, "DigestMethod")?.atributos.Algorithm ?? "";
  if (digest !== "http://www.w3.org/2001/04/xmlenc#sha256") errores.push("DigestMethod debe ser sha256");
  const keyInfo = hijo(firma, "KeyInfo");
  if (!keyInfo) return;
  if (hijo(keyInfo, "KeyValue") || hijo(keyInfo, "RSAKeyValue"))
    errores.push("KeyInfo no puede contener KeyValue ni RSAKeyValue según DGII");
  validarOrdenHijos(keyInfo, "KeyInfo", [nodo("X509Data", 1)], errores);
  const x509 = hijo(keyInfo, "X509Data");
  if (x509) validarOrdenHijos(x509, "X509Data", [nodo("X509Certificate", 1)], errores);
}

function validarPosicionSignature(raiz: NodoXml, errores: string[]): void {
  const indicesFirma = raiz.hijos
    .map((hijoActual, indice) => ({ hijoActual, indice }))
    .filter(({ hijoActual }) => hijoActual.nombre === "Signature");
  if (indicesFirma.length > 1) errores.push("El XML no puede contener más de un elemento Signature directo");
  const firma = indicesFirma[0];
  if (firma && firma.indice !== raiz.hijos.length - 1)
    errores.push("Signature debe ser el último hijo directo del elemento raíz");
  if (firma) validarSignature(firma.hijoActual, errores);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: agrupa los formatos lexicográficos del XSD para reportar rutas precisas
function validarFormatosEnNodo(nodoActual: NodoXml, ruta: string, errores: string[]): void {
  if (nodoActual.hijos.length > 0) return;
  const nombre = nodoActual.nombre;
  const texto = nodoActual.texto.trim();
  const poner = (mensaje: string) => errores.push(`${ruta}: ${mensaje}`);
  if ((nombre === "eNCF" || nombre === "NCFModificado" || nombre.startsWith("SecuenciaeNCF")) && !RE_ENCF.test(texto)) {
    poner("el e-NCF no cumple el formato E + tipo + 10 dígitos");
  }
  if (nombre.toLowerCase().includes("rnc") && !RE_RNC.test(texto)) poner("el RNC debe tener 9 u 11 dígitos");
  if (nombre.startsWith("FechaHora") && !RE_FECHA_HORA.test(texto))
    poner("la fecha-hora debe tener formato DD-MM-YYYY HH:mm:ss");
  else if (nombre.startsWith("Fecha") && !nombre.startsWith("FechaHora") && !RE_FECHA.test(texto)) {
    poner("la fecha debe tener formato DD-MM-YYYY");
  }
  if (
    nombre === "PrecioUnitarioItem" ||
    nombre === "PrecioUnitarioReferencia" ||
    nombre === "PrecioOtraMoneda" ||
    nombre === "TipoCambio"
  ) {
    if (!RE_PRECIO.test(texto)) poner("el precio o tipo de cambio admite hasta 4 decimales");
  } else if (
    nombre.startsWith("Monto") ||
    nombre.startsWith("TotalITBIS") ||
    nombre.startsWith("TotalISR") ||
    nombre === "DescuentoMonto" ||
    nombre === "RecargoMonto" ||
    nombre === "ValorDescuentooRecargo" ||
    nombre === "MontoDescuentooRecargo"
  ) {
    if (!RE_MONTO.test(texto)) poner("el monto debe expresarse con dos decimales");
  }
  if (
    (nombre === "NumeroLinea" ||
      nombre === "NoLinea" ||
      nombre === "CantidadeNCFAnulados" ||
      nombre === "TotalPaginas") &&
    !RE_ENTERO.test(texto)
  ) {
    poner("el valor debe ser entero positivo");
  }
}

function validarFormatos(raiz: NodoXml, errores: string[]): void {
  recorrerNodos(raiz, (nodoActual, ruta) => validarFormatosEnNodo(nodoActual, ruta, errores));
}

function validarEstructuraPorTipo(raiz: NodoXml, errores: string[]): string | null {
  if (raiz.nombre === "ECF") return validarEstructuraEcf(raiz, errores);
  if (raiz.nombre === "RFCE") {
    validarRfce(raiz, errores);
    return "32";
  }
  if (raiz.nombre === "ARECF") validarArecf(raiz, errores);
  else if (raiz.nombre === "ACECF") validarAcecf(raiz, errores);
  else if (raiz.nombre === "ANECF") validarAnecf(raiz, errores);
  else if (raiz.nombre !== "RFCE") errores.push(`El elemento raíz <${raiz.nombre}> no es un esquema DGII admitido`);
  return null;
}

export function validarXmlContraEsquemaDgii(xml: string, tipoEsperado?: TipoEsquemaDgii): ResultadoValidacionXsdDgii {
  const errores: string[] = [];
  if (!RE_DECLARACION.test(xml)) errores.push('La declaración XML debe ser exactamente version="1.0" encoding="utf-8"');
  if (/(^|>)[\t\n\r ]+</.test(xml.replace(RE_DECLARACION, ""))) {
    errores.push("El XML debe ser compacto: no puede tener espacios ni saltos de línea entre etiquetas");
  }
  const cuerpo = xml.replace(RE_DECLARACION, "");
  const raiz = parsearCuerpoXml(cuerpo, errores);
  if (!raiz) {
    errores.push("El XML no tiene un elemento raíz válido");
    return { valido: false, tipoDetectado: null, errores };
  }
  if (tipoEsperado && raiz.nombre !== tipoEsperado)
    errores.push(`Se esperaba un XML ${tipoEsperado}, pero se recibió <${raiz.nombre}>`);
  validarSinEtiquetasVacias(raiz, errores);
  const tipoDetectado = validarEstructuraPorTipo(raiz, errores);
  validarPosicionSignature(raiz, errores);
  validarFormatos(raiz, errores);
  return { valido: errores.length === 0, tipoDetectado, errores };
}
