"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ChevronDown, Loader2, Upload } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_INPUT,
  FormActions,
  FormCard,
  FormDivider,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { guardarEmpresa } from "@/lib/configuracion/acciones";
import { extensionLogo, LIMITE_LOGO_BYTES, validarLogo } from "@/lib/configuracion/validacion";
import type { Empresa } from "@/lib/facturacion/tipos";
import { requerido } from "@/lib/formularios/validacion";
import { createClient } from "@/lib/supabase/client";

function mensajeSubidaLogo(mensaje: string) {
  if (/bucket not found/i.test(mensaje)) return "No se encontró el almacenamiento de logos. Avisa al administrador.";
  if (/payload too large|maximum allowed size/i.test(mensaje)) return "El logo no puede pesar más de 2 MB.";
  if (/row-level security|permission/i.test(mensaje)) return "Solo el administrador puede subir el logo.";
  return "No se pudo subir el logo. Intenta de nuevo.";
}

function rutaLogo(url: string | null) {
  if (!url) return null;
  const marcador = "/object/public/logos/";
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return decodeURIComponent(url.slice(indice + marcador.length));
}

async function subirLogo(archivo: File) {
  const supabase = createClient();
  const ruta = `logo-${Date.now()}.${extensionLogo(archivo.type)}`;

  const { error } = await supabase.storage.from("logos").upload(ruta, archivo, {
    cacheControl: "3600",
    contentType: archivo.type,
    upsert: false,
  });

  if (error) throw new Error(mensajeSubidaLogo(error.message));

  return supabase.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
}

async function borrarLogoAnterior(anterior: string | null, actual: string | null) {
  const ruta = rutaLogo(anterior);
  if (ruta == null || ruta === rutaLogo(actual)) return;

  const supabase = createClient();
  await supabase.storage.from("logos").remove([ruta]);
}

async function resolverLogo(
  archivo: FormDataEntryValue | null,
  actual: string | null,
): Promise<{ ok: true; logoUrl: string | null } | { ok: false; error: string }> {
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: true, logoUrl: actual };

  const problema = validarLogo(archivo);
  if (problema) return { ok: false, error: problema };

  try {
    return { ok: true, logoUrl: await subirLogo(archivo) };
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : "No se pudo subir el logo." };
  }
}

function datosEmpresa(datos: FormData, logoUrl: string | null) {
  return {
    nombre: String(datos.get("nombre") ?? ""),
    rnc: String(datos.get("rnc") ?? ""),
    direccion: String(datos.get("direccion") ?? ""),
    telefono: String(datos.get("telefono") ?? ""),
    correo: String(datos.get("correo") ?? ""),
    logo_url: logoUrl,
  };
}

