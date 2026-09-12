const { Pool } = require("pg");

// Le pool lit ses paramètres depuis les variables d'environnement (voir .env.example).
// Il est partagé par toute l'application : on ne recrée jamais une connexion à la main.
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on("error", (err) => {
  // Erreur sur une connexion inactive du pool (ex : coupure réseau avec Postgres)
  console.error("Erreur inattendue du pool PostgreSQL :", err);
});

module.exports = pool;
