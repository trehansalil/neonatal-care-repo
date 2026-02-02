# Pydantic models for structured extraction

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator

class SusuNotesEntry(BaseModel):
    """Structured Urine Notes data."""
    Item: Literal["diaper", "nappy"] = Field("diaper", description="diaper|nappy")
    Urine_Color: Literal["clear", "pale_yellow", "dark_yellow", "orange", "red"] = Field("clear", description="Color of the urine")
    other_notes: Optional[str] = Field(None, description="Any additional notes or observations")

class PotiNotesEntry(BaseModel):
    """Structured Poti Notes data."""
    Item: Literal["diaper", "nappy"] = Field("diaper", description="diaper|nappy")
    Consistency: Literal["liquid", "soft", "firm", "hard"] = Field("soft", description="Consistency of the Poti")
    other_notes: Optional[str] = Field(None, description="Any additional notes or observations")
class FeedEntry(BaseModel):
    """Structured feed entry data."""
    feed_amount: int = Field(0, description="Amount in ml (integer)")
    feed_type: Literal["bottle", "bottle_expressed", "breast"] = Field(
        "bottle_expressed", 
        description="Type of feed: bottle (formula), bottle_expressed (expressed breast milk in bottle), or breast (direct breastfeeding)"
    )
    notes: Optional[str] = Field(None, description="Any additional notes or observations")


class SusuEntry(BaseModel):
    """Structured urination (susu) entry data."""
    susu_count: int = Field(1, description="Number of wet diapers/urinations (default 1)")
    notes: SusuNotesEntry = Field(..., description="Additional notes about color, frequency, change type, etc.")
    @field_validator('notes', mode='after')
    def parse_notes(cls, value):
        """Ensure notes is parsed from SusuNotesEntry instance to something like this:
        ```
        Item: diaper. Urine color: clear
        ```
        """
        if isinstance(value, SusuNotesEntry):
            parts = [f"Item: {value.Item}", f"Urine color: {value.Urine_Color}"]
            if value.other_notes:
                parts.append(f"Other notes: {value.other_notes}")
            return '. '.join(parts)
        return value

class PotiEntry(BaseModel):
    """Structured stool (poti) entry data."""
    poti_count: int = Field(1, description="Number of dirty diapers/bowel movements (default 1)")
    poti_color: Literal["yellow", "mustard", "green", "brown", "black", "red", "white"] = Field(
        "yellow", 
        description="Color of the stool"
    )
    notes: PotiNotesEntry = Field(..., description="Additional notes about consistency, frequency, change type, etc.")
    @field_validator('notes', mode='after')
    def parse_notes(cls, value):
        """Ensure notes is parsed from PotiNotesEntry instance to something like this:
        ```
        Item: diaper. Consistency: liquid
        ```
        """
        if isinstance(value, PotiNotesEntry):
            parts = [f"Item: {value.Item}", f"Consistency: {value.Consistency}"]
            if value.other_notes:
                parts.append(f"Other notes: {value.other_notes}")
            return '. '.join(parts)
        return value

class TemperatureEntry(BaseModel):
    """Structured temperature entry data."""
    temperature: Optional[float] = Field(None, description="Temperature value in Celsius (e.g., 37.5)")
    notes: Optional[str] = Field(None, description="Additional notes about measurement method, time, etc.")


class WeightEntry(BaseModel):
    """Structured weight entry data."""
    weight: Optional[int] = Field(None, description="Weight in grams (integer)")
    notes: Optional[str] = Field(None, description="Additional notes about measurement conditions, etc.")


class GeneralEntry(BaseModel):
    """Structured general observation entry data."""
    notes: str = Field(..., description="Summary of the observation or note")


class UnclearEntry(BaseModel):
    """Entry data for unclear or multiple categories."""
    notes: str = Field(..., description="Summary of what was said")
    category_note: Optional[str] = Field(None, description="Information about categorization")

