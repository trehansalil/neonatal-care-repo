from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, Enum
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class CarePlan(str, enum.Enum):
    hydronephrosis = "hydronephrosis"
    standard = "standard"


class FeedingMethod(str, enum.Enum):
    breast = "breast"
    bottle = "bottle"
    mixed = "mixed"


class LogType(str, enum.Enum):
    feed_bottle = "feed_bottle"
    feed_breast = "feed_breast"
    wet = "wet"
    soiled = "soiled"
    sleep_start = "sleep_start"
    sleep_end = "sleep_end"
    meds = "meds"
    temp = "temp"
    weight = "weight"


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, default="")
    telegram_chat_id = Column(String, nullable=True)
    telegram_notifications = Column(Boolean, default=False)
    onboarding_complete = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    babies = relationship("Baby", back_populates="user", cascade="all, delete-orphan")


class Baby(Base):
    __tablename__ = "babies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=False)  # ISO date string
    birth_weight_kg = Column(Float, nullable=False, default=3.0)
    current_weight_kg = Column(Float, nullable=True)
    gender = Column(String, nullable=True)
    care_plan = Column(String, default=CarePlan.standard)
    feeding_method = Column(String, default=FeedingMethod.bottle)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="babies")
    logs = relationship("LogEntry", back_populates="baby", cascade="all, delete-orphan")
    growth_records = relationship("GrowthRecord", back_populates="baby", cascade="all, delete-orphan")


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    log_type = Column(String, nullable=False)
    amount_ml = Column(Float, nullable=True)     # feeds
    duration_min = Column(Float, nullable=True)  # sleep / breast feed
    detail = Column(String, nullable=True)       # "heavy", "normal", "amox.", etc.
    temperature_c = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    logged_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    baby = relationship("Baby", back_populates="logs")


class GrowthRecord(Base):
    __tablename__ = "growth_records"

    id = Column(Integer, primary_key=True, index=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    recorded_at = Column(String, nullable=False)  # ISO date
    weight_kg = Column(Float, nullable=True)
    length_cm = Column(Float, nullable=True)
    head_cm = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    baby = relationship("Baby", back_populates="growth_records")
