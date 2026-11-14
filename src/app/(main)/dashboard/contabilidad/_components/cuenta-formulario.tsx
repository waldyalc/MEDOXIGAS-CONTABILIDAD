"use client";

import { type FormEvent, type ReactElement, useState, useTransition } from "react";

import { ChevronDown, Pencil, Plus } from "lucide-react";

import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { actualizarCuenta, crearCuenta } from "@/lib/contabilidad/acciones";
import {
  type CuentaEditable,
  type CuentaOpcion,
  etiquetaNaturalezaCuenta,
  etiquetaTipoCuenta,
  NATURALEZAS_CUENTA,
  TIPOS_CUENTA,
} from "@/lib/contabilidad/validacion";

const OPCIONES_TIPO = TIPOS_CUENTA.map((valor) => ({ value: valor, label: etiquetaTipoCuenta(valor) }));
const OPCIONES_NATURALEZA = NATURALEZAS_CUENTA.map((valor) => ({
  value: valor,
  label: etiquetaNaturalezaCuenta(valor),
}));

interface FormularioCuentaProps {
  cuenta: CuentaEditable | null;
  cuentas: readonly CuentaOpcion[];
  bloquearCodigoTipoNaturaleza?: boolean;
  padreIdInicial?: string | null;
  tipoInicial?: string;
  onGuardado: () => void;
}

function FormularioCuenta({
  cuenta,
  cuentas,
  bloquearCodigoTipoNaturaleza = false,
  padreIdInicial,
  tipoInicial,
  onGuardado,
}: FormularioCuentaProps) {
  const [tipo, setTipo] = useState(cuenta?.tipo ?? tipoInicial ?? "activo");
  const [naturaleza, setNaturaleza] = useState(cuenta?.naturaleza ?? "debito");
  const [padreId, setPadreId] = useState(cuenta?.padre_id ?? padreIdInicial ?? "");
  const [aceptaMovimientos, setAceptaMovimientos] = useState(cuenta?.acepta_movimientos ?? true);
  const [esCajaBanco, setEsCajaBanco] = useState(cuenta?.es_caja_banco ?? false);
  const [activa, setActiva] = useState(cuenta?.activa ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const padresItems = cuentas
    .filter((opcion) => opcion.tipo === tipo && opcion.id !== cuenta?.id)
    .map((opcion) => ({ value: opcion.id, label: `${opcion.codigo} · ${opcion.nombre}` }));
  const padreSeleccionado = padresItems.find((item) => item.value === padreId) ?? null;

  function cambiarTipo(valor: string) {
    setTipo(valor);
    const padre = cuentas.find((opcion) => opcion.id === padreId);
    if (padre != null && padre.tipo !== valor) setPadreId("");
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const resultado = cuenta ? await actualizarCuenta(cuenta.id, formData) : await crearCuenta(formData);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onGuardado();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="acepta_movimientos" value={String(aceptaMovimientos)} />
      <input type="hidden" name="es_caja_banco" value={String(esCajaBanco)} />
      <input type="hidden" name="activa" value={String(activa)} />

      <FieldGroup>
        {bloquearCodigoTipoNaturaleza ? (
          <p className="text-muted-foreground text-xs">
            El código, el tipo y la naturaleza no se pueden cambiar porque la cuenta ya tiene movimientos.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="codigo">Código *</FieldLabel>
            <Input
              id="codigo"
              name="codigo"
              required
              maxLength={20}
              readOnly={bloquearCodigoTipoNaturaleza}
              defaultValue={cuenta?.codigo ?? ""}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="nombre">Nombre *</FieldLabel>
            <Input id="nombre" name="nombre" required maxLength={200} defaultValue={cuenta?.nombre ?? ""} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
            <SelectCampo
              id="tipo"
              name="tipo"
              opciones={OPCIONES_TIPO}
              valor={tipo}
              onCambio={cambiarTipo}
              deshabilitado={bloquearCodigoTipoNaturaleza}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="naturaleza">Naturaleza</FieldLabel>
            <SelectCampo
              id="naturaleza"
              name="naturaleza"
              opciones={OPCIONES_NATURALEZA}
              valor={naturaleza}
              onCambio={setNaturaleza}
              deshabilitado={bloquearCodigoTipoNaturaleza}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="padre">Padre</FieldLabel>
          <Combobox
            items={padresItems}
            value={padreSeleccionado}
            onValueChange={(item) => setPadreId(item?.value ?? "")}
            itemToStringLabel={(item) => item.label}
            isItemEqualToValue={(a, b) => a.value === b.value}
          >
            <ComboboxInput id="padre" className="w-full" placeholder="Sin cuenta padre" showClear />
            <ComboboxContent>
              <ComboboxEmpty>Sin cuentas del mismo tipo</ComboboxEmpty>
              <ComboboxList>
                {(item: { value: string; label: string }) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <input type="hidden" name="padre_id" value={padreId} />
        </Field>

        <Collapsible
          className="rounded-lg border"
          defaultOpen={cuenta != null && (!cuenta.acepta_movimientos || cuenta.es_caja_banco || !cuenta.activa)}
        >
          <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-between" />}>
            Más opciones
            <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="acepta_movimientos">Acepta movimientos</FieldLabel>
              <Switch id="acepta_movimientos" checked={aceptaMovimientos} onCheckedChange={setAceptaMovimientos} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="es_caja_banco">Es caja o banco</FieldLabel>
              <Switch id="es_caja_banco" checked={esCajaBanco} onCheckedChange={setEsCajaBanco} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="activa">Activa</FieldLabel>
              <Switch id="activa" checked={activa} onCheckedChange={setActiva} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NuevaCuenta({
  cuentas,
  padreIdInicial,
  tipoInicial,
  trigger,
}: {
  readonly cuentas: readonly CuentaOpcion[];
  readonly padreIdInicial?: string | null;
  readonly tipoInicial?: string;
  readonly trigger?: ReactElement;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {trigger != null ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger render={<Button type="button" />}>
          <Plus />
          Nueva cuenta
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva cuenta</DialogTitle>
        </DialogHeader>
        <FormularioCuenta
          cuenta={null}
          cuentas={cuentas}
          padreIdInicial={padreIdInicial}
          tipoInicial={tipoInicial}
          onGuardado={() => setAbierto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function EditarCuenta({
  cuenta,
  cuentas,
  bloquearCodigoTipoNaturaleza,
  trigger,
}: {
  readonly cuenta: CuentaEditable;
  readonly cuentas: readonly CuentaOpcion[];
  readonly bloquearCodigoTipoNaturaleza: boolean;
  readonly trigger?: ReactElement;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {trigger != null ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
          <Pencil />
          Editar
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cuenta</DialogTitle>
        </DialogHeader>
        <FormularioCuenta
          key={cuenta.id}
          cuenta={cuenta}
          cuentas={cuentas}
          bloquearCodigoTipoNaturaleza={bloquearCodigoTipoNaturaleza}
          onGuardado={() => setAbierto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
