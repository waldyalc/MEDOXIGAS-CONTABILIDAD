"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FormSectionTitle } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requerido } from "@/lib/formularios/validacion";
import { actualizarTerminal, crearTerminal } from "@/lib/pos/acciones";
import { esquemaTerminal, mensajeValidacion, type TerminalEntrada } from "@/lib/pos/esquemas";
import { PLANTILLA_TICKET_DEFECTO, type PlantillaTicket, type TerminalPOS } from "@/lib/pos/tipos";

import type { CatalogosPos } from "./catalogos";
import { EditorPlantillaTicket } from "./editor-plantilla-ticket";

interface FormularioTerminal {
  nombre: string;
  almacenId: string;
  cuentaEfectivoId: string;
  cuentaDebitoId: string;
  cuentaCreditoId: string;
  cuentaTransferenciaId: string;
  numeracionId: string;
  listaId: string;
  contactoId: string;
  centroCostoId: string;
  activa: boolean;
  plantilla: PlantillaTicket;
}

type Pestana = "terminal" | "ticket";

function valoresIniciales(
  terminal: TerminalPOS | null,
  catalogos: CatalogosPos,
  cajonesEnUso: readonly string[],
): FormularioTerminal {
  if (terminal) {
    return {
      nombre: terminal.nombre,
      almacenId: terminal.almacen_id,
      cuentaEfectivoId: terminal.cuenta_efectivo_id,
      cuentaDebitoId: terminal.cuenta_tarjeta_debito_id ?? "",
      cuentaCreditoId: terminal.cuenta_tarjeta_credito_id ?? "",
      cuentaTransferenciaId: terminal.cuenta_transferencia_id ?? "",
      numeracionId: terminal.numeracion_defecto_id,
      listaId: terminal.lista_precio_defecto_id ?? "",
      contactoId: terminal.contacto_defecto_id,
      centroCostoId: terminal.centro_costo_id ?? "",
      activa: terminal.activa,
      plantilla: terminal.plantilla_ticket,
    };
  }

  const almacen = catalogos.almacenes.find((opcion) => opcion.es_principal) ?? catalogos.almacenes[0];
  const cuenta = catalogos.cuentas.find((opcion) => !cajonesEnUso.includes(opcion.id));
  const lista = catalogos.listas.find((opcion) => opcion.es_principal);
  const contacto = catalogos.contactos.find((opcion) => opcion.nombre.trim().toLowerCase() === "consumidor final");

  return {
    nombre: "",
    almacenId: almacen?.id ?? "",
    cuentaEfectivoId: cuenta?.id ?? "",
    cuentaDebitoId: "",
    cuentaCreditoId: "",
    cuentaTransferenciaId: "",
    numeracionId: catalogos.numeraciones[0]?.id ?? "",
    listaId: lista?.id ?? "",
    contactoId: contacto?.id ?? "",
    centroCostoId: "",
    activa: true,
    plantilla: PLANTILLA_TICKET_DEFECTO,
  };
}

function etiquetaCuenta(
  cuenta: { id: string; codigo: string; nombre: string },
  cajonesEnUso: readonly string[],
): string {
  const enUso = cajonesEnUso.includes(cuenta.id) ? " (en uso)" : "";
  return `${cuenta.codigo} · ${cuenta.nombre}${enUso}`;
}

