"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_INPUT,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FormActions,
  FormCard,
  FormGrid,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { enfocarCampo, useValidacionFormulario } from "@/components/formularios/validacion";
import type { MigaDePan } from "@/components/migas-de-pan";
import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { toast } from "@/components/ui/toast";
import type { CentroCostoOpcion } from "@/lib/centros-costo/tipos";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { ReglaCampo } from "@/lib/formularios/validacion";
import { actualizarEmpleado, crearEmpleado } from "@/lib/nomina/acciones";
import type {
  Empleado,
  FrecuenciaPago,
  MetodoPago,
  SegmentoContable,
  TipoContrato,
  TipoCuentaBanco,
  TipoIdentificacion,
} from "@/lib/nomina/tipos";
import { parsearMonto } from "@/lib/productos/productos";

import {
  BANCOS_RD,
  ETIQUETA_FRECUENCIA,
  ETIQUETA_METODO_PAGO,
  ETIQUETA_SEGMENTO,
  enmascararCuenta,
  formatearCedulaParcial,
  formatearIdentificacion,
  OPCIONES_FRECUENCIA,
  OPCIONES_METODO_PAGO,
  OPCIONES_SEGMENTO,
  OPCIONES_TIPO_CONTRATO,
  OPCIONES_TIPO_CUENTA,
  OPCIONES_TIPO_IDENTIFICACION,
  rutaEmpleado,
} from "./formato-nomina";
import { type PasoEmpleado, type ValoresEmpleado, validarPasoEmpleado } from "./wizard-validacion";

const PASOS = ["Datos personales", "Contrato y salario", "Banco y TSS"] as const;

interface CamposEmpleado {
  tipoIdentificacion: TipoIdentificacion;
  identificacion: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  municipio: string;
  direccion: string;
  telefono: string;
  correo: string;
  tipoContrato: TipoContrato;
  fechaIngreso: string;
  fechaFin: string;
  frecuenciaPago: FrecuenciaPago;
  salario: string;
  cargo: string;
  area: string;
  segmento: SegmentoContable;
  centroCostoId: string;
  metodoPago: MetodoPago;
  bancoNombre: string;
  bancoOtra: string;
  tipoCuenta: TipoCuentaBanco | "";
  numeroCuenta: string;
  claveTss: string;
}

type CambiarCampo = <K extends keyof CamposEmpleado>(clave: K, valor: CamposEmpleado[K]) => void;

interface PropsEmpleado {
  readonly empleado: Empleado | null;
  readonly centrosCosto: readonly CentroCostoOpcion[];
  readonly fechaHoy: string;
  readonly titulo: string;
  readonly migas: readonly MigaDePan[];
  readonly volverA: string;
}

function bancoInicial(empleado: Empleado | null): { bancoNombre: string; bancoOtra: string } {
  const nombre = empleado?.banco_nombre ?? "";
  if (nombre === "") return { bancoNombre: "", bancoOtra: "" };
  if (BANCOS_RD.some((opcion) => opcion.value === nombre)) return { bancoNombre: nombre, bancoOtra: "" };
  return { bancoNombre: "OTRA_ENTIDAD", bancoOtra: nombre };
}

function datosPersonales(empleado: Empleado | null) {
  return {
    tipoIdentificacion: empleado?.tipo_identificacion ?? "cedula",
    identificacion: empleado?.identificacion ?? "",
    primerNombre: empleado?.primer_nombre ?? "",
    segundoNombre: empleado?.segundo_nombre ?? "",
    primerApellido: empleado?.primer_apellido ?? "",
    segundoApellido: empleado?.segundo_apellido ?? "",
    municipio: empleado?.municipio ?? "",
    direccion: empleado?.direccion ?? "",
    telefono: empleado?.telefono ?? "",
    correo: empleado?.correo ?? "",
  };
}

