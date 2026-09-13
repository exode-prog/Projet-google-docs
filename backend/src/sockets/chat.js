const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { getRole } = require("../utils/permissions");

// Middleware d'authentification Socket.io : même logique que le middleware HTTP
// (middlewares/auth.js), mais le token arrive via le handshake, pas un en-tête.
// Documentation officielle : https://socket.io/docs/v4/middlewares/
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentification requise"));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    console.error("Erreur d'authentification Socket.io :", err.message);
    next(new Error("Token invalide ou expiré"));
  }
}

// Attache toute la logique de chat à l'instance Socket.io créée dans server.js.
function attachChat(io) {
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log(`Socket connecté : ${socket.id} (utilisateur ${socket.user.email})`);
    // Un client rejoint le salon (room) d'un document, après vérification de ses droits.
    // Documentation Socket.io - Rooms : https://socket.io/docs/v4/rooms/
    socket.on("join_document", async (documentId, callback) => {
      const role = await getRole(documentId, socket.user.id);
      if (!role) {
        return callback?.({ status: "error", message: "Accès refusé à ce document" });
      }

      socket.join(documentId);
      socket.to(documentId).emit("presence", {
        type: "joined",
        userId: socket.user.id,
        email: socket.user.email,
        name: socket.user.name,
      });

      callback?.({ status: "ok", role });
    });

    // Envoi d'un message : revérifié côté serveur (jamais confiance au client),
    // persisté en base, puis diffusé à tous les participants du salon.
    socket.on("send_message", async ({ documentId, content }, callback) => {
      const role = await getRole(documentId, socket.user.id);
      if (!role) {
        return callback?.({ status: "error", message: "Accès refusé à ce document" });
      }
      if (!content || !content.trim()) {
        return callback?.({ status: "error", message: "Message vide" });
      }

      try {
        const result = await pool.query(
          `INSERT INTO message (document_id, user_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, content, created_at`,
          [documentId, socket.user.id, content.trim()]
        );

        const message = {
          ...result.rows[0],
          user_id: socket.user.id,
          email: socket.user.email,
        name: socket.user.name,
        };

        io.to(documentId).emit("new_message", message);
        callback?.({ status: "ok", message });
      } catch (err) {
        console.error("Erreur envoi message :", err.message);
        callback?.({ status: "error", message: "Erreur lors de l'envoi du message" });
      }
    });

    // Signalisation d'appel audio/vidéo (PeerJS/WebRTC) : le client annonce son
    // peerId (voir server.js pour le PeerServer) une fois connecté à PeerJS, et
    // les autres participants du document en sont informés pour pouvoir
    // l'appeler automatiquement — sans avoir à saisir un ID à la main, comme
    // c'était le cas dans le PoC initial.
    socket.on("call:announce", async ({ documentId, peerId }, callback) => {
      const role = await getRole(documentId, socket.user.id);
      if (!role) {
        return callback?.({ status: "error", message: "Accès refusé à ce document" });
      }

      socket.to(documentId).emit("call:peer_joined", {
        peerId,
        userId: socket.user.id,
        email: socket.user.email,
        name: socket.user.name,
      });

      callback?.({ status: "ok" });
    });

    // "disconnecting" (et non "disconnect") : à ce stade, socket.rooms contient
    // encore les salons que le client s'apprête à quitter, ce qui permet de
    // prévenir les autres participants avant qu'il ne parte réellement.
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit("presence", {
            type: "left",
            userId: socket.user.id,
            email: socket.user.email,
        name: socket.user.name,
          });
          // Prévient aussi les participants d'un éventuel appel en cours,
          // pour qu'ils puissent fermer leur connexion PeerJS proprement.
          socket.to(room).emit("call:peer_left", {
            userId: socket.user.id,
            email: socket.user.email,
        name: socket.user.name,
          });
        }
      }
    });
  });
}

module.exports = { attachChat };
