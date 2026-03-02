# Intel Terminal 1000: Dashboard Filters & Usage Guide

## Overview
Intel Terminal 1000 is a multi-dashboard intelligence aggregation platform. It allows you to create custom dashboards with panels that can be filtered by source type (e.g., Reddit, Twitter), category, severity, and region. This guide provides a step-by-step SOP and tutorial for using filters and building focused dashboards.

---

## 1. Creating a New Dashboard
1. Click the **+ New Dashboard** button in the top-right of the app.
2. Enter a name for your dashboard.
3. Select a layout (e.g., 2x2 for four panels).
4. Configure each panel (see below for filter details).
5. Click **Save Dashboard**.

---

## 2. Panel Types & Filters
Each dashboard panel can be set to a module type:
- **Feed**: Live article feed (supports filters)
- **Map**: Geographic heat map
- **Stats**: Real-time statistics
- **Chart**: Timeline chart
- **Alerts**: Critical alerts
- **Starred**: Starred articles
- **Trending**: Regional spikes and trending topics

### Feed Panel Filters
When adding or editing a Feed panel, you can filter by:
- **Category**: e.g., cyber, geopolitical, military
- **Severity**: critical, high, medium, low
- **Source Type**: rss, gdelt, reddit, bluesky, telegram, etc.
- **Region**: e.g., North America, Europe

#### Example: Reddit-Only Feed
1. Add a Feed panel.
2. In the filter dropdowns, set **Source Type** to `reddit`.
3. Optionally, set other filters (e.g., category, severity).
4. Save the panel.

#### Example: Twitter-Only Feed
1. Add a Feed panel.
2. Set **Source Type** to `twitter` (if supported/available).
3. Save the panel.

#### Example: Multi-Source Dashboard
- Add multiple Feed panels, each filtered by a different source type (e.g., one for Reddit, one for RSS, one for Telegram).

---

## 3. Trending & Developing Stories
- Add a **Trending** panel to your dashboard to see spikes and developing topics.
- The Trending panel uses backend analytics to highlight stories gaining traction.

---

## 4. Saving & Switching Dashboards
- Use the dashboard selector at the top to switch between dashboards.
- You can delete or edit dashboards at any time.

---

## 5. Advanced Tips
- Combine filters for highly focused intelligence (e.g., Reddit + "cyber" + "critical").
- Use the Map panel to visualize geographic distribution of filtered stories.
- Use the Stats panel to see breakdowns by source, category, and severity.

---

## 6. API Reference (for advanced users)
- `/api/articles?source_type=reddit` — Get only Reddit stories
- `/api/articles?category=cyber&severity=critical` — Filter by category and severity

---

## 7. Troubleshooting
- If filters do not appear, ensure you are editing a Feed panel (not all modules support filters).
- Use Shift+F5 to hard refresh if UI changes are not visible.

---

## 8. More Help
- See the main README for full platform features.
- For questions or issues, open an issue on GitHub.

---

*This guide is maintained for Intel Terminal 1000 v2.0 and above.*
