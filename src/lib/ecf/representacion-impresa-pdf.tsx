import { Document, Font, Page, Path, pdf, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { generarVectorQr } from "./qr-svg";
import type { DatosRi, ItemRi, TotalesRi } from "./representacion-impresa";

// La RI debe reproducir los textos del XML de forma exacta y contigua:
// sin guiones de división silábica que rompan las palabras en el PDF.
Font.registerHyphenationCallback((palabra) => [palabra]);

const formatoMonto = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoCantidad = new Intl.NumberFormat("es-DO", {
  maximumFractionDigits: 2,
});

export function formatearMontoRi(valor: number | null | undefined): string {
  return valor == null ? "" : formatoMonto.format(valor);
}

function formatearCantidadRi(valor: number): string {
  return formatoCantidad.format(valor);
}

function textoTasaItbis(item: ItemRi): string {
  if (item.indicadorFacturacion === "4") return "Exento";
  return item.tasaItbis == null ? "—" : `${item.tasaItbis}%`;
}

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 36,
    paddingHorizontal: 40,
    paddingBottom: 190,
    fontSize: 8,
    lineHeight: 1.25,
    fontFamily: "Helvetica",
    color: "#172033",
  },
  tituloDocumento: {
    marginBottom: 8,
    color: "#526070",
    fontSize: 7.5,
    textAlign: "center",
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emisor: {
    width: 270,
    paddingRight: 12,
  },
  razonSocial: {
    marginBottom: 4,
    color: "#0a2352",
    fontSize: 13,
    fontWeight: "bold",
    lineHeight: 1.12,
  },
  datoEmisor: {
    marginTop: 1.5,
  },
  etiqueta: {
    fontWeight: "bold",
  },
  cuadroFiscal: {
    width: 254,
    borderWidth: 1,
    borderColor: "#0a2352",
    padding: 8,
  },
  tipoComprobante: {
    color: "#0a2352",
    fontSize: 9,
    fontWeight: "bold",
    lineHeight: 1.15,
    textAlign: "center",
  },
  encf: {
    marginTop: 7,
    marginBottom: 5,
    color: "#0a2352",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  datoFiscal: {
    marginTop: 2,
    fontSize: 7.4,
  },
  bloqueInfo: {
    marginTop: 10,
    borderWidth: 0.6,
    borderColor: "#ccd3dd",
    backgroundColor: "#f5f7fa",
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  filaInfo: {
    flexDirection: "row",
    marginTop: 2,
  },
  etiquetaInfo: {
    width: 128,
    fontWeight: "bold",
  },
  valorInfo: {
    flexGrow: 1,
    flexBasis: 0,
  },
  tabla: {
    marginTop: 12,
    borderTopWidth: 0.8,
    borderBottomWidth: 0.8,
    borderColor: "#9aa6b5",
  },
  filaTabla: {
    flexDirection: "row",
    borderBottomWidth: 0.45,
    borderBottomColor: "#d9dee6",
  },
  filaEncabezadoTabla: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#9aa6b5",
    backgroundColor: "#edf1f6",
  },
  celda: {
    paddingHorizontal: 2.5,
    paddingVertical: 3,
    fontSize: 6.7,
    lineHeight: 1.18,
  },
  celdaEncabezado: {
    paddingHorizontal: 2.5,
    paddingVertical: 3.5,
    color: "#243247",
    fontSize: 6.6,
    fontWeight: "bold",
    lineHeight: 1.12,
  },
  derecha: {
    textAlign: "right",
  },
  centro: {
    textAlign: "center",
  },
  colLinea: { width: 20 },
  colDescripcion: { width: 202 },
  colTipo: { width: 34 },
  colCantidad: { width: 32 },
  colUm: { width: 38 },
  colPrecio: { width: 58 },
  colDescuento: { width: 48 },
  colItbis: { width: 34 },
  colMonto: { width: 64 },
  seccionInferior: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pago: {
    width: 235,
    paddingRight: 12,
  },
  subtituloSeccion: {
    marginBottom: 4,
    borderBottomWidth: 0.7,
    borderBottomColor: "#9aa6b5",
    paddingBottom: 2,
    color: "#0a2352",
    fontSize: 8.5,
    fontWeight: "bold",
  },
  lineaPago: {
    marginTop: 2,
    fontSize: 7.3,
  },
  totales: {
    marginLeft: "auto",
    width: 245,
  },
  filaTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2.5,
  },
  etiquetaTotal: {
    paddingRight: 10,
  },
  valorTotal: {
    textAlign: "right",
  },
  filaMontoTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#0a2352",
    paddingTop: 4,
    color: "#0a2352",
    fontSize: 10,
    fontWeight: "bold",
  },
  bloqueFiscal: {
    position: "absolute",
    bottom: 57,
    left: 57,
    width: 150,
  },
  qr: {
    width: 85,
    height: 85,
  },
  textoFiscal: {
    marginTop: 4,
    color: "#172033",
    fontSize: 6.4,
    lineHeight: 1.3,
  },
  originalCliente: {
    marginTop: 3,
    color: "#0a2352",
    fontSize: 7.2,
    fontWeight: "bold",
  },
});

