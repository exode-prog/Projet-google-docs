const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const documentsRoutes = require("./routes/documents");

const app = express();

app.use(cors());
app.use(express.json());

// Toutes les routes de l'API sont préfixées par /api pour bien les séparer
// d'un éventuel futur contenu statique (frontend React en production, par exemple).
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentsRoutes);

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
