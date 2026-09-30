<?php
// Socle commun des scripts de formulaire (contact.php, proposer.php…) :
// configuration, validation, anti-spam, envoi d'e-mail et réponse.
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

const FORM_MIN_FILL_SECONDS = 3;

/* --------------------------------------------------------------------
   Configuration
   -------------------------------------------------------------------- */

// Cherche d'abord hors du dossier public (hébergement OVH : à côté de www/),
// puis dans api/config.php (dev local, fichier ignoré par git).
function form_load_config(): array
{
    $candidates = [
        dirname(__DIR__, 3) . '/calendrier-enduro-config.php',
        dirname(__DIR__) . '/config.php',
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            $config = require $path;
            if (is_array($config)) {
                return $config;
            }
        }
    }
    error_log('Calendrier Enduro : fichier de configuration introuvable (voir api/config.example.php).');
    form_respond_failure(500);
}

/* --------------------------------------------------------------------
   Réponses : JSON pour un envoi en fetch, page HTML sinon (sans JavaScript)
   -------------------------------------------------------------------- */

function form_wants_json(): bool
{
    return str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
}

function form_send_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function form_send_html(int $status, string $title, array $lines): never
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $e = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="fr"><head><meta charset="UTF-8" />'
        . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        . '<title>' . $e($title) . ' — Calendrier Enduro</title>'
        . '<link rel="stylesheet" href="../css/styles.css" /></head><body>'
        . '<main class="form-page"><div class="form-page__inner"><h1>' . $e($title) . '</h1><ul>';
    foreach ($lines as $line) {
        echo '<li>' . $e($line) . '</li>';
    }
    // Cette page ne sert que sans JavaScript : pas de lien "retour" scripté.
    echo '</ul><p>Utilisez le bouton Retour de votre navigateur pour revenir au formulaire.</p>'
        . '<p><a class="form-link" href="../index.html">Retour à l’accueil</a></p>'
        . '</div></main></body></html>';
    exit;
}

function form_respond_ok(): never
{
    if (form_wants_json()) {
        form_send_json(200, ['ok' => true]);
    }
    header('Location: ../merci.html', true, 303);
    exit;
}

// $errors : [nom du champ => message]
function form_respond_errors(array $errors): never
{
    if (form_wants_json()) {
        form_send_json(422, ['ok' => false, 'errors' => $errors]);
    }
    form_send_html(422, 'Le formulaire contient des erreurs', array_values($errors));
}

function form_respond_failure(int $status, string $message = 'Une erreur est survenue. Merci de réessayer dans quelques minutes.'): never
{
    if (form_wants_json()) {
        form_send_json($status, ['ok' => false, 'message' => $message]);
    }
    form_send_html($status, 'Envoi impossible', [$message]);
}

/* --------------------------------------------------------------------
   Contrôles de la requête et anti-spam
   -------------------------------------------------------------------- */

function form_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        form_respond_failure(405, 'Méthode non autorisée.');
    }

    // Refuse les envois déclenchés depuis un autre site.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $originHost = parse_url($origin, PHP_URL_HOST);
        $originPort = parse_url($origin, PHP_URL_PORT);
        $origin = $originHost . ($originPort ? ':' . $originPort : '');
        if (strcasecmp($origin, $_SERVER['HTTP_HOST'] ?? '') !== 0) {
            form_respond_failure(403, 'Origine de la requête refusée.');
        }
    }
}

// Un robot est écarté en silence : on lui répond "succès" pour ne pas l'aider à s'adapter.
function form_reject_bots(): void
{
    $trap = $_POST['website'] ?? '';
    $started = $_POST['form_started'] ?? '';
    $tooFast = is_string($started) && ctype_digit($started)
        && (time() - (int) $started) < FORM_MIN_FILL_SECONDS;

    if ($trap !== '' || $tooFast) {
        form_respond_ok();
    }
}

// Limite le nombre d'envois par adresse IP sur une fenêtre glissante.
function form_rate_limit(array $config): void
{
    $max = (int) ($config['rate_limit']['max'] ?? 5);
    $window = (int) ($config['rate_limit']['window'] ?? 3600);
    $dir = form_storage_dir($config, 'ratelimit');
    $file = $dir . '/' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'inconnu') . '.json';
    $now = time();

    $handle = fopen($file, 'c+');
    if ($handle === false) {
        return;
    }
    flock($handle, LOCK_EX);
    $hits = json_decode((string) stream_get_contents($handle), true);
    $hits = is_array($hits) ? array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $now - $window)) : [];
    $blocked = count($hits) >= $max;
    if (!$blocked) {
        $hits[] = $now;
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, (string) json_encode($hits));
    flock($handle, LOCK_UN);
    fclose($handle);

    if ($blocked) {
        form_respond_failure(429, 'Trop d’envois depuis votre connexion. Merci de réessayer plus tard.');
    }
}

