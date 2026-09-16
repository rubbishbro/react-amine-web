"""
新番时间表 API（数据源：Bangumi 开放 API https://api.bgm.tv/calendar）
带进程内缓存，避免频繁请求上游。
"""
from __future__ import annotations

import time
from threading import Lock
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings

router = APIRouter()

_cache: dict[str, Any] = {"data": None, "ts": 0.0}
_lock = Lock()


def _simplify(raw_calendar: list) -> list:
    def httpsify(value: str) -> str:
        return value.replace("http://", "https://", 1) if isinstance(value, str) and value.startswith("http://") else value

    days = []
    for day in raw_calendar or []:
        weekday = day.get("weekday") or {}
        items = []
        for it in day.get("items") or []:
            images = it.get("images") or {}
            name_cn = (it.get("name_cn") or "").strip()
            items.append({
                "id": it.get("id"),
                "name": it.get("name") or "",
                "name_cn": name_cn or it.get("name") or "",
                "image": httpsify(images.get("common") or images.get("medium") or images.get("large") or ""),
                "url": httpsify(it.get("url") or (f"https://bgm.tv/subject/{it.get('id')}" if it.get("id") else "")),
                "air_date": it.get("air_date") or "",
                "score": (it.get("rating") or {}).get("score"),
            })
        days.append({
            "weekday_id": weekday.get("id"),
            "weekday_cn": weekday.get("cn") or weekday.get("en") or "",
            "items": items,
        })
    return days


@router.get("/calendar")
async def anime_calendar() -> Any:
    """每日放送（新番时间表），缓存 BANGUMI_CACHE_SECONDS 秒。"""
    now = time.time()
    cached = _cache.get("data")
    if cached is not None and now - float(_cache.get("ts") or 0) < settings.BANGUMI_CACHE_SECONDS:
        return cached

    url = f"{settings.BANGUMI_API_BASE.rstrip('/')}/calendar"
    headers = {"User-Agent": settings.BANGUMI_USER_AGENT, "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as error:
        if cached is not None:
            # 上游失败时回退旧缓存，保证页面可用
            return cached
        raise HTTPException(status_code=502, detail="新番数据源暂时不可用") from error

    data = {"updated_at": int(now), "source": "bangumi", "days": _simplify(raw)}
    with _lock:
        _cache["data"] = data
        _cache["ts"] = now
    return data