function LineaEmisor({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (valor == null || valor.trim() === "") return null;
  return (
    <Text style={estilos.datoEmisor}>
      <Text style={estilos.etiqueta}>{etiqueta}: </Text>
      {valor}
    </Text>
  );
}

function EncabezadoRi({ datos }: { datos: DatosRi }) {
  const emisor = datos.emisor;
  const municipioProvincia = [emisor.municipio, emisor.provincia].filter((valor) => valor != null).join(" / ");

  return (
    <View style={estilos.encabezado}>
      <View style={estilos.emisor}>
        <Text style={estilos.razonSocial}>{emisor.razonSocial}</Text>
        <LineaEmisor etiqueta="RNC" valor={emisor.rnc} />
        <LineaEmisor etiqueta="Sucursal" valor={emisor.sucursal} />
        <LineaEmisor etiqueta="Dirección" valor={emisor.direccion} />
        <LineaEmisor etiqueta="Municipio / Provincia" valor={municipioProvincia || null} />
        <LineaEmisor etiqueta="Correo" valor={emisor.correo} />
      </View>

      <View style={estilos.cuadroFiscal}>
        <Text style={estilos.tipoComprobante}>{datos.tipoEcfNombre}</Text>
        <Text style={estilos.encf}>{datos.encf}</Text>
        <Text style={estilos.datoFiscal}>
          <Text style={estilos.etiqueta}>Fecha de emisión: </Text>
          {emisor.fechaEmision}
        </Text>
        {datos.fechaVencimientoSecuencia ? (
          <Text style={estilos.datoFiscal}>
            <Text style={estilos.etiqueta}>Vencimiento secuencia: </Text>
            {datos.fechaVencimientoSecuencia}
          </Text>
        ) : null}
        {datos.indicadorNotaCreditoEtiqueta ? (
          <Text style={estilos.datoFiscal}>
            <Text style={estilos.etiqueta}>Indicador nota de crédito: </Text>
            {datos.indicadorNotaCreditoEtiqueta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function BloqueComprador({ datos }: { datos: DatosRi }) {
  const comprador = datos.comprador;
  if (!comprador) return null;

  return (
    <View style={estilos.bloqueInfo} wrap={false}>
      <View style={estilos.filaInfo}>
        <Text style={estilos.etiquetaInfo}>Comprador</Text>
        <Text style={estilos.valorInfo}>{comprador.razonSocial}</Text>
      </View>
      {comprador.rnc ? (
        <View style={estilos.filaInfo}>
          <Text style={estilos.etiquetaInfo}>RNC comprador</Text>
          <Text style={estilos.valorInfo}>{comprador.rnc}</Text>
        </View>
      ) : null}
      {comprador.identificadorExtranjero ? (
        <View style={estilos.filaInfo}>
          <Text style={estilos.etiquetaInfo}>Identificador extranjero</Text>
          <Text style={estilos.valorInfo}>{comprador.identificadorExtranjero}</Text>
        </View>
      ) : null}
    </View>
  );
}

function BloqueReferencia({ datos }: { datos: DatosRi }) {
  const referencia = datos.informacionReferencia;
  if (!referencia) return null;

  return (
    <View style={estilos.bloqueInfo} wrap={false}>
      <View style={estilos.filaInfo}>
        <Text style={estilos.etiquetaInfo}>e-NCF modificado</Text>
        <Text style={estilos.valorInfo}>{referencia.ncfModificado}</Text>
      </View>
      {referencia.fechaNcfModificado ? (
        <View style={estilos.filaInfo}>
          <Text style={estilos.etiquetaInfo}>Fecha e-NCF modificado</Text>
          <Text style={estilos.valorInfo}>{referencia.fechaNcfModificado}</Text>
        </View>
      ) : null}
      {referencia.codigoModificacion ? (
        <View style={estilos.filaInfo}>
          <Text style={estilos.etiquetaInfo}>Código modificación</Text>
          <Text style={estilos.valorInfo}>
            {referencia.codigoModificacion} — {referencia.codigoModificacionEtiqueta}
          </Text>
        </View>
      ) : null}
      {referencia.razonModificacion ? (
        <View style={estilos.filaInfo}>
          <Text style={estilos.etiquetaInfo}>Razón modificación</Text>
          <Text style={estilos.valorInfo}>{referencia.razonModificacion}</Text>
        </View>
      ) : null}
    </View>
  );
}

function BloqueTransporte({ datos }: { datos: DatosRi }) {
  const paisDestino = datos.transporte?.paisDestino;
  if (!paisDestino) return null;

  return (
    <View style={estilos.bloqueInfo} wrap={false}>
      <View style={estilos.filaInfo}>
        <Text style={estilos.etiquetaInfo}>País destino</Text>
        <Text style={estilos.valorInfo}>{paisDestino}</Text>
      </View>
    </View>
  );
}

function EncabezadoTablaItems() {
  return (
    <View style={estilos.filaEncabezadoTabla} fixed>
      <Text style={[estilos.celdaEncabezado, estilos.colLinea]}>Lín.</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colDescripcion]}>Descripción</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colTipo]}>Bien/Serv.</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colCantidad, estilos.derecha]}>Cantidad</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colUm]}>UM</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colPrecio, estilos.derecha]}>Precio unit.</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colDescuento, estilos.derecha]}>Descuento</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colItbis, estilos.centro]}>ITBIS</Text>
      <Text style={[estilos.celdaEncabezado, estilos.colMonto, estilos.derecha]}>Monto</Text>
    </View>
  );
}

