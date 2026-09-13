const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const documentsRoutes = require("./routes/documents");
const filesRoutes = require("./routes/files");
const messagesRoutes = require("./routes/messages");
const adminRoutes = require("./routes/admin");

const app = express();

// helmet règle en une fois plusieurs en-têtes de sécurité HTTP standards :
// HSTS, X-Content-Type-Options, retrait de X-Powered-By, protection anti-
// clickjacking, etc. Documentation officielle : https://helmetjs.github.io/
// contentSecurityPolicy est désactivé ici : par défaut trop strict pour une
// API pure (pas de pages HTML servies), il bloquerait par exemple Swagger UI.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS restreint à une liste d'origines autorisées, plutôt qu'ouvert à "*"
// (n'importe quel site web pourrait sinon appeler notre API directement
// depuis le navigateur d'un utilisateur connecté). Plusieurs origines
// peuvent être listées séparées par des virgules dans FRONTEND_ORIGIN (utile
// pour accepter à la fois localhost et l'IP réelle du serveur, par exemple).
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "https://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origine non autorisée par CORS"));
      }
    },
  })
);

app.use(express.json());

// Documentation interactive de l'API (Swagger UI), générée depuis openapi.json.
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Toutes les routes de l'API sont préfixées par /api pour bien les séparer
// d'un éventuel futur contenu statique (frontend React en production, par exemple).
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/documents/:id/files", filesRoutes);
app.use("/api/documents/:id/messages", messagesRoutes);
app.use("/api/admin", adminRoutes);

// Route racine simple, utile pour vérifier rapidement que le serveur répond.
app.get("/", (req, res) => {
  res.json({ message: "API du projet collaboratif - voir /api/health" });
});

// Gestion des routes inconnues
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route non trouvée" });
});

// Gestionnaire d'erreurs global (doit rester en dernier)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "Erreur interne du serveur" });
});

module.exports = app;
