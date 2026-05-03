from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.routers.babies import _get_baby

router = APIRouter(prefix="/babies/{baby_id}/logs", tags=["logs"])


@router.get("/", response_model=list[schemas.LogOut])
def list_logs(
    baby_id: int,
    limit: int = Query(50, le=200),
    since: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    q = db.query(models.LogEntry).filter(models.LogEntry.baby_id == baby_id)
    if since:
        q = q.filter(models.LogEntry.logged_at >= since)
    return q.order_by(models.LogEntry.logged_at.desc()).limit(limit).all()


@router.post("/", response_model=schemas.LogOut, status_code=201)
def create_log(
    baby_id: int,
    payload: schemas.LogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    data = payload.model_dump()
    if not data.get("logged_at"):
        data["logged_at"] = datetime.now(timezone.utc)
    entry = models.LogEntry(**data, baby_id=baby_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{log_id}", status_code=204)
def delete_log(
    baby_id: int,
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    entry = db.query(models.LogEntry).filter(
        models.LogEntry.id == log_id, models.LogEntry.baby_id == baby_id
    ).first()
    if entry:
        db.delete(entry)
        db.commit()


@router.get("/stats/today", response_model=schemas.DayStats)
def today_stats(
    baby_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    logs = (
        db.query(models.LogEntry)
        .filter(models.LogEntry.baby_id == baby_id, models.LogEntry.logged_at >= day_start)
        .all()
    )
    return _compute_stats(str(now.date()), logs)


@router.get("/stats/week", response_model=list[schemas.DayStats])
def week_stats(
    baby_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    now = datetime.now(timezone.utc)
    result = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        logs = (
            db.query(models.LogEntry)
            .filter(
                models.LogEntry.baby_id == baby_id,
                models.LogEntry.logged_at >= day_start,
                models.LogEntry.logged_at < day_end,
            )
            .all()
        )
        result.append(_compute_stats(str(day.date()), logs))
    return result


def _compute_stats(date: str, logs: list) -> schemas.DayStats:
    feed_count = sum(1 for l in logs if l.log_type in ("feed_bottle", "feed_breast"))
    total_ml = sum(l.amount_ml or 0 for l in logs if l.log_type == "feed_bottle")
    wet_count = sum(1 for l in logs if l.log_type == "wet")
    soiled_count = sum(1 for l in logs if l.log_type == "soiled")
    sleep_min = sum(l.duration_min or 0 for l in logs if l.log_type == "sleep_end")
    temps = [l.temperature_c for l in logs if l.temperature_c is not None]
    avg_temp = sum(temps) / len(temps) if temps else None
    return schemas.DayStats(
        date=date,
        feed_count=feed_count,
        total_ml=total_ml,
        wet_count=wet_count,
        soiled_count=soiled_count,
        sleep_minutes=sleep_min,
        avg_temp=avg_temp,
    )
