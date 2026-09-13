# Documentation technique — Projet Collaboratif

Ce document complète le `README.md` avec le détail nécessaire pour installer, comprendre, tester et dépanner le projet.

## Sommaire

1. [Architecture détaillée](#1-architecture-détaillée)
2. [Prérequis](#2-prérequis)
3. [Installation, étape par étape](#3-installation-étape-par-étape)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [Modèle de données](#5-modèle-de-données)
6. [API et documentation Swagger](#6-api-et-documentation-swagger)
7. [Sécurité — mesures et résultats de tests](#7-sécurité--mesures-et-résultats-de-tests)
8. [Tests de charge](#8-tests-de-charge)
9. [Dépannage — problèmes rencontrés et solutions](#9-dépannage--problèmes-rencontrés-et-solutions)
10. [Déploiement](#10-déploiement)

---

## 1. Architecture détaillée

L'application repose sur une architecture en trois niveaux :

- **Client** : application React (SPA) consommant l'API REST et une connexion Socket.io permanente. Les appels audio/vidéo passent en pair-à-pair (WebRTC) entre navigateurs, la signalisation initiale passant par Socket.io.
- **Serveur** : backend Node.js/Express exposant l'API REST, un serveur Socket.io (même port HTTPS), et un serveur PeerJS dédié (signalisation WebRTC, port séparé).
- **Données** : PostgreSQL (données applicatives), MinIO (fichiers), Etherpad (contenu des documents collaboratifs, avec sa propre base PostgreSQL séparée).

### Pourquoi un reverse proxy devant Etherpad

L'image Docker officielle d'Etherpad ne termine pas le HTTPS elle-même. Un reverse proxy nginx a été ajouté (`etherpad-proxy.conf`) pour lui donner un certificat HTTPS, indispensable pour que le navigateur charge le pad dans une iframe sans être bloqué par la politique de contenu mixte (une page HTTPS ne peut pas charger de contenu HTTP en iframe).

### Pourquoi deux adresses différentes pour Etherpad

- Le **backend** appelle l'HTTP API d'Etherpad directement en HTTP interne, port 9001 (`ETHERPAD_BASE_URL`) — plus rapide, pas de certificat à valider entre deux process serveur.
- Le **navigateur** charge les pads via le reverse proxy HTTPS, port 9002 (`ETHERPAD_PUBLIC_URL`).

### Sécurité des pads Etherpad

Les documents ne sont pas des pads Etherpad "simples" (accessibles par quiconque connaît l'URL), mais des **pads de groupe** avec **sessions** :
1. À la création d'un document, le backend crée un groupe Etherpad puis un pad dans ce groupe (`document.etherpad_id` stocke `<groupID>$<padName>`).
2. À chaque ouverture, le backend mappe l'utilisateur à un auteur Etherpad et crée une session temporaire (24h), renvoyée au frontend.
3. Le frontend pose cette session comme cookie (`sessionID`) avant de charger l'iframe.
4. Etherpad est configuré avec `REQUIRE_SESSION=true` : sans session valide, l'accès est refusé, même en connaissant l'URL exacte du pad.

---

## 2. Prérequis

- Node.js 18+ (Node 22 utilisé en développement)
- Docker et Docker Compose
- PostgreSQL, MinIO, Etherpad : fournis via `docker-compose.yml`, aucune installation manuelle nécessaire
- Un certificat HTTPS auto-signé (généré avec `openssl`, voir plus bas)

---

## 3. Installation, étape par étape

### 3.1 Cloner et générer les certificats

```bash
git clone <url-du-depot>
cd projet-google-docs
mkdir -p backend/certificates
openssl req -x509 -newkey rsa:2048 \
  -keyout backend/certificates/projet_docs-key.pem \
  -out backend/certificates/projet_docs-cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

### 3.2 Générer la clé API Etherpad

```bash
mkdir -p etherpad-apikey
openssl rand -hex 16 | tr -d '\n' > etherpad-apikey/APIKEY.txt
```

### 3.3 Configurer les variables d'environnement

Trois fichiers `.env` distincts (voir section 4 pour le détail) :
```bash
cp docker/.env.example .env                    # à la racine, utilisé par docker-compose.yml
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Remplis chaque `.env` avec de vraies valeurs (mots de passe, adresse IP réelle du serveur).

### 3.4 Lancer les services conteneurisés

```bash
docker compose up -d
docker compose ps   # les 5 services doivent être "Up" / "healthy"
```

### 3.5 Base de données applicative

Les migrations dans `backend/db/migrations/` s'exécutent automatiquement au premier démarrage du conteneur PostgreSQL (montées sur `/docker-entrypoint-initdb.d`). Si la base existait déjà avant l'ajout d'une nouvelle migration, exécute-la manuellement :
```bash
docker exec -i <conteneur_postgres> psql -U <user> -d <db> < backend/db/migrations/00X_nom.sql
```

### 3.6 Récupérer la clé API Etherpad réellement utilisée

```bash
docker exec -it <conteneur_etherpad> cat /opt/etherpad-lite/APIKEY.txt
```
Reporte cette valeur dans `backend/.env` (`ETHERPAD_API_KEY`).

### 3.7 Backend

```bash
cd backend
npm install
npm start
```

### 3.8 Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3.9 Passer un compte en administrateur

```bash
docker exec -it <conteneur_postgres> psql -U <user> -d <db> \
  -c "UPDATE utilisateur SET is_admin = true WHERE email = 'ton_email';"
```
Déconnecte-toi puis reconnecte-toi dans l'application pour que le token reflète ce nouveau statut.

---

## 4. Variables d'environnement

### Racine (`.env`, utilisé par `docker-compose.yml`)

| Variable | Rôle |
|---|---|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Base applicative |
| `ETHERPAD_DB_NAME`, `ETHERPAD_DB_USER`, `ETHERPAD_DB_PASSWORD` | Base dédiée à Etherpad |
| `ETHERPAD_ADMIN_PASSWORD` | Interface d'admin Etherpad |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Identifiants MinIO |

### `backend/.env`

| Variable | Exemple | Rôle |
|---|---|---|
| `PORT` | `3443` | Port HTTPS de l'API |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | — | Connexion PostgreSQL applicative |
| `JWT_SECRET` | (générer avec `openssl rand -hex 32`) | Signature des tokens |
| `ETHERPAD_BASE_URL` | `http://localhost:9001` | Appels API backend → Etherpad (HTTP interne) |
| `ETHERPAD_PUBLIC_URL` | `https://<ip>:9002` | URL donnée au navigateur (via le proxy HTTPS) |
| `ETHERPAD_API_KEY` | — | Récupérée après premier démarrage (voir 3.6) |
| `MINIO_ENDPOINT` | **l'IP réelle du serveur**, pas `localhost` | Voir piège n°1 en section 9 |
| `MINIO_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET` | — | Connexion MinIO |
| `PEER_PORT` | `9000` | Port du serveur de signalisation WebRTC |
| `FRONTEND_ORIGIN` | `https://<ip>:5173,https://localhost:5173` | Origines autorisées en CORS (liste séparée par virgules) |

### `frontend/.env`

| Variable | Rôle |
|---|---|
| `VITE_API_URL`, `VITE_SOCKET_URL` | Adresse du backend (HTTPS, l'IP réelle, pas `localhost`) |
| `VITE_PEER_HOST`, `VITE_PEER_PORT` | Adresse du serveur PeerJS |

**Règle générale à retenir** : toute variable lue par un service qui tourne *sur le serveur* peut utiliser `localhost`. Toute variable dont la valeur finit *dans le navigateur de l'utilisateur* (URLs de pad, de téléchargement, de PeerServer...) doit utiliser l'**IP ou le nom de domaine réel** du serveur.

---

## 5. Modèle de données

Voir le cahier des charges (`Cahier_des_charges_projet_collaboratif.docx`, section Conception) pour le MCD/MLD complet. Résumé des tables (`backend/db/migrations/001_init_schema.sql`) :

- `utilisateur` (id, email, password_hash, name, is_admin, is_active, created_at)
- `document` (id, title, owner_id → utilisateur, etherpad_id, created_at, updated_at)
- `permission` (document_id, user_id, role : owner/editor/viewer) — matérialise les droits
- `message` (id, document_id, user_id, content, created_at) — historique du chat
- `fichier` (id, document_id, minio_key, filename, size, mime_type)

Migrations suivantes : `002` ajoute `name`, `003` ajoute `is_admin`, `004`/`005` ajoutent `is_active` et fixent le comportement de suppression en cascade (supprimer un compte supprime ses documents ; il n'existe aucune route permettant de supprimer un document indépendamment du compte de son propriétaire, hormis pour le propriétaire lui-même).

---

## 6. API et documentation Swagger

Documentation interactive générée automatiquement depuis des commentaires `@openapi` placés directement au-dessus de chaque route (`swagger-jsdoc`, configuré dans `backend/src/swagger.js`) :

```
https://<adresse>:3443/api-docs
```

Pour tester une route protégée : `POST /auth/login` → copier le `token` de la réponse → bouton "Authorize" en haut de la page → coller le token.

Une collection Postman équivalente est disponible dans `backend/tests/postman-collection.json`.

---

## 7. Sécurité — mesures et résultats de tests

| Mesure | Détail |
|---|---|
| Mots de passe | Hachés avec `bcrypt` (natif, pas `bcryptjs` — voir section 8 sur l'impact charge) |
| Injections SQL | Requêtes systématiquement paramétrées (`$1`, `$2`...). Testé avec plusieurs payloads (`OR 1=1`, `DROP TABLE`...) : tous neutralisés |
| XSS | Testé avec un payload `<script>` dans un titre de document : React échappe automatiquement à l'affichage, confirmé dans un vrai navigateur (le script ne s'exécute jamais) |
| Contrôle des accès | Chaque route vérifie le rôle réel en base, jamais une simple présence de token. Testé : token absent, token invalide, tiers sans droit, non-admin sur route admin → tous rejetés (401/403) |
| HTTPS | Le serveur ne répond à aucune requête HTTP brute (protocole différent, connexion refusée au niveau TLS) |
| En-têtes de sécurité HTTP | `helmet` (HSTS, X-Content-Type-Options, X-Frame-Options, retrait de X-Powered-By...) |
| CORS | Restreint à une liste explicite d'origines (`FRONTEND_ORIGIN`), plus de `*` |
| Etherpad | Accès par session uniquement (`REQUIRE_SESSION=true`), pas par simple connaissance de l'URL du pad |
| Dépendances | `npm audit` exécuté régulièrement ; vulnérabilités modérées connues et documentées (dépendances internes de `minio` et `peer`, sans correctif disponible sans régression à ce jour) |

---

## 8. Tests de charge

Réalisés avec Apache JMeter 5.6.3 (installation officielle, pas le paquet `apt` qui est une version 2.13 obsolète et incompatible).

### Résultats (authentification, `bcrypt` natif)

| Utilisateurs simultanés | Temps moyen | Erreurs | Débit |
|---|---|---|---|
| 30 | 3,3 s | 0% | 5,5 req/s |
| 200 | 14,7 s | 0% | 7,6 req/s |
| 1000 | 57,3 s | 0,40% | 7,2 req/s |

**Interprétation** : le serveur absorbe sans erreur une charge réaliste (30 à 200 connexions simultanées). Au-delà (1000), le temps d'attente devient très long et de rares requêtes finissent en timeout — un niveau de charge très éloigné d'un usage réel pour ce projet (petite équipe ou classe).

### `bcrypt` natif vs `bcryptjs`

Le remplacement de `bcryptjs` (JavaScript pur, bloque le thread principal de Node) par `bcrypt` (natif, délègue à un pool de threads) a fait passer le débit de connexion de **1,2 à 7,6 requêtes/seconde** (×6,3) à charge comparable (~200 utilisateurs). Migration transparente : même API, hashs existants toujours valides.

---

## 9. Dépannage — problèmes rencontrés et solutions

Cette section documente les vrais problèmes rencontrés pendant le développement, pour éviter de les reproduire.

### "localhost n'autorise pas la connexion" / téléchargement qui échoue

**Cause** : une URL destinée au navigateur (pad Etherpad, téléchargement MinIO) a été construite avec `localhost`, qui désigne la machine du **client**, pas le serveur.
**Solution** : toute variable d'environnement dont la valeur part vers le navigateur doit utiliser l'IP réelle du serveur (`MINIO_ENDPOINT`, `ETHERPAD_PUBLIC_URL`, `VITE_API_URL`...).

### Contenu mixte bloqué (iframe Etherpad ne charge pas)

**Cause** : une page HTTPS ne peut pas charger une iframe en HTTP.
**Solution** : reverse proxy nginx devant Etherpad (`etherpad-proxy.conf`), qui ajoute HTTPS.

### `getUserMedia` / caméra-micro indisponible dans le navigateur

**Cause** : les navigateurs interdisent l'accès caméra/micro sur toute origine non sécurisée (sauf `localhost` exact).
**Solution** : servir aussi le frontend en HTTPS (`vite.config.js`, option `server.https`), pas seulement le backend.

### Vidéo locale (sa propre caméra) invisible en appel, alors que celle des autres s'affiche

**Cause** : le flux caméra était attaché à l'élément `<video>` avant que cet élément existe dans le DOM (React ne l'affichait qu'après un changement d'état survenant juste après).
**Solution** : un `useEffect` déclenché par ce changement d'état réattache le flux une fois l'élément réellement monté.

### JMeter : `Unsupported protocol TLSv1.2,TLSv1.1,TLSv1`

**Cause** : Java moderne désactive TLSv1/TLSv1.1 par défaut, mais `jmeter.properties` demande encore ces protocoles.
**Solution** : dans `bin/user.properties` (pas `system.properties`, qui n'est pas le bon fichier malgré le nom), ajouter `https.socket.protocols=TLSv1.2`, puis **redémarrer complètement** JMeter (le réglage ne se recharge qu'au démarrage du processus).

### Docker : "port already in use"

**Cause** : un service (souvent une instance PostgreSQL ou MinIO déjà installée nativement ou par un autre projet) occupe déjà le port par défaut.
**Solution** : remapper le port exposé côté hôte dans `docker-compose.yml` (ex: `"5433:5432"` au lieu de `"5432:5432"`), en gardant le port interne au conteneur inchangé.

### Docker : les migrations SQL ne s'exécutent pas

**Cause** : les scripts dans `/docker-entrypoint-initdb.d` ne s'exécutent qu'au tout premier démarrage, sur un volume de données vide. Un volume déjà initialisé (même vide de tables si le chemin de montage était erroné) ne les rejoue jamais.
**Solution** : soit exécuter la migration manuellement (`docker exec -i ... psql ... < fichier.sql`), soit repartir d'un volume propre (`docker compose down -v`, ⚠️ perte des données existantes).

### Disque plein pendant l'installation d'un service Docker

**Cause fréquente** : anciennes révisions `snap` jamais nettoyées, cache `npm`.
**Solution** : `snap set system refresh.retain=2` puis supprimer les révisions `disabled` (`snap remove <nom> --revision=<rev>`), et `npm cache clean --force`.

---

## 10. Déploiement

Ce projet est pensé pour un déploiement **local** (réseau privé, certificat auto-signé), pas pour une exposition publique sur Internet. Pour aller plus loin :

- Remplacer les certificats auto-signés par de vrais certificats (Let's Encrypt) si un nom de domaine public est mis en place
- Restreindre davantage `FRONTEND_ORIGIN` à la seule adresse réelle de production
- Revoir les mots de passe par défaut de tous les `.env`
- Envisager un reverse proxy unique (nginx) devant l'ensemble des services plutôt qu'un port par service