function datosContrato(empleado: Empleado | null, fechaHoy: string) {
  return {
    tipoContrato: empleado?.tipo_contrato ?? "indefinido",
    fechaIngreso: empleado?.fecha_ingreso ?? fechaHoy,
    fechaFin: empleado?.fecha_fin ?? "",
    frecuenciaPago: empleado?.frecuencia_pago ?? "quincenal",
    salario: empleado?.salario_mensual ?? "",
    cargo: empleado?.cargo ?? "",
    area: empleado?.area ?? "",
    segmento: empleado?.segmento_contable ?? "administrativa",
    centroCostoId: empleado?.centro_costo_id ?? "",
  };
}

function datosPago(
  empleado: Empleado | null,
): Pick<CamposEmpleado, "metodoPago" | "bancoNombre" | "bancoOtra" | "tipoCuenta" | "numeroCuenta" | "claveTss"> {
  return {
    ...bancoInicial(empleado),
    metodoPago: empleado?.metodo_pago ?? "transferencia",
    tipoCuenta: empleado?.tipo_cuenta_banco ?? "",
    numeroCuenta: empleado?.numero_cuenta_banco ?? "",
    claveTss: empleado?.clave_tss ?? "",
  };
}

function camposIniciales(empleado: Empleado | null, fechaHoy: string): CamposEmpleado {
  return {
    ...datosPersonales(empleado),
    ...datosContrato(empleado, fechaHoy),
    ...datosPago(empleado),
  };
}

function nombreDelBanco(campos: CamposEmpleado): string {
  return campos.bancoNombre === "OTRA_ENTIDAD" ? campos.bancoOtra : campos.bancoNombre;
}

function aValoresValidacion(campos: CamposEmpleado): ValoresEmpleado {
  return {
    tipo_identificacion: campos.tipoIdentificacion,
    identificacion: campos.identificacion,
    primer_nombre: campos.primerNombre,
    primer_apellido: campos.primerApellido,
    correo: campos.correo,
    tipo_contrato: campos.tipoContrato,
    fecha_ingreso: campos.fechaIngreso,
    fecha_fin: campos.fechaFin,
    frecuencia_pago: campos.frecuenciaPago,
    salario_mensual: campos.salario,
    segmento_contable: campos.segmento,
    metodo_pago: campos.metodoPago,
    banco_nombre: nombreDelBanco(campos),
    tipo_cuenta_banco: campos.tipoCuenta,
    numero_cuenta_banco: campos.numeroCuenta,
    clave_tss: campos.claveTss,
  };
}

function aEntradaEmpleado(campos: CamposEmpleado) {
  const esTransferencia = campos.metodoPago === "transferencia";

  return {
    tipo_identificacion: campos.tipoIdentificacion,
    identificacion: campos.identificacion,
    primer_nombre: campos.primerNombre,
    segundo_nombre: campos.segundoNombre,
    primer_apellido: campos.primerApellido,
    segundo_apellido: campos.segundoApellido,
    correo: campos.correo,
    telefono: campos.telefono,
    municipio: campos.municipio,
    direccion: campos.direccion,
    cargo: campos.cargo,
    area: campos.area,
    segmento_contable: campos.segmento,
    centro_costo_id: campos.centroCostoId,
    tipo_contrato: campos.tipoContrato,
    fecha_ingreso: campos.fechaIngreso,
    fecha_fin: campos.tipoContrato === "definido" ? campos.fechaFin : "",
    frecuencia_pago: campos.frecuenciaPago,
    salario_mensual: campos.salario,
    metodo_pago: campos.metodoPago,
    banco_nombre: esTransferencia ? nombreDelBanco(campos) : "",
    tipo_cuenta_banco: esTransferencia ? campos.tipoCuenta : "",
    numero_cuenta_banco: esTransferencia ? campos.numeroCuenta : "",
    clave_tss: campos.claveTss,
  };
}

function reglasDelPaso(paso: PasoEmpleado, valores: ValoresEmpleado): ReglaCampo[] {
  return validarPasoEmpleado(paso, valores).map((error) => ({
    campo: error.campo,
    invalido: true,
    mensaje: error.mensaje,
  }));
}

