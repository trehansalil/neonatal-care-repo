from fastapi import APIRouter, Depends
from app import schemas
from app.auth import get_current_user
from app import models
from app.utils.routine_calc import calculate_routine

router = APIRouter(prefix="/routine", tags=["routine"])


@router.post("/calculate", response_model=schemas.RoutineResponse)
def calculate(
    payload: schemas.RoutineRequest,
    current_user: models.User = Depends(get_current_user),
):
    return calculate_routine(
        weight_kg=payload.weight_kg,
        care_plan=payload.care_plan,
        feeding_method=payload.feeding_method,
    )
