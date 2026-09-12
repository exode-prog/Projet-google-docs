-- Migration 001 : mise en place du schéma initial (MPD - section 3.5.3 du cahier des charges)
-- À exécuter sur la base "projet_collab" (PostgreSQL 14+)

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- fournit gen_random_uuid()

CREATE TABLE utilisateur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES utilisateur(id) ON DELETE CASCADE,
  etherpad_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE permission (
  document_id UUID REFERENCES document(id) ON DELETE CASCADE,
  user_id UUID REFERENCES utilisateur(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  PRIMARY KEY (document_id, user_id)
);

CREATE TABLE message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES document(id) ON DELETE CASCADE,
  user_id UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE fichier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES document(id) ON DELETE CASCADE,
  minio_key VARCHAR(255) NOT NULL,
  filename VARCHAR(255),
  size INT,
  mime_type VARCHAR(100)
);

-- Index utiles pour les requêtes fréquentes de l'application
CREATE INDEX idx_document_owner ON document(owner_id);
CREATE INDEX idx_permission_user ON permission(user_id);
CREATE INDEX idx_message_document ON message(document_id);
CREATE INDEX idx_fichier_document ON fichier(document_id);
