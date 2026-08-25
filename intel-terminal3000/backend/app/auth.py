"""
Intel Terminal 3000 - Admin auth for write endpoints.

Every mutating endpoint (add/edit/delete sources, dashboards, categories,
keywords, settings, etc) requires an X-Admin-Key header matching
ADMIN_API_KEY. Fails closed: if ADMIN_API_KEY isn't set, every gated route
is locked - there is no "forgot to configure it" fallback to open.
"""
import hmac

from fastapi import Header, HTTPException

from .config import get_settings


async def require_admin(x_admin_key: str = Header(default="")) -> None:
    settings = get_settings()
    configured_key = settings.admin_api_key
    if not configured_key or not hmac.compare_digest(x_admin_key, configured_key):
        raise HTTPException(status_code=403, detail="Admin key required for this action")
