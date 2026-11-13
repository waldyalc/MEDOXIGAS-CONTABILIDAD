import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Medoxigas Contabilidad",
  version: packageJson.version,
  copyright: `© ${currentYear}, Medoxigas Contabilidad.`,
  meta: {
    title: "Medoxigas Contabilidad",
    description: "Sistema de contabilidad y facturación de MEDOXIGAS ALC, SRL.",
  },
};
