import type { ReactNode } from "react";

import { ProveedorCargaReportes } from "./_components/proveedor-carga-reportes";

export default function ReportesLayout({ children }: { children: ReactNode }) {
  return <ProveedorCargaReportes>{children}</ProveedorCargaReportes>;
}
