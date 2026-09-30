<?php
// Formulaire de contact : valide la demande et l'envoie par e-mail.
declare(strict_types=1);

require __DIR__ . '/lib/form.php';

const CONTACT_SUBJECTS = [
    'question' => 'Question générale',
    'error' => 'Signaler une erreur sur une randonnée',
    'partnership' => 'Partenariat',
    'other' => 'Autre',
];

form_require_post();
form_reject_bots();

[$data, $errors] = form_validate([
    'name' => ['required' => true, 'max' => 100],
    'email' => ['type' => 'email', 'required' => true, 'max' => 254],
    'subject' => ['type' => 'choice', 'required' => true, 'choices' => array_keys(CONTACT_SUBJECTS)],
    'message' => ['required' => true, 'min' => 10, 'max' => 5000, 'multiline' => true],
    'consent' => ['type' => 'checkbox', 'required' => true],
], $_POST);

if ($errors) {
    form_respond_errors($errors);
}

$config = form_load_config();
form_rate_limit($config);

$subjectLabel = CONTACT_SUBJECTS[$data['subject']];
$body = "Nouveau message depuis le formulaire de contact.\n\n"
    . 'Nom : ' . $data['name'] . "\n"
    . 'E-mail : ' . $data['email'] . "\n"
    . 'Sujet : ' . $subjectLabel . "\n\n"
    . "Message :\n" . $data['message'] . "\n";

if (!form_send_mail($config, '[Sorties Enduro] Contact — ' . $subjectLabel, $body, $data['email'], $data['name'])) {
    form_respond_failure(502, 'Votre message n’a pas pu être envoyé. Merci de réessayer dans quelques minutes.');
}

form_respond_ok();
