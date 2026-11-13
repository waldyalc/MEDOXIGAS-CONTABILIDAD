import type { ReactNode } from "react";

export const metadata = { title: "Entrar" };

export default function LoginLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <main>{children}</main>;
}
