// Clasificación fiscal por cuenta contable: la cuenta del renglón o su cuenta
// madre, como la resuelve Alegra al exportar 606/607.

export interface CuentaDgiiDb {
  id: string;
  codigo: string;
  nombre: string;
  padre_id: string | null;
  categoria_dgii: string | null;
  tipo_compra: string | null;
  tipo_ingreso: string | null;
}

export type CatalogoCuentasDgii = ReadonlyMap<string, CuentaDgiiDb>;

export interface ClasificacionCuenta {
  cuentaId: string;
  nombre: string;
  categoriaDgii: string | null;
  tipoCompra: "bienes" | "servicio" | null;
  tipoIngreso: string | null;
}

function tipoCompraValido(valor: string | null): "bienes" | "servicio" | null {
  if (valor === "bienes" || valor === "servicio") return valor;
  return null;
}

export function resolverClasificacionCuenta(
  catalogo: CatalogoCuentasDgii,
  cuentaId: string | null | undefined,
): ClasificacionCuenta | null {
  if (cuentaId == null || cuentaId === "") return null;

  const base = catalogo.get(cuentaId);
  if (base == null) return null;

  let categoriaDgii = base.categoria_dgii;
  let tipoCompra = tipoCompraValido(base.tipo_compra);
  let tipoIngreso = base.tipo_ingreso;
  let actual: CuentaDgiiDb | undefined = base;

  for (let nivel = 0; nivel < 10 && actual?.padre_id != null; nivel += 1) {
    const padre = catalogo.get(actual.padre_id);
    if (padre == null) break;
    categoriaDgii ??= padre.categoria_dgii;
    tipoCompra ??= tipoCompraValido(padre.tipo_compra);
    tipoIngreso ??= padre.tipo_ingreso;
    actual = padre;
  }

  return { cuentaId: base.id, nombre: base.nombre, categoriaDgii, tipoCompra, tipoIngreso };
}

/** Categoría / tipo con mayor monto en el documento (el resto no se pierde: se suma aparte). */
export function valorPrincipal(montos: ReadonlyMap<string, number>): string | null {
  let elegido: string | null = null;
  let mayor = -1;

  for (const [valor, monto] of montos) {
    if (monto > mayor) {
      elegido = valor;
      mayor = monto;
    }
  }

  return elegido;
}
