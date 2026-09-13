import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// Les mêmes certificats auto-signés que le backend sont réutilisés ici : le
// frontend doit lui aussi tourner en HTTPS, sinon les navigateurs bloquent
// l'accès à la caméra/au micro (WebRTC) sur toute origine non sécurisée
// (documentation officielle Vite : server.https accepte un objet
// https.createServer(), voir https://vite.dev/config/server-options.html#server-https).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(import.meta.dirname, "../backend/certificates/projet_docs-key.pem")),
      cert: fs.readFileSync(path.resolve(import.meta.dirname, "../backend/certificates/projet_docs-cert.pem")),
    },
  },
});
