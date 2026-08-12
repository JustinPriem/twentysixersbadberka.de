<?php
/**
 * Kontaktformular-Handler für Strato-PowerWeb-Hosting (PHP + mail()).
 * Empfängt POST-Daten vom Formular auf /kontakt/ und leitet sie per E-Mail weiter.
 *
 * WICHTIG vor dem Live-Gang:
 * - EMPFAENGER_EMAIL unten auf die echte Vereins-Mailadresse setzen.
 * - ABSENDER_DOMAIN auf die eigene Domain setzen (manche Hoster verlangen eine
 *   Absenderadresse aus der eigenen Domain, sonst landet die Mail im Spam).
 * - Für zusätzlichen Spam-Schutz kann später ein Captcha (z. B. hCaptcha) ergänzt werden.
 */

declare(strict_types=1);

const EMPFAENGER_EMAIL = "info@twentysixersbadberka.de";
const ABSENDER_ADRESSE = "webseite@twentysixersbadberka.de";

header("Content-Type: application/json; charset=utf-8");

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(405, ["error" => "Methode nicht erlaubt."]);
}

// Honeypot: befülltes verstecktes Feld = Bot. So tun, als wäre alles gut, aber nichts senden.
if (!empty($_POST["website"] ?? "")) {
    respond(200, ["ok" => true]);
}

function cleanField(string $value): string
{
    // Entfernt Zeilenumbrüche etc., um Header-Injection in mail() zu verhindern.
    return trim(str_replace(["\r", "\n"], "", $value));
}

$name = cleanField((string) ($_POST["name"] ?? ""));
$email = cleanField((string) ($_POST["email"] ?? ""));
$betreff = cleanField((string) ($_POST["betreff"] ?? ""));
$nachricht = trim((string) ($_POST["nachricht"] ?? ""));

$errors = [];
if ($name === "") $errors[] = "Name fehlt.";
if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = "Gültige E-Mail-Adresse fehlt.";
if ($betreff === "") $errors[] = "Betreff fehlt.";
if ($nachricht === "") $errors[] = "Nachricht fehlt.";

if (!empty($errors)) {
    respond(422, ["error" => "Ungültige Eingabe.", "details" => $errors]);
}

$subject = "[Kontaktformular] " . $betreff;
$body = "Neue Nachricht über das Kontaktformular auf twentysixersbadberka.de\n\n"
    . "Name: {$name}\n"
    . "E-Mail: {$email}\n"
    . "Betreff: {$betreff}\n\n"
    . "Nachricht:\n{$nachricht}\n";

$headers = [
    "From: twentysixersbadberka.de <" . ABSENDER_ADRESSE . ">",
    "Reply-To: {$name} <{$email}>",
    "Content-Type: text/plain; charset=UTF-8",
];

$success = mail(EMPFAENGER_EMAIL, $subject, $body, implode("\r\n", $headers));

if (!$success) {
    respond(500, ["error" => "Mail konnte nicht gesendet werden."]);
}

respond(200, ["ok" => true]);
