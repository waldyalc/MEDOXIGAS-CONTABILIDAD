"use client";

import { type FormEvent, useState, useTransition } from "react";

import { cn } from "cn";
import { useShallow } from "zustand/react/shallow";

import { salir } from "@/app/login/actions";
import {
  CircleAlert,
  CircleCheck,
  Eye,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { validarCambioContrasena } from "@/lib/auth/perfil-validacion";
import type { Rol } from "@/lib/auth/rol";
import { limpiarCachePOS } from "@/lib/cache-pos";
import { formatoFechaHora } from "@/lib/formato";
import type { ThemeMode } from "@/lib/preferences/theme";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { cambiarContrasena, cerrarTodasLasSesiones } from "../actions";

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  contador: "Contador",
  lector: "Lector",
};

function inicialesPerfil(nombre: string | null, correo: string | null) {
  const limpio = nombre?.trim() ?? "";
  if (limpio) {
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      return `${partes[0]?.charAt(0) ?? ""}${partes[partes.length - 1]?.charAt(0) ?? ""}`.toUpperCase();
    }
    return limpio.charAt(0).toUpperCase();
  }
  return correo?.trim().charAt(0).toUpperCase() || "?";
}

function metodoAcceso(proveedores: readonly string[]) {
  const normalizados = proveedores.map((proveedor) => proveedor.toLowerCase());
  const tieneCorreo = normalizados.includes("email");
  const tieneGoogle = normalizados.includes("google");

  if (tieneCorreo && tieneGoogle) return "Correo y contraseña · Google";
  if (tieneGoogle) return "Google";
  return "Correo y contraseña";
}

