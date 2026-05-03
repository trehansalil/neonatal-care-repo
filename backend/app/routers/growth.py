from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.routers.babies import _get_baby

router = APIRouter(prefix="/babies/{baby_id}/growth", tags=["growth"])


@router.get("/", response_model=list[schemas.GrowthOut])
def list_growth(
    baby_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    return (
        db.query(models.GrowthRecord)
        .filter(models.GrowthRecord.baby_id == baby_id)
        .order_by(models.GrowthRecord.recorded_at.asc())
        .all()
    )


@router.post("/", response_model=schemas.GrowthOut, status_code=201)
def add_growth(
    baby_id: int,
    payload: schemas.GrowthCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    record = models.GrowthRecord(**payload.model_dump(), baby_id=baby_id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=204)
def delete_growth(
    baby_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_baby(baby_id, current_user, db)
    record = db.query(models.GrowthRecord).filter(
        models.GrowthRecord.id == record_id, models.GrowthRecord.baby_id == baby_id
    ).first()
    if record:
        db.delete(record)
        db.commit()
