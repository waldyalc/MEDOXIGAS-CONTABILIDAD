"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus } from "lucide-react";

import { FORM_INPUT, FORM_INPUT_GROUP, FORM_SELECT, FormField } from "@/components/formularios/formulario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { actualizarRetencion, crearRetencion } from "@/lib/configuracion/acciones";
import type { CuentaRetencion, RetencionConfig } from "@/lib/configuracion/tipos";
import { formatoPct } from "@/lib/formato";
import type { TipoRetencion } from "@/lib/retenciones/calculo";

const TIPOS = [
  { value: "itbis", label: "ITBIS" },
  { value: "isr", label: "ISR" },
] as const;

const SIN_CUENTA = "ninguna";

function opcionesCuenta(cuentas: readonly CuentaRetencion[]) {
  return cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));
}

function FormularioRetencion({
  retencion,
  cuentas,
  onGuardado,
}: {
  readonly retencion: RetencionConfig | null;
  readonly cuentas: readonly CuentaRetencion[];
  readonly onGuardado: () => void;
}) {
  const cuentasPasivo = cuentas.filter((cuenta) => cuenta.tipo === "pasivo");
  const cuentasActivo = cuentas.filter((cuenta) => cuenta.tipo === "activo");
  const [tipo, setTipo] = useState<TipoRetencion>(retencion?.tipo ?? "itbis");
  const [porcentaje, setPorcentaje] = useState(retencion == null ? "" : String(retencion.porcentaje));
  const [cuentaId, setCuentaId] = useState(retencion?.cuenta_id ?? cuentasPasivo[0]?.id ?? "");
  const [anticipoId, setAnticipoId] = useState(retencion?.cuenta_anticipo_id ?? SIN_CUENTA);
  const [activa, setActiva] = useState(retencion?.activa ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const opcionesPasivo = opcionesCuenta(cuentasPasivo);
  const opcionesActivo = [{ value: SIN_CUENTA, label: "Sin cuenta (usa la configuración contable)" }];
  opcionesActivo.push(...opcionesCuenta(cuentasActivo));

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    const entrada = {
      ...(retencion ? { id: retencion.id } : {}),
      nombre: String(datos.get("nombre") ?? ""),
      tipo,
      porcentaje: String(datos.get("porcentaje") ?? ""),
      cuenta_id: cuentaId,
      cuenta_anticipo_id: anticipoId === SIN_CUENTA ? "" : anticipoId,
      activa,
    };

    iniciar(async () => {
      const resultado = retencion ? await actualizarRetencion(entrada) : await crearRetencion(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onGuardado();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <FormField htmlFor="nombre" label="Nombre" required>
          <Input
            id="nombre"
            name="nombre"
            required
            maxLength={80}
            defaultValue={retencion?.nombre ?? ""}
            placeholder="Ej. ITBIS 30 %"
            className={FORM_INPUT}
          />
        </FormField>

        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <FormField htmlFor="tipo" label="Tipo" required>
            <Select
              items={[...TIPOS]}
              value={tipo}
              onValueChange={(valor: string | null) => {
                if (valor === "itbis" || valor === "isr") setTipo(valor);
              }}
            >
              <SelectTrigger id="tipo" className={FORM_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField htmlFor="porcentaje" label="Porcentaje" required>
            <InputGroup className={FORM_INPUT_GROUP}>
              <InputGroupInput
                id="porcentaje"
                name="porcentaje"
                inputMode="decimal"
                required
                defaultValue={porcentaje}
                onChange={(evento) => setPorcentaje(evento.target.value)}
                placeholder="30"
              />
              <InputGroupAddon align="inline-end" className="pr-2 pl-0 text-sm text-slate-500">
                %
              </InputGroupAddon>
            </InputGroup>
          </FormField>
        </div>

        <FormField htmlFor="cuenta" label="Cuenta cuando retenemos (pasivo)" required>
          <Select
            items={opcionesPasivo}
            value={cuentaId}
            onValueChange={(valor: string | null) => setCuentaId(valor ?? "")}
          >
            <SelectTrigger id="cuenta" className={FORM_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesPasivo.map((opcion) => (
                <SelectItem key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField htmlFor="cuenta_anticipo" label="Cuenta cuando nos retienen (activo)">
          <Select
            items={opcionesActivo}
            value={anticipoId}
            onValueChange={(valor: string | null) => setAnticipoId(valor ?? SIN_CUENTA)}
          >
            <SelectTrigger id="cuenta_anticipo" className={FORM_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesActivo.map((opcion) => (
                <SelectItem key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="activa">Activa</FieldLabel>
          <Switch id="activa" checked={activa} onCheckedChange={setActiva} />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-[12px] px-6" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RetencionesCliente({
  retenciones,
  cuentas,
  puedeEscribir,
}: {
  readonly retenciones: RetencionConfig[];
  readonly cuentas: CuentaRetencion[];
  readonly puedeEscribir: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<RetencionConfig | null>(null);

  function abrirNueva() {
    setEditando(null);
    setAbierto(true);
  }

  function abrirEdicion(retencion: RetencionConfig) {
    setEditando(retencion);
    setAbierto(true);
  }

  function cerrarTrasGuardar() {
    setAbierto(false);
    setEditando(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          El porcentaje de ITBIS se calcula sobre el ITBIS de la factura; el de ISR, sobre el subtotal.
        </p>
        {puedeEscribir ? (
          <Button type="button" onClick={abrirNueva}>
            <Plus />
            Nueva retención
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Porcentaje</TableHead>
              <TableHead>Cuenta (retenemos)</TableHead>
              <TableHead>Cuenta anticipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {retenciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center whitespace-normal">
                  No hay retenciones configuradas.
                </TableCell>
              </TableRow>
            ) : (
              retenciones.map((retencion) => (
                <TableRow key={retencion.id}>
                  <TableCell className="font-medium">{retencion.nombre}</TableCell>
                  <TableCell>{retencion.tipo === "itbis" ? "ITBIS" : "ISR"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoPct(retencion.porcentaje)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {retencion.cuenta_codigo} · {retencion.cuenta_nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {retencion.cuenta_anticipo_codigo
                      ? `${retencion.cuenta_anticipo_codigo} · ${retencion.cuenta_anticipo_nombre}`
                      : "Configuración contable"}
                  </TableCell>
                  <TableCell>
                    {retencion.activa ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                      >
                        Activa
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {puedeEscribir ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicion(retencion)}>
                        <Pencil />
                        Editar
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando == null ? "Nueva retención" : "Editar retención"}</DialogTitle>
          </DialogHeader>
          <FormularioRetencion
            key={editando?.id ?? "nueva"}
            retencion={editando}
            cuentas={cuentas}
            onGuardado={cerrarTrasGuardar}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
