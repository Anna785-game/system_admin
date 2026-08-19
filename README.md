# front_admin — régie / dashboard de l'expo

Front React (Vite) pour piloter le stand pendant l'expo : file d'attente des
candidats, roue des postes en plein écran, liste employés, historique,
présences, et un fil d'événements 100% temps réel via le WebSocket
`/ws/admin` de l'API (`fastapi_pointage`, voir `v.txt`).

Pensé pour tourner sur un PC branché à un vidéoprojecteur : tout ce qui se
passe (inscription, acceptation, roulette, badge, entrée/sortie) s'affiche
en direct pour que le public voie l'effet immédiatement.

## Démarrage

```bash
npm install
cp .env.example .env   # renseigne VITE_API_BASE et éventuellement VITE_ADMIN_WS_TOKEN
npm run dev
```

Build de prod (à servir depuis le PC branché au projecteur) :

```bash
npm run build
npm run preview
```

## Configuration

Deux secrets distincts, ne pas les confondre :

- **Compte admin** (email / mot de passe Supabase, `role: admin` dans
  `user_metadata`) : sert à se connecter à l'écran de login et donne le
  jeton JWT utilisé pour tous les appels REST protégés.
- **`ADMIN_WS_TOKEN`** : jeton statique défini côté serveur (`settings`),
  vérifié uniquement par `/ws/admin?token=...`. Se configure via
  `VITE_ADMIN_WS_TOKEN` au build, ou directement dans l'onglet **Réglages**
  une fois l'app lancée (stocké en `localStorage`, pratique pour changer le
  jeton sur place sans rebuild).

## Ce que fait chaque onglet

- **Direct** — fil d'actualité complet de tous les événements WebSocket,
  pensé pour rester affiché à l'écran entre deux visiteurs.
- **Candidats** — file d'attente + candidat actif en cours d'enrôlement
  (accepter / retirer / virer), branché sur `/candidats/*`.
- **Employés** — liste, statut Actif/Inactif, poste attribué, assignation
  de carte RFID libre, suppression de l'encoding facial.
- **Historique** — candidats archivés (retirés ou virés).
- **Postes & roue** — poids de chaque poste (répartition affichée en
  barres), création/suppression, bouton de seed démo
  (`Vendeur` / `Nettoyeur de toilettes` / `Boss`, cf. `postes.py`).
- **Cartes RFID** — gestion des UID de badges physiques.
- **Présences** — table du jour + absences, boutons pour déclencher les
  jobs (`calcul-duree-travail`, `insert-absences`).
- **Simulation 7j** — démarre `/simulation/start/{candidat_id}` pour le
  candidat actif une fois son poste roulé, et journalise chaque jour simulé
  en direct.
- **Réglages** — URL de l'API, statut et jeton du WebSocket, et un bouton
  pour **rejouer l'animation de la roulette sans backend** (répétition
  avant l'ouverture du stand).

## L'effet roulette

Quand le serveur broadcast `{ "event": "roulette", "poste_gagnant": ... }`
(déclenché par `POST /api/biometrie/enroll/{employe_id}`, voir
`app/routers/biometrie.py`), `RouletteOverlay` prend tout l'écran, fait
tourner `public/roulette.png` sur plusieurs tours (~7200°, décélération
progressive) et s'arrête pile sur le secteur du poste gagnant, avant de
révéler "Vous êtes {poste}" avec un effet confettis.

Correspondance secteur ↔ poste (voir `src/constants/postes.js`) :

| Secteur | Poste                  |
| ------- | ---------------------- |
| Rouge   | Vendeur                |
| Bleu    | Nettoyeur de toilettes |
| Jaune   | Boss                   |

Si tu ajoutes/renommes des postes, mets à jour ce fichier pour que la roue
s'arrête au bon endroit (les noms doivent matcher exactement `type_poste`
en base).

## Ce qui n'est pas dans ce front

- L'enrôlement du visage lui-même (webcam + upload) : ça reste sur le
  téléphone du visiteur (`front_user` / `v3.txt`) et sur `index.html`
  (cible caméra) branché au `face_server` (`v2.txt`).
- La logique de calcul (roulette pondérée, matching facial, simulation) :
  tout est déjà côté API (`v.txt`), ce front ne fait qu'appeler les
  endpoints et afficher les broadcasts.
