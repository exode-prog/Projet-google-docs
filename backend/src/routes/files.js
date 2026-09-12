const express = require("express");
const multer = require("multer");
const pool = require("../config/db");
const { requireAuth } = require("../middlewares/auth");
const { getRole } = require("../utils/permissions");
const { minioClient, BUCKET } = require("../config/minio");

const router = express.Router({ mergeParams: true }); // mergeParams pour lire :id (documentId) du routeur parent

// Fichiers gardés en mémoire le temps de l'upload vers MinIO (pas d'écriture disque
// intermédiaire), avec une limite de taille pour éviter les abus (25 Mo ici).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(requireAuth);

// POST /api/documents/:id/files
// Upload d'un fichier attaché au document. Réservé à owner et editor (pas viewer).
router.post("/", upload.single("file"), async (req, res) => {
  const documentId = req.params.id;
  const role = await getRole(documentId, req.user.id);
  if (!role || role === "viewer") {
    return res.status(403).json({ status: "error", message: "Droit insuffisant pour ajouter un fichier à ce document" });
  }

  if (!req.file) {
    return res.status(400).json({ status: "error", message: "Aucun fichier reçu (champ attendu : 'file')" });
  }

  // Clé unique dans le bucket : on préfixe par l'id du document pour que chaque
  // document ait son propre "dossier" logique dans le bucket partagé.
  const minioKey = `${documentId}/${Date.now()}-${req.file.originalname}`;

  try {
    await minioClient.putObject(BUCKET, minioKey, req.file.buffer, req.file.size, {
      "Content-Type": req.file.mimetype,
    });

    const result = await pool.query(
      `INSERT INTO fichier (document_id, minio_key, filename, size, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, size, mime_type`,
      [documentId, minioKey, req.file.originalname, req.file.size, req.file.mimetype]
    );

    res.status(201).json({ status: "ok", file: result.rows[0] });
  } catch (err) {
    console.error("Erreur upload fichier :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de l'envoi du fichier" });
  }
});

// GET /api/documents/:id/files
// Liste les fichiers d'un document. Accessible à owner, editor et viewer.
router.get("/", async (req, res) => {
  const documentId = req.params.id;
  const role = await getRole(documentId, req.user.id);
  if (!role) {
    return res.status(403).json({ status: "error", message: "Accès refusé à ce document" });
  }

  try {
    const result = await pool.query(
      "SELECT id, filename, size, mime_type FROM fichier WHERE document_id = $1 ORDER BY id",
      [documentId]
    );
    res.json({ status: "ok", files: result.rows });
  } catch (err) {
    console.error("Erreur liste fichiers :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération des fichiers" });
  }
});

// GET /api/documents/:id/files/:fileId/download
// Génère une URL de téléchargement temporaire (valable 5 minutes) plutôt que de
// rendre le bucket public : c'est MinIO qui sert le fichier, pas notre backend.
router.get("/:fileId/download", async (req, res) => {
  const documentId = req.params.id;
  const role = await getRole(documentId, req.user.id);
  if (!role) {
    return res.status(403).json({ status: "error", message: "Accès refusé à ce document" });
  }

  try {
    const result = await pool.query(
      "SELECT minio_key, filename FROM fichier WHERE id = $1 AND document_id = $2",
      [req.params.fileId, documentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Fichier introuvable" });
    }

    const { minio_key: minioKey } = result.rows[0];
    const url = await minioClient.presignedGetObject(BUCKET, minioKey, 5 * 60);
    res.json({ status: "ok", download_url: url });
  } catch (err) {
    console.error("Erreur génération lien de téléchargement :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la génération du lien" });
  }
});

// DELETE /api/documents/:id/files/:fileId
// Suppression réservée à owner et editor.
router.delete("/:fileId", async (req, res) => {
  const documentId = req.params.id;
  const role = await getRole(documentId, req.user.id);
  if (!role || role === "viewer") {
    return res.status(403).json({ status: "error", message: "Droit insuffisant pour supprimer ce fichier" });
  }

  try {
    const result = await pool.query(
      "SELECT minio_key FROM fichier WHERE id = $1 AND document_id = $2",
      [req.params.fileId, documentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Fichier introuvable" });
    }

    await minioClient.removeObject(BUCKET, result.rows[0].minio_key);
    await pool.query("DELETE FROM fichier WHERE id = $1", [req.params.fileId]);

    res.json({ status: "ok", message: "Fichier supprimé" });
  } catch (err) {
    console.error("Erreur suppression fichier :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la suppression du fichier" });
  }
});

module.exports = router;
