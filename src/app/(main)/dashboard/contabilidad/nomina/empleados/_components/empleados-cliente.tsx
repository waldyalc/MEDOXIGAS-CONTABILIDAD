"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Pencil, Plus } from "lucide-react";

import { AvatarInicial } from "@/components/avatar-inicial";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatoMoneda } from "@/lib/facturacion/formato";
import {
  type OpcionesLista,
  type ParametrosLista,
  type ResumenPagina,
  TAMANOS_PAGINA,
  urlLista,
} from "@/lib/listas/parametros";
import type { Empleado, EstadoEmpleado, FrecuenciaPago, SegmentoContable } from "@/lib/nomina/tipos";

import {
  ETIQUETA_ESTADO_EMPLEADO,
  ETIQUETA_FRECUENCIA,
  ETIQUETA_SEGMENTO,
  ETIQUETA_TIPO_IDENTIFICACION,
  formatearIdentificacion,
  OPCIONES_FRECUENCIA,
  OPCIONES_SEGMENTO,
  RUTA_EMPLEADOS,
  rutaEditarEmpleado,
  rutaEmpleado,
  rutaNuevoEmpleado,
  TONO_ESTADO_EMPLEADO,
} from "./formato-nomina";

const BASE = RUTA_EMPLEADOS;

interface Props {
  readonly empleados: Empleado[];
  readonly resumen: ResumenPagina;
  readonly conteos: Record<EstadoEmpleado | "todos", number>;
  readonly params: ParametrosLista;
  readonly opciones: OpcionesLista;
  readonly estado: EstadoEmpleado | "todos";
  readonly frecuencia: FrecuenciaPago | null;
  readonly segmento: SegmentoContable | null;
  readonly puedeEscribir: boolean;
}

interface Vacio {
  titulo: string;
  descripcion?: string;
  filtrada?: boolean;
  accion?: ReactNode;
}

const COLUMNAS: readonly ColumnaLista<Empleado>[] = [
  {
    clave: "empleado",
    encabezado: "Empleado",
    celda: (empleado) => (
      <Link
        href={rutaEmpleado(empleado.id)}
        prefetch={false}
        className="text-foreground flex items-center gap-2.5 hover:underline"
      >
        <AvatarInicial nombre={empleado.nombre_completo} correo={empleado.correo} size="sm" />
        <span className="flex flex-col">
          <span className="font-medium">{empleado.nombre_completo}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {ETIQUETA_TIPO_IDENTIFICACION[empleado.tipo_identificacion]}{" "}
            {formatearIdentificacion(empleado.tipo_identificacion, empleado.identificacion)}
          </span>
        </span>
      </Link>
    ),
  },
  {
    clave: "cargo",
    encabezado: "Cargo",
    className: "hidden md:table-cell",
    celda: (empleado) => empleado.cargo ?? "—",
  },
  {
    clave: "segmento",
    encabezado: "Segmento",
    className: "hidden lg:table-cell",
    celda: (empleado) => ETIQUETA_SEGMENTO[empleado.segmento_contable],
  },
  {
    clave: "frecuencia",
    encabezado: "Frecuencia",
    className: "hidden lg:table-cell",
    celda: (empleado) => ETIQUETA_FRECUENCIA[empleado.frecuencia_pago],
  },
  {
    clave: "salario",
    encabezado: "Salario",
    alineacion: "derecha",
    celda: (empleado) => formatoMoneda(empleado.salario_mensual),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (empleado) => (
      <PillEstado tono={TONO_ESTADO_EMPLEADO[empleado.estado]}>{ETIQUETA_ESTADO_EMPLEADO[empleado.estado]}</PillEstado>
    ),
  },
];

function vacioDePestana(estado: EstadoEmpleado | "todos"): Vacio {
  if (estado === "suspendido") {
    return {
      filtrada: true,
      titulo: "No hay empleados suspendidos.",
      descripcion: "Los empleados suspendidos aparecen en esta pestaña.",
    };
  }
  if (estado === "inactivo") {
    return {
      filtrada: true,
      titulo: "No hay empleados inactivos.",
      descripcion: "Los empleados inactivos aparecen en esta pestaña.",
    };
  }
  return {
    filtrada: true,
    titulo: "No hay empleados activos.",
    descripcion: "Cambia de pestaña para ver los demás empleados.",
  };
}

