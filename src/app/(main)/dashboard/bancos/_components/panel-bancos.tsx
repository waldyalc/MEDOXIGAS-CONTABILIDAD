import Link from "next/link";

import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import type { PuntoIngresosGastos as PuntoSerie } from "@/lib/bancos/consultas";
import { tipoCuenta } from "@/lib/bancos/formato";
import type { CuentaBanco as CuentaBancoLista } from "@/lib/bancos/tipos";
import { rutaBanco, rutaConciliacion, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

import { GraficoIngresosGastos } from "./grafico-ingresos-gastos";
import { ResumenBancos, type ResumenBancosDatos } from "./resumen-bancos";

interface Props {
  cuentas: CuentaBancoLista[];
  serie: PuntoSerie[];
  resumen: ResumenBancosDatos;
  puedeEscribir: boolean;
}

function ConciliacionCelda({ cuenta, puedeEscribir }: { cuenta: CuentaBancoLista; puedeEscribir: boolean }) {
  if (cuenta.conciliacion) {
    return (
      <Link href={rutaConciliacion(cuenta.conciliacion.id)} title={formatoDia(cuenta.conciliacion.fechaHasta)}>
        <PillEstado tono={cuenta.conciliacion.estado === "conciliada" ? "exito" : "pendiente"}>
          {cuenta.conciliacion.estado === "conciliada" ? "Conciliada" : "Borrador"}
        </PillEstado>
      </Link>
    );
  }

  if (!puedeEscribir) return <span className="text-muted-foreground">—</span>;

  return (
    <Link
      href={`/dashboard/bancos/conciliaciones/nueva?cuenta=${cuenta.id}`}
      className="text-primary text-sm underline-offset-4 hover:underline"
    >
      Conciliar
    </Link>
  );
}

export function PanelBancos({ cuentas, serie, resumen, puedeEscribir }: Props) {
  const columnas: readonly ColumnaLista<CuentaBancoLista>[] = [
    {
      clave: "nombre",
      encabezado: "Nombre",
      celda: (cuenta) => (
        <span className="inline-flex items-baseline gap-2">
          <Link className="font-medium hover:underline" href={rutaBanco(cuenta.id)}>
            {cuenta.nombre}
          </Link>
          <Link
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
            href={rutaCuenta(cuenta.id)}
          >
            {cuenta.codigo}
          </Link>
        </span>
      ),
    },
    {
      clave: "tipo",
      encabezado: "Tipo",
      celda: (cuenta) => <PillEstado tono="neutro">{tipoCuenta(cuenta.nombre, cuenta.tipoBanco)}</PillEstado>,
    },
    {
      clave: "numero",
      encabezado: "Número",
      celda: (cuenta) => <span className="tabular-nums">{cuenta.numeroCuenta ?? "—"}</span>,
    },
    {
      clave: "saldo",
      encabezado: "Saldo",
      alineacion: "derecha",
      celda: (cuenta) => {
        const saldoCentavos = centavos(cuenta.saldo);
        return (
          <span className={saldoCentavos < 0 ? "text-destructive font-medium" : "font-medium"}>
            {formatearRd(saldoCentavos)}
          </span>
        );
      },
    },
    {
      clave: "conciliacion",
      encabezado: "Conciliación",
      celda: (cuenta) => <ConciliacionCelda cuenta={cuenta} puedeEscribir={puedeEscribir} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <GraficoIngresosGastos serie={serie} className="lg:col-span-2" />
        <ResumenBancos resumen={resumen} />
      </div>

      <TarjetaLista data-lista="bancos">
        <TablaLista
          columnas={columnas}
          filas={cuentas}
          claveFila={(cuenta) => cuenta.id}
          vacio={{
            titulo: "¡Aún no tienes cuentas de caja o banco!",
            descripcion: "Crea la primera cuenta para llevar sus saldos y conciliaciones.",
          }}
        />
      </TarjetaLista>
    </div>
  );
}
