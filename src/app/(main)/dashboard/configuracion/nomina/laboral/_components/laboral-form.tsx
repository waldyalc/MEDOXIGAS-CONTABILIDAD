"use client";

import { type ReactNode, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_BUTTON, FormActions, FormCard, FormGrid, FormSectionTitle } from "@/components/formularios/formulario";
import { AlertTriangle, InfoIcon, Loader2 } from "@/components/icons";
import { type OpcionSelect, SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import type { Empresa } from "@/lib/facturacion/tipos";
import { guardarConfigNomina } from "@/lib/nomina/acciones";
import { configNominaSchema, mensajeValidacion } from "@/lib/nomina/esquemas";
import type { CategoriaEmpresa, ConfigNomina, FrecuenciaPago, RiesgoLaboral } from "@/lib/nomina/tipos";

const RIESGOS: readonly OpcionSelect[] = [
  { value: "tipo_1", label: "Tipo I — 1.10 %" },
  { value: "tipo_2", label: "Tipo II — 1.15 %" },
  { value: "tipo_3", label: "Tipo III — 1.25 %" },
  { value: "tipo_4", label: "Tipo IV — 1.30 %" },
];

const CATEGORIAS: readonly OpcionSelect[] = [
  { value: "micro", label: "Micro" },
  { value: "pequena", label: "Pequeña" },
  { value: "mediana", label: "Mediana" },
  { value: "grande", label: "Grande" },
];

const FRECUENCIAS: readonly OpcionSelect[] = [
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
];

interface OpcionCuenta {
  value: string;
  label: string;
}

interface OpcionContacto {
  value: string;
  label: string;
}

interface EstadoLaboral {
  riesgo_laboral: RiesgoLaboral;
  categoria_empresa: CategoriaEmpresa;
  aplica_infotep: boolean;
  frecuencia_defecto: FrecuenciaPago;
  cuenta_pago_defecto_id: string;
  cuenta_salarios_por_pagar_id: string;
  registrar_provisiones: boolean;
  contacto_tss_id: string;
  contacto_infotep_id: string;
  contacto_dgii_id: string;
}

function estadoInicial(config: ConfigNomina | null): EstadoLaboral {
  return {
    riesgo_laboral: config?.riesgo_laboral ?? "tipo_1",
    categoria_empresa: config?.categoria_empresa ?? "pequena",
    aplica_infotep: config?.aplica_infotep ?? true,
    frecuencia_defecto: config?.frecuencia_defecto ?? "quincenal",
    cuenta_pago_defecto_id: config?.cuenta_pago_defecto_id ?? "",
    cuenta_salarios_por_pagar_id: config?.cuenta_salarios_por_pagar_id ?? "",
    registrar_provisiones: config?.registrar_provisiones ?? false,
    contacto_tss_id: config?.contacto_tss_id ?? "",
    contacto_infotep_id: config?.contacto_infotep_id ?? "",
    contacto_dgii_id: config?.contacto_dgii_id ?? "",
  };
}

function etiquetaDe(opciones: readonly OpcionSelect[], valor: string): string | null {
  return opciones.find((opcion) => opcion.value === valor)?.label ?? null;
}

function FilaDefinicion({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs font-medium">{termino}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function LaboralForm({
  config,
  empresa,
  cuentasCajaBanco,
  cuentasSalarios,
  contactos,
  puedeEditar,
}: {
  readonly config: ConfigNomina | null;
  readonly empresa: Empresa | null;
  readonly cuentasCajaBanco: readonly OpcionCuenta[];
  readonly cuentasSalarios: readonly OpcionCuenta[];
  readonly contactos: readonly OpcionContacto[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoLaboral>(() => estadoInicial(config));
  const [base, setBase] = useState<EstadoLaboral>(() => estadoInicial(config));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const hayCambios = JSON.stringify(estado) !== JSON.stringify(base);
  const nombreSalarios = etiquetaDe(cuentasSalarios, estado.cuenta_salarios_por_pagar_id);
  const nombrePago = etiquetaDe(cuentasCajaBanco, estado.cuenta_pago_defecto_id);

  function cambiar<K extends keyof EstadoLaboral>(campo: K, valor: EstadoLaboral[K]) {
    setEstado((previo) => ({ ...previo, [campo]: valor }));
  }

  function descartar() {
    setEstado(base);
    setError(null);
  }

  function guardar() {
    setError(null);

    const entrada = {
      ...estado,
      cuenta_pago_defecto_id: estado.cuenta_pago_defecto_id || null,
      cuenta_salarios_por_pagar_id: estado.cuenta_salarios_por_pagar_id || null,
      contacto_tss_id: estado.contacto_tss_id || null,
      contacto_infotep_id: estado.contacto_infotep_id || null,
      contacto_dgii_id: estado.contacto_dgii_id || null,
    };

    const validado = configNominaSchema.safeParse(entrada);
    if (!validado.success) {
      setError(mensajeValidacion(validado.error));
      return;
    }

    iniciar(async () => {
      const resultado = await guardarConfigNomina(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setBase(estado);
      toast.add({
        type: "success",
        title: "Configuración de nómina guardada.",
        description: "Los próximos periodos usan estos datos.",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {config == null ? (
        <Alert>
          <InfoIcon aria-hidden="true" />
          <AlertDescription>
            Todavía no hay una fila de configuración. Se muestran los valores por defecto y se crearán al guardar.
          </AlertDescription>
        </Alert>
      ) : null}

      {estado.cuenta_salarios_por_pagar_id === "" ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Contabilización bloqueada: falta la cuenta de salarios por pagar.</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200/90">
            Sin esa cuenta no se puede contabilizar el comprobante NO. Elige una cuenta de pasivo de detalle en “Cuentas
            por defecto”.
          </AlertDescription>
        </Alert>
      ) : null}

      <FormCard>
        <FormSectionTitle descripcion="Estos datos se editan en Configuración → Empresa.">Empresa</FormSectionTitle>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilaDefinicion termino="Nombre">{empresa?.nombre ?? "—"}</FilaDefinicion>
          <FilaDefinicion termino="RNC">{empresa?.rnc ?? "—"}</FilaDefinicion>
          <FilaDefinicion termino="Teléfono">{empresa?.telefono ?? "—"}</FilaDefinicion>
          <FilaDefinicion termino="Correo">{empresa?.correo ?? "—"}</FilaDefinicion>
          <FilaDefinicion termino="Dirección">{empresa?.direccion ?? "—"}</FilaDefinicion>
          <FilaDefinicion termino="Comprobante de nómina">
            <span className="font-mono">NO</span> ·{" "}
            <Link
              href="/dashboard/configuracion/tipos-entrada-diario"
              prefetch={false}
              className="text-primary underline underline-offset-4"
            >
              Tipos de entrada de diario
            </Link>
          </FilaDefinicion>
        </dl>
        <p className="text-muted-foreground text-sm">
          <Link
            href="/dashboard/configuracion/empresa"
            prefetch={false}
            className="text-primary underline underline-offset-4"
          >
            Editar datos de la empresa
          </Link>
        </p>
      </FormCard>

      <FormCard>
        <FormSectionTitle descripcion="Determinan los aportes patronales del asiento de nómina.">
          Riesgo y aportes
        </FormSectionTitle>
        <FormGrid>
          <CampoFormulario htmlFor="nomina-riesgo" label="Riesgo laboral (SRL)" required>
            <SelectCampo
              id="nomina-riesgo"
              opciones={RIESGOS}
              valor={estado.riesgo_laboral}
              onCambio={(valor) => cambiar("riesgo_laboral", valor as RiesgoLaboral)}
              deshabilitado={!puedeEditar}
            />
            <p className="text-muted-foreground text-xs">Determina la tasa del SRL. Confírmalo con tu asesor.</p>
          </CampoFormulario>

          <CampoFormulario htmlFor="nomina-categoria" label="Categoría de la empresa" required>
            <SelectCampo
              id="nomina-categoria"
              opciones={CATEGORIAS}
              valor={estado.categoria_empresa}
              onCambio={(valor) => cambiar("categoria_empresa", valor as CategoriaEmpresa)}
              deshabilitado={!puedeEditar}
            />
            <p className="text-muted-foreground text-xs">Informativa en esta fase; no cambia la tasa de INFOTEP.</p>
          </CampoFormulario>

          <CampoFormulario htmlFor="nomina-frecuencia" label="Frecuencia por defecto" required>
            <SelectCampo
              id="nomina-frecuencia"
              opciones={FRECUENCIAS}
              valor={estado.frecuencia_defecto}
              onCambio={(valor) => cambiar("frecuencia_defecto", valor as FrecuenciaPago)}
              deshabilitado={!puedeEditar}
            />
            <p className="text-muted-foreground text-xs">Solo prellena el formulario de nuevo periodo.</p>
          </CampoFormulario>
        </FormGrid>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="nomina-infotep">Aplica INFOTEP</Label>
              <p className="text-muted-foreground text-xs">
                Si está apagado, no se genera la línea de INFOTEP (1.00 %).
              </p>
            </div>
            <Switch
              id="nomina-infotep"
              checked={estado.aplica_infotep}
              onCheckedChange={(valor) => cambiar("aplica_infotep", valor)}
              disabled={!puedeEditar}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="nomina-provisiones">Registrar provisiones</Label>
              <p className="text-muted-foreground text-xs">
                Genera provisiones de regalía, vacaciones y cesantía. En esta fase no se consumen al pagar; confírmalo
                con Contable.
              </p>
            </div>
            <Switch
              id="nomina-provisiones"
              checked={estado.registrar_provisiones}
              onCheckedChange={(valor) => cambiar("registrar_provisiones", valor)}
              disabled={!puedeEditar}
            />
          </div>
        </div>
      </FormCard>

      <FormCard>
        <FormSectionTitle descripcion="Se proponen al contabilizar y pagar la nómina.">
          Cuentas por defecto
        </FormSectionTitle>
        <FormGrid>
          <CampoFormulario htmlFor="nomina-cuenta-pago" label="Cuenta de pago por defecto">
            <SelectCampo
              id="nomina-cuenta-pago"
              buscable
              opciones={cuentasCajaBanco}
              valor={estado.cuenta_pago_defecto_id}
              onCambio={(valor) => cambiar("cuenta_pago_defecto_id", valor)}
              etiquetaVacia="Elegir cuenta"
              deshabilitado={!puedeEditar}
            />
            <p className="text-muted-foreground text-xs">
              Se propone al pagar. Si falta, el pago pide elegir una cuenta.
            </p>
          </CampoFormulario>

          <CampoFormulario htmlFor="nomina-cuenta-salarios" label="Cuenta de salarios por pagar">
            <SelectCampo
              id="nomina-cuenta-salarios"
              buscable
              opciones={cuentasSalarios}
              valor={estado.cuenta_salarios_por_pagar_id}
              onCambio={(valor) => cambiar("cuenta_salarios_por_pagar_id", valor)}
              etiquetaVacia="Elegir cuenta"
              deshabilitado={!puedeEditar}
            />
            <p className="text-muted-foreground text-xs">
              Es la contrapartida del neto en el comprobante NO. Sin esta cuenta no se puede contabilizar.
            </p>
          </CampoFormulario>
        </FormGrid>
      </FormCard>

      <FormCard>
        <FormSectionTitle descripcion="Terceros que se usan en el asiento por concepto de ley.">
          Contactos de ley
        </FormSectionTitle>
        <FormGrid>
          <CampoFormulario htmlFor="nomina-contacto-tss" label="Contacto TSS">
            <SelectCampo
              id="nomina-contacto-tss"
              buscable
              opciones={contactos}
              valor={estado.contacto_tss_id}
              onCambio={(valor) => cambiar("contacto_tss_id", valor)}
              etiquetaVacia="Sin contacto"
              deshabilitado={!puedeEditar}
            />
            <p className="text-muted-foreground text-xs">Tercero de SFS, AFP y SRL en el asiento.</p>
          </CampoFormulario>

          <CampoFormulario htmlFor="nomina-contacto-infotep" label="Contacto INFOTEP">
            <SelectCampo
              id="nomina-contacto-infotep"
              buscable
              opciones={contactos}
              valor={estado.contacto_infotep_id}
              onCambio={(valor) => cambiar("contacto_infotep_id", valor)}
              etiquetaVacia="Sin contacto"
              deshabilitado={!puedeEditar}
            />
          </CampoFormulario>

          <CampoFormulario htmlFor="nomina-contacto-dgii" label="Contacto DGII">
            <SelectCampo
              id="nomina-contacto-dgii"
              buscable
              opciones={contactos}
              valor={estado.contacto_dgii_id}
              onCambio={(valor) => cambiar("contacto_dgii_id", valor)}
              etiquetaVacia="Sin contacto"
              deshabilitado={!puedeEditar}
            />
            <p className="text-muted-foreground text-xs">Tercero del ISR retenido.</p>
          </CampoFormulario>
        </FormGrid>
      </FormCard>

      <FormCard>
        <FormSectionTitle
          descripcion={
            <>
              Las cuentas de gasto salen del{" "}
              <Link
                href="/dashboard/configuracion/nomina/mapeo"
                prefetch={false}
                className="text-primary underline underline-offset-4"
              >
                mapeo contable
              </Link>
              .
            </>
          }
        >
          Así se arma el asiento
        </FormSectionTitle>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>Débito: gastos por segmento según el mapeo contable de cada concepto.</li>
          <li>Crédito: retenciones SFS/AFP/ISR (2108/2109/2110) y otras deducciones.</li>
          <li>Crédito: aportes SFS/AFP/SRL/INFOTEP (2111–2114) si aplican.</li>
          <li>Crédito: provisiones (2116–2118) solo si están activas.</li>
          <li>Crédito: salarios por pagar (2107) — {nombreSalarios ?? "sin cuenta seleccionada"}.</li>
          <li>Pago: {nombrePago ?? "se elige la cuenta al pagar"}.</li>
        </ul>
        <p className="text-sm">
          <span className="text-muted-foreground">Riesgo elegido: </span>
          {etiquetaDe(RIESGOS, estado.riesgo_laboral) ?? estado.riesgo_laboral}
        </p>
      </FormCard>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {puedeEditar ? (
        <FormActions>
          {hayCambios ? (
            <Button type="button" variant="ghost" onClick={descartar} disabled={pendiente} className={FORM_BUTTON}>
              Descartar
            </Button>
          ) : null}
          <Button type="button" onClick={guardar} disabled={!hayCambios || pendiente} className={FORM_BUTTON}>
            {pendiente ? <Loader2 className="animate-spin" /> : null}
            Guardar cambios
          </Button>
        </FormActions>
      ) : null}
    </div>
  );
}
