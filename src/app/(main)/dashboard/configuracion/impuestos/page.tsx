import { redirect } from "next/navigation";

import { Percent } from "@/components/icons";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getImpuestosConfig, type ImpuestoConfig } from "@/lib/impuestos/consultas";
import type { TipoImpuesto } from "@/lib/impuestos/tipos";

import { EncabezadoConfiguracion } from "../_components/encabezado";

const GRUPOS: Record<TipoImpuesto, string> = {
  ninguno: "Ninguno",
  itbis: "ITBIS",
  otro: "Otro",
  propina: "Propina legal",
  exento: "Exento (E)",
};

const columnas: readonly ColumnaLista<ImpuestoConfig>[] = [
  {
    clave: "grupo",
    encabezado: "Grupo",
    celda: (impuesto) => <span className="text-muted-foreground">{GRUPOS[impuesto.tipo]}</span>,
  },
  {
    clave: "impuesto",
    encabezado: "Impuesto",
    celda: (impuesto) => <span className="font-medium">{impuesto.nombre}</span>,
  },
  {
    clave: "tasa",
    encabezado: "Tasa",
    alineacion: "derecha",
    celda: (impuesto) => `${impuesto.tarifa.toFixed(2)} %`,
  },
  {
    clave: "cuenta",
    encabezado: "Cuenta por pagar",
    celda: (impuesto) => (
      <span className="text-muted-foreground">
        {impuesto.cuenta_codigo ? `${impuesto.cuenta_codigo} — ${impuesto.cuenta_nombre ?? ""}` : "Sin cuenta"}
      </span>
    ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (impuesto) => (
      <PillEstado tono={impuesto.activo ? "exito" : "neutro"}>{impuesto.activo ? "Activo" : "Inactivo"}</PillEstado>
    ),
  },
];

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const impuestos = await getImpuestosConfig();

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Impuestos"
        descripcion="Catálogo de impuestos que se usan en productos, compras y facturas."
      />

      <TarjetaLista data-lista="configuracion-impuestos">
        <TablaLista
          columnas={columnas}
          filas={impuestos}
          claveFila={(impuesto) => impuesto.id}
          vacio={{
            titulo: "Sin impuestos",
            descripcion: "No hay impuestos en el catálogo.",
            icono: <Percent className="size-10" />,
          }}
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