function construirVacio({
  hayFiltros,
  conteos,
  estado,
  puedeEscribir,
}: {
  hayFiltros: boolean;
  conteos: Record<EstadoEmpleado | "todos", number>;
  estado: EstadoEmpleado | "todos";
  puedeEscribir: boolean;
}): Vacio {
  if (hayFiltros) {
    return { filtrada: true, titulo: "Sin resultados", descripcion: "La búsqueda no arrojó empleados." };
  }
  if (conteos.todos === 0) {
    return {
      titulo: "¡Aún no tienes empleados!",
      descripcion: "Agrega tu primer empleado para empezar a calcular la nómina.",
      accion: puedeEscribir ? (
        <Button render={<Link href={rutaNuevoEmpleado()} prefetch={false} />}>
          <Plus data-icon="inline-start" />
          Nuevo empleado
        </Button>
      ) : undefined,
    };
  }
  return vacioDePestana(estado);
}

export function EmpleadosCliente({
  empleados,
  resumen,
  conteos,
  params,
  opciones,
  estado,
  frecuencia,
  segmento,
  puedeEscribir,
}: Props) {
  const router = useRouter();

  function navegar(cambios: Record<string, string | null>) {
    router.replace(urlLista(BASE, params, { ...cambios, pagina: null }), { scroll: false });
  }

  function cambiarPestana(valor: string | number) {
    if (valor === "activo") {
      navegar({ estado: null });
      return;
    }
    navegar({ estado: String(valor) });
  }

  const hayFiltros = opciones.q !== "" || frecuencia !== null || segmento !== null;
  const vacio = construirVacio({ hayFiltros, conteos, estado, puedeEscribir });

  const cambiarFrecuencia = (valor: string) =>
    navegar({ frecuencia: valor === "" ? null : valor, estado: estado === "activo" ? null : estado });

  const cambiarSegmento = (valor: string) =>
    navegar({ segmento: valor === "" ? null : valor, estado: estado === "activo" ? null : estado });

  const limpiar = () => navegar({ q: null, frecuencia: null, segmento: null, estado: null });

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Empleados"
        subtitulo="Personas que reciben nómina en la empresa."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Nómina", href: "/dashboard/contabilidad/nomina" },
          { etiqueta: "Empleados" },
        ]}
        acciones={
          puedeEscribir ? (
            <Button render={<Link href={rutaNuevoEmpleado()} prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nuevo empleado
            </Button>
          ) : null
        }
      />

      <Tabs value={estado} onValueChange={cambiarPestana}>
        <TabsList>
          <TabsTrigger value="activo">Activos ({conteos.activo})</TabsTrigger>
          <TabsTrigger value="suspendido">Suspendidos ({conteos.suspendido})</TabsTrigger>
          <TabsTrigger value="inactivo">Inactivos ({conteos.inactivo})</TabsTrigger>
          <TabsTrigger value="todos">Todos ({conteos.todos})</TabsTrigger>
        </TabsList>
      </Tabs>

      <TarjetaLista data-lista="empleados">
        <BarraLista>
          <BuscadorLista
            base={BASE}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por nombre o identificación…"
            ariaLabel="Buscar empleados"
            className="sm:max-w-[267px] [&_input]:h-8"
          />

          <SelectCampo
            valor={frecuencia ?? ""}
            opciones={OPCIONES_FRECUENCIA}
            etiquetaVacia="Frecuencia: Todas"
            onCambio={cambiarFrecuencia}
            className="h-8 w-[180px]"
            aria-label="Filtrar por frecuencia"
          />

          <SelectCampo
            valor={segmento ?? ""}
            opciones={OPCIONES_SEGMENTO}
            etiquetaVacia="Segmento: Todos"
            onCambio={cambiarSegmento}
            className="h-8 w-[180px]"
            aria-label="Filtrar por segmento"
          />

          {hayFiltros ? (
            <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
              Limpiar
            </Button>
          ) : null}
        </BarraLista>

        <TablaLista
          columnas={COLUMNAS}
          filas={empleados}
          claveFila={(empleado) => empleado.id}
          filaHref={(empleado) => rutaEmpleado(empleado.id)}
          acciones={
            puedeEscribir
              ? (empleado) => (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar a ${empleado.nombre_completo}`}
                    render={<Link href={rutaEditarEmpleado(empleado.id)} prefetch={false} />}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={vacio}
        />

        <PaginadorLista
          base={BASE}
          params={params}
          resumen={resumen}
          etiqueta="Ítems por página"
          tamano={opciones.tamano}
          opciones={TAMANOS_PAGINA}
          mostrarEnVacio
          botonesExtremos={false}
          className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
