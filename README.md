# Calendrier Enduro

Site vitrine (HTML/CSS/JS statique, sans framework ni étape de build) recensant les randonnées enduro en France : calendrier, carte interactive et fiche détaillée par randonnée.

## Structure

```
index.html        Accueil (hero, prochaines randos, CTA organisateur)
calendrier.html   Liste complète des randonnées, recherche + filtres
carte.html        Carte interactive (Leaflet / OpenStreetMap), filtres département/statut
fiche.html        Détail d'une randonnée (?id=<id>), généré depuis data/randos.json
css/styles.css    Feuille de styles unique, mobile-first (breakpoints 600 / 900 / 1200px)
js/main.js        Logique partagée : rendu des cartes, filtres, carte Leaflet, page fiche
data/randos.json  Source de données des randonnées (voir ci-dessous)
assets/img/       Visuels
server.js         Petit serveur statique Node (dev local uniquement, aucune dépendance)
.claude/launch.json  Config pour lancer le serveur de dev depuis Claude Code
```

## Développement local

Aucune dépendance à installer. Servir le dossier avec n'importe quel serveur statique, par exemple :

```bash
node server.js
```

puis ouvrir http://localhost:8123.

## Données

`data/randos.json` est un tableau d'objets randonnée. Champs principaux :

- `id`, `title`, `location`, `dept`, `date` (`AAAA-MM-JJ`), `time`, `status` (`venir` / `passee` / `annulee`)
- `image`, `imageAlt`
- `distanceKm`, `price`, `loops`, `meetingPoint`
- `lat`, `lng` — coordonnées du point de rendez-vous, utilisées par la carte
- `organizerName`, `organizerDescription`, `contactPhone`, `contactEmail`

## Déploiement

Le site est 100% statique : n'importe quel hébergeur statique convient (GitHub Pages, Netlify, Vercel, OVH, etc.), sans étape de build — il suffit de publier le contenu du dépôt tel quel.

- `server.js` et `.claude/launch.json` sont des outils de développement local ; ils ne sont pas nécessaires en production.
- La carte (`carte.html`, `fiche.html`) charge Leaflet depuis un CDN (cdnjs) : nécessite un accès réseau sortant, pas de clé API.

## État

V1 en cours de construction.
