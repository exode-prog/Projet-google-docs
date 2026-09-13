-- Migration 005 : correctif suite à un malentendu sur la migration 004.
--
-- Comportement voulu, clarifié : l'administrateur n'a aucun moyen de
-- supprimer un document précis (seul le propriétaire du document peut le
-- faire, via l'API documents existante). En revanche, s'il supprime un
-- COMPTE entier, tout ce qui appartient à ce compte doit disparaître avec —
-- y compris ses documents. On revient donc à ON DELETE CASCADE sur
-- document.owner_id (annule le SET NULL introduit par la migration 004).
--
-- is_active (ajouté en 004) est conservé tel quel : il sert à désactiver un
-- compte sans le supprimer, ce qui reste voulu.

ALTER TABLE document DROP CONSTRAINT IF EXISTS document_owner_id_fkey;
ALTER TABLE document
  ADD CONSTRAINT document_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES utilisateur(id) ON DELETE CASCADE;