export function DialogoTerminal({
  terminal,
  catalogos,
  cajonesEnUso,
  onCerrar,
}: {
  readonly terminal: TerminalPOS | null;
  readonly catalogos: CatalogosPos;
  readonly cajonesEnUso: readonly string[];
  readonly onCerrar: () => void;
}) {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>("terminal");
  const [formulario, setFormulario] = useState<FormularioTerminal>(() =>
    valoresIniciales(terminal, catalogos, cajonesEnUso),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  const sinCatalogos =
    catalogos.almacenes.length === 0 ||
    catalogos.cuentas.length === 0 ||
    catalogos.numeraciones.length === 0 ||
    catalogos.contactos.length === 0;

  function cambiar<Clave extends keyof FormularioTerminal>(clave: Clave, valor: FormularioTerminal[Clave]) {
    setFormulario((previo) => ({ ...previo, [clave]: valor }));
  }

  const opcionesAlmacen = catalogos.almacenes.map((almacen) => ({ value: almacen.id, label: almacen.nombre }));

  const opcionesEfectivo = catalogos.cuentas
    .filter((cuenta) => !cajonesEnUso.includes(cuenta.id) || cuenta.id === formulario.cuentaEfectivoId)
    .map((cuenta) => ({ value: cuenta.id, label: etiquetaCuenta(cuenta, cajonesEnUso) }));

  const opcionesCobro = catalogos.cuentas
    .filter((cuenta) => cuenta.id !== formulario.cuentaEfectivoId && !cajonesEnUso.includes(cuenta.id))
    .map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));

  const opcionesNumeracion = catalogos.numeraciones.map((numeracion) => ({
    value: numeracion.id,
    label: `${numeracion.tipo_comprobante} · ${numeracion.nombre}`,
  }));

  const opcionesLista = catalogos.listas.map((lista) => ({ value: lista.id, label: lista.nombre }));
  const opcionesContacto = catalogos.contactos.map((contacto) => ({ value: contacto.id, label: contacto.nombre }));
  const opcionesCentroCosto = catalogos.centrosCosto.map((centro) => ({
    value: centro.id,
    label: `${centro.codigo} · ${centro.nombre}`,
  }));

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const valido = validacion.validar([
      requerido("terminal-nombre", formulario.nombre, "El nombre de la terminal es obligatorio."),
      requerido("terminal-almacen", formulario.almacenId, "Selecciona el almacén de la terminal."),
      requerido("terminal-efectivo", formulario.cuentaEfectivoId, "Selecciona la cuenta de efectivo."),
      requerido("terminal-numeracion", formulario.numeracionId, "Selecciona la numeración de la terminal."),
      requerido("terminal-contacto", formulario.contactoId, "Selecciona el contacto por defecto."),
    ]);
    if (!valido) return;

    const entrada: TerminalEntrada = {
      nombre: formulario.nombre.trim(),
      almacen_id: formulario.almacenId,
      cuenta_efectivo_id: formulario.cuentaEfectivoId,
      cuenta_tarjeta_debito_id: formulario.cuentaDebitoId || null,
      cuenta_tarjeta_credito_id: formulario.cuentaCreditoId || null,
      cuenta_transferencia_id: formulario.cuentaTransferenciaId || null,
      numeracion_defecto_id: formulario.numeracionId,
      lista_precio_defecto_id: formulario.listaId || null,
      contacto_defecto_id: formulario.contactoId,
      centro_costo_id: formulario.centroCostoId || null,
      plantilla_ticket: formulario.plantilla,
      activa: formulario.activa,
    };

    // La misma validación de la capa 2B que corre en el servidor: los errores
    // llegan en español sin esperar el viaje a la base.
    const validado = esquemaTerminal.safeParse(entrada);
    if (!validado.success) {
      setError(mensajeValidacion(validado.error));
      return;
    }

    iniciar(async () => {
      const resultado = terminal
        ? await actualizarTerminal(terminal.id, validado.data)
        : await crearTerminal(validado.data);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onCerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => (abierto ? undefined : onCerrar())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{terminal ? "Editar terminal" : "Nueva terminal"}</DialogTitle>
          <DialogDescription>
            Cada terminal define su almacén, su cajón de efectivo, su numeración y la plantilla del ticket.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={enviar} className="flex flex-col gap-5">
          {sinCatalogos ? (
            <Alert>
              <AlertDescription>
                Faltan catálogos: necesitas al menos un almacén activo, una cuenta de caja o banco, una numeración de
                venta y un cliente activo antes de configurar la terminal.
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs value={pestana} onValueChange={(valor) => setPestana(valor === "ticket" ? "ticket" : "terminal")}>
            <TabsList className="flex min-h-10 w-full gap-1">
              <TabsTrigger value="terminal">Terminal</TabsTrigger>
              <TabsTrigger value="ticket">Ticket</TabsTrigger>
            </TabsList>

            <TabsContent value="terminal" className="flex flex-col gap-4 pt-4">
              <FormSectionTitle descripcion="El nombre es único y el cajón no se comparte entre terminales activas.">
                Configuración de la terminal
              </FormSectionTitle>

              <div className="grid gap-4 sm:grid-cols-2">
                <CampoFormulario
                  htmlFor="terminal-nombre"
                  label="Nombre"
                  required
                  error={validacion.errorDe("terminal-nombre")}
                  className="sm:col-span-2"
                >
                  <Input
                    id="terminal-nombre"
                    value={formulario.nombre}
                    onChange={(evento) => {
                      cambiar("nombre", evento.target.value);
                      validacion.limpiar("terminal-nombre");
                    }}
                    maxLength={80}
                    placeholder="Ej. Caja 1"
                    disabled={pendiente}
                    required
                  />
                </CampoFormulario>

                <CampoFormulario
                  htmlFor="terminal-almacen"
                  label="Almacén"
                  required
                  error={validacion.errorDe("terminal-almacen")}
                >
                  <SelectCampo
                    id="terminal-almacen"
                    opciones={opcionesAlmacen}
                    valor={formulario.almacenId}
                    onCambio={(valor) => {
                      cambiar("almacenId", valor);
                      validacion.limpiar("terminal-almacen");
                    }}
                    requerido
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario
                  htmlFor="terminal-efectivo"
                  label="Cuenta de efectivo"
                  required
                  error={validacion.errorDe("terminal-efectivo")}
                >
                  <SelectCampo
                    id="terminal-efectivo"
                    opciones={opcionesEfectivo}
                    valor={formulario.cuentaEfectivoId}
                    onCambio={(valor) => {
                      cambiar("cuentaEfectivoId", valor);
                      validacion.limpiar("terminal-efectivo");
                    }}
                    requerido
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario htmlFor="terminal-debito" label="Tarjeta de débito">
                  <SelectCampo
                    id="terminal-debito"
                    opciones={opcionesCobro}
                    valor={formulario.cuentaDebitoId}
                    onCambio={(valor) => cambiar("cuentaDebitoId", valor)}
                    etiquetaVacia="Sin cuenta"
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario htmlFor="terminal-credito" label="Tarjeta de crédito">
                  <SelectCampo
                    id="terminal-credito"
                    opciones={opcionesCobro}
                    valor={formulario.cuentaCreditoId}
                    onCambio={(valor) => cambiar("cuentaCreditoId", valor)}
                    etiquetaVacia="Sin cuenta"
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario htmlFor="terminal-transferencia" label="Transferencia">
                  <SelectCampo
                    id="terminal-transferencia"
                    opciones={opcionesCobro}
                    valor={formulario.cuentaTransferenciaId}
                    onCambio={(valor) => cambiar("cuentaTransferenciaId", valor)}
                    etiquetaVacia="Sin cuenta"
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario
                  htmlFor="terminal-numeracion"
                  label="Numeración por defecto"
                  required
                  error={validacion.errorDe("terminal-numeracion")}
                >
                  <SelectCampo
                    id="terminal-numeracion"
                    opciones={opcionesNumeracion}
                    valor={formulario.numeracionId}
                    onCambio={(valor) => {
                      cambiar("numeracionId", valor);
                      validacion.limpiar("terminal-numeracion");
                    }}
                    requerido
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario htmlFor="terminal-lista" label="Lista de precios">
                  <SelectCampo
                    id="terminal-lista"
                    opciones={opcionesLista}
                    valor={formulario.listaId}
                    onCambio={(valor) => cambiar("listaId", valor)}
                    etiquetaVacia="Precio base"
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario
                  htmlFor="terminal-contacto"
                  label="Contacto por defecto"
                  required
                  error={validacion.errorDe("terminal-contacto")}
                >
                  <SelectCampo
                    id="terminal-contacto"
                    opciones={opcionesContacto}
                    valor={formulario.contactoId}
                    onCambio={(valor) => {
                      cambiar("contactoId", valor);
                      validacion.limpiar("terminal-contacto");
                    }}
                    buscable
                    requerido
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>

                <CampoFormulario htmlFor="terminal-centro-costo" label="Centro de costo">
                  <SelectCampo
                    id="terminal-centro-costo"
                    opciones={opcionesCentroCosto}
                    valor={formulario.centroCostoId}
                    onCambio={(valor) => cambiar("centroCostoId", valor)}
                    etiquetaVacia="Sin centro de costo"
                    deshabilitado={pendiente}
                  />
                </CampoFormulario>
              </div>

              <p className="text-muted-foreground text-xs">
                Con un turno abierto no se pueden cambiar el almacén, la cuenta de efectivo ni la numeración: cierra el
                turno primero. El servidor lo valida y devuelve el mensaje.
              </p>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="terminal-activa" className="text-sm font-medium">
                    Terminal activa
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Si la desactivas, no se puede abrir turno ni vender en ella.
                  </p>
                </div>
                <Switch
                  id="terminal-activa"
                  checked={formulario.activa}
                  onCheckedChange={(valor) => cambiar("activa", valor)}
                  disabled={pendiente}
                />
              </div>
            </TabsContent>

            <TabsContent value="ticket" className="pt-4">
              <EditorPlantillaTicket
                plantilla={formulario.plantilla}
                empresa={catalogos.empresa}
                terminal={formulario.nombre}
                deshabilitado={pendiente}
                onCambio={(plantilla) => cambiar("plantilla", plantilla)}
              />
            </TabsContent>
          </Tabs>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pendiente} className="h-11 rounded-[12px] px-6" />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              {terminal ? "Guardar cambios" : "Crear terminal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
