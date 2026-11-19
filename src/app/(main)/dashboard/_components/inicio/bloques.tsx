import { AlertaError } from "@/app/(main)/dashboard/reportes/_components/alerta-error";
import { obtenerResumenNegocio } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

import { GraficoVentasResumen } from "./grafico-ventas-resumen";
import { formatearConteo, TarjetaCartera, TarjetaMetrica } from "./tarjetas";

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
      <TarjetaCartera titulo="Cuentas por cobrar" href={hrefCxc} datos={resumen.cxc} />
      <TarjetaCartera titulo="Cuentas por pagar" href={hrefCxp} datos={resumen.cxp} />
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
      <TarjetaMetrica
        titulo="Impuestos en venta"
        href={urlReporte("/dashboard/reportes/impuestos-detallados", { desde, hasta })}
        valor={formatearRd(centavos(resumen.impuestos_venta))}
      />
      <TarjetaMetrica
        titulo="Clientes con ventas"
        href={urlReporte("/dashboard/reportes/ventas-cliente", { desde, hasta })}
        valor={formatearConteo(resumen.clientes_con_ventas)}
      />
      <TarjetaMetrica
        titulo="Devoluciones de clientes"
        href={urlReporte("/dashboard/reportes/ventas-generales", { desde, hasta })}
        valor={formatearRd(centavos(resumen.devoluciones_clientes))}
        detalle="Incluye impuestos"
      />
      <TarjetaMetrica
        titulo="Productos vendidos"
        href={urlReporte("/dashboard/reportes/ventas-producto", { desde, hasta })}
        valor={formatearConteo(resumen.productos_vendidos)}
      />
    </>
  );
}

export async function BloqueGrafico({ desde, hasta }: Props) {
  const { resumen, error } = await obtenerResumenNegocio(desde, hasta);

  if (!resumen) {
    return <AlertaError mensaje={error ?? "No se pudo cargar el resumen del negocio."} />;
  }

  return (
    <GraficoVentasResumen
      resumen={resumen}
      href={urlReporte("/dashboard/reportes/ventas-generales", { desde, hasta })}
    />
  );
}
