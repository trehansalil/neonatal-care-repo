"""Telegram notification helper."""

import httpx
from app.config import settings


async def send_telegram_message(chat_id: str, text: str) -> bool:
    if not settings.telegram_bot_token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
            return r.status_code == 200
        except Exception:
            return False


async def send_feed_reminder(chat_id: str, baby_name: str, amount_ml: float) -> bool:
    msg = f"🍼 <b>Feed reminder for {baby_name}</b>\nTime for {int(amount_ml)} ml — you've got this! 💚"
    return await send_telegram_message(chat_id, msg)


async def send_daily_summary(chat_id: str, baby_name: str, stats: dict) -> bool:
    msg = (
        f"📊 <b>Daily summary for {baby_name}</b>\n"
        f"Feeds: {stats.get('feed_count', 0)}\n"
        f"Volume: {int(stats.get('total_ml', 0))} ml\n"
        f"Wet diapers: {stats.get('wet_count', 0)}\n"
        f"Sleep: {stats.get('sleep_minutes', 0):.0f} min\n"
        f"Great job today! 🌟"
    )
    return await send_telegram_message(chat_id, msg)
