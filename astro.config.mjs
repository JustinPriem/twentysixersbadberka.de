import { defineConfig } from "astro/config";

// Statischer Export (SSG) – wird per FTP zu Strato-Webhosting deployed.
// Siehe README.md für den Deployment-Workflow.
export default defineConfig({
  site: "https://twentysixersbadberka.de",
  output: "static",
  compressHTML: true,
});