function camposConMensaje(mensaje: string): Record<string, string> {
  const texto = mensaje.toLowerCase();
  if (texto.includes("cédula") || texto.includes("cedula") || texto.includes("identificaci")) {
    return { identificacion: mensaje };
  }
  if (texto.includes("correo")) return { correo: mensaje };
  if (texto.includes("transferencia")) {
    return { banco_nombre: mensaje, tipo_cuenta_banco: mensaje, numero_cuenta_banco: mensaje };
  }
  if (texto.includes("fecha de fin")) return { fecha_fin: mensaje };
  if (texto.includes("salario")) return { salario_mensual: mensaje };
  return {};
}

function nombreCompleto(campos: CamposEmpleado): string {
  return [campos.primerNombre, campos.segundoNombre, campos.primerApellido, campos.segundoApellido]
    .map((parte) => parte.trim())
    .filter((parte) => parte !== "")
    .join(" ");
}

function claseCirculo(numero: PasoEmpleado, paso: PasoEmpleado): string {
  if (numero === paso) return "border-primary bg-primary text-primary-foreground";
  if (numero < paso) return "border-primary text-primary bg-transparent";
  return "border-border text-muted-foreground bg-transparent";
}

function IndicadorPasos({ paso }: { paso: PasoEmpleado }) {
  return (
    <>
      <ol className="hidden items-center gap-2 sm:flex" aria-label="Pasos del formulario">
        {PASOS.map((etiqueta, indice) => {
          const numero = (indice + 1) as PasoEmpleado;
          const completado = numero < paso;
          const actual = numero === paso;
          return (
            <li key={etiqueta} className="flex flex-1 items-center gap-2">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${claseCirculo(numero, paso)}`}
                aria-hidden="true"
              >
                {completado ? <Check className="size-4" /> : numero}
              </span>
              <span className={actual ? "text-foreground text-sm font-medium" : "text-muted-foreground text-sm"}>
                {numero}. {etiqueta}
              </span>
              {indice < PASOS.length - 1 ? <span className="bg-border h-px flex-1" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 sm:hidden">
        <p className="text-sm font-medium">
          Paso {paso} de 3 · {PASOS[paso - 1]}
        </p>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
          <div className="bg-primary h-full rounded-full" style={{ width: `${(paso / 3) * 100}%` }} />
        </div>
      </div>
    </>
  );
}

interface PropsPaso {
  readonly campos: CamposEmpleado;
  readonly cambiar: CambiarCampo;
  readonly errorDe: (campo: string) => string | undefined;
}

function PasoDatosPersonales({ campos, cambiar, errorDe, esEdicion }: PropsPaso & { esEdicion: boolean }) {
  const idMostrado =
    campos.tipoIdentificacion === "cedula" ? formatearCedulaParcial(campos.identificacion) : campos.identificacion;

  return (
    <FormCard>
      <FormSectionTitle descripcion="Como aparece en la cédula o el pasaporte.">Datos personales</FormSectionTitle>
      <FormGrid className="lg:grid-cols-2">
        <CampoFormulario htmlFor="tipo_identificacion" label="Tipo de identificación" required>
          <SelectCampo
            id="tipo_identificacion"
            valor={campos.tipoIdentificacion}
            opciones={OPCIONES_TIPO_IDENTIFICACION}
            onCambio={(valor) => {
              if (valor === "cedula" || valor === "pasaporte" || valor === "residencia") {
                cambiar("tipoIdentificacion", valor);
              }
            }}
            className={FORM_SELECT}
            aria-label="Tipo de identificación"
          />
        </CampoFormulario>

        <CampoFormulario
          htmlFor="identificacion"
          label="Número de identificación"
          required
          error={errorDe("identificacion")}
        >
          <Input
            id="identificacion"
            value={idMostrado}
            inputMode={campos.tipoIdentificacion === "cedula" ? "numeric" : "text"}
            maxLength={campos.tipoIdentificacion === "cedula" ? 13 : 40}
            placeholder={campos.tipoIdentificacion === "cedula" ? "000-0000000-0" : "Número de documento"}
            onChange={(evento) => {
              const valor = evento.target.value;
              cambiar(
                "identificacion",
                campos.tipoIdentificacion === "cedula" ? valor.replace(/\D/g, "").slice(0, 11) : valor,
              );
            }}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="primer_nombre" label="Primer nombre" required error={errorDe("primer_nombre")}>
          <Input
            id="primer_nombre"
            value={campos.primerNombre}
            maxLength={80}
            onChange={(evento) => cambiar("primerNombre", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="segundo_nombre" label="Segundo nombre">
          <Input
            id="segundo_nombre"
            value={campos.segundoNombre}
            maxLength={80}
            onChange={(evento) => cambiar("segundoNombre", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="primer_apellido" label="Primer apellido" required error={errorDe("primer_apellido")}>
          <Input
            id="primer_apellido"
            value={campos.primerApellido}
            maxLength={80}
            onChange={(evento) => cambiar("primerApellido", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="segundo_apellido" label="Segundo apellido">
          <Input
            id="segundo_apellido"
            value={campos.segundoApellido}
            maxLength={80}
            onChange={(evento) => cambiar("segundoApellido", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="municipio" label="Municipio">
          <Input
            id="municipio"
            value={campos.municipio}
            maxLength={120}
            onChange={(evento) => cambiar("municipio", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="direccion" label="Dirección" className="sm:col-span-2">
          <Input
            id="direccion"
            value={campos.direccion}
            maxLength={300}
            onChange={(evento) => cambiar("direccion", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="telefono" label="Teléfono">
          <Input
            id="telefono"
            value={campos.telefono}
            inputMode="tel"
            maxLength={40}
            onChange={(evento) => cambiar("telefono", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="correo" label="Correo" error={errorDe("correo")}>
          <Input
            id="correo"
            type="email"
            value={campos.correo}
            maxLength={160}
            onChange={(evento) => cambiar("correo", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>
      </FormGrid>

      <p className="text-muted-foreground text-sm">
        {esEdicion
          ? "Los cambios se sincronizan con el contacto vinculado."
          : "También se crea o vincula el contacto en Contactos para que el empleado aparezca en el auxiliar por tercero."}
      </p>
    </FormCard>
  );
}

function PasoContrato({
  campos,
  cambiar,
  errorDe,
  centrosCosto,
}: PropsPaso & { centrosCosto: readonly CentroCostoOpcion[] }) {
  return (
    <FormCard>
      <FormSectionTitle descripcion="El contrato y el salario deciden el cálculo de cada periodo.">
        Contrato y salario
      </FormSectionTitle>
      <FormGrid className="lg:grid-cols-2">
        <CampoFormulario htmlFor="tipo_contrato" label="Tipo de contrato" required>
          <SelectCampo
            id="tipo_contrato"
            valor={campos.tipoContrato}
            opciones={OPCIONES_TIPO_CONTRATO}
            onCambio={(valor) => {
              if (valor === "indefinido" || valor === "definido") cambiar("tipoContrato", valor);
            }}
            className={FORM_SELECT}
            aria-label="Tipo de contrato"
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="fecha_ingreso" label="Fecha de ingreso" required error={errorDe("fecha_ingreso")}>
          <DatePicker
            id="fecha_ingreso"
            value={campos.fechaIngreso}
            onChange={(valor) => cambiar("fechaIngreso", valor)}
          />
        </CampoFormulario>

        {campos.tipoContrato === "definido" ? (
          <CampoFormulario htmlFor="fecha_fin" label="Fecha de fin" required error={errorDe("fecha_fin")}>
            <DatePicker id="fecha_fin" value={campos.fechaFin} onChange={(valor) => cambiar("fechaFin", valor)} />
          </CampoFormulario>
        ) : null}

        <CampoFormulario htmlFor="frecuencia_pago" label="Frecuencia de pago" required>
          <SelectCampo
            id="frecuencia_pago"
            valor={campos.frecuenciaPago}
            opciones={OPCIONES_FRECUENCIA}
            onCambio={(valor) => {
              if (valor === "quincenal" || valor === "mensual") cambiar("frecuenciaPago", valor);
            }}
            className={FORM_SELECT}
            aria-label="Frecuencia de pago"
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="salario_mensual" label="Salario mensual" required error={errorDe("salario_mensual")}>
          <InputGroup className={FORM_INPUT_GROUP}>
            <InputGroupAddon align="inline-start">RD$</InputGroupAddon>
            <InputGroupInput
              id="salario_mensual"
              inputMode="decimal"
              value={campos.salario}
              placeholder="0.00"
              onChange={(evento) => cambiar("salario", evento.target.value)}
              className="h-full min-w-0 pl-1 tabular-nums"
            />
          </InputGroup>
        </CampoFormulario>

        <CampoFormulario htmlFor="cargo" label="Cargo">
          <Input
            id="cargo"
            value={campos.cargo}
            maxLength={120}
            onChange={(evento) => cambiar("cargo", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="area" label="Área">
          <Input
            id="area"
            value={campos.area}
            maxLength={120}
            onChange={(evento) => cambiar("area", evento.target.value)}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="segmento_contable" label="Segmento contable" required>
          <SelectCampo
            id="segmento_contable"
            valor={campos.segmento}
            opciones={OPCIONES_SEGMENTO}
            onCambio={(valor) => {
              if (valor === "administrativa" || valor === "operativa" || valor === "ventas") {
                cambiar("segmento", valor);
              }
            }}
            className={FORM_SELECT}
            aria-label="Segmento contable"
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="centro_costo_id" label="Centro de costo">
          <SelectCampo
            id="centro_costo_id"
            valor={campos.centroCostoId}
            opciones={centrosCosto.map((centro) => ({
              value: centro.id,
              label: `${centro.codigo} · ${centro.nombre}`,
            }))}
            buscable
            etiquetaVacia="Sin centro de costo"
            onCambio={(valor) => cambiar("centroCostoId", valor)}
            className="h-10 w-full"
            aria-label="Centro de costo"
          />
        </CampoFormulario>
      </FormGrid>

      <p className="text-muted-foreground text-sm">
        Un periodo solo incluye empleados de su frecuencia. El salario se prorratea por los días del contrato.
      </p>
    </FormCard>
  );
}

function ResumenEmpleado({ campos }: { campos: CamposEmpleado }) {
  const salarioNumero = parsearMonto(campos.salario);

  return (
    <div className="bg-muted/50 flex flex-col gap-2 rounded-xl p-4">
      <h3 className="text-sm font-semibold">Se guardará</h3>
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Nombre</dt>
          <dd className="text-right font-medium">{nombreCompleto(campos) || "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Identificación</dt>
          <dd className="text-right font-medium tabular-nums">
            {formatearIdentificacion(campos.tipoIdentificacion, campos.identificacion) || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Cargo</dt>
          <dd className="text-right font-medium">{campos.cargo || "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Salario</dt>
          <dd className="text-right font-medium tabular-nums">
            {salarioNumero === null ? "—" : formatoMoneda(salarioNumero)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Frecuencia</dt>
          <dd className="text-right font-medium">{ETIQUETA_FRECUENCIA[campos.frecuenciaPago]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Segmento</dt>
          <dd className="text-right font-medium">{ETIQUETA_SEGMENTO[campos.segmento]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Método de pago</dt>
          <dd className="text-right font-medium">{ETIQUETA_METODO_PAGO[campos.metodoPago]}</dd>
        </div>
        {campos.metodoPago === "transferencia" ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Cuenta</dt>
            <dd className="text-right font-medium tabular-nums">{enmascararCuenta(campos.numeroCuenta)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function PasoBanco({ campos, cambiar, errorDe }: PropsPaso) {
  return (
    <FormCard>
      <FormSectionTitle descripcion="Cómo se le paga y cómo se reporta ante la TSS.">Banco y TSS</FormSectionTitle>
      <FormGrid className="lg:grid-cols-2">
        <CampoFormulario htmlFor="metodo_pago" label="Método de pago" required>
          <SelectCampo
            id="metodo_pago"
            valor={campos.metodoPago}
            opciones={OPCIONES_METODO_PAGO}
            onCambio={(valor) => {
              if (valor === "efectivo" || valor === "transferencia" || valor === "cheque") cambiar("metodoPago", valor);
            }}
            className={FORM_SELECT}
            aria-label="Método de pago"
          />
        </CampoFormulario>

        {campos.metodoPago === "transferencia" ? (
          <>
            <CampoFormulario htmlFor="banco_nombre" label="Banco" required error={errorDe("banco_nombre")}>
              <SelectCampo
                id="banco_nombre"
                valor={campos.bancoNombre}
                opciones={BANCOS_RD}
                buscable
                etiquetaVacia="Selecciona el banco…"
                onCambio={(valor) => cambiar("bancoNombre", valor)}
                className="h-10 w-full"
                aria-label="Banco"
              />
            </CampoFormulario>

            {campos.bancoNombre === "OTRA_ENTIDAD" ? (
              <CampoFormulario htmlFor="banco_otra" label="Nombre del banco" required error={errorDe("banco_nombre")}>
                <Input
                  id="banco_otra"
                  value={campos.bancoOtra}
                  maxLength={120}
                  onChange={(evento) => cambiar("bancoOtra", evento.target.value)}
                  className={FORM_INPUT}
                />
              </CampoFormulario>
            ) : null}

            <CampoFormulario
              htmlFor="tipo_cuenta_banco"
              label="Tipo de cuenta"
              required
              error={errorDe("tipo_cuenta_banco")}
            >
              <SelectCampo
                id="tipo_cuenta_banco"
                valor={campos.tipoCuenta}
                opciones={OPCIONES_TIPO_CUENTA}
                etiquetaVacia="Selecciona…"
                onCambio={(valor) => {
                  if (valor === "ahorros" || valor === "corriente" || valor === "") cambiar("tipoCuenta", valor);
                }}
                className={FORM_SELECT}
                aria-label="Tipo de cuenta"
              />
            </CampoFormulario>

            <CampoFormulario
              htmlFor="numero_cuenta_banco"
              label="Número de cuenta"
              required
              error={errorDe("numero_cuenta_banco")}
            >
              <Input
                id="numero_cuenta_banco"
                value={campos.numeroCuenta}
                inputMode="numeric"
                maxLength={40}
                onChange={(evento) => cambiar("numeroCuenta", evento.target.value.replace(/\s/g, ""))}
                className={FORM_INPUT}
              />
            </CampoFormulario>
          </>
        ) : null}

        <CampoFormulario htmlFor="clave_tss" label="Clave TSS" error={errorDe("clave_tss")}>
          <Input
            id="clave_tss"
            value={campos.claveTss}
            inputMode="numeric"
            maxLength={3}
            placeholder="000"
            onChange={(evento) => cambiar("claveTss", evento.target.value.replace(/\D/g, "").slice(0, 3))}
            className={FORM_INPUT}
          />
        </CampoFormulario>
      </FormGrid>

      <ResumenEmpleado campos={campos} />
    </FormCard>
  );
}

export function WizardEmpleado({ empleado, centrosCosto, fechaHoy, titulo, migas, volverA }: PropsEmpleado) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();
  const { limpiarTodo } = validacion;
  const [erroresServidor, setErroresServidor] = useState<Record<string, string>>({});
  const [paso, setPaso] = useState<PasoEmpleado>(1);
  const [error, setError] = useState<string | null>(null);
  const [descartarAbierto, setDescartarAbierto] = useState(false);
  const [campos, setCampos] = useState<CamposEmpleado>(() => camposIniciales(empleado, fechaHoy));
  const [inicial] = useState(() => JSON.stringify(camposIniciales(empleado, fechaHoy)));

  const valores = aValoresValidacion(campos);
  const sucio = JSON.stringify(campos) !== inicial;

  const errorDe = (campo: string) => validacion.errorDe(campo) ?? erroresServidor[campo];

  function limpiarServidor() {
    if (Object.keys(erroresServidor).length > 0) setErroresServidor({});
    if (error) setError(null);
  }

  function cambiar<K extends keyof CamposEmpleado>(clave: K, valor: CamposEmpleado[K]) {
    setCampos((previos) => ({ ...previos, [clave]: valor }));
    limpiarServidor();
  }

  function mostrarError(mensaje: string) {
    setError(mensaje);
    setErroresServidor(camposConMensaje(mensaje));
  }

  function reiniciar() {
    setCampos(camposIniciales(null, fechaHoy));
    setPaso(1);
    setError(null);
    setErroresServidor({});
    limpiarTodo();
    enfocarCampo("tipo_identificacion");
  }

  function continuar() {
    if (!validacion.validar(reglasDelPaso(paso, valores))) return;
    setError(null);
    setErroresServidor({});
    if (paso < 3) setPaso((paso + 1) as PasoEmpleado);
  }

  function atras() {
    setError(null);
    setErroresServidor({});
    limpiarTodo();
    if (paso > 1) setPaso((paso - 1) as PasoEmpleado);
  }

  function guardar(crearOtro: boolean) {
    if (!validacion.validar(reglasDelPaso(3, valores))) return;

    setError(null);
    setErroresServidor({});

    iniciar(async () => {
      const entrada = aEntradaEmpleado(campos);
      const resultado = empleado ? await actualizarEmpleado(empleado.id, entrada) : await crearEmpleado(entrada);

      if (!resultado.ok) {
        mostrarError(resultado.error);
        return;
      }

      if (crearOtro) {
        toast.add({ type: "success", title: "Empleado creado. Puedes registrar otro." });
        reiniciar();
        return;
      }

      toast.add({ type: "success", title: empleado ? "Empleado actualizado." : "Empleado creado." });
      router.push(rutaEmpleado(resultado.id));
    });
  }

  function cancelar() {
    if (sucio) {
      setDescartarAbierto(true);
      return;
    }
    router.push(volverA);
  }

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo={titulo}
        subtitulo="Registra los datos personales, el contrato y la forma de pago."
        migas={migas}
        acciones={
          <Button
            type="button"
            variant="outline"
            onClick={cancelar}
            disabled={pendiente}
            className="h-10 rounded-[10px] px-4"
          >
            Cancelar
          </Button>
        }
      />

      <FormCard className="gap-4">
        <FormSectionTitle descripcion={`Paso ${paso} de 3`}>Progreso del registro</FormSectionTitle>
        <IndicadorPasos paso={paso} />
      </FormCard>

      {paso === 1 ? (
        <PasoDatosPersonales campos={campos} cambiar={cambiar} errorDe={errorDe} esEdicion={empleado !== null} />
      ) : null}
      {paso === 2 ? (
        <PasoContrato campos={campos} cambiar={cambiar} errorDe={errorDe} centrosCosto={centrosCosto} />
      ) : null}
      {paso === 3 ? <PasoBanco campos={campos} cambiar={cambiar} errorDe={errorDe} /> : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo guardar el empleado</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        {paso > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={atras}
            disabled={pendiente}
            className="h-11 rounded-[12px] px-6"
          >
            Atrás
          </Button>
        ) : null}
        {paso < 3 ? (
          <Button type="button" onClick={continuar} className="h-11 rounded-[12px] px-6">
            Continuar
          </Button>
        ) : (
          <>
            {empleado ? null : (
              <Button
                type="button"
                variant="outline"
                onClick={() => guardar(true)}
                disabled={pendiente}
                className="h-11 rounded-[12px] px-6"
              >
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Guardar y crear otro
              </Button>
            )}
            <Button
              type="button"
              onClick={() => guardar(false)}
              disabled={pendiente}
              className="h-11 rounded-[12px] px-6"
            >
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              {pendiente ? "Guardando…" : "Guardar empleado"}
            </Button>
          </>
        )}
      </FormActions>

      <AlertDialog open={descartarAbierto} onOpenChange={setDescartarAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>Si sales ahora se perderán los datos que escribiste.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => router.push(volverA)}>
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContenedorFormulario>
  );
}
