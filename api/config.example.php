<?php
// Modèle de configuration des formulaires.
//
// Hébergement OVH : copier ce fichier À CÔTÉ du dossier www/ (donc hors du site public)
//                   sous le nom calendrier-enduro-config.php, puis le compléter.
// Dev local       : le copier en api/config.php (ignoré par git), avec 'dev_mode' => true.
//
// Ne jamais versionner le fichier complété : il contient le mot de passe de la boîte e-mail.

return [
    // true : aucun e-mail n'est envoyé, le message est écrit dans <storage_dir>/mail.log.
    'dev_mode' => false,

    // Adresse qui reçoit les messages.
    'mail_to' => 'contact@votre-domaine.fr',

    // Expéditeur : doit être une adresse du domaine, celle de la boîte SMTP ci-dessous.
    'mail_from' => 'contact@votre-domaine.fr',
    'mail_from_name' => 'Sorties Enduro',

    // Boîte e-mail OVH utilisée pour l'envoi.
    'smtp' => [
        'host' => 'ssl0.ovh.net',
        'port' => 465,
        'username' => 'contact@votre-domaine.fr',
        'password' => '',
    ],

    // Dossier de travail (compteur anti-abus, journal en mode dev), hors du site public.
    // OVH : __DIR__ . '/calendrier-enduro-data'   — Dev local : __DIR__ . '/../storage'
    'storage_dir' => __DIR__ . '/calendrier-enduro-data',

    // Nombre maximum d'envois par adresse IP sur la période (en secondes).
    'rate_limit' => ['max' => 5, 'window' => 3600],
];
