"""LLM-based service to map speech transcriptions to structured entry fields."""

from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

from ..log import get_logger
from ..helpers import get_azure_openai_client
from ..settings import get_settings

logger = get_logger(__name__)


# Pydantic models for structured extraction
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


class EntryMappingService:
    """Service to map transcriptions to structured baby tracker entries using Azure OpenAI and Pydantic."""
    
    def __init__(self):
        """Initialize the entry mapping service with Azure OpenAI client and instructor."""
        settings = get_settings()
        
        try:
            import instructor
            # Use instructor mode for structured outputs with Pydantic
            self.client = get_azure_openai_client(mode=instructor.Mode.JSON)
            self.model = settings.azure_openai_deployment
            
            if not settings.azure_openai_endpoint or not settings.azure_openai_key:
                logger.warning("Azure OpenAI endpoint or key not configured")
                self.client = None
            else:
                logger.info(f"Initialized Entry Mapping service with deployment {self.model}")
        except Exception as e:
            logger.error(f"Failed to initialize Azure OpenAI client: {e}")
            self.client = None
    
    def _get_model_for_category(self, category: str) -> type[BaseModel]:
        """Get the appropriate Pydantic model for the given category.
        
        Args:
            category: The entry category
            
        Returns:
            The Pydantic model class for the category
        """
        model_map = {
            'feed': FeedEntry,
            'susu': SusuEntry,
            'poti': PotiEntry,
            'temperature': TemperatureEntry,
            'weight': WeightEntry,
            'general': GeneralEntry,
            'unclear': UnclearEntry,
        }
        return model_map.get(category, UnclearEntry)
    
    def _build_mapping_prompt(self, transcription: str, category: str) -> str:
        """Build the system prompt for mapping based on category.
        
        Args:
            transcription: The speech-to-text transcription
            category: The entry category
            
        Returns:
            System prompt for the LLM
        """
        category_instructions = {
            'feed': """Extract feeding information from the transcription:
- Identify the amount in ml if mentioned (integers only)
- Determine feed type: "bottle" for formula, "bottle_expressed" for expressed breast milk given via bottle, or "breast" for direct breastfeeding
- Capture any additional observations in notes""",
            
            'susu': """Extract urination (pee) information from the transcription:
- Count the number of wet diapers mentioned (default to 1 if just stated without a number)
- Note any details about color, frequency, or observations""",
            
            'poti': """Extract stool (poop) information from the transcription:
- Count the number of dirty diapers/bowel movements (default to 1 if just stated without a number)
- Identify the color: yellow, mustard, green, brown, or black
- Note any details about consistency, frequency, or observations""",
            
            'temperature': """Extract temperature information from the transcription:
- Identify the temperature value in Celsius (decimal format like 37.5)
- Note the measurement method or any observations""",
            
            'weight': """Extract weight information from the transcription:
- Identify the weight in grams (integer only)
- Note any measurement conditions or observations""",
            
            'general': """Summarize the general observation or note from the transcription.""",
            
            'unclear': """Summarize what was said in the transcription."""
        }
        
        instruction = category_instructions.get(category, category_instructions['unclear'])
        
        system_prompt = f"""You are a precise data extraction assistant for a neonatal care tracking application.
Extract structured information from speech-to-text transcriptions.

Category: {category}

Instructions:
{instruction}

Be precise and only extract information that is clearly stated. If something is not mentioned, leave it as null."""
        
        return system_prompt
    
    def map_to_entry(self, transcription: str, category: str) -> Dict[str, Any]:
        """Map a transcription to structured entry fields using LLM with Pydantic validation.
        
        Args:
            transcription: The speech-to-text transcription
            category: The category determined by the categorization service
            
        Returns:
            Dict containing structured fields for the entry, or error information
        """
        if not self.client:
            logger.warning("LLM client not initialized")
            return {'error': 'LLM client not available', 'notes': transcription}
        
        if not transcription or not transcription.strip():
            return {'error': 'Empty transcription'}
        
        # For unclear or unsupported categories, return minimal mapping
        if category in ['unclear', 'multiple']:
            logger.info(f"Category '{category}' - creating note-only entry")
            return {
                'notes': transcription,
                'category_note': f"Auto-categorized as: {category}"
            }
        
        try:
            # Get the appropriate Pydantic model for this category
            response_model = self._get_model_for_category(category)
            system_prompt = self._build_mapping_prompt(transcription, category)
            
            # Use instructor to get structured output with Pydantic validation
            response = self.client.chat.completions.create(
                model=self.model,
                response_model=response_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract structured information from this transcription:\n\n{transcription}"}
                ],
                temperature=0.1,  # Low temperature for consistent extraction
                max_tokens=300
            )
            
            # Convert Pydantic model to dict
            mapped_data = response.model_dump(exclude_none=True)
            logger.info(f"Successfully mapped {category} entry with Pydantic: {mapped_data}")
            return mapped_data
            
        except Exception as e:
            logger.error(f"Error during entry mapping: {e}", exc_info=True)
            return {
                'error': str(e),
                'notes': transcription
            }
    
    def is_available(self) -> bool:
        """Check if the mapping service is available and properly configured."""
        return self.client is not None
