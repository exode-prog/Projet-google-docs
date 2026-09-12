const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// GET /api/health
// Vérifie que l'API répond ET que la connexion à PostgreSQL fonctionne réellement
// (utile pour diagnostiquer rapidement un problème de configuration ou de réseau).
router.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS server_time");
    res.json({
      status: "ok",
      api: "up",
      database: "connected",
      server_time: result.rows[0].server_time,
    });
  } catch (err) {
    console.error("Health check - erreur de connexion à la base :", err.message);
    res.status(503).json({
      status: "error",
      api: "up",
      database: "unreachable",
      error: err.message,
    });
  }
});

module.exports = router;
