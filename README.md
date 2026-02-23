# NVIDIA Session Hub

Production-focused session intake web app for NVIDIA GR00T Robotics workflows, built with Google Apps Script.

## Why It Is Useful in NVIDIA GR00T Robotics Production

- Standardizes how operators and team leads submit session data for robotics workflows.
- Reduces manual inconsistencies through required fields and validation rules.
- Improves traceability by writing consistent records to multiple downstream sheets.
- Supports operational coordination by centralizing task/mode metadata from config.
- Increases reliability through guarded writes and lock-based concurrency handling.

## Core Pros

- **Operational consistency:** Shared form structure across users and shifts.
- **Input validation:** Early checks reduce bad entries and cleanup work.
- **Structured outputs:** Deterministic writes to Session Inputs, Output Tracker, and Meshcat sheets.
- **Fast onboarding:** Form-driven UI with preloaded metadata and clear user flow.
- **Low infrastructure overhead:** Runs on Google Apps Script + Google Sheets.

## Primary Uses in GR00T Production Work

- Session intake for operators and team leaders.
- Task assignment and mode selection with controlled vocabularies.
- BOB and LI pathway data capture for downstream processing.
- Logging output-tracker-ready rows for pipeline visibility.
- Maintaining auditable submission history for process monitoring.

## Tech Stack

- Google Apps Script (server + web app runtime)
- HTML/CSS/JavaScript (front-end UI)
- Google Sheets (data sink and workflow tracking)

## Project Structure

- `Code.gs` — app entry points (`doGet`, user identity)
- `Auth.gs` — metadata shaping and access checks
- `DataService.gs` — validation + transactional sheet writes
- `Config.gs` — environment configuration and task metadata
- `Index.html` — web app UI and client-side behavior
- `appsscript.json` — Apps Script manifest/scopes

## Setup

1. Create a new Apps Script project.
2. Copy all source files from this repository into the project.
3. Update `Config.gs` placeholders with your own spreadsheet IDs and non-sensitive operational metadata.
4. Ensure your sheet tabs match expected writer targets (Session Inputs/BOB, Output Tracker, Meshcat).
5. Deploy as Web App and allow the required access model for your org.
6. Open the deployed URL and verify submission flow end-to-end.

## Security and Privacy Notes

- Do not commit personal emails, internal IDs, or confidential identifiers to public repos.
- Keep organization-specific sheet IDs in secure/private configuration workflows.
- Review Apps Script OAuth scopes before each release.

## Portfolio / Demo Links

- Portfolio: `https://kylejbonachita.github.io/`
- Repository: `https://github.com/KyleJBonachita/nvidia-session-hub`
- Live App URL format: `https://script.google.com/macros/s/AKfycbwEx_PH6KX1UhEY0V1TRg7QFhZmYx3D5_NzyFDzcVUzSXKKg_cAYiAkDrP5CcIM543BzQ/exec`

## License

MIT — see `LICENSE`.
