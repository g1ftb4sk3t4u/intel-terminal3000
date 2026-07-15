# Intel Terminal 3000 — Polish v3

This release focuses on readability, theme consistency, source management, and visual intelligence.

## Readability

The Appearance drawer now includes three text sizes:

- Standard
- Large — new default
- Extra large

It also includes two severity styles:

- Balanced — dark tinted rows with severity rails
- High contrast — stronger severity tinting

The setting applies to navigation, command controls, panel headings, tiled articles, IRC rows, metadata, source management, and video cards.

## Themes

All nine command-center palettes were normalized for consistent contrast and reduced eye strain:

- Command Dark
- Analyst Light
- Cyber Operations
- Matrix Terminal
- Synthwave
- LCARS
- Solarized
- Nord
- Dracula

Matrix no longer renders critical IRC rows as a solid fluorescent pink block. Severity is communicated by a colored rail and restrained background tint.

## Intelligence Sources

The sidebar **Intelligence sources** control now opens a full source library with:

- Search
- Category and collector-type filters
- Source health and error visibility
- Last-fetch timestamps
- Per-source manual fetch
- Source removal
- RSS/Atom source creation
- YouTube channel feed creation
- Reddit community creation
- Custom GDELT query creation

### Intelligence packs

The following optional focused GDELT collectors can be installed from the source library:

- Natural Disaster Watch
- Critical Infrastructure
- Space & Launch Watch
- Public Health Watch
- Maritime Chokepoints
- Elections & Civil Unrest
- Supply Chain Watch
- AI & Emerging Technology

Packs are not installed automatically. This prevents unrequested collectors from increasing noise or load.

## Video Intelligence

The Hot Videos module is now a visual-intelligence desk. It:

- Scans the latest 300 reports rather than only 12 high-severity reports
- Detects YouTube, Vimeo, Rumble, Twitch, Dailymotion, Streamable, TikTok, Instagram, X, and Twitter video links
- Shows priority counts and platform filters
- Displays configured YouTube/video channel collectors
- Provides direct access to add YouTube channel RSS feeds

## Deployment

```bash
cd /Intel-terminal3000
git switch main
git pull origin main
cd intel-terminal3000
docker-compose down --remove-orphans
docker-compose up -d --build --force-recreate
docker-compose ps
```

Do not add `-v`; persistent volumes should remain intact.
