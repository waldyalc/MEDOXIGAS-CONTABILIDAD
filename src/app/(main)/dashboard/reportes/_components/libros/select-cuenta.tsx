import { SelectCampo } from "@/components/select-campo";
import type { CuentaContable } from "@/lib/reportes/tipos";

interface Props {
  id?: string;
  name?: string;
  cuentas: readonly CuentaContable[];
  valor?: string | null;
  requerido?: boolean;
  todas?: boolean;
  etiquetaTodas?: string;
  deshabilitado?: boolean;
}

export function SelectCuenta({
  id = "cuenta",
  name = "cuenta",
  cuentas,
  valor,
  requerido = false,
  todas = false,
  etiquetaTodas = "Todas las cuentas",
  deshabilitado = false,
}: Props) {
  const opciones = cuentas.map((cuenta) => ({
    value: cuenta.codigo,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));

  return (
    <SelectCampo
      id={id}
      name={name}
      opciones={opciones}
      valorInicial={valor ?? ""}
      etiquetaVacia={todas ? etiquetaTodas : "Elige una cuenta"}
      buscable
      requerido={requerido}
      deshabilitado={deshabilitado}
      className="min-w-56"
    />
  );
}
