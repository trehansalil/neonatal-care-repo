from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/babies", tags=["babies"])


def _get_baby(baby_id: int, user: models.User, db: Session) -> models.Baby:
    baby = db.query(models.Baby).filter(
        models.Baby.id == baby_id, models.Baby.user_id == user.id
    ).first()
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
    return baby


@router.get("/", response_model=list[schemas.BabyOut])
def list_babies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Baby).filter(models.Baby.user_id == current_user.id).all()


@router.post("/", response_model=schemas.BabyOut, status_code=201)
def create_baby(
    payload: schemas.BabyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    baby = models.Baby(**payload.model_dump(), user_id=current_user.id)
    db.add(baby)
    db.commit()
    db.refresh(baby)
    return baby


@router.get("/{baby_id}", response_model=schemas.BabyOut)
def get_baby(
    baby_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _get_baby(baby_id, current_user, db)


@router.patch("/{baby_id}", response_model=schemas.BabyOut)
def update_baby(
    baby_id: int,
    payload: schemas.BabyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    baby = _get_baby(baby_id, current_user, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(baby, field, value)
    db.commit()
    db.refresh(baby)
    return baby


@router.delete("/{baby_id}", status_code=204)
def delete_baby(
    baby_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    baby = _get_baby(baby_id, current_user, db)
    db.delete(baby)
    db.commit()
