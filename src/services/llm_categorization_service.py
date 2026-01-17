"""LLM-based categorization service for speech entries."""

import os
from typing import Optional, Dict, Any
from ..log import get_logger
from ..helpers import get_azure_openai_client
from ..settings import get_settings

logger = get_logger(__name__)


class LLMCategorizationService:
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
        settings = get_settings()
        
        # Get plain Azure OpenAI client (without instructor wrapping for simple chat completions)
        try:
            self.client = get_azure_openai_client(mode=None)  # Plain AzureOpenAI client
            self.model = settings.azure_openai_deployment
            
            if not settings.azure_openai_endpoint or not settings.azure_openai_key:
                logger.warning("Azure OpenAI endpoint or key not configured")
                self.client = None
            else:
                logger.info(f"Initialized Azure OpenAI client with deployment {self.model}")
        except Exception as e:
            logger.error(f"Failed to initialize Azure OpenAI client: {e}")
            self.client = None
    
    def _build_categorization_prompt(self, transcription: str) -> str:
        """Build the prompt for categorization."""
        return f"""You are analyzing speech-to-text transcriptions from a neonatal care tracking application. 

The parent/caregiver has recorded audio notes about their baby's care activities. Based on the transcription, identify which category this entry belongs to.

Valid categories:
- feed: Feeding related (breast milk, formula, bottle, amount, duration, etc.)
- susu: Urine/pee related (diaper changes, frequency, etc.)
- poti: Stool/poop related (diaper changes, color, consistency, etc.)
- temperature: Temperature measurements or fever related
- weight: Weight measurements
- general: General observations, behavior, sleep, crying, etc.
- multiple: Entry contains information about multiple categories
- unclear: Cannot determine the category from the transcription

Transcription: "{transcription}"

Respond with ONLY the category name (one word, lowercase). If it's clearly about multiple distinct categories, use "multiple". If the transcription is too vague or unclear, use "unclear"."""

    def _extract_metadata(self, transcription: str, category: str) -> Dict[str, Any]:
        """Extract structured metadata from the transcription based on category.
        
        This method can be extended to extract specific values like feed amounts,
        temperatures, weights, etc. from the transcription.
        """
        metadata = {
            'category': category,
            'requires_manual_review': category in ['multiple', 'unclear']
        }
        
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
            
            # Use Azure OpenAI client
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a precise categorization assistant. Respond with only the category name."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for consistent categorization
                max_tokens=10
            )
            category = response.choices[0].message.content.strip().lower()
            
            # Validate category
            if category not in self.CATEGORIES:
                logger.warning(f"LLM returned invalid category '{category}', defaulting to 'unclear'")
                category = 'unclear'
            
            logger.info(f"Categorized transcription as '{category}'")
            metadata = self._extract_metadata(transcription, category)
            return metadata
            
        except Exception as e:
            logger.error(f"Error during categorization: {e}", exc_info=True)
            return {'category': 'unclear', 'error': str(e)}
    
    def is_available(self) -> bool:
        """Check if the LLM service is available and properly configured."""
        return self.client is not None
