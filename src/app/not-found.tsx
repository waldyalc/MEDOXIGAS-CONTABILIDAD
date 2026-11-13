"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center space-y-2 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada.</h1>
      <p className="text-muted-foreground">La página que buscas no existe.</p>
      <Link prefetch={false} replace href="/dashboard">
        <Button variant="outline">Volver al inicio</Button>
      </Link>
    </div>
  );
}
