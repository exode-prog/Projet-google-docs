require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
const { Server } = require("socket.io");
const { PeerServer } = require("peer");
const app = require("./app");
const { attachChat } = require("./sockets/chat");

const PORT = process.env.PORT || 3443;
const PEER_PORT = process.env.PEER_PORT || 9000;

// HTTPS obligatoire dès le socle : Socket.io et WebRTC (PeerJS) en dépendront
// dans les prochains modules, autant le poser correctement dès maintenant.
const options = {
  key: fs.readFileSync(path.join(__dirname, "..", "certificates", "projet_docs-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "..", "certificates", "projet_docs-cert.pem")),
};

const server = https.createServer(options, app);

// Socket.io s'attache au même serveur HTTPS que l'API REST (un seul port à gérer).
// Même liste d'origines autorisées que l'API REST (voir app.js), pour rester
// cohérent plutôt que de laisser Socket.io ouvert à "*".
// Documentation officielle : https://socket.io/docs/v4/server-initialization/
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "https://localhost:5173")
  .split(",")
  .map((o) => o.trim());
const io = new Server(server, {
  cors: { origin: allowedOrigins },
});
attachChat(io);

// PeerServer : reprend exactement le principe déjà validé dans le PoC PeerJS,
// mais sur son propre port dédié (comme dans le PoC initial), en réutilisant
// le même certificat HTTPS que le reste du backend.
// Documentation officielle : https://github.com/peers/peerjs-server
PeerServer({ port: PEER_PORT, path: "/peer", ssl: options, host: "0.0.0.0" });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur backend démarré sur https://localhost:${PORT}`);
  console.log(`Vérification de santé : https://localhost:${PORT}/api/health`);
  console.log(`Serveur PeerJS démarré sur https://localhost:${PEER_PORT}/peer`);
});
