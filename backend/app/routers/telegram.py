from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import get_current_user
from app.utils.telegram import send_telegram_message

router = APIRouter(prefix="/telegram", tags=["telegram"])


class TelegramSetup(BaseModel):
    chat_id: str


class TestMessage(BaseModel):
    message: str = "👋 neonate.care is connected! You'll receive reminders and daily summaries here."


@router.post("/setup")
async def setup_telegram(
    payload: TelegramSetup,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.telegram_chat_id = payload.chat_id
    current_user.telegram_notifications = True
    db.commit()
    ok = await send_telegram_message(
        payload.chat_id,
        "👋 <b>neonate.care connected!</b>\nYou'll receive reminders and daily summaries here. 💚",
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Could not send test message — check the chat ID")
    return {"ok": True}


@router.post("/test")
async def test_telegram(
    payload: TestMessage,
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="No Telegram chat ID configured")
    ok = await send_telegram_message(current_user.telegram_chat_id, payload.message)
    return {"ok": ok}
