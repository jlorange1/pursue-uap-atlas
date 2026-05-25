# PURSUE UAP Atlas

Local interactive dashboard and SQLite database for public UAP/UFO release material, official archival records, public sighting reports, and baseline comparison datasets.

## Run

```powershell
npm.cmd start
```

Open http://localhost:4173.

## Share For Free

Temporary live link from this computer:

```powershell
npm.cmd run share
```

The command prints a free `trycloudflare.com` URL. Keep this computer awake while people use it.

Stop sharing:

```powershell
npm.cmd run stop:share
```

Permanent/free static-host build:

```powershell
npm.cmd run build:static
```

Upload the `docs` folder to a free static host such as GitHub Pages, Netlify, or Cloudflare Pages. The static build uses JSON files instead of the local SQLite API, so it does not need a paid server.

## Data Snapshot

- `data/uap_findings.db`: SQLite database used by the local API.
- `data/uap_findings.json`: JSON export of the same snapshot.
- `data/public_sightings_lite.json`: static full public sighting report export for GitHub Pages.
- `scripts/build_database.py`: crawler/importer for rebuilding the database.

Current snapshot:

- 70 PURSUE/UAP case groups
- 200 released file records
- 399 generated cross-reference edges
- 155 official/open-source document collections
- 111 official NARA metadata records
- 80,332 public sighting reports from the Zenodo geocoded UFO report dataset
- 12,523 baseline comparison events from NASA/JPL CNEOS fireballs and FAA UAS/drone sightings
- 7 generated research signals
- 9 OSINT method notes

The first tab is an Intel command center: it shows source health, recursive research methodology, evidence-class integration, generated next-action signals, and a local cross-database search. Baseline events are kept separate from UAP reports so they can challenge or contextualize sightings without overwriting the original source record.

The row-level PURSUE case data is crawled from the public UAP UFO index, which mirrors the WAR.GOV/UFO manifest and source links. WAR.GOV confirms PURSUE Release 01 on May 8, 2026 and Release 02 on May 22, 2026, but the accessible row-level manifest currently exposes the detailed records as Release 01. The app keeps that distinction visible in source notes and findings.

Public sighting reports are kept separate from official records. They are useful for OSINT leads, pattern browsing, and hypothesis generation, not as validated event evidence.