function FilaItem({ item }: { item: ItemRi }) {
  return (
    <View style={estilos.filaTabla} wrap={false}>
      <Text style={[estilos.celda, estilos.colLinea, estilos.centro]}>{item.numeroLinea}</Text>
      <Text style={[estilos.celda, estilos.colDescripcion]}>{item.nombreItem}</Text>
      <Text style={[estilos.celda, estilos.colTipo]}>{item.indicadorBienoServicioEtiqueta}</Text>
      <Text style={[estilos.celda, estilos.colCantidad, estilos.derecha]}>
        {formatearCantidadRi(item.cantidadItem)}
      </Text>
      <Text style={[estilos.celda, estilos.colUm]}>{item.unidadMedidaEtiqueta ?? "—"}</Text>
      <Text style={[estilos.celda, estilos.colPrecio, estilos.derecha]}>
        {formatearMontoRi(item.precioUnitarioItem)}
      </Text>
      <Text style={[estilos.celda, estilos.colDescuento, estilos.derecha]}>
        {formatearMontoRi(item.descuentoMonto)}
      </Text>
      <Text style={[estilos.celda, estilos.colItbis, estilos.centro]}>{textoTasaItbis(item)}</Text>
      <Text style={[estilos.celda, estilos.colMonto, estilos.derecha]}>{formatearMontoRi(item.montoItem)}</Text>
    </View>
  );
}

function TablaItems({ items }: { items: ItemRi[] }) {
  return (
    <View style={estilos.tabla}>
      <EncabezadoTablaItems />
      {items.map((item) => (
        <FilaItem key={`${item.numeroLinea}-${item.nombreItem}`} item={item} />
      ))}
    </View>
  );
}

function FilaTotal({ etiqueta, valor }: { etiqueta: string; valor: number | null }) {
  if (valor == null) return null;
  return (
    <View style={estilos.filaTotal}>
      <Text style={estilos.etiquetaTotal}>{etiqueta}</Text>
      <Text style={estilos.valorTotal}>{formatearMontoRi(valor)}</Text>
    </View>
  );
}

function etiquetaTasa(base: string, tasa: number | null): string {
  return tasa == null ? base : `${base} (${tasa}%)`;
}

