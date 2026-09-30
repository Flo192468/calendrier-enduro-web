# Sorties Enduro

Site vitrine (HTML/CSS/JS sans framework ni étape de build, plus quelques scripts PHP pour les formulaires) recensant les randonnées enduro en France : calendrier, carte interactive et fiche détaillée par randonnée.

## Structure

```
index.html           Accueil (hero, prochaines randos, CTA organisateur)
calendar.html        Liste complète des randonnées, recherche + filtres
map.html             Carte interactive (Leaflet / OpenStreetMap), recherche + filtres département/statut
detail.html          Détail d'une randonnée (?id=<id>), généré depuis data/events.json
contact.html         Formulaire de contact
submit.html          Formulaire « Proposer une randonnée » (organisateurs)
thanks.html          Page de confirmation d'envoi (utilisée quand JavaScript est désactivé)
css/styles.css       Feuille de styles unique, mobile-first (breakpoints 600 / 900 / 1200px)
js/main.js           Logique partagée : rendu des cartes, filtres, carte Leaflet, page détail
js/forms.js          Formulaires : validation côté navigateur, envoi sans rechargement
api/contact.php      Traitement du formulaire de contact (validation, anti-spam, e-mail)
api/submit.php       Traitement d'une randonnée proposée (validation, copie de sécurité, e-mail)
api/lib/form.php     Socle commun des scripts de formulaire
api/lib/PHPMailer    Bibliothèque d'envoi d'e-mails (version dans api/lib/PHPMailer/VERSION)
api/config.example.php  Modèle de configuration (adresse e-mail, SMTP)
data/events.json     Source de données des randonnées (voir ci-dessous)
assets/img/          Visuels
VERSION              Numéro de version du site
server.js            Petit serveur statique Node (dev local uniquement, aucune dépendance)
.claude/launch.json  Config pour lancer le serveur de dev depuis Claude Code
.claude/launch.json  Config pour lancer le serveur de dev depuis Claude Code
```

## Développement local

Aucune dépendance à installer. Servir le dossier avec n'importe quel serveur statique, par exemple :

```bash
node server.js
```

puis ouvrir http://localhost:8123.

Ce serveur Node ne sait pas exécuter le PHP : les pages s'affichent, mais l'envoi des formulaires échoue. Pour tester les formulaires de bout en bout, il faut PHP 8.1 ou plus :

```bash
cp api/config.example.php api/config.php
php -S localhost:8123
```

Dans `api/config.php` (ignoré par git), mettre `'dev_mode' => true` et `'storage_dir' => __DIR__ . '/../storage'` : aucun e-mail n'est envoyé, les messages sont écrits dans `storage/mail.log`.

## Formulaires

- Filtres du calendrier et de la carte : conservés dans l'URL (`?q=`, `dept=`, `mois=`, `statut=`).
- Un formulaire `<form data-form>` est validé par `js/forms.js` puis envoyé en `fetch` ; le script PHP répond en JSON. Sans JavaScript, le formulaire est envoyé normalement et le script redirige vers `thanks.html`.
- Le serveur revalide toujours les champs. Anti-spam : champ piège caché, délai minimum de remplissage, nombre d'envois limité par adresse IP.
- L'e-mail part par le SMTP de la boîte OVH (PHPMailer). L'expéditeur est l'adresse du domaine ; la personne qui écrit est en « Répondre à ».

### Modération d'une randonnée proposée

Rien n'est publié automatiquement. Chaque proposition arrive par e-mail, avec en fin de message une entrée au format de `data/events.json`. Pour la publier :

1. Vérifier les informations auprès de l'organisateur si besoin.
2. Compléter `image`, `imageAlt`, `lat` et `lng`.
3. Ajouter l'entrée dans `data/events.json` et publier le fichier.

Une copie de chaque proposition est aussi enregistrée dans `<storage_dir>/submissions/`, au cas où l'e-mail se perdrait.

## Données

`data/events.json` est un tableau d'objets randonnée. Champs principaux :

- `id`, `title`, `location`, `dept`, `date` (`AAAA-MM-JJ`), `time`, `status` (`upcoming` / `past` / `cancelled`)
- `image`, `imageAlt`
- `distanceKm`, `price`, `loops`, `meetingPoint`
- `lat`, `lng` — coordonnées du point de rendez-vous, utilisées par la carte
- `organizerName`, `organizerDescription`, `contactPhone`, `contactEmail`
- `reservationUrl`, `contactFormUrl` (facultatifs) — lien de réservation en ligne, formulaire de contact de l'organisateur

## Déploiement

Le site est prévu pour un hébergement mutualisé OVH (offre Perso), sans étape de build : publier le contenu du dépôt dans `www/`.

Pour les formulaires :

1. Choisir PHP 8.1 ou plus pour l'hébergement (fichier `.ovhconfig` ou espace client OVH).
2. Copier `api/config.example.php` **à côté** de `www/` (hors du site public), sous le nom `calendrier-enduro-config.php`. Le script le retrouve aussi quand le site est dans un sous-dossier de test comme `www/test/`.
3. Y renseigner l'adresse de réception et les identifiants de la boîte e-mail OVH. Ce fichier ne doit jamais être versionné.
4. Envoyer un message de test depuis `contact.html`, puis une proposition depuis `submit.html`.

- `server.js` et `.claude/launch.json` sont des outils de développement local ; ils ne sont pas nécessaires en production.
- La carte (`map.html`, `detail.html`) charge Leaflet depuis un CDN (cdnjs) : nécessite un accès réseau sortant, pas de clé API.

## Version

Version actuelle : **1.1.1** (fichier `VERSION`, publié avec le site : `/VERSION` indique la version en ligne).

- 1.1.1 — le site s'appelle « Sorties Enduro » partout (titres, pieds de page, e-mails).
- 1.1.0 — formulaires Contact et Proposer une randonnée en PHP, filtres partageables par URL, pictogramme pour les randonnées sans photo, logo cliquable.
- 1.0.0 — calendrier, carte, fiche détaillée.

À chaque mise en ligne, mettre à jour `VERSION` et cette liste.
