"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ChevronDown, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { guardarEmpresa } from "@/lib/configuracion/acciones";
import { extensionLogo, LIMITE_LOGO_BYTES, validarLogo } from "@/lib/configuracion/validacion";
import type { Empresa } from "@/lib/facturacion/tipos";
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
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos de la empresa</CardTitle>
          <CardDescription>Así aparecen el nombre y los datos en facturas, cotizaciones y conduces.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nombre">Nombre *</FieldLabel>
                <Input
                  id="nombre"
                  name="nombre"
                  required
                  maxLength={200}
                  defaultValue={empresa?.nombre ?? ""}
                  disabled={!puedeEditar}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rnc">RNC</FieldLabel>
                <Input id="rnc" name="rnc" maxLength={20} defaultValue={empresa?.rnc ?? ""} disabled={!puedeEditar} />
              </Field>
            </div>

            <Collapsible
              className="rounded-lg border"
              defaultOpen={Boolean(empresa?.direccion ?? empresa?.telefono ?? empresa?.correo)}
            >
              <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-between" />}>
                Más opciones
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
                <Field>
                  <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
                  <Input
                    id="direccion"
                    name="direccion"
                    maxLength={300}
                    defaultValue={empresa?.direccion ?? ""}
                    disabled={!puedeEditar}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
                    <Input
                      id="telefono"
                      name="telefono"
                      maxLength={40}
                      defaultValue={empresa?.telefono ?? ""}
                      disabled={!puedeEditar}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="correo">Correo</FieldLabel>
                    <Input
                      id="correo"
                      name="correo"
                      type="email"
                      maxLength={200}
                      defaultValue={empresa?.correo ?? ""}
                      disabled={!puedeEditar}
                    />
                  </Field>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Se usa en el encabezado de los documentos. PNG, JPG o WebP de hasta 2 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-5">
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
              <div className="flex min-w-0 flex-col gap-2">
                <FieldLabel htmlFor="logo">Subir imagen</FieldLabel>
                <Input
                  ref={inputLogo}
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={cambiarLogo}
                />
                <p className="text-muted-foreground text-xs">{LIMITE_LOGO_BYTES / (1024 * 1024)} MB como máximo.</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

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
        <div className="flex justify-end">
          <Button type="submit" disabled={pendiente}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Upload />}
            Guardar
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Solo el administrador puede cambiar los datos de la empresa.</p>
      )}
    </form>
  );
}
