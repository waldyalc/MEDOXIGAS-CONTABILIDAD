import type { ComponentProps } from "react";

import Link from "next/link";

import { cn } from "cn";

export function Enlace({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn("text-primary underline-offset-4 hover:underline print:text-inherit print:no-underline", className)}
    />
  );
}
