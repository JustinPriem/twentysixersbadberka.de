# twentysixersbadberka.de

Vereinswebsite für **twentysixersbadberka** – den Dartverein aus Bad Berka.

Gebaut mit [Astro](https://astro.build) (statischer Export), einer 3D-Scroll-Animation
(Three.js + GSAP ScrollTrigger) auf der Startseite und [Decap CMS](https://decapcms.org) zur
Content-Pflege durch den Vorstand. Deployment erfolgt per GitHub Actions per FTP auf ein
Strato-PowerWeb-Hosting.

## Tech-Stack

- **[Astro](https://astro.build)** – statischer Seitenbau (SSG), Ausgabe ist reines HTML/CSS/JS
- **[Three.js](https://threejs.org) + [GSAP ScrollTrigger](https://gsap.com/scrolltrigger/)** – die Dartpfeil-Scroll-Animation im Hero
- **[Decap CMS](https://decapcms.org)** – Git-basiertes CMS unter `/admin` für News, Termine, Ergebnisse, Sponsoren, Mannschaften
- **PHP** (`public/contact.php`) – Mailversand des Kontaktformulars (läuft auf Strato-PowerWeb)
- **GitHub Actions** – Build + FTPS-Deployment zu Strato

## Lokale Entwicklung

```bash
npm install
npm run dev       # Dev-Server unter http://localhost:4321
npm run build     # Typprüfung (astro check) + Produktionsbuild nach dist/
npm run preview   # Produktionsbuild lokal testen
```

## Projektstruktur

```
src/
  components/       Header, Footer, DartHero (Hero-Animation), ScrollReveal
  layouts/          BaseLayout.astro (SEO-Meta, globales Markup)
  lib/               dartboard.ts, dart.ts, dartHero.ts – 3D-Szene & Scroll-Logik
  content/           Von Decap CMS gepflegte Inhalte (news, termine, ergebnisse, sponsoren, mannschaften)
  content.config.ts Schema-Definitionen der Content Collections
  pages/             Alle Routen der Website
public/
  admin/             Decap-CMS-Oberfläche (config.yml + index.html)
  contact.php        Kontaktformular-Handler für Strato
.github/workflows/  deploy.yml – Build & FTPS-Deploy
```

## Die Hero-Animation

`src/components/DartHero.astro` + `src/lib/dartHero.ts` steuern eine an den Scrollfortschritt
gekoppelte Three.js-Szene: Der Dartpfeil fliegt in die Triple-20, es blitzt kurz auf, die
Dartscheibe löst sich auf und der Vereinsname erscheint. Die komplette Logik ist deterministisch
über `progress` (0–1) berechnet, damit Vor- und Zurückscrollen sauber funktioniert.
`prefers-reduced-motion` wird respektiert: dann erscheint der Text sofort, ohne Scroll-Pinning.

## Content-Pflege (CMS)

Der Vorstand pflegt News, Termine, Ergebnisse, Sponsoren und Mannschaften über eine
Weboberfläche unter `https://twentysixersbadberka.de/admin/` (Decap CMS). Änderungen werden
als Commit direkt ins GitHub-Repo geschrieben – die GitHub Action baut die Seite danach
automatisch neu und lädt sie zu Strato hoch.

**Einmalige Einrichtung (noch offen):**

1. **GitHub OAuth App anlegen**: GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   Homepage URL: `https://twentysixersbadberka.de`, Callback URL: `https://<oauth-proxy>/callback`.
2. **OAuth-Proxy deployen**: Decap CMS braucht für den GitHub-Login einen kleinen Server, der den
   OAuth-Handshake abwickelt (Strato-Webhosting kann das nicht, da kein Node.js). Dafür reicht ein
   kostenloses Konto bei Vercel oder Cloudflare Workers – z. B. mit
   [`decap-cms-oauth`](https://github.com/sterlingwes/decap-cms-oauth) oder einem vergleichbaren
   Referenz-Handler. Client-ID/-Secret der OAuth App dort als Umgebungsvariablen eintragen.
3. In `public/admin/config.yml` den Platzhalter `base_url` durch die URL dieses Proxys ersetzen.
4. Board-Mitglieder als Collaborator im GitHub-Repo hinzufügen (Decap CMS meldet sich mit deren
   GitHub-Account an).

## Deployment (Strato)

Der Workflow `.github/workflows/deploy.yml` baut das Projekt bei jedem Push auf `main` und lädt
den Inhalt von `dist/` per FTPS zu Strato hoch. Dafür müssen folgende **Repository-Secrets**
gesetzt werden (GitHub → Settings → Secrets and variables → Actions):

| Secret                   | Beschreibung                                             |
| ------------------------ | --------------------------------------------------------- |
| `STRATO_FTP_SERVER`      | FTP-Host, z. B. `ftp.twentysixersbadberka.de`             |
| `STRATO_FTP_USERNAME`    | FTP-Benutzername aus dem Strato-Kundenmenü                |
| `STRATO_FTP_PASSWORD`    | FTP-Passwort                                               |
| `STRATO_FTP_SERVER_DIR`  | Zielordner im Webspace (häufig `/` oder `/htdocs/`)        |

Die Domain `twentysixersbadberka.de` muss im Strato-Kundenmenü auf den Webspace zeigen, in den
deployed wird.

## Kontaktformular

`public/contact.php` verschickt Formular-Einsendungen per PHP `mail()` – das läuft auf
Strato-PowerWeb-Hosting ohne weitere Einrichtung. Vor dem Live-Gang in der Datei die Konstante
`EMPFAENGER_EMAIL` prüfen/anpassen. Ein Honeypot-Feld blockt einfache Spam-Bots ab; für mehr
Schutz kann später ein Captcha (z. B. hCaptcha) ergänzt werden.

## Offene TODOs vor dem Live-Gang

- [ ] **Echtes Logo & Farbkonzept** – aktuell wird ein Platzhalter-Branding im
      Dartscheiben-Look verwendet (`src/styles/global.css`).
- [ ] **Impressum & Datenschutz** ausfüllen (`src/pages/impressum.astro`,
      `src/pages/datenschutz.astro`) – aktuell nur Platzhalter-Struktur, **keine
      Rechtsberatung**, bitte prüfen lassen.
- [ ] **Echte Vereinsdaten**: Vorstand (`src/pages/verein.astro`), Mannschaften/Kader
      (`src/content/mannschaften/`), Beitragsordnung (`src/pages/mitglied-werden.astro`)
- [ ] **Decap-CMS-OAuth-Proxy** einrichten (siehe oben)
- [ ] **Fotos** für Galerie und Sponsoren-Logos einpflegen
- [ ] **Strato-FTP-Secrets** in GitHub hinterlegen, Domain-DNS prüfen
- [ ] Social-Media-Links in `Footer.astro` auf echte Profile setzen
