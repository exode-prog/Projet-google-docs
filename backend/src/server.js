require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
const app = require("./app");

const PORT = process.env.PORT || 3443;

// HTTPS obligatoire dès le socle : Socket.io et WebRTC (PeerJS) en dépendront
// dans les prochains modules, autant le poser correctement dès maintenant.
const options = {
  key: fs.readFileSync(path.join(__dirname, "..", "certificates", "projet_docs-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "..", "certificates", "projet_docs-cert.pem")),
};

const server = https.createServer(options, app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur backend démarré sur https://localhost:${PORT}`);
  console.log(`Vérification de santé : https://localhost:${PORT}/api/health`);
});
