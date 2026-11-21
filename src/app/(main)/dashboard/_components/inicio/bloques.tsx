import { AlertaError } from "@/app/(main)/dashboard/reportes/_components/alerta-error";
import { iniciales } from "@/lib/inicio/calculos";
import { obtenerDatosWidgets, obtenerResumenNegocio, obtenerTopVentas } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";
import { obtenerSaldosCajaBanco } from "@/lib/reportes/saldos";

import { BancosCajas } from "./bancos-cajas";
import { GraficoFlujo } from "./grafico-flujo";
import { GraficoGastos } from "./grafico-gastos";
import { GraficoVentasResumen } from "./grafico-ventas-resumen";
import { TablaTop } from "./tabla-top";
import { formatearConteo, TarjetaCartera, TarjetaMetrica } from "./tarjetas";
import { WidgetMarco } from "./widget-marco";

interface Props {
  desde: string;
  hasta: string;
}

function urlReporte(base: string, params: Record<string, string>): string {
  return `${base}?${new URLSearchParams(params).toString()}`;
}

export async function BloqueCartera({ desde, hasta }: Props) {
  const { resumen, error } = await obtenerResumenNegocio(desde, hasta);

  if (!resumen) {
    return (
      <div className="sm:col-span-2">
        <AlertaError mensaje={error ?? "No se pudo cargar el resumen del negocio."} />
      </div>
    );
  }

  const hrefCxc = urlReporte("/dashboard/reportes/cxc", {
    hasta,
    creacion_desde: desde,
    creacion_hasta: hasta,
  });
  const hrefCxp = urlReporte("/dashboard/reportes/cxp", { desde, hasta });

  return (
    <>
      <WidgetMarco id="cxc" className="h-full">
        <TarjetaCartera titulo="Cuentas por cobrar" href={hrefCxc} datos={resumen.cxc} />
      </WidgetMarco>
      <WidgetMarco id="cxp" className="h-full">
        <TarjetaCartera titulo="Cuentas por pagar" href={hrefCxp} datos={resumen.cxp} />
      </WidgetMarco>
    </>
  );
}

export async function BloqueMetricas({ desde, hasta }: Props) {
  const { resumen, error } = await obtenerResumenNegocio(desde, hasta);

  if (!resumen) {
    return (
      <div className="sm:col-span-2">
        <AlertaError mensaje={error ?? "No se pudo cargar el resumen del negocio."} />
      </div>
    );
  }

  return (
    <>
      <WidgetMarco id="impuestos" className="h-full">
        <TarjetaMetrica
          titulo="Impuestos en venta"
          href={urlReporte("/dashboard/reportes/impuestos-detallados", { desde, hasta })}
          valor={formatearRd(centavos(resumen.impuestos_venta))}
        />
      </WidgetMarco>
      <WidgetMarco id="clientes" className="h-full">
        <TarjetaMetrica
          titulo="Clientes con ventas"
          href={urlReporte("/dashboard/reportes/ventas-cliente", { desde, hasta })}
          valor={formatearConteo(resumen.clientes_con_ventas)}
        />
      </WidgetMarco>
      <WidgetMarco id="devoluciones" className="h-full">
        <TarjetaMetrica
          titulo="Devoluciones de clientes"
          href={urlReporte("/dashboard/reportes/ventas-generales", { desde, hasta })}
          valor={formatearRd(centavos(resumen.devoluciones_clientes))}
          detalle="Incluye impuestos"
        />
      </WidgetMarco>
      <WidgetMarco id="productos-vendidos" className="h-full">
        <TarjetaMetrica
          titulo="Productos vendidos"
          href={urlReporte("/dashboard/reportes/ventas-producto", { desde, hasta })}
          valor={formatearConteo(resumen.productos_vendidos)}
        />
      </WidgetMarco>
    </>
  );
}

