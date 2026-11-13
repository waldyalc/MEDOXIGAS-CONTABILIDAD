import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "MEDOXIGAS ALC, SRL",
  version: packageJson.version,
  copyright: `© ${currentYear}, MEDOXIGAS ALC, SRL.`,
  meta: {
    title: "MEDOXIGAS ALC, SRL — OPP",
    description: "ERP interno de MEDOXIGAS ALC, SRL: producción de oxígeno líquido.",
  },
};
