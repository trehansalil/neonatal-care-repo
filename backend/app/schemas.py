from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    onboarding_complete: bool
    telegram_notifications: bool
    telegram_chat_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Baby ──────────────────────────────────────────────────────────────────────

class BabyCreate(BaseModel):
    name: str
    date_of_birth: str
    birth_weight_kg: float = 3.0
    current_weight_kg: Optional[float] = None
    gender: Optional[str] = None
    care_plan: str = "standard"
    feeding_method: str = "bottle"


class BabyUpdate(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    birth_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    gender: Optional[str] = None
    care_plan: Optional[str] = None
    feeding_method: Optional[str] = None


class BabyOut(BaseModel):
    id: int
    name: str
    date_of_birth: str
    birth_weight_kg: float
    current_weight_kg: Optional[float]
    gender: Optional[str]
    care_plan: str
    feeding_method: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Log Entries ───────────────────────────────────────────────────────────────

class LogCreate(BaseModel):
    log_type: str
    amount_ml: Optional[float] = None
    duration_min: Optional[float] = None
    detail: Optional[str] = None
    temperature_c: Optional[float] = None
    notes: Optional[str] = None
    logged_at: Optional[datetime] = None


class LogOut(BaseModel):
    id: int
    baby_id: int
    log_type: str
    amount_ml: Optional[float]
    duration_min: Optional[float]
    detail: Optional[str]
    temperature_c: Optional[float]
    notes: Optional[str]
    logged_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ── Growth ────────────────────────────────────────────────────────────────────

class GrowthCreate(BaseModel):
    recorded_at: str
    weight_kg: Optional[float] = None
    length_cm: Optional[float] = None
    head_cm: Optional[float] = None
    notes: Optional[str] = None


class GrowthOut(BaseModel):
    id: int
    baby_id: int
    recorded_at: str
    weight_kg: Optional[float]
    length_cm: Optional[float]
    head_cm: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Stats ─────────────────────────────────────────────────────────────────────

class DayStats(BaseModel):
    date: str
    feed_count: int
    total_ml: float
    wet_count: int
    soiled_count: int
    sleep_minutes: float
    avg_temp: Optional[float]


# ── Routine ───────────────────────────────────────────────────────────────────

class RoutineRequest(BaseModel):
    weight_kg: float
    care_plan: str = "standard"
    feeding_method: str = "bottle"


class FeedScheduleItem(BaseModel):
    time: str
    label: str
    amount_ml: float
    notes: str = ""


class RoutineResponse(BaseModel):
    weight_kg: float
    feeds_per_day: int
    amount_per_feed_ml: float
    interval_hours: float
    daily_total_ml: float
    schedule: list[FeedScheduleItem]
    wet_goal_per_day: int
    notes: list[str]


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    full_name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_notifications: Optional[bool] = None
    onboarding_complete: Optional[bool] = None
