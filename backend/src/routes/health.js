const express = require("express");
const pool = require("../config/db");

const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Santé]
 *     summary: Vérifie que l'API et la connexion PostgreSQL fonctionnent
 *     security: []
 *     responses:
 *       200: { description: Tout fonctionne }
 *       503: { description: Base de données injoignable }
 */
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
