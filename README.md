# ⛺ CampCloud — Campingplatz-Verwaltungssoftware

**Kostenlose, Open-Source-Alternative zu CloudCamping.**  
Kein Abo. Keine versteckten Kosten. Deine Daten, dein Server.

---

## Was brauchst du, um es zum Laufen zu bringen?

### Kurzantwort

| Szenario | Was du brauchst |
|----------|----------------|
| **Nur lokal testen** | Node.js 18+ (kein Docker nötig) |
| **Lokal mit Docker** | Docker Desktop — kein Node nötig |
| **Gratis online** | GitHub-Account + Vercel (kostenlos) + Supabase (kostenlos) |
| **Eigener Server** | VPS (z.B. Hetzner ~4 €/Monat) + Docker |

> **Docker ist nicht zwingend notwendig**, macht aber die Einrichtung sauberer und den Betrieb auf einem eigenen Server einfacher.

---

## Voraussetzung: Supabase einrichten (für alle Optionen)

Supabase stellt die Datenbank und Authentifizierung bereit — kostenlos bis 500 MB.

1. [supabase.com](https://supabase.com) → kostenlosen Account erstellen
2. **"New Project"** → Name (z.B. `campcloud`), Passwort wählen, Region: Frankfurt
3. Warten bis Projekt bereit ist (~2 Min.)
4. **SQL Editor** → **"New query"** → Inhalt von `supabase/schema.sql` einfügen → **"Run"**
5. **Project Settings → API** → diese zwei Werte kopieren:
   - `Project URL` → wird zu `VITE_SUPABASE_URL`
   - `anon public` Key → wird zu `VITE_SUPABASE_ANON_KEY`

---

## Option A — Lokal ohne Docker (schnellster Start)

**Benötigt:** Node.js 18 oder neuer → [nodejs.org](https://nodejs.org)

```bash
# 1. Ins Projektverzeichnis
cd campcloud

# 2. Abhängigkeiten installieren
npm install

# 3. Umgebungsvariablen anlegen
cp .env.example .env
# Jetzt .env öffnen und die zwei Supabase-Werte eintragen

# 4. Starten
npm run dev
```

→ App läuft auf **http://localhost:5173**

---

## Option B — Lokal mit Docker (kein Node.js nötig)

**Benötigt:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) — das war's.

```bash
# 1. .env anlegen
cp .env.example .env
# .env öffnen und Supabase-Werte eintragen

# 2. Entwicklungsserver starten (mit Hot Reload)
docker compose up dev
```

→ App läuft auf **http://localhost:5173**

```bash
# Produktions-Build lokal testen (nginx, wie auf dem Server)
docker compose up prod
```

→ App läuft auf **http://localhost:80**

---

## Option C — Gratis online (Vercel, empfohlen)

Kein eigener Server nötig. Vercel hostet die App kostenlos mit HTTPS und eigener Domain.

### Schritt 1 — Code auf GitHub

```bash
git init
git add .
git commit -m "CampCloud initial"
# GitHub → New Repository anlegen → URL kopieren
git remote add origin https://github.com/DEINNAME/campcloud.git
git push -u origin main
```

### Schritt 2 — Vercel verbinden

1. [vercel.com](https://vercel.com) → mit GitHub anmelden → **"Add New Project"**
2. Dein Repository auswählen → **"Import"**
3. Framework: **Vite** (wird automatisch erkannt)
4. **"Environment Variables"** aufklappen → zwei Variablen eintragen:
   - `VITE_SUPABASE_URL` = deine Supabase-URL
   - `VITE_SUPABASE_ANON_KEY` = dein Supabase Key
5. **"Deploy"** klicken

→ Nach ~1 Minute ist die App live unter `https://campcloud-xxx.vercel.app`

### Eigene Domain (optional, kostenlos)

Vercel → Dein Projekt → **Settings → Domains → Add** → z.B. `camping.meinedomain.de`  
Vercel zeigt dir die DNS-Einstellungen. SSL-Zertifikat wird automatisch ausgestellt.

### Automatische Updates

Ab jetzt: jedes `git push` → Vercel deployt automatisch die neue Version. Kein manueller Schritt nötig.

---

## Option D — Eigener Server (VPS mit Docker)

Wenn du keine Abhängigkeit von Vercel möchtest oder eine feste IP brauchst.

**Günstiger Einstieg:** Hetzner CX22 (~4 €/Monat), 2 vCPUs, 4 GB RAM, Ubuntu 24.04

### Server einrichten

```bash
# Docker auf dem Server installieren
curl -fsSL https://get.docker.com | sh

# Ins Projektverzeichnis (per git clone oder scp)
git clone https://github.com/DEINNAME/campcloud.git
cd campcloud

# .env anlegen
cp .env.example .env
nano .env   # Supabase-Werte eintragen

# App bauen und starten
docker compose up prod -d
```

→ App läuft auf Port 80 deines Servers.

### HTTPS mit eigenem Domainnamen (Caddy, kostenlos)

```bash
# Caddy als Reverse Proxy mit automatischem SSL
docker run -d \
  -p 443:443 -p 80:80 \
  -v caddy_data:/data \
  -e DOMAIN=camping.meinedomain.de \
  caddy caddy reverse-proxy --from camping.meinedomain.de --to localhost:80
```

→ App ist unter `https://camping.meinedomain.de` erreichbar, SSL automatisch.

### Updates einspielen

```bash
git pull
docker compose up prod -d --build
```

---

## Kostenübersicht

| Dienst | Free-Tier | Reicht für... |
|--------|-----------|---------------|
| Supabase | 500 MB DB, 50.000 Auth/Monat | 1 Campingplatz problemlos |
| Vercel | 100 GB Bandwidth/Monat | Problemlos für interne Nutzung |
| Hetzner VPS (optional) | — | ~4 €/Monat für vollen Eigenbetrieb |

**Gesamtkosten für Option A/B/C: 0 €**

---

## Projektstruktur

```
campcloud/
├── src/
│   ├── App.jsx              # Router & Auth-Wrapper
│   ├── index.css            # Design-System & globale Styles
│   ├── hooks/useAuth.jsx    # Auth-Context (Login, Session, Campground)
│   ├── lib/
│   │   ├── supabase.js      # Supabase-Client
│   │   └── utils.js         # Hilfsfunktionen
│   ├── components/ui.jsx    # Icons, Toast, Modal, Avatar, Spinner
│   └── pages/               # Dashboard, Buchungen, Stellplätze, Gäste...
├── supabase/schema.sql      # Datenbankschema + RLS + Auth-Trigger
├── Dockerfile               # Multi-stage Build (Node → Nginx)
├── docker-compose.yml       # Dev (hot-reload) + Prod (nginx)
├── nginx.conf               # SPA-Routing + Caching + Security-Header
├── .env.example             # Vorlage für Umgebungsvariablen
└── vercel.json              # Vercel SPA-Routing
```

---

## E-Mail-Bestätigung deaktivieren (empfohlen für internen Einsatz)

Supabase → **Authentication → Providers → Email → "Confirm email"** deaktivieren  
→ Registrierung funktioniert sofort ohne E-Mail-Bestätigung.

---

## Häufige Fragen

**Brauche ich Docker für Vercel?**  
Nein. Vercel baut die App selbst. Docker brauchst du nur für lokalen Betrieb ohne Node.js oder für einen eigenen Server.

**Brauche ich einen eigenen Server für die Cloud-Veröffentlichung?**  
Nein. Vercel hostet die App kostenlos. Einen eigenen Server (VPS) brauchst du nur wenn du:
- keine Abhängigkeit von Vercel willst
- alles selbst kontrollieren möchtest
- mehr als 100 GB Traffic/Monat erwartest

**Meine Daten — wo liegen sie?**  
Ausschließlich in deiner eigenen Supabase-Datenbank. Vercel speichert keine App-Daten.

**Mehrere Campingplätze?**  
Jeder Account verwaltet einen Campingplatz. Einfach mehrere Accounts anlegen.

**Backup?**  
Supabase → **Database → Backups** (täglich automatisch, 7 Tage aufbewahrt).

---

## Lizenz

MIT — frei nutzbar, änderbar und verteilbar.

