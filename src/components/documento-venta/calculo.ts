import {
  calcularLinea,
  calcularTotales,
  centavosAValor,
  type LineaCalculada,
  parsearCantidad,
  parsearCentavos,
  type TotalesFactura,
} from "@/lib/facturacion/calculo";

export interface LineaFormulario {
  clave: string;
  productoId: string;
  cantidad: string;
  precio: string;
  descuentoPct: string;
  itbisTasa: string;
}

export interface ProductoParaLinea {
  id: string;
  nombre: string;
}

export interface PagoFormulario {
  cuentaId: string;
  metodo: string;
}

export interface DatosDocumento {
  clienteId: string;
  fecha: string;
  vencimiento: string;
  notas: string;
  lineas: LineaFormulario[];
  productos: readonly ProductoParaLinea[];
  almacenId?: string;
  tipoComprobante?: string;
  terminos?: string;
  pie?: string;
  vendedorId?: string;
  centroCostoId?: string;
  pago?: PagoFormulario;
}

export interface LineaCalculadaFormulario {
  clave: string;
  calculo: LineaCalculada;
}

export interface ValidacionDocumento {
  clienteId: string;
  lineas: LineaFormulario[];
  totalCentavos: number;
  requiereCuentaPago?: boolean;
  cuentaPago?: string;
}

export interface DocumentoCalculado {
  calculadas: LineaCalculadaFormulario[];
  totales: TotalesFactura;
}

export function lineaVacia(clave: string): LineaFormulario {
  return { clave, productoId: "", cantidad: "1", precio: "0.00", descuentoPct: "0", itbisTasa: "18" };
}

export function numero(texto: string): number {
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : 0;
}

export function calcularDocumento(lineas: LineaFormulario[]): DocumentoCalculado {
  const calculadas = lineas.map((linea) => ({
    clave: linea.clave,
    calculo: calcularLinea({
      cantidad: parsearCantidad(linea.cantidad),
      precioCentavos: parsearCentavos(linea.precio) ?? 0,
      descuentoPct: numero(linea.descuentoPct),
      itbisTasa: numero(linea.itbisTasa),
    }),
  }));

  return { calculadas, totales: calcularTotales(calculadas.map((linea) => linea.calculo)) };
}

export function mensajeValidacionDocumento(datos: ValidacionDocumento): string | null {
  if (!datos.clienteId) return "Selecciona un cliente.";
  if (datos.lineas.some((linea) => !linea.productoId)) return "Selecciona el producto en todas las líneas.";
  if (datos.totalCentavos <= 0) return "El total del documento debe ser mayor que cero.";
  if (datos.requiereCuentaPago && !datos.cuentaPago) {
    return "Selecciona la cuenta de caja o banco para el pago.";
  }
  return null;
}

export function construirEntrada(datos: DatosDocumento) {
  const { totales } = calcularDocumento(datos.lineas);
  const notas = datos.notas.trim();
  const terminos = datos.terminos?.trim() ?? "";
  const pie = datos.pie?.trim() ?? "";

  return {
    ...(datos.tipoComprobante ? { tipo_comprobante: datos.tipoComprobante } : {}),
    contacto_id: datos.clienteId,
    fecha: datos.fecha,
    vencimiento: datos.vencimiento,
    ...(datos.almacenId ? { almacen_id: datos.almacenId } : {}),
    ...(notas ? { notas } : {}),
    ...(terminos ? { terminos } : {}),
    ...(pie ? { pie } : {}),
    ...(datos.vendedorId ? { vendedor_id: datos.vendedorId } : {}),
    ...(datos.centroCostoId ? { centro_costo_id: datos.centroCostoId } : {}),
    lineas: datos.lineas.map((linea) => {
      const producto = datos.productos.find((item) => item.id === linea.productoId);
      return {
        producto_id: linea.productoId,
        descripcion: producto?.nombre ?? "",
        cantidad: parsearCantidad(linea.cantidad),
        precio: centavosAValor(parsearCentavos(linea.precio) ?? 0),
        descuento_pct: numero(linea.descuentoPct),
        itbis_tasa: numero(linea.itbisTasa),
      };
    }),
    ...(datos.pago
      ? {
          pago: {
            cuenta_id: datos.pago.cuentaId,
            metodo: datos.pago.metodo,
            monto: centavosAValor(totales.totalCentavos),
          },
        }
      : {}),
  };
}
