<?php
// Formulaire « Proposer ma randonnée » : valide la proposition, l'enregistre
// et l'envoie par e-mail pour modération (ajout manuel dans data/randos.json).
declare(strict_types=1);

require __DIR__ . '/lib/form.php';

const DEPT_REGEX = '/^(0[1-9]|1\d|2[AB1-9]|[3-8]\d|9[0-5])$/';
const PHONE_REGEX = '/^(?:(?:\+|00)33\s?|0)[1-9](?:[\s.\-]?\d{2}){4}$/';

form_require_post();
form_reject_bots();

[$data, $errors] = form_validate([
    'title' => ['required' => true, 'max' => 100],
    'date' => ['type' => 'date', 'required' => true, 'future' => true],
    'time' => ['type' => 'time'],
    'location' => ['required' => true, 'max' => 100],
    'dept' => ['type' => 'pattern', 'required' => true, 'regex' => DEPT_REGEX, 'message' => 'Choisissez un département dans la liste.'],
    'meetingPoint' => ['required' => true, 'max' => 200],
    'distanceKm' => ['type' => 'number', 'min_value' => 1, 'max_value' => 1000],
    'price' => ['type' => 'number', 'min_value' => 0, 'max_value' => 1000],
    'loops' => ['type' => 'number', 'integer' => true, 'min_value' => 1, 'max_value' => 20],
    'organizerName' => ['required' => true, 'max' => 100],
    'organizerDescription' => ['max' => 1000, 'multiline' => true],
    'contactEmail' => ['type' => 'email', 'required' => true, 'max' => 254],
    'contactPhone' => ['type' => 'pattern', 'regex' => PHONE_REGEX, 'message' => 'Saisissez un numéro de téléphone français, par exemple 06 12 34 56 78.'],
    'notes' => ['max' => 2000, 'multiline' => true],
    'consent' => ['type' => 'checkbox', 'required' => true],
], $_POST);

if ($errors) {
    form_respond_errors($errors);
}

$config = form_load_config();
form_rate_limit($config);

// Entrée au format de data/randos.json, prête à être relue puis collée.
// Restent à compléter à la main : image, imageAlt, lat, lng.
$optionalNumber = static fn($value) => $value === '' ? null : $value;
$rando = [
    'id' => form_slug($data['title']) . '-' . $data['date'],
    'title' => $data['title'],
    'location' => $data['location'],
    'dept' => $data['dept'],
    'date' => $data['date'],
    'time' => $data['time'] === '' ? '' : str_replace(':', 'h', $data['time']),
    'status' => 'venir',
    'image' => '',
    'imageAlt' => '',
    'distanceKm' => $optionalNumber($data['distanceKm']),
    'price' => $optionalNumber($data['price']),
    'loops' => $optionalNumber($data['loops']),
    'meetingPoint' => $data['meetingPoint'],
    'lat' => null,
    'lng' => null,
    'organizerName' => $data['organizerName'],
    'organizerDescription' => $data['organizerDescription'],
    'contactPhone' => $data['contactPhone'],
    'contactEmail' => $data['contactEmail'],
];
$json = json_encode($rando, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// Copie de sécurité : la proposition est conservée même si l'e-mail se perd.
$record = ['receivedAt' => date('c'), 'notes' => $data['notes'], 'rando' => $rando];
$file = form_storage_dir($config, 'propositions') . '/' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';
$saved = file_put_contents($file, json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) !== false;
if (!$saved) {
    error_log('Calendrier Enduro : impossible d’enregistrer la proposition dans ' . $file);
}

$body = "Nouvelle randonnée proposée.\n\n"
    . 'Randonnée : ' . $data['title'] . "\n"
    . 'Date : ' . $data['date'] . ($data['time'] !== '' ? ' à ' . $data['time'] : '') . "\n"
    . 'Lieu : ' . $data['location'] . ' (' . $data['dept'] . ")\n"
    . 'Rendez-vous : ' . $data['meetingPoint'] . "\n"
    . 'Organisateur : ' . $data['organizerName'] . "\n"
    . 'Contact : ' . $data['contactEmail'] . ($data['contactPhone'] !== '' ? ' — ' . $data['contactPhone'] : '') . "\n\n"
    . "Informations complémentaires :\n" . ($data['notes'] !== '' ? $data['notes'] : '(aucune)') . "\n\n"
    . "Entrée à relire puis ajouter dans data/randos.json\n"
    . "(à compléter : image, imageAlt, lat, lng) :\n\n" . $json . "\n";

if (!form_send_mail($config, '[Calendrier Enduro] Randonnée proposée — ' . $data['title'], $body, $data['contactEmail'], $data['organizerName'])) {
    form_respond_failure(502, 'Votre proposition n’a pas pu être envoyée. Merci de réessayer dans quelques minutes.');
}

form_respond_ok();
