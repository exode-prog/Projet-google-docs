const { Client } = require("minio");

// Client MinIO (API compatible S3). Toutes les valeurs viennent de .env :
// aucune donnée d'accès ne doit être écrite en dur dans le code.
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT, 10) || 9010,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
});

const BUCKET = process.env.MINIO_BUCKET || "projetdocs";

// S'assure que le bucket existe au démarrage du serveur (utile en développement ;
// en production le bucket est généralement créé une fois pour toutes, comme on
// vient de le faire manuellement via la console MinIO).
async function ensureBucketExists() {
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`Bucket MinIO "${BUCKET}" créé.`);
  }
}

module.exports = { minioClient, BUCKET, ensureBucketExists };