function FilasTotales({ totales }: { totales: TotalesRi }) {
  return (
    <>
      <FilaTotal etiqueta="Monto gravado total" valor={totales.montoGravadoTotal} />
      <FilaTotal etiqueta={etiquetaTasa("Monto gravado ITBIS1", totales.itbis1)} valor={totales.montoGravadoI1} />
      <FilaTotal etiqueta={etiquetaTasa("Monto gravado ITBIS2", totales.itbis2)} valor={totales.montoGravadoI2} />
      <FilaTotal etiqueta={etiquetaTasa("Monto gravado ITBIS3", totales.itbis3)} valor={totales.montoGravadoI3} />
      <FilaTotal etiqueta="Monto exento" valor={totales.montoExento} />
      <FilaTotal etiqueta="Total ITBIS" valor={totales.totalItbis} />
      <FilaTotal etiqueta={etiquetaTasa("Total ITBIS1", totales.itbis1)} valor={totales.totalItbis1} />
      <FilaTotal etiqueta={etiquetaTasa("Total ITBIS2", totales.itbis2)} valor={totales.totalItbis2} />
      <FilaTotal etiqueta={etiquetaTasa("Total ITBIS3", totales.itbis3)} valor={totales.totalItbis3} />
      <FilaTotal etiqueta="Total ITBIS retenido" valor={totales.totalItbisRetenido} />
      <FilaTotal etiqueta="Total ISR retenido" valor={totales.totalIsrRetencion} />
    </>
  );
}

function BloquePago({ datos }: { datos: DatosRi }) {
  if (!datos.tipoPagoEtiqueta && datos.formasPago.length === 0 && !datos.fechaLimitePago) return null;

  return (
    <View style={estilos.pago} wrap={false}>
      <Text style={estilos.subtituloSeccion}>Condiciones de pago</Text>
      {datos.tipoPagoEtiqueta ? <Text style={estilos.lineaPago}>Tipo de pago: {datos.tipoPagoEtiqueta}</Text> : null}
      {datos.fechaLimitePago ? (
        <Text style={estilos.lineaPago}>Fecha límite de pago: {datos.fechaLimitePago}</Text>
      ) : null}
      {datos.formasPago.map((forma) => (
        <Text key={`${forma.formaPago}-${forma.montoPago ?? "sin-monto"}`} style={estilos.lineaPago}>
          {forma.formaPagoEtiqueta}
          {forma.montoPago == null ? "" : `: ${formatearMontoRi(forma.montoPago)}`}
        </Text>
      ))}
    </View>
  );
}

function SeccionTotales({ datos }: { datos: DatosRi }) {
  return (
    <View style={estilos.seccionInferior} wrap={false}>
      <BloquePago datos={datos} />
      <View style={estilos.totales}>
        <FilasTotales totales={datos.totales} />
        <View style={estilos.filaMontoTotal}>
          <Text>TOTAL</Text>
          <Text>{formatearMontoRi(datos.totales.montoTotal)}</Text>
        </View>
      </View>
    </View>
  );
}

function BloqueFiscalRi({ datos }: { datos: DatosRi }) {
  const urlQr = datos.urlQr;
  if (!urlQr) throw new Error("La representación impresa requiere urlQr para generar el código QR");
  const { dimension, trazado } = generarVectorQr(urlQr);

  return (
    <View fixed style={estilos.bloqueFiscal} wrap={false}>
      <Svg style={estilos.qr} viewBox={`0 0 ${dimension} ${dimension}`}>
        <Path d={trazado} fill="#000000" />
      </Svg>
      <View style={estilos.textoFiscal}>
        <Text>Código de seguridad: {datos.codigoSeguridad}</Text>
        <Text>Fecha de firma digital: {datos.fechaHoraFirma}</Text>
        <Text style={estilos.originalCliente}>Original: Cliente</Text>
      </View>
    </View>
  );
}

function DocumentoRepresentacionImpresa({ datos }: { datos: DatosRi }) {
  return (
    <Document
      title={`${datos.tipoEcfNombre} ${datos.encf}`}
      author={datos.emisor.razonSocial}
      creator="MEDOXIGAS Contabilidad"
    >
      <Page size="LETTER" style={estilos.pagina}>
        <Text style={estilos.tituloDocumento}>Representación impresa del comprobante fiscal electrónico</Text>
        <EncabezadoRi datos={datos} />
        <BloqueComprador datos={datos} />
        <BloqueReferencia datos={datos} />
        <BloqueTransporte datos={datos} />
        <TablaItems items={datos.items} />
        <SeccionTotales datos={datos} />
        <BloqueFiscalRi datos={datos} />
      </Page>
    </Document>
  );
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Uint8Array | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function generarPdfRepresentacionImpresa(datos: DatosRi): Promise<Buffer> {
  if (!datos.urlQr) throw new Error("DatosRi.urlQr es obligatorio para generar la representación impresa");
  const stream = await pdf(<DocumentoRepresentacionImpresa datos={datos} />).toBuffer();
  return streamToBuffer(stream);
}