function CampoContrasena({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (valor: string) => void;
  readonly autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
          className="h-9 pr-10"
        />
        <button
          type="button"
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          onClick={() => setVisible((actual) => !actual)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg outline-none focus-visible:ring-2"
        >
          <Eye aria-hidden className={cn("size-4", visible && "text-primary")} />
        </button>
      </div>
    </div>
  );
}

function BotonModoTema({
  modo,
  etiqueta,
  icono: Icono,
  activo,
  onClick,
}: {
  readonly modo: ThemeMode;
  readonly etiqueta: string;
  readonly icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  readonly activo: boolean;
  readonly onClick: (modo: ThemeMode) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={() => onClick(modo)}
      className={cn(
        "focus-visible:ring-ring flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2",
        activo ? "bg-background text-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icono aria-hidden className="size-4" />
      {etiqueta}
    </button>
  );
}

export function PerfilSeguridadCliente({
  nombre,
  correo,
  rol,
  creadoEn,
  ultimoAcceso,
  proveedores,
}: {
  readonly nombre: string | null;
  readonly correo: string | null;
  readonly rol: Rol;
  readonly creadoEn: string | null;
  readonly ultimoAcceso: string | null;
  readonly proveedores: readonly string[];
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [errorContrasena, setErrorContrasena] = useState<string | null>(null);
  const [contrasenaActualizada, setContrasenaActualizada] = useState(false);
  const [actualizando, startActualizacion] = useTransition();
  const [saliendo, startSalida] = useTransition();
  const [cerrandoTodas, startCierreGlobal] = useTransition();
  const { themeMode, setPreference } = usePreferencesStore(
    useShallow((state) => ({
      themeMode: state.values.theme_mode,
      setPreference: state.setPreference,
    })),
  );

  const nombreVisible = nombre?.trim() || correo || "Usuario";

  function enviarCambioContrasena(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorContrasena(null);
    setContrasenaActualizada(false);

    const validacion = validarCambioContrasena({ actual, nueva, confirmar });
    if (!validacion.ok) {
      setErrorContrasena(validacion.error);
      return;
    }

    startActualizacion(async () => {
      const resultado = await cambiarContrasena({ actual, nueva, confirmar });

      if (!resultado.ok) {
        setErrorContrasena(resultado.error);
        toast.add({
          type: "error",
          title: "No se pudo actualizar la contraseña",
          description: resultado.error,
        });
        return;
      }

      setActual("");
      setNueva("");
      setConfirmar("");
      setContrasenaActualizada(true);
      toast.add({
        type: "success",
        title: "Contraseña actualizada",
        description: "Tu nueva contraseña ya está activa.",
      });
    });
  }

  function cerrarSesionEsteDispositivo() {
    startSalida(async () => {
      try {
        await limpiarCachePOS();
      } finally {
        await salir();
      }
    });
  }

  function cerrarSesionGlobal() {
    startCierreGlobal(async () => {
      try {
        await limpiarCachePOS();
      } finally {
        await cerrarTodasLasSesiones();
      }
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Datos del perfil</CardTitle>
          <CardDescription>Tu identidad dentro de Medoxigas Contabilidad.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary dark:bg-primary/20 flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
            >
              {inicialesPerfil(nombre, correo)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-foreground truncate text-base font-semibold">{nombreVisible}</p>
                <span className="bg-primary/10 text-primary dark:bg-primary/20 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {ETIQUETA_ROL[rol]}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 truncate text-sm">{correo ?? "Sin correo"}</p>
            </div>
          </div>

          <dl className="grid gap-4 border-t pt-5 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Método de acceso</dt>
              <dd className="text-sm font-medium">{metodoAcceso(proveedores)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Cuenta creada</dt>
              <dd className="text-sm font-medium">{formatoFechaHora(creadoEn)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Último acceso</dt>
              <dd className="text-sm font-medium">{formatoFechaHora(ultimoAcceso)}</dd>
            </div>
          </dl>

          <p className="text-muted-foreground bg-muted/60 flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
            <ShieldCheck aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
            Tu correo y tu rol son administrados por el administrador del sistema. Si necesitas cambiarlos, solicita la
            actualización al administrador.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seguridad y contraseña</CardTitle>
          <CardDescription>Cambia tu contraseña confirmando primero la contraseña actual.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={enviarCambioContrasena} className="flex flex-col gap-4">
            <CampoContrasena
              id="actual"
              label="Contraseña actual"
              value={actual}
              onChange={setActual}
              autoComplete="current-password"
            />
            <CampoContrasena
              id="nueva"
              label="Nueva contraseña"
              value={nueva}
              onChange={setNueva}
              autoComplete="new-password"
            />
            <CampoContrasena
              id="confirmar"
              label="Confirmar nueva contraseña"
              value={confirmar}
              onChange={setConfirmar}
              autoComplete="new-password"
            />

            <p className="text-muted-foreground text-xs">
              Usa al menos 8 caracteres, con una letra y un número. La nueva contraseña debe ser diferente de la actual.
            </p>

            {errorContrasena ? (
              <p role="alert" className="text-destructive flex items-start gap-2 text-sm">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {errorContrasena}
              </p>
            ) : null}
            {contrasenaActualizada ? (
              <p role="status" className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
                Contraseña actualizada correctamente.
              </p>
            ) : null}

            <Button type="submit" disabled={actualizando} className="mt-1 w-full sm:w-fit">
              {actualizando ? <Loader2 aria-hidden className="animate-spin" /> : <Lock aria-hidden />}
              {actualizando ? "Actualizando…" : "Actualizar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apariencia y sesiones</CardTitle>
          <CardDescription>
            Elige cómo se ve la aplicación y controla dónde permanece abierta tu sesión.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Tema</Label>
            <fieldset aria-label="Tema" className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
              <BotonModoTema
                modo="light"
                etiqueta="Claro"
                icono={Sun}
                activo={themeMode === "light"}
                onClick={(modo) => setPreference("theme_mode", modo)}
              />
              <BotonModoTema
                modo="dark"
                etiqueta="Oscuro"
                icono={Moon}
                activo={themeMode === "dark"}
                onClick={(modo) => setPreference("theme_mode", modo)}
              />
              <BotonModoTema
                modo="system"
                etiqueta="Sistema"
                icono={Monitor}
                activo={themeMode === "system"}
                onClick={(modo) => setPreference("theme_mode", modo)}
              />
            </fieldset>
          </div>

          <div className="flex flex-col gap-3 border-t pt-5">
            <div>
              <p className="text-sm font-medium">Sesiones activas</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Cierra solo este dispositivo o termina todas las sesiones abiertas con tu cuenta.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button
                type="button"
                variant="outline"
                disabled={saliendo || cerrandoTodas}
                onClick={cerrarSesionEsteDispositivo}
                className="justify-start"
              >
                {saliendo ? <Loader2 aria-hidden className="animate-spin" /> : <LogOut aria-hidden />}
                {saliendo ? "Cerrando…" : "Cerrar sesión en este dispositivo"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={saliendo || cerrandoTodas}
                onClick={cerrarSesionGlobal}
                className="justify-start"
              >
                {cerrandoTodas ? <Loader2 aria-hidden className="animate-spin" /> : <ShieldCheck aria-hidden />}
                {cerrandoTodas ? "Cerrando sesiones…" : "Cerrar sesión en todos los dispositivos"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
