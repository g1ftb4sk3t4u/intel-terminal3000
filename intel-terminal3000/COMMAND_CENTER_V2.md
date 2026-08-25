# Intelligence Command Center v2

## Scope

This redesign replaces the crowded dashboard shell with an operational intelligence workspace while preserving the existing backend, APIs, collectors, dashboards, maps, feeds, and data model.

### Included

- Collapsible left navigation rail
- Compact operations top bar and command search
- Live metric strip for priority reports, 24-hour volume, active sources, mapped events, and local time
- Responsive 12-column panel workspace
- Global Panels / IRC stream presentation switch
- Critical-focus mode
- Clickable panel headings and double-click panel expansion
- Theme gallery with Command Dark, Analyst Light, Cyber Operations, Matrix, Synthwave, LCARS, Solarized, Nord, and Dracula
- Comfortable, compact, and maximum-intelligence density modes
- Persistent grid, glow, motion, theme, density, sidebar, and feed-view preferences
- Dashboard selector, administrator control, help control, and source-management access
- Theme-aware Chart.js and map presentation
- Desktop, tablet, and mobile layouts

## Backup

The pre-redesign deployed frontend is preserved in:

`backup/pre-command-center-redesign-2026-07-15`

The branch points to commit:

`00b6eeb95ff173ffcbe0c05afafbedad5eb2e81f`

## Linode deployment

From the repository on the server:

```bash
git switch main
git pull origin main
cd intel-terminal3000
docker-compose down --remove-orphans
docker-compose up -d --build --force-recreate
docker-compose ps
```

Do not use `-v`; persistent volumes should remain intact.

## Rollback

```bash
git fetch origin
git switch --detach origin/backup/pre-command-center-redesign-2026-07-15
cd intel-terminal3000
docker-compose down --remove-orphans
docker-compose up -d --build --force-recreate
```

To return to the current release:

```bash
git switch main
git pull origin main
cd intel-terminal3000
docker-compose down --remove-orphans
docker-compose up -d --build --force-recreate
```

## Testing note

The redesign is additive and frontend-only. JavaScript syntax and stylesheet delimiter checks were performed. A final browser smoke test should be performed against the Linode deployment because the production API, WebSocket, Leaflet maps, and Docker proxy are only fully available there.
