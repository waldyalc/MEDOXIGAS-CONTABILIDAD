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

const ESQUEMAS_ECF_XSD: Record<TipoEcf, Record<string, ReglaHijo[]>> = {
  "31": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("IndicadorNorma1007", 0, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("Retencion", 0, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("CantidadReferencia", 0, 1),
      nodo("UnidadReferencia", 0, 1),
      nodo("TablaSubcantidad", 0, 1),
      nodo("GradosAlcohol", 0, 1),
      nodo("PrecioUnitarioReferencia", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("TablaImpuestoAdicional", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/Retencion": [
      nodo("IndicadorAgenteRetencionoPercepcion", 0, 1),
      nodo("MontoITBISRetenido", 0, 1),
      nodo("MontoISRRetenido", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional": [nodo("ImpuestoAdicional", 1, 2)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional/ImpuestoAdicional": [nodo("TipoImpuesto", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubcantidad": [nodo("SubcantidadItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaSubcantidad/SubcantidadItem": [
      nodo("Subcantidad", 0, 1),
      nodo("CodigoSubcantidad", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 1, 1),
      nodo("InformacionesAdicionales", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 1, 1),
      nodo("RazonSocialComprador", 1, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("FechaEntrega", 0, 1),
      nodo("ContactoEntrega", 0, 1),
      nodo("DireccionEntrega", 0, 1),
      nodo("TelefonoAdicional", 0, 1),
      nodo("FechaOrdenCompra", 0, 1),
      nodo("NumeroOrdenCompra", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("CodigoVendedor", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("ZonaVenta", 0, 1),
      nodo("RutaVenta", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("IndicadorEnvioDiferido", 0, 1),
      nodo("IndicadorMontoGravado", 0, 1),
      nodo("IndicadorServicioTodoIncluido", 0, 1),
      nodo("TipoIngresos", 1, 1),
      nodo("TipoPago", 1, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/InformacionesAdicionales": [
      nodo("FechaEmbarque", 0, 1),
      nodo("NumeroEmbarque", 0, 1),
      nodo("NumeroContenedor", 0, 1),
      nodo("NumeroReferencia", 0, 1),
      nodo("PesoBruto", 0, 1),
      nodo("PesoNeto", 0, 1),
      nodo("UnidadPesoBruto", 0, 1),
      nodo("UnidadPesoNeto", 0, 1),
      nodo("CantidadBulto", 0, 1),
      nodo("UnidadBulto", 0, 1),
      nodo("VolumenBulto", 0, 1),
      nodo("UnidadVolumen", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoGravadoTotalOtraMoneda", 0, 1),
      nodo("MontoGravado1OtraMoneda", 0, 1),
      nodo("MontoGravado2OtraMoneda", 0, 1),
      nodo("MontoGravado3OtraMoneda", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("TotalITBISOtraMoneda", 0, 1),
      nodo("TotalITBIS1OtraMoneda", 0, 1),
      nodo("TotalITBIS2OtraMoneda", 0, 1),
      nodo("TotalITBIS3OtraMoneda", 0, 1),
      nodo("MontoImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("ImpuestosAdicionalesOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda": [nodo("ImpuestoAdicionalOtraMoneda", 1, 20)],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda/ImpuestoAdicionalOtraMoneda": [
      nodo("TipoImpuestoOtraMoneda", 1, 1),
      nodo("TasaImpuestoAdicionalOtraMoneda", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecificoOtraMoneda", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda", 0, 1),
      nodo("OtrosImpuestosAdicionalesOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoGravadoTotal", 0, 1),
      nodo("MontoGravadoI1", 0, 1),
      nodo("MontoGravadoI2", 0, 1),
      nodo("MontoGravadoI3", 0, 1),
      nodo("MontoExento", 0, 1),
      nodo("ITBIS1", 0, 1),
      nodo("ITBIS2", 0, 1),
      nodo("ITBIS3", 0, 1),
      nodo("TotalITBIS", 0, 1),
      nodo("TotalITBIS1", 0, 1),
      nodo("TotalITBIS2", 0, 1),
      nodo("TotalITBIS3", 0, 1),
      nodo("MontoImpuestoAdicional", 0, 1),
      nodo("ImpuestosAdicionales", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoNoFacturable", 0, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
      nodo("TotalITBISRetenido", 0, 1),
      nodo("TotalISRRetencion", 0, 1),
      nodo("TotalITBISPercepcion", 0, 1),
      nodo("TotalISRPercepcion", 0, 1),
    ],
    "ECF/Encabezado/Totales/ImpuestosAdicionales": [nodo("ImpuestoAdicional", 1, 20)],
    "ECF/Encabezado/Totales/ImpuestosAdicionales/ImpuestoAdicional": [
      nodo("TipoImpuesto", 1, 1),
      nodo("TasaImpuestoAdicional", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecifico", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvalorem", 0, 1),
      nodo("OtrosImpuestosAdicionales", 0, 1),
    ],
    "ECF/Encabezado/Transporte": [
      nodo("Conductor", 0, 1),
      nodo("DocumentoTransporte", 0, 1),
      nodo("Ficha", 0, 1),
      nodo("Placa", 0, 1),
      nodo("RutaTransporte", 0, 1),
      nodo("ZonaTransporte", 0, 1),
      nodo("NumeroAlbaran", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalMontoGravadoPagina", 0, 1),
      nodo("SubtotalMontoGravado1Pagina", 0, 1),
      nodo("SubtotalMontoGravado2Pagina", 0, 1),
      nodo("SubtotalMontoGravado3Pagina", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("SubtotalItbisPagina", 0, 1),
      nodo("SubtotalItbis1Pagina", 0, 1),
      nodo("SubtotalItbis2Pagina", 0, 1),
      nodo("SubtotalItbis3Pagina", 0, 1),
      nodo("SubtotalImpuestoAdicionalPagina", 0, 1),
      nodo("SubtotalImpuestoAdicional", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
      nodo("SubtotalMontoNoFacturablePagina", 0, 1),
    ],
    "ECF/Paginacion/Pagina/SubtotalImpuestoAdicional": [
      nodo("SubtotalImpuestoSelectivoConsumoEspecificoPagina", 0, 1),
      nodo("SubtotalOtrosImpuesto", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalMontoGravadoTotal", 0, 1),
      nodo("SubTotalMontoGravadoI1", 0, 1),
      nodo("SubTotalMontoGravadoI2", 0, 1),
      nodo("SubTotalMontoGravadoI3", 0, 1),
      nodo("SubTotaITBIS", 0, 1),
      nodo("SubTotaITBIS1", 0, 1),
      nodo("SubTotaITBIS2", 0, 1),
      nodo("SubTotaITBIS3", 0, 1),
      nodo("SubTotalImpuestoAdicional", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "32": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("IndicadorNorma1007", 0, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("CantidadReferencia", 0, 1),
      nodo("UnidadReferencia", 0, 1),
      nodo("TablaSubcantidad", 0, 1),
      nodo("GradosAlcohol", 0, 1),
      nodo("PrecioUnitarioReferencia", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("Mineria", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("TablaImpuestoAdicional", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/Mineria": [
      nodo("PesoNetoKilogramo", 0, 1),
      nodo("PesoNetoMineria", 0, 1),
      nodo("TipoAfiliacion", 0, 1),
      nodo("Liquidacion", 0, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional": [nodo("ImpuestoAdicional", 1, 2)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional/ImpuestoAdicional": [nodo("TipoImpuesto", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubcantidad": [nodo("SubcantidadItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaSubcantidad/SubcantidadItem": [
      nodo("Subcantidad", 0, 1),
      nodo("CodigoSubcantidad", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 1, 1),
      nodo("InformacionesAdicionales", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 0, 1),
      nodo("IdentificadorExtranjero", 0, 1),
      nodo("RazonSocialComprador", 0, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("FechaEntrega", 0, 1),
      nodo("ContactoEntrega", 0, 1),
      nodo("DireccionEntrega", 0, 1),
      nodo("TelefonoAdicional", 0, 1),
      nodo("FechaOrdenCompra", 0, 1),
      nodo("NumeroOrdenCompra", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("CodigoVendedor", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("ZonaVenta", 0, 1),
      nodo("RutaVenta", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("IndicadorEnvioDiferido", 0, 1),
      nodo("IndicadorMontoGravado", 0, 1),
      nodo("IndicadorServicioTodoIncluido", 0, 1),
      nodo("TipoIngresos", 1, 1),
      nodo("TipoPago", 1, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/InformacionesAdicionales": [
      nodo("FechaEmbarque", 0, 1),
      nodo("NumeroEmbarque", 0, 1),
      nodo("NumeroContenedor", 0, 1),
      nodo("NumeroReferencia", 0, 1),
      nodo("PesoBruto", 0, 1),
      nodo("PesoNeto", 0, 1),
      nodo("UnidadPesoBruto", 0, 1),
      nodo("UnidadPesoNeto", 0, 1),
      nodo("CantidadBulto", 0, 1),
      nodo("UnidadBulto", 0, 1),
      nodo("VolumenBulto", 0, 1),
      nodo("UnidadVolumen", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoGravadoTotalOtraMoneda", 0, 1),
      nodo("MontoGravado1OtraMoneda", 0, 1),
      nodo("MontoGravado2OtraMoneda", 0, 1),
      nodo("MontoGravado3OtraMoneda", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("TotalITBISOtraMoneda", 0, 1),
      nodo("TotalITBIS1OtraMoneda", 0, 1),
      nodo("TotalITBIS2OtraMoneda", 0, 1),
      nodo("TotalITBIS3OtraMoneda", 0, 1),
      nodo("MontoImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("ImpuestosAdicionalesOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda": [nodo("ImpuestoAdicionalOtraMoneda", 1, 20)],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda/ImpuestoAdicionalOtraMoneda": [
      nodo("TipoImpuestoOtraMoneda", 1, 1),
      nodo("TasaImpuestoAdicionalOtraMoneda", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecificoOtraMoneda", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda", 0, 1),
      nodo("OtrosImpuestosAdicionalesOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoGravadoTotal", 0, 1),
      nodo("MontoGravadoI1", 0, 1),
      nodo("MontoGravadoI2", 0, 1),
      nodo("MontoGravadoI3", 0, 1),
      nodo("MontoExento", 0, 1),
      nodo("ITBIS1", 0, 1),
      nodo("ITBIS2", 0, 1),
      nodo("ITBIS3", 0, 1),
      nodo("TotalITBIS", 0, 1),
      nodo("TotalITBIS1", 0, 1),
      nodo("TotalITBIS2", 0, 1),
      nodo("TotalITBIS3", 0, 1),
      nodo("MontoImpuestoAdicional", 0, 1),
      nodo("ImpuestosAdicionales", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoNoFacturable", 0, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
    ],
    "ECF/Encabezado/Totales/ImpuestosAdicionales": [nodo("ImpuestoAdicional", 1, 20)],
    "ECF/Encabezado/Totales/ImpuestosAdicionales/ImpuestoAdicional": [
      nodo("TipoImpuesto", 1, 1),
      nodo("TasaImpuestoAdicional", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecifico", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvalorem", 0, 1),
      nodo("OtrosImpuestosAdicionales", 0, 1),
    ],
    "ECF/Encabezado/Transporte": [
      nodo("Conductor", 0, 1),
      nodo("DocumentoTransporte", 0, 1),
      nodo("Ficha", 0, 1),
      nodo("Placa", 0, 1),
      nodo("RutaTransporte", 0, 1),
      nodo("ZonaTransporte", 0, 1),
      nodo("NumeroAlbaran", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalMontoGravadoPagina", 0, 1),
      nodo("SubtotalMontoGravado1Pagina", 0, 1),
      nodo("SubtotalMontoGravado2Pagina", 0, 1),
      nodo("SubtotalMontoGravado3Pagina", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("SubtotalItbisPagina", 0, 1),
      nodo("SubtotalItbis1Pagina", 0, 1),
      nodo("SubtotalItbis2Pagina", 0, 1),
      nodo("SubtotalItbis3Pagina", 0, 1),
      nodo("SubtotalImpuestoAdicionalPagina", 0, 1),
      nodo("SubtotalImpuestoAdicional", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
      nodo("SubtotalMontoNoFacturablePagina", 0, 1),
    ],
    "ECF/Paginacion/Pagina/SubtotalImpuestoAdicional": [
      nodo("SubtotalImpuestoSelectivoConsumoEspecificoPagina", 0, 1),
      nodo("SubtotalOtrosImpuesto", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalMontoGravadoTotal", 0, 1),
      nodo("SubTotalMontoGravadoI1", 0, 1),
      nodo("SubTotalMontoGravadoI2", 0, 1),
      nodo("SubTotalMontoGravadoI3", 0, 1),
      nodo("SubTotaITBIS", 0, 1),
      nodo("SubTotaITBIS1", 0, 1),
      nodo("SubTotaITBIS2", 0, 1),
      nodo("SubTotaITBIS3", 0, 1),
      nodo("SubTotalImpuestoAdicional", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "33": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 1, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("IndicadorNorma1007", 0, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 10000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("Retencion", 0, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("CantidadReferencia", 0, 1),
      nodo("UnidadReferencia", 0, 1),
      nodo("TablaSubcantidad", 0, 1),
      nodo("GradosAlcohol", 0, 1),
      nodo("PrecioUnitarioReferencia", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("Mineria", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("TablaImpuestoAdicional", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/Mineria": [
      nodo("PesoNetoKilogramo", 0, 1),
      nodo("PesoNetoMineria", 0, 1),
      nodo("TipoAfiliacion", 0, 1),
      nodo("Liquidacion", 0, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/Retencion": [
      nodo("IndicadorAgenteRetencionoPercepcion", 0, 1),
      nodo("MontoITBISRetenido", 0, 1),
      nodo("MontoISRRetenido", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional": [nodo("ImpuestoAdicional", 1, 2)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional/ImpuestoAdicional": [nodo("TipoImpuesto", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubcantidad": [nodo("SubcantidadItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaSubcantidad/SubcantidadItem": [
      nodo("Subcantidad", 0, 1),
      nodo("CodigoSubcantidad", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 0, 1),
      nodo("InformacionesAdicionales", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 0, 1),
      nodo("IdentificadorExtranjero", 0, 1),
      nodo("RazonSocialComprador", 0, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("FechaEntrega", 0, 1),
      nodo("ContactoEntrega", 0, 1),
      nodo("DireccionEntrega", 0, 1),
      nodo("TelefonoAdicional", 0, 1),
      nodo("FechaOrdenCompra", 0, 1),
      nodo("NumeroOrdenCompra", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("CodigoVendedor", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("ZonaVenta", 0, 1),
      nodo("RutaVenta", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("IndicadorEnvioDiferido", 0, 1),
      nodo("IndicadorMontoGravado", 0, 1),
      nodo("IndicadorServicioTodoIncluido", 0, 1),
      nodo("TipoIngresos", 0, 1),
      nodo("TipoPago", 1, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/InformacionesAdicionales": [
      nodo("FechaEmbarque", 0, 1),
      nodo("NumeroEmbarque", 0, 1),
      nodo("NumeroContenedor", 0, 1),
      nodo("NumeroReferencia", 0, 1),
      nodo("PesoBruto", 0, 1),
      nodo("PesoNeto", 0, 1),
      nodo("UnidadPesoBruto", 0, 1),
      nodo("UnidadPesoNeto", 0, 1),
      nodo("CantidadBulto", 0, 1),
      nodo("UnidadBulto", 0, 1),
      nodo("VolumenBulto", 0, 1),
      nodo("UnidadVolumen", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoGravadoTotalOtraMoneda", 0, 1),
      nodo("MontoGravado1OtraMoneda", 0, 1),
      nodo("MontoGravado2OtraMoneda", 0, 1),
      nodo("MontoGravado3OtraMoneda", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("TotalITBISOtraMoneda", 0, 1),
      nodo("TotalITBIS1OtraMoneda", 0, 1),
      nodo("TotalITBIS2OtraMoneda", 0, 1),
      nodo("TotalITBIS3OtraMoneda", 0, 1),
      nodo("MontoImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("ImpuestosAdicionalesOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda": [nodo("ImpuestoAdicionalOtraMoneda", 1, 20)],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda/ImpuestoAdicionalOtraMoneda": [
      nodo("TipoImpuestoOtraMoneda", 1, 1),
      nodo("TasaImpuestoAdicionalOtraMoneda", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecificoOtraMoneda", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda", 0, 1),
      nodo("OtrosImpuestosAdicionalesOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoGravadoTotal", 0, 1),
      nodo("MontoGravadoI1", 0, 1),
      nodo("MontoGravadoI2", 0, 1),
      nodo("MontoGravadoI3", 0, 1),
      nodo("MontoExento", 0, 1),
      nodo("ITBIS1", 0, 1),
      nodo("ITBIS2", 0, 1),
      nodo("ITBIS3", 0, 1),
      nodo("TotalITBIS", 0, 1),
      nodo("TotalITBIS1", 0, 1),
      nodo("TotalITBIS2", 0, 1),
      nodo("TotalITBIS3", 0, 1),
      nodo("MontoImpuestoAdicional", 0, 1),
      nodo("ImpuestosAdicionales", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoNoFacturable", 0, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
      nodo("TotalITBISRetenido", 0, 1),
      nodo("TotalISRRetencion", 0, 1),
      nodo("TotalITBISPercepcion", 0, 1),
      nodo("TotalISRPercepcion", 0, 1),
    ],
    "ECF/Encabezado/Totales/ImpuestosAdicionales": [nodo("ImpuestoAdicional", 1, 20)],
    "ECF/Encabezado/Totales/ImpuestosAdicionales/ImpuestoAdicional": [
      nodo("TipoImpuesto", 1, 1),
      nodo("TasaImpuestoAdicional", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecifico", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvalorem", 0, 1),
      nodo("OtrosImpuestosAdicionales", 0, 1),
    ],
    "ECF/Encabezado/Transporte": [
      nodo("Conductor", 0, 1),
      nodo("DocumentoTransporte", 0, 1),
      nodo("Ficha", 0, 1),
      nodo("Placa", 0, 1),
      nodo("RutaTransporte", 0, 1),
      nodo("ZonaTransporte", 0, 1),
      nodo("NumeroAlbaran", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 1, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 1, 1),
      nodo("CodigoModificacion", 1, 1),
      nodo("RazonModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 10000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalMontoGravadoPagina", 0, 1),
      nodo("SubtotalMontoGravado1Pagina", 0, 1),
      nodo("SubtotalMontoGravado2Pagina", 0, 1),
      nodo("SubtotalMontoGravado3Pagina", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("SubtotalItbisPagina", 0, 1),
      nodo("SubtotalItbis1Pagina", 0, 1),
      nodo("SubtotalItbis2Pagina", 0, 1),
      nodo("SubtotalItbis3Pagina", 0, 1),
      nodo("SubtotalImpuestoAdicionalPagina", 0, 1),
      nodo("SubtotalImpuestoAdicional", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
      nodo("SubtotalMontoNoFacturablePagina", 0, 1),
    ],
    "ECF/Paginacion/Pagina/SubtotalImpuestoAdicional": [
      nodo("SubtotalImpuestoSelectivoConsumoEspecificoPagina", 0, 1),
      nodo("SubtotalOtrosImpuesto", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalMontoGravadoTotal", 0, 1),
      nodo("SubTotalMontoGravadoI1", 0, 1),
      nodo("SubTotalMontoGravadoI2", 0, 1),
      nodo("SubTotalMontoGravadoI3", 0, 1),
      nodo("SubTotaITBIS", 0, 1),
      nodo("SubTotaITBIS1", 0, 1),
      nodo("SubTotaITBIS2", 0, 1),
      nodo("SubTotaITBIS3", 0, 1),
      nodo("SubTotalImpuestoAdicional", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "34": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 1, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("IndicadorNorma1007", 0, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 10000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("Retencion", 0, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("CantidadReferencia", 0, 1),
      nodo("UnidadReferencia", 0, 1),
      nodo("TablaSubcantidad", 0, 1),
      nodo("GradosAlcohol", 0, 1),
      nodo("PrecioUnitarioReferencia", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("Mineria", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("TablaImpuestoAdicional", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/Mineria": [
      nodo("PesoNetoKilogramo", 0, 1),
      nodo("PesoNetoMineria", 0, 1),
      nodo("TipoAfiliacion", 0, 1),
      nodo("Liquidacion", 0, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/Retencion": [
      nodo("IndicadorAgenteRetencionoPercepcion", 0, 1),
      nodo("MontoITBISRetenido", 0, 1),
      nodo("MontoISRRetenido", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional": [nodo("ImpuestoAdicional", 1, 2)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional/ImpuestoAdicional": [nodo("TipoImpuesto", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubcantidad": [nodo("SubcantidadItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaSubcantidad/SubcantidadItem": [
      nodo("Subcantidad", 0, 1),
      nodo("CodigoSubcantidad", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 0, 1),
      nodo("InformacionesAdicionales", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 0, 1),
      nodo("IdentificadorExtranjero", 0, 1),
      nodo("RazonSocialComprador", 0, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("FechaEntrega", 0, 1),
      nodo("ContactoEntrega", 0, 1),
      nodo("DireccionEntrega", 0, 1),
      nodo("TelefonoAdicional", 0, 1),
      nodo("FechaOrdenCompra", 0, 1),
      nodo("NumeroOrdenCompra", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("CodigoVendedor", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("ZonaVenta", 0, 1),
      nodo("RutaVenta", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("IndicadorNotaCredito", 1, 1),
      nodo("IndicadorEnvioDiferido", 0, 1),
      nodo("IndicadorMontoGravado", 0, 1),
      nodo("IndicadorServicioTodoIncluido", 0, 1),
      nodo("TipoIngresos", 0, 1),
      nodo("TipoPago", 1, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/InformacionesAdicionales": [
      nodo("FechaEmbarque", 0, 1),
      nodo("NumeroEmbarque", 0, 1),
      nodo("NumeroContenedor", 0, 1),
      nodo("NumeroReferencia", 0, 1),
      nodo("PesoBruto", 0, 1),
      nodo("PesoNeto", 0, 1),
      nodo("UnidadPesoBruto", 0, 1),
      nodo("UnidadPesoNeto", 0, 1),
      nodo("CantidadBulto", 0, 1),
      nodo("UnidadBulto", 0, 1),
      nodo("VolumenBulto", 0, 1),
      nodo("UnidadVolumen", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoGravadoTotalOtraMoneda", 0, 1),
      nodo("MontoGravado1OtraMoneda", 0, 1),
      nodo("MontoGravado2OtraMoneda", 0, 1),
      nodo("MontoGravado3OtraMoneda", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("TotalITBISOtraMoneda", 0, 1),
      nodo("TotalITBIS1OtraMoneda", 0, 1),
      nodo("TotalITBIS2OtraMoneda", 0, 1),
      nodo("TotalITBIS3OtraMoneda", 0, 1),
      nodo("MontoImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("ImpuestosAdicionalesOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda": [nodo("ImpuestoAdicionalOtraMoneda", 1, 20)],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda/ImpuestoAdicionalOtraMoneda": [
      nodo("TipoImpuestoOtraMoneda", 1, 1),
      nodo("TasaImpuestoAdicionalOtraMoneda", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecificoOtraMoneda", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda", 0, 1),
      nodo("OtrosImpuestosAdicionalesOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoGravadoTotal", 0, 1),
      nodo("MontoGravadoI1", 0, 1),
      nodo("MontoGravadoI2", 0, 1),
      nodo("MontoGravadoI3", 0, 1),
      nodo("MontoExento", 0, 1),
      nodo("ITBIS1", 0, 1),
      nodo("ITBIS2", 0, 1),
      nodo("ITBIS3", 0, 1),
      nodo("TotalITBIS", 0, 1),
      nodo("TotalITBIS1", 0, 1),
      nodo("TotalITBIS2", 0, 1),
      nodo("TotalITBIS3", 0, 1),
      nodo("MontoImpuestoAdicional", 0, 1),
      nodo("ImpuestosAdicionales", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoNoFacturable", 0, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
      nodo("TotalITBISRetenido", 0, 1),
      nodo("TotalISRRetencion", 0, 1),
      nodo("TotalITBISPercepcion", 0, 1),
      nodo("TotalISRPercepcion", 0, 1),
    ],
    "ECF/Encabezado/Totales/ImpuestosAdicionales": [nodo("ImpuestoAdicional", 1, 20)],
    "ECF/Encabezado/Totales/ImpuestosAdicionales/ImpuestoAdicional": [
      nodo("TipoImpuesto", 0, 1),
      nodo("TasaImpuestoAdicional", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecifico", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvalorem", 0, 1),
      nodo("OtrosImpuestosAdicionales", 0, 1),
    ],
    "ECF/Encabezado/Transporte": [
      nodo("Conductor", 0, 1),
      nodo("DocumentoTransporte", 0, 1),
      nodo("Ficha", 0, 1),
      nodo("Placa", 0, 1),
      nodo("RutaTransporte", 0, 1),
      nodo("ZonaTransporte", 0, 1),
      nodo("NumeroAlbaran", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 1, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 1, 1),
      nodo("CodigoModificacion", 1, 1),
      nodo("RazonModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 10000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalMontoGravadoPagina", 0, 1),
      nodo("SubtotalMontoGravado1Pagina", 0, 1),
      nodo("SubtotalMontoGravado2Pagina", 0, 1),
      nodo("SubtotalMontoGravado3Pagina", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("SubtotalItbisPagina", 0, 1),
      nodo("SubtotalItbis1Pagina", 0, 1),
      nodo("SubtotalItbis2Pagina", 0, 1),
      nodo("SubtotalItbis3Pagina", 0, 1),
      nodo("SubtotalImpuestoAdicionalPagina", 0, 1),
      nodo("SubtotalImpuestoAdicional", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
      nodo("SubtotalMontoNoFacturablePagina", 0, 1),
    ],
    "ECF/Paginacion/Pagina/SubtotalImpuestoAdicional": [
      nodo("SubtotalImpuestoSelectivoConsumoEspecificoPagina", 0, 1),
      nodo("SubtotalOtrosImpuesto", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalMontoGravadoTotal", 0, 1),
      nodo("SubTotalMontoGravadoI1", 0, 1),
      nodo("SubTotalMontoGravadoI2", 0, 1),
      nodo("SubTotalMontoGravadoI3", 0, 1),
      nodo("SubTotaITBIS", 0, 1),
      nodo("SubTotaITBIS1", 0, 1),
      nodo("SubTotaITBIS2", 0, 1),
      nodo("SubTotaITBIS3", 0, 1),
      nodo("SubTotalImpuestoAdicional", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "41": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("Retencion", 1, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/Retencion": [
      nodo("IndicadorAgenteRetencionoPercepcion", 1, 1),
      nodo("MontoITBISRetenido", 0, 1),
      nodo("MontoISRRetenido", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 1, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 1, 1),
      nodo("RazonSocialComprador", 1, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("IndicadorMontoGravado", 0, 1),
      nodo("TipoPago", 0, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoGravadoTotalOtraMoneda", 0, 1),
      nodo("MontoGravado1OtraMoneda", 0, 1),
      nodo("MontoGravado2OtraMoneda", 0, 1),
      nodo("MontoGravado3OtraMoneda", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("TotalITBISOtraMoneda", 0, 1),
      nodo("TotalITBIS1OtraMoneda", 0, 1),
      nodo("TotalITBIS2OtraMoneda", 0, 1),
      nodo("TotalITBIS3OtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoGravadoTotal", 0, 1),
      nodo("MontoGravadoI1", 0, 1),
      nodo("MontoGravadoI2", 0, 1),
      nodo("MontoGravadoI3", 0, 1),
      nodo("MontoExento", 0, 1),
      nodo("ITBIS1", 0, 1),
      nodo("ITBIS2", 0, 1),
      nodo("ITBIS3", 0, 1),
      nodo("TotalITBIS", 0, 1),
      nodo("TotalITBIS1", 0, 1),
      nodo("TotalITBIS2", 0, 1),
      nodo("TotalITBIS3", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
      nodo("TotalITBISRetenido", 0, 1),
      nodo("TotalISRRetencion", 0, 1),
      nodo("TotalITBISPercepcion", 0, 1),
      nodo("TotalISRPercepcion", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalMontoGravadoPagina", 0, 1),
      nodo("SubtotalMontoGravado1Pagina", 0, 1),
      nodo("SubtotalMontoGravado2Pagina", 0, 1),
      nodo("SubtotalMontoGravado3Pagina", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("SubtotalItbisPagina", 0, 1),
      nodo("SubtotalItbis1Pagina", 0, 1),
      nodo("SubtotalItbis2Pagina", 0, 1),
      nodo("SubtotalItbis3Pagina", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalMontoGravadoTotal", 0, 1),
      nodo("SubTotalMontoGravadoI1", 0, 1),
      nodo("SubTotalMontoGravadoI2", 0, 1),
      nodo("SubTotalMontoGravadoI3", 0, 1),
      nodo("SubTotaITBIS", 0, 1),
      nodo("SubTotaITBIS1", 0, 1),
      nodo("SubTotaITBIS2", 0, 1),
      nodo("SubTotaITBIS3", 0, 1),
      nodo("SubTotalImpuestoAdicional", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "43": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("TipoPago", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoExento", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "44": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("TablaImpuestoAdicional", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional": [nodo("ImpuestoAdicional", 1, 2)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional/ImpuestoAdicional": [nodo("TipoImpuesto", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 1, 1),
      nodo("InformacionesAdicionales", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 0, 1),
      nodo("IdentificadorExtranjero", 0, 1),
      nodo("RazonSocialComprador", 1, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("FechaEntrega", 0, 1),
      nodo("ContactoEntrega", 0, 1),
      nodo("DireccionEntrega", 0, 1),
      nodo("TelefonoAdicional", 0, 1),
      nodo("FechaOrdenCompra", 0, 1),
      nodo("NumeroOrdenCompra", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("CodigoVendedor", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("ZonaVenta", 0, 1),
      nodo("RutaVenta", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("IndicadorEnvioDiferido", 0, 1),
      nodo("IndicadorServicioTodoIncluido", 0, 1),
      nodo("TipoIngresos", 1, 1),
      nodo("TipoPago", 1, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/InformacionesAdicionales": [
      nodo("FechaEmbarque", 0, 1),
      nodo("NumeroEmbarque", 0, 1),
      nodo("NumeroContenedor", 0, 1),
      nodo("NumeroReferencia", 0, 1),
      nodo("PesoBruto", 0, 1),
      nodo("PesoNeto", 0, 1),
      nodo("UnidadPesoBruto", 0, 1),
      nodo("UnidadPesoNeto", 0, 1),
      nodo("CantidadBulto", 0, 1),
      nodo("UnidadBulto", 0, 1),
      nodo("VolumenBulto", 0, 1),
      nodo("UnidadVolumen", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("MontoImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("ImpuestosAdicionalesOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda": [nodo("ImpuestoAdicionalOtraMoneda", 1, 20)],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda/ImpuestoAdicionalOtraMoneda": [
      nodo("TipoImpuestoOtraMoneda", 0, 1),
      nodo("TasaImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("OtrosImpuestosAdicionalesOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoExento", 0, 1),
      nodo("MontoImpuestoAdicional", 0, 1),
      nodo("ImpuestosAdicionales", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoNoFacturable", 0, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
    ],
    "ECF/Encabezado/Totales/ImpuestosAdicionales": [nodo("ImpuestoAdicional", 1, 20)],
    "ECF/Encabezado/Totales/ImpuestosAdicionales/ImpuestoAdicional": [
      nodo("TipoImpuesto", 1, 1),
      nodo("TasaImpuestoAdicional", 1, 1),
      nodo("OtrosImpuestosAdicionales", 1, 1),
    ],
    "ECF/Encabezado/Transporte": [
      nodo("Conductor", 0, 1),
      nodo("DocumentoTransporte", 0, 1),
      nodo("Ficha", 0, 1),
      nodo("Placa", 0, 1),
      nodo("RutaTransporte", 0, 1),
      nodo("ZonaTransporte", 0, 1),
      nodo("NumeroAlbaran", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("SubtotalImpuestoAdicionalPagina", 0, 1),
      nodo("SubtotalImpuestoAdicional", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
      nodo("SubtotalMontoNoFacturablePagina", 0, 1),
    ],
    "ECF/Paginacion/Pagina/SubtotalImpuestoAdicional": [nodo("SubtotalOtrosImpuesto", 0, 1)],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalImpuestoAdicional", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "45": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("IndicadorNorma1007", 0, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("CantidadReferencia", 0, 1),
      nodo("UnidadReferencia", 0, 1),
      nodo("TablaSubcantidad", 0, 1),
      nodo("GradosAlcohol", 0, 1),
      nodo("PrecioUnitarioReferencia", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("TablaImpuestoAdicional", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional": [nodo("ImpuestoAdicional", 1, 2)],
    "ECF/DetallesItems/Item/TablaImpuestoAdicional/ImpuestoAdicional": [nodo("TipoImpuesto", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubcantidad": [nodo("SubcantidadItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaSubcantidad/SubcantidadItem": [
      nodo("Subcantidad", 0, 1),
      nodo("CodigoSubcantidad", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 1, 1),
      nodo("InformacionesAdicionales", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 1, 1),
      nodo("RazonSocialComprador", 1, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("FechaEntrega", 0, 1),
      nodo("ContactoEntrega", 0, 1),
      nodo("DireccionEntrega", 0, 1),
      nodo("TelefonoAdicional", 0, 1),
      nodo("FechaOrdenCompra", 0, 1),
      nodo("NumeroOrdenCompra", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("CodigoVendedor", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("ZonaVenta", 0, 1),
      nodo("RutaVenta", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("IndicadorEnvioDiferido", 0, 1),
      nodo("IndicadorMontoGravado", 0, 1),
      nodo("IndicadorServicioTodoIncluido", 0, 1),
      nodo("TipoIngresos", 1, 1),
      nodo("TipoPago", 1, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/InformacionesAdicionales": [
      nodo("FechaEmbarque", 0, 1),
      nodo("NumeroEmbarque", 0, 1),
      nodo("NumeroContenedor", 0, 1),
      nodo("NumeroReferencia", 0, 1),
      nodo("PesoBruto", 0, 1),
      nodo("PesoNeto", 0, 1),
      nodo("UnidadPesoBruto", 0, 1),
      nodo("UnidadPesoNeto", 0, 1),
      nodo("CantidadBulto", 0, 1),
      nodo("UnidadBulto", 0, 1),
      nodo("VolumenBulto", 0, 1),
      nodo("UnidadVolumen", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoGravadoTotalOtraMoneda", 0, 1),
      nodo("MontoGravado1OtraMoneda", 0, 1),
      nodo("MontoGravado2OtraMoneda", 0, 1),
      nodo("MontoGravado3OtraMoneda", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("TotalITBISOtraMoneda", 0, 1),
      nodo("TotalITBIS1OtraMoneda", 0, 1),
      nodo("TotalITBIS2OtraMoneda", 0, 1),
      nodo("TotalITBIS3OtraMoneda", 0, 1),
      nodo("MontoImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("ImpuestosAdicionalesOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda": [nodo("ImpuestoAdicionalOtraMoneda", 1, 20)],
    "ECF/Encabezado/OtraMoneda/ImpuestosAdicionalesOtraMoneda/ImpuestoAdicionalOtraMoneda": [
      nodo("TipoImpuestoOtraMoneda", 0, 1),
      nodo("TasaImpuestoAdicionalOtraMoneda", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecificoOtraMoneda", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda", 0, 1),
      nodo("OtrosImpuestosAdicionalesOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoGravadoTotal", 0, 1),
      nodo("MontoGravadoI1", 0, 1),
      nodo("MontoGravadoI2", 0, 1),
      nodo("MontoGravadoI3", 0, 1),
      nodo("MontoExento", 0, 1),
      nodo("ITBIS1", 0, 1),
      nodo("ITBIS2", 0, 1),
      nodo("ITBIS3", 0, 1),
      nodo("TotalITBIS", 0, 1),
      nodo("TotalITBIS1", 0, 1),
      nodo("TotalITBIS2", 0, 1),
      nodo("TotalITBIS3", 0, 1),
      nodo("MontoImpuestoAdicional", 0, 1),
      nodo("ImpuestosAdicionales", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoNoFacturable", 0, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
    ],
    "ECF/Encabezado/Totales/ImpuestosAdicionales": [nodo("ImpuestoAdicional", 1, 20)],
    "ECF/Encabezado/Totales/ImpuestosAdicionales/ImpuestoAdicional": [
      nodo("TipoImpuesto", 1, 1),
      nodo("TasaImpuestoAdicional", 1, 1),
      nodo("MontoImpuestoSelectivoConsumoEspecifico", 0, 1),
      nodo("MontoImpuestoSelectivoConsumoAdvalorem", 0, 1),
      nodo("OtrosImpuestosAdicionales", 0, 1),
    ],
    "ECF/Encabezado/Transporte": [
      nodo("Conductor", 0, 1),
      nodo("DocumentoTransporte", 0, 1),
      nodo("Ficha", 0, 1),
      nodo("Placa", 0, 1),
      nodo("RutaTransporte", 0, 1),
      nodo("ZonaTransporte", 0, 1),
      nodo("NumeroAlbaran", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalMontoGravadoPagina", 0, 1),
      nodo("SubtotalMontoGravado1Pagina", 0, 1),
      nodo("SubtotalMontoGravado2Pagina", 0, 1),
      nodo("SubtotalMontoGravado3Pagina", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("SubtotalItbisPagina", 0, 1),
      nodo("SubtotalItbis1Pagina", 0, 1),
      nodo("SubtotalItbis2Pagina", 0, 1),
      nodo("SubtotalItbis3Pagina", 0, 1),
      nodo("SubtotalImpuestoAdicionalPagina", 0, 1),
      nodo("SubtotalImpuestoAdicional", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
      nodo("SubtotalMontoNoFacturablePagina", 0, 1),
    ],
    "ECF/Paginacion/Pagina/SubtotalImpuestoAdicional": [
      nodo("SubtotalImpuestoSelectivoConsumoEspecificoPagina", 0, 1),
      nodo("SubtotalOtrosImpuesto", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalMontoGravadoTotal", 0, 1),
      nodo("SubTotalMontoGravadoI1", 0, 1),
      nodo("SubTotalMontoGravadoI2", 0, 1),
      nodo("SubTotalMontoGravadoI3", 0, 1),
      nodo("SubTotaITBIS", 0, 1),
      nodo("SubTotaITBIS1", 0, 1),
      nodo("SubTotaITBIS2", 0, 1),
      nodo("SubTotaITBIS3", 0, 1),
      nodo("SubTotalImpuestoAdicional", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "46": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("DescuentosORecargos", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DescuentosORecargos": [nodo("DescuentoORecargo", 1, 20)],
    "ECF/DescuentosORecargos/DescuentoORecargo": [
      nodo("NumeroLinea", 1, 1),
      nodo("TipoAjuste", 1, 1),
      nodo("DescripcionDescuentooRecargo", 0, 1),
      nodo("TipoValor", 0, 1),
      nodo("ValorDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargo", 0, 1),
      nodo("MontoDescuentooRecargoOtraMoneda", 0, 1),
      nodo("IndicadorFacturacionDescuentooRecargo", 0, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("FechaElaboracion", 0, 1),
      nodo("FechaVencimientoItem", 0, 1),
      nodo("Mineria", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("DescuentoMonto", 0, 1),
      nodo("TablaSubDescuento", 0, 1),
      nodo("RecargoMonto", 0, 1),
      nodo("TablaSubRecargo", 0, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/Mineria": [
      nodo("PesoNetoKilogramo", 0, 1),
      nodo("PesoNetoMineria", 0, 1),
      nodo("TipoAfiliacion", 0, 1),
      nodo("Liquidacion", 0, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/DetallesItems/Item/TablaSubDescuento": [nodo("SubDescuento", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubDescuento/SubDescuento": [
      nodo("TipoSubDescuento", 1, 1),
      nodo("SubDescuentoPorcentaje", 0, 1),
      nodo("MontoSubDescuento", 0, 1),
    ],
    "ECF/DetallesItems/Item/TablaSubRecargo": [nodo("SubRecargo", 1, 12)],
    "ECF/DetallesItems/Item/TablaSubRecargo/SubRecargo": [
      nodo("TipoSubRecargo", 1, 1),
      nodo("SubRecargoPorcentaje", 0, 1),
      nodo("MontoSubRecargo", 0, 1),
    ],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 1, 1),
      nodo("InformacionesAdicionales", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [
      nodo("RNCComprador", 0, 1),
      nodo("IdentificadorExtranjero", 0, 1),
      nodo("RazonSocialComprador", 1, 1),
      nodo("ContactoComprador", 0, 1),
      nodo("CorreoComprador", 0, 1),
      nodo("DireccionComprador", 0, 1),
      nodo("MunicipioComprador", 0, 1),
      nodo("ProvinciaComprador", 0, 1),
      nodo("PaisComprador", 0, 1),
      nodo("FechaEntrega", 0, 1),
      nodo("ContactoEntrega", 0, 1),
      nodo("DireccionEntrega", 0, 1),
      nodo("TelefonoAdicional", 0, 1),
      nodo("FechaOrdenCompra", 0, 1),
      nodo("NumeroOrdenCompra", 0, 1),
      nodo("CodigoInternoComprador", 0, 1),
      nodo("ResponsablePago", 0, 1),
      nodo("InformacionAdicionalComprador", 0, 1),
    ],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("CodigoVendedor", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("ZonaVenta", 0, 1),
      nodo("RutaVenta", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("IndicadorEnvioDiferido", 0, 1),
      nodo("TipoIngresos", 1, 1),
      nodo("TipoPago", 1, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/InformacionesAdicionales": [
      nodo("FechaEmbarque", 0, 1),
      nodo("NumeroEmbarque", 0, 1),
      nodo("NumeroContenedor", 0, 1),
      nodo("NumeroReferencia", 0, 1),
      nodo("NombrePuertoEmbarque", 0, 1),
      nodo("CondicionesEntrega", 0, 1),
      nodo("TotalFob", 0, 1),
      nodo("Seguro", 0, 1),
      nodo("Flete", 0, 1),
      nodo("OtrosGastos", 0, 1),
      nodo("TotalCif", 0, 1),
      nodo("RegimenAduanero", 0, 1),
      nodo("NombrePuertoSalida", 0, 1),
      nodo("NombrePuertoDesembarque", 0, 1),
      nodo("PesoBruto", 0, 1),
      nodo("PesoNeto", 0, 1),
      nodo("UnidadPesoBruto", 0, 1),
      nodo("UnidadPesoNeto", 0, 1),
      nodo("CantidadBulto", 0, 1),
      nodo("UnidadBulto", 0, 1),
      nodo("VolumenBulto", 0, 1),
      nodo("UnidadVolumen", 0, 1),
    ],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoGravadoTotalOtraMoneda", 0, 1),
      nodo("MontoGravado3OtraMoneda", 0, 1),
      nodo("TotalITBISOtraMoneda", 0, 1),
      nodo("TotalITBIS3OtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoGravadoTotal", 0, 1),
      nodo("MontoGravadoI3", 0, 1),
      nodo("ITBIS3", 0, 1),
      nodo("TotalITBIS", 0, 1),
      nodo("TotalITBIS3", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoNoFacturable", 0, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
    ],
    "ECF/Encabezado/Transporte": [
      nodo("ViaTransporte", 0, 1),
      nodo("PaisOrigen", 0, 1),
      nodo("DireccionDestino", 0, 1),
      nodo("PaisDestino", 0, 1),
      nodo("RNCIdentificacionCompaniaTransportista", 0, 1),
      nodo("NombreCompaniaTransportista", 0, 1),
      nodo("NumeroViaje", 0, 1),
      nodo("Conductor", 0, 1),
      nodo("DocumentoTransporte", 0, 1),
      nodo("Ficha", 0, 1),
      nodo("Placa", 0, 1),
      nodo("RutaTransporte", 0, 1),
      nodo("ZonaTransporte", 0, 1),
      nodo("NumeroAlbaran", 0, 1),
    ],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalMontoGravadoPagina", 0, 1),
      nodo("SubtotalMontoGravado3Pagina", 0, 1),
      nodo("SubtotalItbisPagina", 0, 1),
      nodo("SubtotalItbis3Pagina", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
      nodo("SubtotalMontoNoFacturablePagina", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalMontoGravadoTotal", 0, 1),
      nodo("SubTotalMontoGravadoI3", 0, 1),
      nodo("SubTotaITBIS", 0, 1),
      nodo("SubTotaITBIS3", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
  "47": {
    ECF: [
      nodo("Encabezado", 1, 1),
      nodo("DetallesItems", 1, 1),
      nodo("Subtotales", 0, 1),
      nodo("Paginacion", 0, 1),
      nodo("InformacionReferencia", 0, 1),
      nodo("FechaHoraFirma", 1, 1),
    ],
    "ECF/DetallesItems": [nodo("Item", 1, 1000)],
    "ECF/DetallesItems/Item": [
      nodo("NumeroLinea", 1, 1),
      nodo("TablaCodigosItem", 0, 1),
      nodo("IndicadorFacturacion", 1, 1),
      nodo("Retencion", 1, 1),
      nodo("NombreItem", 1, 1),
      nodo("IndicadorBienoServicio", 1, 1),
      nodo("DescripcionItem", 0, 1),
      nodo("CantidadItem", 1, 1),
      nodo("UnidadMedida", 0, 1),
      nodo("PrecioUnitarioItem", 1, 1),
      nodo("OtraMonedaDetalle", 0, 1),
      nodo("MontoItem", 1, 1),
    ],
    "ECF/DetallesItems/Item/OtraMonedaDetalle": [
      nodo("PrecioOtraMoneda", 0, 1),
      nodo("DescuentoOtraMoneda", 0, 1),
      nodo("RecargoOtraMoneda", 0, 1),
      nodo("MontoItemOtraMoneda", 0, 1),
    ],
    "ECF/DetallesItems/Item/Retencion": [
      nodo("IndicadorAgenteRetencionoPercepcion", 1, 1),
      nodo("MontoISRRetenido", 1, 1),
    ],
    "ECF/DetallesItems/Item/TablaCodigosItem": [nodo("CodigosItem", 1, 5)],
    "ECF/DetallesItems/Item/TablaCodigosItem/CodigosItem": [nodo("TipoCodigo", 1, 1), nodo("CodigoItem", 1, 1)],
    "ECF/Encabezado": [
      nodo("Version", 1, 1),
      nodo("IdDoc", 1, 1),
      nodo("Emisor", 1, 1),
      nodo("Comprador", 0, 1),
      nodo("Transporte", 0, 1),
      nodo("Totales", 1, 1),
      nodo("OtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Comprador": [nodo("IdentificadorExtranjero", 0, 1), nodo("RazonSocialComprador", 0, 1)],
    "ECF/Encabezado/Emisor": [
      nodo("RNCEmisor", 1, 1),
      nodo("RazonSocialEmisor", 1, 1),
      nodo("NombreComercial", 0, 1),
      nodo("Sucursal", 0, 1),
      nodo("DireccionEmisor", 1, 1),
      nodo("Municipio", 0, 1),
      nodo("Provincia", 0, 1),
      nodo("TablaTelefonoEmisor", 0, 1),
      nodo("CorreoEmisor", 0, 1),
      nodo("WebSite", 0, 1),
      nodo("ActividadEconomica", 0, 1),
      nodo("NumeroFacturaInterna", 0, 1),
      nodo("NumeroPedidoInterno", 0, 1),
      nodo("InformacionAdicionalEmisor", 0, 1),
      nodo("FechaEmision", 1, 1),
    ],
    "ECF/Encabezado/Emisor/TablaTelefonoEmisor": [nodo("TelefonoEmisor", 1, 3)],
    "ECF/Encabezado/IdDoc": [
      nodo("TipoeCF", 1, 1),
      nodo("eNCF", 1, 1),
      nodo("FechaVencimientoSecuencia", 1, 1),
      nodo("TipoPago", 0, 1),
      nodo("FechaLimitePago", 0, 1),
      nodo("TerminoPago", 0, 1),
      nodo("TablaFormasPago", 0, 1),
      nodo("TipoCuentaPago", 0, 1),
      nodo("NumeroCuentaPago", 0, 1),
      nodo("BancoPago", 0, 1),
      nodo("FechaDesde", 0, 1),
      nodo("FechaHasta", 0, 1),
      nodo("TotalPaginas", 0, 1),
    ],
    "ECF/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 1, 7)],
    "ECF/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 1, 1), nodo("MontoPago", 1, 1)],
    "ECF/Encabezado/OtraMoneda": [
      nodo("TipoMoneda", 0, 1),
      nodo("TipoCambio", 0, 1),
      nodo("MontoExentoOtraMoneda", 0, 1),
      nodo("MontoTotalOtraMoneda", 0, 1),
    ],
    "ECF/Encabezado/Totales": [
      nodo("MontoExento", 0, 1),
      nodo("MontoTotal", 1, 1),
      nodo("MontoPeriodo", 0, 1),
      nodo("SaldoAnterior", 0, 1),
      nodo("MontoAvancePago", 0, 1),
      nodo("ValorPagar", 0, 1),
      nodo("TotalISRRetencion", 0, 1),
    ],
    "ECF/Encabezado/Transporte": [nodo("PaisDestino", 0, 1)],
    "ECF/InformacionReferencia": [
      nodo("NCFModificado", 0, 1),
      nodo("RNCOtroContribuyente", 0, 1),
      nodo("FechaNCFModificado", 0, 1),
      nodo("CodigoModificacion", 0, 1),
    ],
    "ECF/Paginacion": [nodo("Pagina", 1, 1000)],
    "ECF/Paginacion/Pagina": [
      nodo("PaginaNo", 0, 1),
      nodo("NoLineaDesde", 0, 1),
      nodo("NoLineaHasta", 0, 1),
      nodo("SubtotalExentoPagina", 0, 1),
      nodo("MontoSubtotalPagina", 0, 1),
    ],
    "ECF/Subtotales": [nodo("Subtotal", 1, 20)],
    "ECF/Subtotales/Subtotal": [
      nodo("NumeroSubTotal", 0, 1),
      nodo("DescripcionSubtotal", 0, 1),
      nodo("Orden", 0, 1),
      nodo("SubTotalExento", 0, 1),
      nodo("MontoSubTotal", 0, 1),
      nodo("Lineas", 0, 1),
    ],
  },
};

const ESQUEMA_RFCE_XSD: Record<string, ReglaHijo[]> = {
  RFCE: [nodo("Encabezado", 1, 1)],
  "RFCE/Encabezado": [
    nodo("Version", 1, 1),
    nodo("IdDoc", 1, 1),
    nodo("Emisor", 1, 1),
    nodo("Comprador", 1, 1),
    nodo("Totales", 1, 1),
    nodo("CodigoSeguridadeCF", 1, 1),
  ],
  "RFCE/Encabezado/Comprador": [
    nodo("RNCComprador", 0, 1),
    nodo("IdentificadorExtranjero", 0, 1),
    nodo("RazonSocialComprador", 0, 1),
  ],
  "RFCE/Encabezado/Emisor": [nodo("RNCEmisor", 1, 1), nodo("RazonSocialEmisor", 1, 1), nodo("FechaEmision", 1, 1)],
  "RFCE/Encabezado/IdDoc": [
    nodo("TipoeCF", 1, 1),
    nodo("eNCF", 1, 1),
    nodo("TipoIngresos", 1, 1),
    nodo("TipoPago", 1, 1),
    nodo("TablaFormasPago", 0, 1),
  ],
  "RFCE/Encabezado/IdDoc/TablaFormasPago": [nodo("FormaDePago", 0, 7)],
  "RFCE/Encabezado/IdDoc/TablaFormasPago/FormaDePago": [nodo("FormaPago", 0, 1), nodo("MontoPago", 0, 1)],
  "RFCE/Encabezado/Totales": [
    nodo("MontoGravadoTotal", 0, 1),
    nodo("MontoGravadoI1", 0, 1),
    nodo("MontoGravadoI2", 0, 1),
    nodo("MontoGravadoI3", 0, 1),
    nodo("MontoExento", 0, 1),
    nodo("TotalITBIS", 0, 1),
    nodo("TotalITBIS1", 0, 1),
    nodo("TotalITBIS2", 0, 1),
    nodo("TotalITBIS3", 0, 1),
    nodo("MontoImpuestoAdicional", 0, 1),
    nodo("ImpuestosAdicionales", 0, 1),
    nodo("MontoTotal", 1, 1),
    nodo("MontoNoFacturable", 0, 1),
    nodo("MontoPeriodo", 0, 1),
  ],
  "RFCE/Encabezado/Totales/ImpuestosAdicionales": [nodo("ImpuestoAdicional", 0, 20)],
  "RFCE/Encabezado/Totales/ImpuestosAdicionales/ImpuestoAdicional": [
    nodo("TipoImpuesto", 0, 1),
    nodo("MontoImpuestoSelectivoConsumoEspecifico", 0, 1),
    nodo("MontoImpuestoSelectivoConsumoAdvalorem", 0, 1),
    nodo("OtrosImpuestosAdicionales", 0, 1),
  ],
};
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

function validarEstructuraGenerica(
  nodoActual: NodoXml,
  ruta: string,
  esquema: Record<string, ReglaHijo[]>,
  errores: string[],
): void {
  const reglas = esquema[ruta];
  if (reglas) {
    const esRaiz = ruta === "ECF" || ruta === "RFCE";
    validarOrdenHijos(nodoActual, ruta, esRaiz ? [...reglas, nodo("Signature")] : reglas, errores);
  }
  for (const hijoActual of nodoActual.hijos) {
    if (hijoActual.nombre === "Signature") continue;
    validarEstructuraGenerica(hijoActual, `${ruta}/${hijoActual.nombre}`, esquema, errores);
  }
}

function validarEstructuraEcf(raiz: NodoXml, errores: string[]): string | null {
  const encabezado = hijo(raiz, "Encabezado");
  const idDoc = hijo(encabezado, "IdDoc");
  const tipoTexto = textoHijo(idDoc, "TipoeCF");
  if (!TIPOS_ECF_VALIDOS.has(tipoTexto)) {
    errores.push(`El TipoeCF ${tipoTexto || "(vacío)"} no es uno de los tipos E31 a E47 admitidos por DGII`);
    return tipoTexto || null;
  }
  const tipo = tipoTexto as TipoEcf;
  validarEstructuraGenerica(raiz, "ECF", ESQUEMAS_ECF_XSD[tipo], errores);
  return tipo;
}

function validarRfce(raiz: NodoXml, errores: string[]): void {
  validarEstructuraGenerica(raiz, "RFCE", ESQUEMA_RFCE_XSD, errores);
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

function fechaDgiiEsValida(texto: string, exigirAnio20: boolean): boolean {
  if (!RE_FECHA.test(texto)) return false;
  const dia = Number(texto.slice(0, 2));
  const mes = Number(texto.slice(3, 5));
  const anio = Number(texto.slice(6, 10));
  if (exigirAnio20 && !/^20\d{2}$/.test(texto.slice(6, 10))) return false;
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const esBisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const diasPorMes = [31, esBisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= (diasPorMes[mes - 1] ?? 0);
}

function fechaHoraDgiiEsValida(texto: string): boolean {
  if (!RE_FECHA_HORA.test(texto)) return false;
  if (!fechaDgiiEsValida(texto.slice(0, 10), false)) return false;
  const hora = Number(texto.slice(11, 13));
  const minuto = Number(texto.slice(14, 16));
  const segundo = Number(texto.slice(17, 19));
  return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59 && segundo >= 0 && segundo <= 59;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: reproduce las restricciones específicas del XSD ACECF v1.0 en orden de lectura
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

  const prefijo = "ACECF/DetalleAprobacionComercial";
  const version = textoHijo(detalle, "Version");
  if (version !== "" && version !== "1.0") errores.push(`${prefijo}/Version: debe ser exactamente 1.0`);

  const montoTotal = textoHijo(detalle, "MontoTotal");
  if (montoTotal !== "" && !/^\d+\.\d{2}$/.test(montoTotal)) {
    errores.push(`${prefijo}/MontoTotal: debe tener exactamente dos decimales según Decimal18D2Validation`);
  } else if (montoTotal !== "" && montoTotal.replace(".", "").length > 18) {
    errores.push(`${prefijo}/MontoTotal: no puede exceder 18 dígitos totales según Decimal18D2Validation`);
  }

  const estado = textoHijo(detalle, "Estado");
  if (estado !== "" && estado !== "1" && estado !== "2") {
    errores.push(`${prefijo}/Estado: solo admite 1 (aprobado) o 2 (rechazado)`);
  }

  const motivo = hijo(detalle, "DetalleMotivoRechazo")?.texto ?? "";
  if (motivo.length > 250) errores.push(`${prefijo}/DetalleMotivoRechazo: no puede exceder 250 caracteres`);
  if (estado === "2" && motivo.trim() === "") {
    errores.push(`${prefijo}/DetalleMotivoRechazo: es obligatorio cuando Estado es 2`);
  }

  const fechaEmision = textoHijo(detalle, "FechaEmision");
  if (fechaEmision !== "" && !fechaDgiiEsValida(fechaEmision, true)) {
    errores.push(`${prefijo}/FechaEmision: debe ser una fecha calendario válida DD-MM-YYYY con año 20xx`);
  }

  const fechaHora = textoHijo(detalle, "FechaHoraAprobacionComercial");
  if (fechaHora !== "" && !fechaHoraDgiiEsValida(fechaHora)) {
    errores.push(`${prefijo}/FechaHoraAprobacionComercial: debe ser una fecha y hora válida DD-MM-YYYY HH:mm:ss`);
  }
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
  validarOrdenHijos(detalle, "DetalleAnulacion", [nodo("Anulacion", 1, 10)], errores);
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
    if (tabla) validarOrdenHijos(tabla, "TablaRangoSecuenciasAnuladaseNCF", [nodo("Secuencias", 1, 10000)], errores);
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
  const sinDeclaracion = xml.replace(RE_DECLARACION, "");
  let cuerpo = sinDeclaracion;
  if (cuerpo.startsWith("\r\n")) cuerpo = cuerpo.slice(2);
  else if (cuerpo.startsWith("\n")) cuerpo = cuerpo.slice(1);
  if (/(^|>)[\t\n\r ]+</.test(cuerpo)) {
    errores.push("El XML debe ser compacto: no puede tener espacios ni saltos de línea entre etiquetas");
  }
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
