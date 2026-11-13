import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  return (
    <NativeSelect
      id={id}
      name={name}
      defaultValue={valor ?? ""}
      required={requerido}
      disabled={deshabilitado}
      className="min-w-56"
    >
      {todas ? <NativeSelectOption value="">{etiquetaTodas}</NativeSelectOption> : null}
      {!todas ? <NativeSelectOption value="">Elige una cuenta</NativeSelectOption> : null}
      {cuentas.map((cuenta) => (
        <NativeSelectOption key={cuenta.id} value={cuenta.codigo}>
          {cuenta.codigo} · {cuenta.nombre}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