export function EmpresaForm({
  empresa,
  puedeEditar,
}: {
  readonly empresa: Empresa | null;
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const inputLogo = useRef<HTMLInputElement>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  function cambiarLogo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0] ?? null;
    setGuardado(false);

    if (archivo == null) {
      setVistaPrevia(null);
      setError(null);
      return;
    }

    const problema = validarLogo(archivo);
    if (problema) {
      evento.target.value = "";
      setVistaPrevia(null);
      setError(problema);
      return;
    }

    setError(null);
    setVistaPrevia(URL.createObjectURL(archivo));
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    setGuardado(false);

    if (!validacion.validar([requerido("nombre", datos.get("nombre"), "El nombre es requerido.")])) return;

    iniciar(async () => {
      const resolucion = await resolverLogo(datos.get("logo"), empresa?.logo_url ?? null);
      if (!resolucion.ok) {
        setError(resolucion.error);
        return;
      }

      const resultado = await guardarEmpresa(datosEmpresa(datos, resolucion.logoUrl));
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (resolucion.logoUrl !== empresa?.logo_url) {
        await borrarLogoAnterior(empresa?.logo_url ?? null, resolucion.logoUrl);
      }

      if (inputLogo.current) inputLogo.current.value = "";
      setVistaPrevia(null);
      setGuardado(true);
      router.refresh();
    });
  }

  const logo = vistaPrevia ?? empresa?.logo_url?.trim() ?? "";

  return (
    <form noValidate onSubmit={enviar} className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      <FormCard>
        <section>
          <FormSectionTitle descripcion="Así aparecen el nombre y los datos en facturas, cotizaciones y conduces.">
            Datos de la empresa
          </FormSectionTitle>
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <CampoFormulario htmlFor="nombre" label="Nombre" required error={validacion.errorDe("nombre")}>
                <Input
                  id="nombre"
                  name="nombre"
                  required
                  maxLength={200}
                  defaultValue={empresa?.nombre ?? ""}
                  disabled={!puedeEditar}
                  onChange={() => validacion.limpiar("nombre")}
                  className={FORM_INPUT}
                />
              </CampoFormulario>
              <CampoFormulario htmlFor="rnc" label="RNC">
                <Input
                  id="rnc"
                  name="rnc"
                  maxLength={20}
                  defaultValue={empresa?.rnc ?? ""}
                  disabled={!puedeEditar}
                  className={FORM_INPUT}
                />
              </CampoFormulario>
            </div>

            <Collapsible
              className="rounded-xl border border-slate-200"
              defaultOpen={Boolean(empresa?.direccion ?? empresa?.telefono ?? empresa?.correo)}
            >
              <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-between" />}>
                Más opciones
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-4 border-t border-slate-200 p-3">
                <CampoFormulario htmlFor="direccion" label="Dirección">
                  <Input
                    id="direccion"
                    name="direccion"
                    maxLength={300}
                    defaultValue={empresa?.direccion ?? ""}
                    disabled={!puedeEditar}
                    className={FORM_INPUT}
                  />
                </CampoFormulario>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <CampoFormulario htmlFor="telefono" label="Teléfono">
                    <Input
                      id="telefono"
                      name="telefono"
                      maxLength={40}
                      defaultValue={empresa?.telefono ?? ""}
                      disabled={!puedeEditar}
                      className={FORM_INPUT}
                    />
                  </CampoFormulario>
                  <CampoFormulario htmlFor="correo" label="Correo">
                    <Input
                      id="correo"
                      name="correo"
                      type="email"
                      maxLength={200}
                      defaultValue={empresa?.correo ?? ""}
                      disabled={!puedeEditar}
                      className={FORM_INPUT}
                    />
                  </CampoFormulario>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </section>

        <FormDivider />

        <section>
          <FormSectionTitle descripcion="Se usa en el encabezado de los documentos. PNG, JPG o WebP de hasta 2 MB.">
            Logo
          </FormSectionTitle>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            {logo ? (
              // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
              <img src={logo} alt="Logo de la empresa" className="h-20 max-w-[220px] object-contain" />
            ) : (
              // biome-ignore lint/performance/noImgElement: logo por defecto de Medoxigas
              <img
                src="/marca/logo-medoxigas.png"
                alt="Logo de Medoxigas"
                className="h-20 max-w-[220px] object-contain"
              />
            )}

            {puedeEditar ? (
              <CampoFormulario htmlFor="logo" label="Subir imagen" className="min-w-0 flex-1">
                <Input
                  ref={inputLogo}
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={cambiarLogo}
                  className={FORM_INPUT}
                />
                <p className="text-muted-foreground text-xs">{LIMITE_LOGO_BYTES / (1024 * 1024)} MB como máximo.</p>
              </CampoFormulario>
            ) : null}
          </div>
        </section>
      </FormCard>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {guardado ? (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          Datos guardados.
        </p>
      ) : null}

      {puedeEditar ? (
        <FormActions>
          <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Upload />}
            Guardar
          </Button>
        </FormActions>
      ) : (
        <p className="text-muted-foreground text-sm">Solo el administrador puede cambiar los datos de la empresa.</p>
      )}
    </form>
  );
}