export async function BloqueGrafico({ desde, hasta }: Props) {
  const { resumen, error } = await obtenerResumenNegocio(desde, hasta);

  if (!resumen) {
    return <AlertaError mensaje={error ?? "No se pudo cargar el resumen del negocio."} />;
  }

  return (
    <WidgetMarco id="ventas">
      <GraficoVentasResumen
        resumen={resumen}
        href={urlReporte("/dashboard/reportes/ventas-generales", { desde, hasta })}
      />
    </WidgetMarco>
  );
}

export async function BloqueGastos({ desde, hasta }: Props) {
  const { datos, error } = await obtenerDatosWidgets(desde, hasta);

  if (!datos) {
    return <AlertaError mensaje={error ?? "No se pudo cargar la distribución de gastos."} />;
  }

  return (
    <WidgetMarco id="gastos">
      <GraficoGastos
        gastos={datos.gastos}
        href={urlReporte("/dashboard/reportes/estado-resultados", { desde, hasta })}
      />
    </WidgetMarco>
  );
}

export async function BloqueFlujo({ desde, hasta }: Props) {
  const { datos, error } = await obtenerDatosWidgets(desde, hasta);

  if (!datos) {
    return <AlertaError mensaje={error ?? "No se pudo cargar el flujo de transacciones."} />;
  }

  return (
    <WidgetMarco id="flujo">
      <GraficoFlujo flujo={datos.flujo} href={urlReporte("/dashboard/reportes/flujo-efectivo", { desde, hasta })} />
    </WidgetMarco>
  );
}

export async function BloqueTopProductos({ desde, hasta }: Props) {
  const { top, error } = await obtenerTopVentas(desde, hasta);

  if (!top) {
    return <AlertaError mensaje={error ?? "No se pudo cargar el top de productos."} />;
  }

  return (
    <WidgetMarco id="top-productos" className="h-full">
      <TablaTop
        titulo="Productos más vendidos"
        href={urlReporte("/dashboard/reportes/ventas-producto", { desde, hasta })}
        tooltip="Productos con más ventas del período; el total tiene impuestos incluidos."
        subtitulo="Totales con impuestos incluidos."
        columnaCantidad="Nº items"
        filas={top.productos.map((producto) => ({
          clave: producto.nombre,
          avatar: producto.referencia?.slice(0, 2) ?? iniciales(producto.nombre),
          nombre: producto.nombre,
          cantidad: formatearConteo(producto.items),
          total: formatearRd(producto.total),
        }))}
        vacioTitulo="Sin ventas registradas"
        vacioDetalle="No registraste ventas de productos durante este período."
      />
    </WidgetMarco>
  );
}

export async function BloqueTopClientes({ desde, hasta }: Props) {
  const { top, error } = await obtenerTopVentas(desde, hasta);

  if (!top) {
    return <AlertaError mensaje={error ?? "No se pudo cargar el top de clientes."} />;
  }

  return (
    <WidgetMarco id="top-clientes" className="h-full">
      <TablaTop
        titulo="Mejores clientes"
        href={urlReporte("/dashboard/reportes/ventas-cliente", { desde, hasta })}
        tooltip="Clientes con más ventas del período; el total tiene impuestos incluidos."
        subtitulo="Totales con impuestos incluidos."
        columnaCantidad="Nº documentos"
        filas={top.clientes.map((cliente) => ({
          clave: cliente.nombre,
          avatar: iniciales(cliente.nombre),
          nombre: cliente.nombre,
          cantidad: formatearConteo(cliente.documentos),
          total: formatearRd(cliente.total),
        }))}
        vacioTitulo="Sin ventas registradas"
        vacioDetalle="No registraste documentos de venta durante este período."
      />
    </WidgetMarco>
  );
}

export async function BloqueBancos() {
  const { filas, error } = await obtenerSaldosCajaBanco();

  if (error != null) {
    return <AlertaError mensaje={error} />;
  }

  return (
    <WidgetMarco id="bancos" className="h-full">
      <BancosCajas filas={filas} href="/dashboard/bancos" />
    </WidgetMarco>
  );
}