function form_storage_dir(array $config, string $sub = ''): string
{
    $dir = rtrim((string) ($config['storage_dir'] ?? ''), '/');
    if ($dir === '') {
        error_log('Calendrier Enduro : "storage_dir" manquant dans la configuration.');
        form_respond_failure(500);
    }
    if ($sub !== '') {
        $dir .= '/' . $sub;
    }
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        error_log('Calendrier Enduro : impossible de créer ' . $dir);
        form_respond_failure(500);
    }
    return $dir;
}

/* --------------------------------------------------------------------
   Validation
   -------------------------------------------------------------------- */

// Règles par champ : label, required, type (text | email | checkbox | choice),
// min, max (longueur), multiline, choices (valeurs autorisées pour "choice").
// Retourne [données nettoyées, erreurs].
function form_validate(array $rules, array $input): array
{
    $data = [];
    $errors = [];

    foreach ($rules as $name => $rule) {
        $type = $rule['type'] ?? 'text';
        $raw = $input[$name] ?? '';
        $value = is_string($raw) ? form_clean($raw, !empty($rule['multiline'])) : '';
        $data[$name] = $value;

        if ($type === 'checkbox') {
            $data[$name] = $value !== '';
            if (!empty($rule['required']) && $value === '') {
                $errors[$name] = 'Cochez cette case pour continuer.';
            }
            continue;
        }

        if ($value === '') {
            if (!empty($rule['required'])) {
                $errors[$name] = 'Ce champ est obligatoire.';
            }
            continue;
        }

        $length = mb_strlen($value);
        if (isset($rule['min']) && $length < $rule['min']) {
            $errors[$name] = 'Saisissez au moins ' . $rule['min'] . ' caractères.';
        } elseif (isset($rule['max']) && $length > $rule['max']) {
            $errors[$name] = 'Saisissez au maximum ' . $rule['max'] . ' caractères.';
        } elseif ($type === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $errors[$name] = 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.';
        } elseif ($type === 'choice' && !in_array($value, $rule['choices'] ?? [], true)) {
            $errors[$name] = 'Choisissez une valeur dans la liste.';
        }
    }

    return [$data, $errors];
}

// Supprime les caractères de contrôle ; les champs sur une ligne perdent aussi leurs
// retours à la ligne (évite l'injection d'en-têtes dans l'e-mail).
function form_clean(string $value, bool $multiline): string
{
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = (string) preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', '', $value);
    if (!$multiline) {
        $value = (string) preg_replace('/\s+/u', ' ', $value);
    }
    return trim($value);
}

/* --------------------------------------------------------------------
   Envoi de l'e-mail
   -------------------------------------------------------------------- */

// En mode dev, l'e-mail n'est pas envoyé : il est écrit dans storage_dir/mail.log.
function form_send_mail(array $config, string $subject, string $body, string $replyToEmail, string $replyToName): bool
{
    if (!empty($config['dev_mode'])) {
        $entry = '--- ' . date('c') . " ---\n"
            . 'À : ' . ($config['mail_to'] ?? '') . "\n"
            . 'Répondre à : ' . $replyToName . ' <' . $replyToEmail . ">\n"
            . 'Objet : ' . $subject . "\n\n" . $body . "\n\n";
        return file_put_contents(form_storage_dir($config) . '/mail.log', $entry, FILE_APPEND | LOCK_EX) !== false;
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $config['smtp']['host'];
        $mail->Port = (int) $config['smtp']['port'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp']['username'];
        $mail->Password = $config['smtp']['password'];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;

        // L'expéditeur reste une adresse du domaine (sinon l'e-mail part en spam) ;
        // la personne qui écrit est mise en "Répondre à".
        $mail->setFrom($config['mail_from'], $config['mail_from_name'] ?? 'Calendrier Enduro');
        $mail->addAddress($config['mail_to']);
        $mail->addReplyTo($replyToEmail, $replyToName);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->send();
        return true;
    } catch (\Throwable $error) {
        error_log('Calendrier Enduro : échec de l’envoi de l’e-mail — ' . $error->getMessage());
        return false;
    }
}
