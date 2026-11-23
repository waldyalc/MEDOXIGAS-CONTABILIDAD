"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { buscarContactos } from "@/lib/contactos/busqueda";
import {
  type ContactoBuscado,
  TAMANO_CONTACTOS,
  type TipoBusquedaContacto,
  unirContactos,
} from "@/lib/contactos/seleccion";
import { esConsumidorFinalPorRnc, etiquetaContactoPOS } from "@/lib/pos/consumidor-final";

import { type ContactoCreado, DialogoNuevoContacto } from "./dialogo-nuevo-contacto";

export type ContactoOpcion = ContactoBuscado;

const ESPERA_BUSQUEDA_MS = 350;

const formato = new Intl.NumberFormat("es-DO");

interface Props {
  contactos: readonly ContactoOpcion[];
  valor: string;
  onCambio: (contacto: ContactoOpcion | null) => void;
  tipoInicial: TipoBusquedaContacto;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showClear?: boolean;
  /** Muestra el nombre con su RNC entre paréntesis; el Consumidor final queda solo con su nombre (MSG-44). */
  mostrarRncEnValor?: boolean;
  /** Acciones junto a la flecha (lápiz y X en el POS); no reemplazan la flecha. */
  acciones?: (contacto: ContactoOpcion | null) => ReactNode;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function SelectorContacto({
  contactos,
  valor,
  onCambio,
  tipoInicial,
  id,
  className,
  placeholder,
  disabled = false,
  showClear = true,
  mostrarRncEnValor = false,
  acciones,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: Props) {
  const [opciones, setOpciones] = useState<ContactoBuscado[]>(() => {
    const inicial = contactos.find((contacto) => contacto.id === valor);
    return unirContactos(contactos.slice(0, TAMANO_CONTACTOS), inicial);
  });
  const [seleccionado, setSeleccionado] = useState<ContactoOpcion | null>(
    () => contactos.find((contacto) => contacto.id === valor) ?? null,
  );
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const solicitud = useRef(0);
  const resuelto = useRef<string | null>(null);

  useEffect(() => {
    if (!valor) {
      setSeleccionado(null);
      resuelto.current = null;
      return;
    }

    const conocido = opciones.find((contacto) => contacto.id === valor);
    if (conocido) {
      setSeleccionado(conocido);
      resuelto.current = valor;
      return;
    }

    if (resuelto.current === valor) return;

    let activo = true;
    resuelto.current = valor;
    buscarContactos({ tipo: tipoInicial, incluir: valor })
      .then((resultado) => {
        const encontrado = resultado.contactos.find((contacto) => contacto.id === valor);
        if (!activo || !encontrado) return;
        setSeleccionado(encontrado);
        setOpciones((actuales) => unirContactos(actuales, encontrado));
      })
      .catch(() => {
        // El contacto no se pudo recuperar; el formulario conserva el id.
      });

    return () => {
      activo = false;
    };
  }, [valor, tipoInicial, opciones]);

  useEffect(() => {
    if (!abierto) return;

    const consulta = busqueda.trim();
    const temporizador = setTimeout(() => {
      const numero = solicitud.current + 1;
      solicitud.current = numero;
      setCargando(true);

      buscarContactos({
        tipo: tipoInicial,
        q: consulta,
        pagina: 1,
        tamano: TAMANO_CONTACTOS,
        ...(valor ? { incluir: valor } : {}),
      })
        .then((resultado) => {
          if (solicitud.current !== numero) return;
          setOpciones(unirContactos(resultado.contactos, seleccionado));
          setTotal(resultado.total);
        })
        .catch(() => {
          if (solicitud.current === numero) setOpciones(seleccionado ? [seleccionado] : []);
        })
        .finally(() => {
          if (solicitud.current === numero) setCargando(false);
        });
    }, ESPERA_BUSQUEDA_MS);

    return () => clearTimeout(temporizador);
  }, [abierto, busqueda, tipoInicial, valor, seleccionado]);

  const etiquetaCrear = tipoInicial === "cliente" ? "Crear nuevo cliente" : "Crear nuevo proveedor";
  const permiteCrear = tipoInicial !== "todos";
  const restantes = total != null && total > opciones.length;

  const placeholderFinal = placeholder ?? (tipoInicial === "todos" ? "Buscar contacto…" : `Buscar ${tipoInicial}…`);

  function cambiar(contacto: ContactoOpcion | null) {
    setBusqueda("");
    onCambio(contacto);
  }

  function crear(contacto: ContactoCreado) {
    setOpciones((actuales) => unirContactos(actuales, contacto));
    setDialogoAbierto(false);
    setBusqueda("");
    onCambio(contacto);
  }

  return (
    <>
      <Combobox
        items={opciones}
        value={seleccionado}
        onValueChange={cambiar}
        itemToStringLabel={(contacto) => etiquetaContactoPOS(contacto, mostrarRncEnValor)}
        isItemEqualToValue={(a, b) => a.id === b.id}
        filter={null}
        onOpenChange={(nuevo) => {
          setAbierto(nuevo);
          if (!nuevo) setBusqueda("");
        }}
      >
        <ComboboxInput
          id={id}
          className={className ?? "w-full"}
          placeholder={placeholderFinal}
          disabled={disabled}
          showClear={showClear}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-busy={cargando}
          onChange={(evento) => setBusqueda(evento.currentTarget.value)}
        >
          {acciones ? acciones(seleccionado) : null}
        </ComboboxInput>
        <ComboboxContent>
          {permiteCrear ? (
            <div className="border-b p-1">
              <Button
                type="button"
                variant="ghost"
                className="text-primary h-8 w-full justify-start gap-1.5 px-1.5 text-sm font-medium"
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => setDialogoAbierto(true)}
              >
                <Plus className="size-4" />
                {etiquetaCrear}
              </Button>
            </div>
          ) : null}
          <ComboboxEmpty>{cargando ? "Buscando…" : "Sin resultados"}</ComboboxEmpty>
          <ComboboxList>
            {(contacto: ContactoOpcion) => (
              <ComboboxItem key={contacto.id} value={contacto}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{contacto.nombre}</span>
                  {contacto.rnc_cedula && !(mostrarRncEnValor && esConsumidorFinalPorRnc(contacto.rnc_cedula)) ? (
                    <span className="text-muted-foreground text-xs tabular-nums">{contacto.rnc_cedula}</span>
                  ) : null}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
          {restantes ? (
            <p className="text-muted-foreground border-t px-2 py-1.5 text-xs">
              Mostrando {formato.format(opciones.length)} de {formato.format(total ?? 0)}. Escribe para buscar.
            </p>
          ) : null}
        </ComboboxContent>
      </Combobox>

      {tipoInicial !== "todos" ? (
        <DialogoNuevoContacto
          abierto={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
          tipoInicial={tipoInicial}
          nombreInicial={busqueda}
          onCreado={crear}
        />
      ) : null}
    </>
  );
}
