"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { FORM_BUTTON, FORM_TEXTAREA, FormCard, FormField, FormSectionTitle } from "@/components/formularios/formulario";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { guardarPlantillaImpresion } from "@/lib/plantillas-impresion/acciones";
import { ETIQUETAS_PLANTILLA, type PlantillaImpresion } from "@/lib/plantillas-impresion/tipos";

function FormularioPlantilla({
  plantilla,
  puedeEditar,
}: {
  readonly plantilla: PlantillaImpresion;
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [notas, setNotas] = useState(plantilla.notas_pie ?? "");
  const [terminos, setTerminos] = useState(plantilla.terminos ?? "");
  const [mostrarLogo, setMostrarLogo] = useState(plantilla.mostrar_logo);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);

    iniciar(async () => {
      const resultado = await guardarPlantillaImpresion({
        tipo_documento: plantilla.tipo_documento,
        notas_pie: notas,
        terminos,
        mostrar_logo: mostrarLogo,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <FormCard>
      <FormSectionTitle
        descripcion={
          plantilla.tipo_documento === "factura"
            ? "Plantilla base: si cotización o conduce no tienen textos, se usan estos."
            : "Si dejas los textos vacíos, se usan los de la factura."
        }
      >
        {ETIQUETAS_PLANTILLA[plantilla.tipo_documento]}
      </FormSectionTitle>
      <div className="flex flex-col gap-4">
        <FormField htmlFor={`notas-${plantilla.tipo_documento}`} label="Notas al pie">
          <Textarea
            id={`notas-${plantilla.tipo_documento}`}
            value={notas}
            onChange={(evento) => setNotas(evento.target.value)}
            maxLength={2000}
            placeholder="Ej. Gracias por su compra"
            disabled={!puedeEditar || pendiente}
            className={FORM_TEXTAREA}
          />
        </FormField>
        <FormField htmlFor={`terminos-${plantilla.tipo_documento}`} label="Términos y condiciones">
          <Textarea
            id={`terminos-${plantilla.tipo_documento}`}
            value={terminos}
            onChange={(evento) => setTerminos(evento.target.value)}
            maxLength={2000}
            placeholder="Ej. Pago a 30 días"
            disabled={!puedeEditar || pendiente}
            className={FORM_TEXTAREA}
          />
        </FormField>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`logo-${plantilla.tipo_documento}`}>Mostrar logo</Label>
          <Switch
            id={`logo-${plantilla.tipo_documento}`}
            checked={mostrarLogo}
            onCheckedChange={setMostrarLogo}
            disabled={!puedeEditar || pendiente}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {puedeEditar ? (
          <div className="flex justify-end">
            <Button type="button" onClick={guardar} disabled={pendiente} className={FORM_BUTTON}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Guardar plantilla
            </Button>
          </div>
        ) : null}
      </div>
    </FormCard>
  );
}

export function PlantillasCliente({
  plantillas,
  puedeEditar,
}: {
  readonly plantillas: PlantillaImpresion[];
  readonly puedeEditar: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {plantillas.map((plantilla) => (
        <FormularioPlantilla key={plantilla.tipo_documento} plantilla={plantilla} puedeEditar={puedeEditar} />
      ))}
    </div>
  );
}
