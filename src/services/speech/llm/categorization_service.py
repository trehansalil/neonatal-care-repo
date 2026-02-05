"""LLM-based categorization service for speech entries."""

from typing import Dict, Any, Optional, Literal

import instructor
from pydantic import BaseModel, Field

from src.log import get_logger
from src.helpers import get_azure_openai_client
from src.settings import configured_settings

logger = get_logger(__name__)


class CategorizationExtraction(BaseModel):
    """Structured categorization result extracted by the LLM.
    
    Example:
        - Feed of 60ml express milk in last 1 hour. Current Datetime: 2024-08-15 14:30
            Category: "feed"
            log_date: "2024-08-15"
            log_time: "13:30"
        - Changed diaper, baby peed twice in the last hour. Current Datetime: 2024-08-15 17:30
            Category: "susu"
            log_date: "2024-08-15"
            log_time: "16:30"
    """

    category: Literal[
        "feed",
        "susu",
        "poti",
        "temperature",
        "weight",
        "general",
        "unclear",
    ] = Field(
        ..., description="Category inferred from the transcription."
    )
    log_date: str = Field(
        ...,
        description=(
            "Date of the log entry in YYYY-MM-DD format if explicitly mentioned; leave current date when no calendar date is stated."
        ),
    )
    log_time: str = Field(
        ...,
        description=(
            "Time of the log entry in 24-hour HH:MM format if explicitly mentioned; leave current time when no time is stated."
        ),
    )


class CategorizationService:
    """Service to categorize baby care transcriptions using Azure OpenAI."""
    
    # Valid categories based on the baby tracker
    CATEGORIES = [
        "feed",           # Feeding related entries
        "susu",           # Urine (pee)
        "poti",           # Stool (poop)
        "temperature",    # Temperature measurements
        "weight",         # Weight measurements
        "general",        # General notes or observations
        "unclear"         # Cannot determine category
    ]
    
    def __init__(self):
        """Initialize the LLM categorization service with Azure OpenAI client."""
        
        
        # Get Azure OpenAI client in instructor JSON mode for structured responses
        try:
            # Use instructor in JSON mode for structured extraction with Pydantic
            self.client = get_azure_openai_client(mode=instructor.Mode.JSON)
            self.model = configured_settings.azure_openai_deployment
            
            if not configured_settings.azure_openai_endpoint or not configured_settings.azure_openai_key:
                logger.warning("Azure OpenAI endpoint or key not configured")
                self.client = None
            else:
                logger.info(f"Initialized Azure OpenAI client with deployment {self.model}")
        except Exception as e:
            logger.error(f"Failed to initialize Azure OpenAI client: {e}")
            self.client = None
    
    def _build_categorization_prompt(self, transcription: str) -> str:
        """Build the prompt for categorization and temporal extraction."""
        from datetime import datetime
        current_dt = datetime.now().strftime("%Y-%m-%d %H:%M")
        return f"""You are analyzing speech-to-text transcriptions from a neonatal care tracking application.

The parent/caregiver has recorded audio notes about their baby's care activities. Based on the transcription, determine the most appropriate category for the entry and extract the explicit date and time of the log if they are mentioned.

Valid categories:
- feed: Feeding related (breast milk, formula, bottle, amount, etc.)
- susu: Urine/pee related (diaper changes, frequency, etc.)
- poti: Stool/poop related (diaper changes, color, consistency, etc.)
- temperature: Temperature measurements or fever related
- weight: Weight measurements
- general: General observations, behavior, sleep, crying, etc.
- unclear: Cannot determine the category from the transcription

Temporal extraction rules:
- Only extract a log_date if an explicit calendar date is provided; format it as YYYY-MM-DD.
- Only extract a log_time if a time is provided; format it in 24-hour HH:MM.
- If no detail on date or time is mentioned, assume it as the current date and time.
- If relative times are mentioned (e.g., "an hour ago"), convert them in reference to current date and time.
- When a time is mentioned without AM/PM (e.g., "at 6" or "6:00"):
  * Default to the nearest occurrence of that time in the PAST relative to the current time
  * Exception: If the mentioned time is within the next hour of the current time, it can be interpreted as near future (e.g., if current time is 1:25 AM and user says "1:30", interpret as 1:30 AM, not 1:30 PM yesterday)
  * Examples:
    - Current time: 1:25 AM, user says "6" → interpret as 6:00 PM (previous day)
    - Current time: 1:25 AM, user says "12:10" → interpret as 00:10 AM (same day)
    - Current time: 1:25 AM, user says "1:30" → interpret as 1:30 AM (near future within 1 hour)
    - Current time: 3:00 PM, user says "2" → interpret as 2:00 PM (1 hour ago)
    - Current time: 3:00 PM, user says "3:30" → interpret as 3:30 PM (30 minutes in future, within 1 hour window)
  * Use contextual clues when available (e.g., "breakfast" implies AM, "dinner" implies PM) to override the default past-time rule

Transcription: "{transcription}"
Current date and time: "{current_dt}"

If the transcription is too vague or unclear, use "unclear"."""

    def _extract_metadata(
        self,
        transcription: str,
        category: str,
        log_date: Optional[str] = None,
        log_time: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Extract structured metadata from the transcription based on category.
        
        This method can be extended to extract specific values like feed amounts,
        temperatures, weights, etc. from the transcription.
        """
        metadata = {
            'category': category,
            'requires_manual_review': category in ['multiple', 'unclear']
        }

        if log_date:
            metadata['log_date'] = log_date

        if log_time:
            metadata['log_time'] = log_time
        
        # Future enhancement: Extract specific values based on category
        # For example, if category is "temperature", try to extract the temperature value
        # if category is "feed", try to extract amount and type
        
        return metadata
    
    def categorize(self, transcription: str) -> Dict[str, Any]:
        """Categorize a transcription using the LLM.
        
        Args:
            transcription: The speech-to-text transcription to categorize
            
        Returns:
            Dict containing 'category' and optional metadata
        """
        if not self.client:
            logger.warning("LLM client not initialized, returning 'unclear' category")
            return {'category': 'unclear', 'error': 'LLM client not available'}
        
        if not transcription or not transcription.strip():
            return {'category': 'unclear', 'error': 'Empty transcription'}
        
        try:
            prompt = self._build_categorization_prompt(transcription)
            category = 'unclear'  # Default value
            
            # Use Azure OpenAI client with Pydantic validation
            response = self.client.chat.completions.create(
                model=self.model,
                response_model=CategorizationExtraction,
                messages=[
                    {"role": "system", "content": "You are a precise categorization assistant. Return only structured data."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for consistent categorization
                max_tokens=150
            )

            extraction = response.model_dump(exclude_none=True)
            category = extraction.get('category', 'unclear')
            
            # Validate category
            if category not in self.CATEGORIES:
                logger.warning(f"LLM returned invalid category '{category}', defaulting to 'unclear'")
                category = 'unclear'
            
            logger.info(
                "Categorized transcription as '%s' (date: %s, time: %s)",
                category,
                extraction.get('log_date'),
                extraction.get('log_time'),
            )
            metadata = self._extract_metadata(
                transcription,
                category,
                extraction.get('log_date'),
                extraction.get('log_time'),
            )

            print(
                f"Categorized transcription as '{category}' "
                f"(date: {extraction.get('log_date')}, time: {extraction.get('log_time')})"
            )

            return metadata
            
        except Exception as e:
            logger.error(f"Error during categorization: {e}", exc_info=True)
            return {'category': 'unclear', 'error': str(e)}
    
    def is_available(self) -> bool:
        """Check if the LLM service is available and properly configured."""
        return self.client is not None
