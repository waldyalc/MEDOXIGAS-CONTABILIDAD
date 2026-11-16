import { cargarEntorno, clientesAutenticados, escribir, Medidor } from "./_comun";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const raiz = resolve(__dirname, "..", "..");
  const entorno = cargarEntorno(raiz);
  const [cliente] = await clientesAutenticados(entorno);
  if (!cliente) throw new Error("sin cliente");
  const medidor = new Medidor();

  // Datos de referencia: cuentas de caja/banco y una retención.
  const cuentasRes = await cliente
    .from("cuentas")
    .select("id, codigo, nombre, es_caja_banco")
    .in("codigo", ["1101", "1102"]);
  if (cuentasRes.error) throw new Error(`cuentas: ${cuentasRes.error.message}`);
  const caja = cuentasRes.data.find((c) => c.codigo === "1101");
  const banco = cuentasRes.data.find((c) => c.codigo === "1102");
  escribir(`cuentas: caja=${caja ? "ok" : "FALTA"} banco=${banco ? "ok" : "FALTA"}`);

  const retencionesRes = await cliente.from("retenciones").select("id, nombre, tipo, porcentaje").eq("activa", true);
  if (retencionesRes.error) throw new Error(`retenciones: ${retencionesRes.error.message}`);
  const retencionItbis = retencionesRes.data.find((r) => r.tipo === "itbis");
  const retencionIsr = retencionesRes.data.find((r) => r.tipo === "isr");
  escribir(`retenciones: itbis=${retencionItbis?.nombre ?? "FALTA"} isr=${retencionIsr?.nombre ?? "FALTA"}`);

  if (!caja || !banco) throw new Error("faltan cuentas de caja/banco");

  // 1. Contacto cliente y proveedor.
  const contactoCliente = await medidor.medir("crear_contacto", () =>
    cliente.rpc("crear_contacto", {
      p: { tipo: "cliente", nombre: "ZZTEST-Humo Cliente", tipo_identificacion: "rnc", rnc_cedula: "912345678" },
    }),
  );
  escribir(`contacto cliente: ${JSON.stringify(contactoCliente.ok ? contactoCliente.data : contactoCliente.error)}`);
  const contactoProv = await medidor.medir("crear_contacto", () =>
    cliente.rpc("crear_contacto", {
      p: { tipo: "proveedor", nombre: "ZZTEST-Humo Proveedor", tipo_identificacion: "rnc", rnc_cedula: "998765432" },
    }),
  );
  escribir(`contacto proveedor: ${JSON.stringify(contactoProv.ok ? contactoProv.data : contactoProv.error)}`);

  // 2. Producto inventariable y servicio.
  const producto = await medidor.medir("crear_producto", () =>
    cliente.rpc("crear_producto", {
      p: {
        tipo: "producto",
        nombre: "ZZTEST-Humo Producto",
        precio: 1000,
        itbis_tasa: 18,
        inventariable: true,
        cantidad: 100,
        costo: 600,
      },
    }),
  );
  escribir(`producto: ${JSON.stringify(producto.ok ? producto.data : producto.error)}`);
  const servicio = await medidor.medir("crear_producto", () =>
    cliente.rpc("crear_producto", {
      p: { tipo: "servicio", nombre: "ZZTEST-Humo Servicio", precio: 500, itbis_tasa: 18 },
    }),
  );
  escribir(`servicio: ${JSON.stringify(servicio.ok ? servicio.data : servicio.error)}`);

  if (!contactoCliente.data || !contactoProv.data || !producto.data || !servicio.data) {
    escribir("HUMO FALLÓ: faltan ids");
    process.exit(1);
  }

  const clienteId = String(contactoCliente.data);
  const provId = String(contactoProv.data);
  const productoId = String(producto.data);
  const servicioId = String(servicio.data);

  // 3. Compra a proveedor (repone stock).
  const compra = await medidor.medir("crear_factura_proveedor", () =>
    cliente.rpc("crear_factura_proveedor", {
      p: {
        contacto_id: provId,
        fecha: "2022-06-15",
        vencimiento: "2022-07-15",
        ncf: `B01${String(1).padStart(8, "0")}`,
        notas: "ZZTEST humo",
        lineas: [{ producto_id: productoId, cantidad: 50, costo: 600, itbis_tasa: 18, descuento_pct: 0 }],
      },
    }),
  );
  escribir(`compra: ${JSON.stringify(compra.ok ? compra.data : compra.error)}`);

  // 4. Factura a crédito B01.
  const facturaCredito = await medidor.medir("crear_factura", () =>
    cliente.rpc("crear_factura", {
      p: {
        tipo_comprobante: "01",
        contacto_id: clienteId,
        fecha: "2022-06-20",
        vencimiento: "2022-07-20",
        notas: "ZZTEST humo crédito",
        lineas: [
          {
            producto_id: productoId,
            cantidad: 2,
            precio: 1000,
            itbis_tasa: 18,
            descuento_pct: 0,
          },
        ],
      },
    }),
  );
  escribir(`factura crédito: ${JSON.stringify(facturaCredito.ok ? facturaCredito.data : facturaCredito.error)}`);

  // 5. Pago recibido parcial sobre la factura a crédito.
  if (facturaCredito.data) {
    const pago = await medidor.medir("registrar_pago_recibido", () =>
      cliente.rpc("registrar_pago_recibido", {
        p: {
          factura_id: String(facturaCredito.data),
          contacto_id: clienteId,
          fecha: "2022-06-25",
          cuenta_id: caja.id,
          metodo: "efectivo",
          monto: 500,
        },
      }),
    );
    escribir(`pago recibido: ${JSON.stringify(pago.ok ? pago.data : pago.error)}`);

    // 5b. Pago multi con retención sobre otra factura.
    const facturaRet = await medidor.medir("crear_factura", () =>
      cliente.rpc("crear_factura", {
        p: {
          tipo_comprobante: "01",
          contacto_id: clienteId,
          fecha: "2022-06-21",
          vencimiento: "2022-07-21",
          lineas: [{ producto_id: servicioId, cantidad: 1, precio: 1000, itbis_tasa: 18, descuento_pct: 0 }],
        },
      }),
    );
    escribir(`factura retención: ${JSON.stringify(facturaRet.ok ? facturaRet.data : facturaRet.error)}`);

    if (facturaRet.data) {
      const multi = await medidor.medir("registrar_pago_recibido_multi", () =>
        cliente.rpc("registrar_pago_recibido_multi", {
          p_encabezado: {
            contacto_id: clienteId,
            fecha: "2022-06-26",
            cuenta_id: caja.id,
            metodo: "transferencia",
          },
          p_aplicaciones: [
            {
              factura_id: String(facturaRet.data),
              monto: 800,
              retenciones: retencionItbis ? [{ retencion_id: retencionItbis.id }] : [],
            },
          ],
        }),
      );
      escribir(`pago multi: ${JSON.stringify(multi.ok ? multi.data : multi.error)}`);
    }
  }

  // 6. Factura de contado B02 con pago dentro.
  const facturaContado = await medidor.medir("crear_factura", () =>
    cliente.rpc("crear_factura", {
      p: {
        tipo_comprobante: "02",
        contacto_id: clienteId,
        fecha: "2022-06-22",
        vencimiento: "2022-06-22",
        notas: "ZZTEST humo contado",
        lineas: [{ producto_id: servicioId, cantidad: 1, precio: 250, itbis_tasa: 18, descuento_pct: 0 }],
        pago: { cuenta_id: banco.id, metodo: "tarjeta", monto: 295, fecha: "2022-06-22" },
      },
    }),
  );
  escribir(`factura contado: ${JSON.stringify(facturaContado.ok ? facturaContado.data : facturaContado.error)}`);

  // 7. Pago a proveedor.
  if (compra.data) {
    const pagoProv = await medidor.medir("registrar_pago_proveedor", () =>
      cliente.rpc("registrar_pago_proveedor", {
        p: {
          factura_proveedor_id: String(compra.data),
          fecha: "2022-06-28",
          cuenta_id: banco.id,
          metodo: "transferencia",
          monto: 1000,
        },
      }),
    );
    escribir(`pago proveedor: ${JSON.stringify(pagoProv.ok ? pagoProv.data : pagoProv.error)}`);
  }

  // 8. Nota de crédito sobre la factura a crédito (1 unidad de 2).
  if (facturaCredito.data) {
    const lineasRes = await cliente
      .from("factura_lineas")
      .select("id, cantidad")
      .eq("factura_id", String(facturaCredito.data));
    const linea = lineasRes.data?.[0];
    if (linea) {
      const nc = await medidor.medir("crear_nota_credito_venta", () =>
        cliente.rpc("crear_nota_credito_venta", {
          p: {
            factura_id: String(facturaCredito.data),
            fecha: "2022-06-29",
            notas: "ZZTEST humo NC",
            devuelve_inventario: true,
            lineas: [{ factura_linea_id: linea.id, cantidad: 1 }],
          },
        }),
      );
      escribir(`nota crédito: ${JSON.stringify(nc.ok ? nc.data : nc.error)}`);
    }
  }

  // 9. Anulación de la factura contado (tiene pago → debe fallar) y de una sin pago.
  if (facturaContado.data) {
    const anulConPago = await medidor.medir("anular_documento", () =>
      cliente.rpc("anular_documento", { p_tipo: "factura", p_id: String(facturaContado.data) }),
    );
    escribir(
      `anular con pago (esperado fallo): ${JSON.stringify(anulConPago.ok ? anulConPago.data : anulConPago.error)}`,
    );
  }

  escribir("\nRESUMEN MEDIDOR:");
  escribir(JSON.stringify(medidor.resumen(), null, 2));

  writeFileSync(
    resolve(raiz, "docs", "pruebas", "resultados", "humo.json"),
    JSON.stringify({ resumen: medidor.resumen() }, null, 2),
  );
}

main().catch((error) => {
  console.error("HUMO ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
