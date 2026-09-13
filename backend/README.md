# Projet Collaboratif — Application type Google Docs

Application web collaborative permettant l'édition de documents en temps réel à plusieurs, avec chat intégré, appel audio/vidéo, gestion fine des droits d'accès et stockage de fichiers — entièrement construite sur des briques open source auto-hébergées.

> Documentation complète et détaillée : voir [`docs/GUIDE.md`](docs/GUIDE.md)
> Cahier des charges complet : voir [`docs/Cahier_des_charges_projet_collaboratif.docx`](docs/Cahier_des_charges_projet_collaboratif.docx)

---

## Fonctionnalités

| Module | Description |
|---|---|
| **Authentification** | Inscription/connexion par email + mot de passe (JWT), nom d'affichage optionnel |
| **Documents** | Création, listage, renommage, suppression, avec rôles (propriétaire / éditeur / lecteur) |
| **Édition collaborative** | Intégrée via Etherpad, sécurisée par session (pas d'accès par simple URL) |
| **Chat** | Messagerie temps réel par document (Socket.io), historique persistant |
| **Appel audio/vidéo** | Mesh WebRTC via PeerJS, signalisation automatique par Socket.io |
| **Partage** | Invitation par email avec attribution de rôle, liste des collaborateurs |
| **Fichiers** | Upload/téléchargement/suppression via MinIO (stockage compatible S3) |
| **Administration** | Gestion complète des comptes (créer/modifier/désactiver/supprimer), séparée entre administrateurs et utilisateurs, sans jamais pouvoir supprimer un document directement |
| **Documentation API** | Interactive, générée automatiquement depuis le code (Swagger / OpenAPI) |

---

## Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | React (Vite) | Interface utilisateur (SPA) |
| Backend | Node.js / Express | API REST |
| Temps réel | Socket.io | Chat, présence, signalisation d'appel |
| Appel A/V | PeerJS (WebRTC) | Connexions audio/vidéo pair-à-pair |
| Édition collaborative | Etherpad | Moteur d'édition partagée |
| Base de données | PostgreSQL | Données applicatives (utilisateurs, documents, droits...) |
| Stockage fichiers | MinIO | Fichiers attachés aux documents |
| Reverse proxy | nginx | Termine le HTTPS devant Etherpad |
| Sécurité | bcrypt, JWT, helmet | Mots de passe, sessions, en-têtes HTTP |
| Documentation | swagger-jsdoc, swagger-ui-express | Doc API générée depuis le code |
| Tests | Postman, Apache JMeter | Tests fonctionnels et de charge |

---

## Architecture

```
Navigateur (React)
   │  HTTPS (Vite dev server, port 5173)
   ▼
Backend Node.js/Express (port 3443, HTTPS)
   ├── API REST (/api/...)
   ├── Socket.io (chat, présence, signalisation d'appel)
   ├── Swagger UI (/api-docs)
   └── PeerServer (port 9000, signalisation WebRTC)
   │
   ├──► PostgreSQL (port 5433) — utilisateurs, documents, permissions, messages, fichiers
   ├──► MinIO (port 9010 API / 9011 console) — fichiers attachés
   └──► Etherpad, via son HTTP API (port 9001, interne)
            │
            └──► nginx reverse proxy (port 9002, HTTPS) — c'est cette adresse que le navigateur charge
```

---

## Structure du dépôt

```
projet-google-docs/
├── backend/
│   ├── src/
│   │   ├── server.js          → point d'entrée (HTTPS, Socket.io, PeerServer)
│   │   ├── app.js              → configuration Express (middlewares, routes, Swagger)
│   │   ├── swagger.js          → génère la doc API depuis les commentaires @openapi
│   │   ├── config/             → connexions PostgreSQL, Etherpad, MinIO
│   │   ├── middlewares/        → authentification JWT, contrôle admin
│   │   ├── routes/             → auth, documents, fichiers, messages, admin, santé
│   │   ├── sockets/            → logique Socket.io (chat, appel)
│   │   └── utils/               → vérification des droits partagée
│   ├── db/migrations/          → schéma SQL, exécuté dans l'ordre numéroté
│   └── tests/                  → collection Postman, plans de test JMeter
│
├── frontend/
│   └── src/
│       ├── api/client.js       → tous les appels à l'API REST
│       ├── context/            → authentification, connexion Socket.io globale
│       ├── components/         → Navbar, panneaux (chat/fichiers/appel/partage), routes protégées
│       └── pages/               → connexion, inscription, tableau de bord, document, administration
│
├── docker/                     → (si utilisé) configuration Docker
├── docker-compose.yml          → PostgreSQL, Etherpad (+ proxy nginx), MinIO
├── etherpad-proxy.conf         → configuration du reverse proxy HTTPS devant Etherpad
└── docs/
    ├── GUIDE.md                 → documentation technique détaillée (installation, dépannage...)
    └── Cahier_des_charges_projet_collaboratif.docx
```

---

## Démarrage rapide

Voir [`docs/GUIDE.md`](docs/GUIDE.md) pour la procédure complète et détaillée. Dans les grandes lignes :

```bash
# 1. Services (PostgreSQL, Etherpad, MinIO)
docker compose up -d

# 2. Backend
cd backend
npm install
npm start

# 3. Frontend
cd frontend
npm install
npm run dev
```

---

## Sécurité

Vérifiée concrètement (pas seulement prévue) : requêtes SQL paramétrées (protection injection), échappement automatique React (protection XSS), contrôle des droits testé à chaque route, HTTPS obligatoire partout, en-têtes de sécurité HTTP (`helmet`), CORS restreint à une liste d'origines. Détails et résultats dans `docs/GUIDE.md`.

## Tests

- **Fonctionnels** : collection Postman (`backend/tests/postman-collection.json`)
- **Charge** : plans de test JMeter (`backend/tests/*.jmx`) — résultats et analyse dans `docs/GUIDE.md`

## Documentation API

Une fois le backend démarré : `https://<adresse>:3443/api-docs`

---

## Licence

Projet académique.
