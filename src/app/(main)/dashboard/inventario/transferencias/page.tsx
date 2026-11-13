import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarTransferencias } from "@/lib/inventario/consultas";

import { TransferenciasTabla } from "./_components/transferencias-tabla";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const transferencias = await listarTransferencias();

  return <TransferenciasTabla transferencias={transferencias} puedeEscribir={rol !== "lector"} />;
}
