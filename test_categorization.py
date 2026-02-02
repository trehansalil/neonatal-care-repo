"""
Example script demonstrating LLM categorization service usage.

This can be used for testing the categorization service independently.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.speech.llm.categorization_service import CategorizationService

# Example transcriptions to test
SAMPLE_TRANSCRIPTIONS = [
    "Baby drank 60 ml of formula at 1210",
    "Changed diaper, baby peed twice in the last hour",
    "Baby had a bowel movement, color was yellow and consistency was normal",
    "Took baby's temperature, it was 37.2 degrees Celsius",
    "Weighed the baby today, she is now 4.5 kilograms",
    "Baby was crying a lot and seemed uncomfortable, gave tummy time",
    "Fed baby 80ml at 2pm, then changed a wet diaper and she had yellow poop",
    "The weather is nice today",
    "Baby feed taken at 12.30 pm of 40 ml."
]
from src.settings import Settings
setting = Settings()

def main():
    """Test the LLM categorization service."""
    
    # Check if Azure OpenAI is configured
    azure_endpoint = setting.azure_openai_endpoint
    azure_key = setting.azure_openai_key
    azure_deployment = setting.azure_openai_deployment
    
    if not azure_endpoint or not azure_key or not azure_deployment:
        print("ERROR: Azure OpenAI not configured")
        print("Set the following environment variables:")
        print("  export AZURE_OPENAI_ENDPOINT='https://your-resource.openai.azure.com/'")
        print("  export AZURE_OPENAI_KEY='your-key'")
        print("  export AZURE_OPENAI_DEPLOYMENT='your-deployment-name'")
        sys.exit(1)
    
    # Initialize the service
    print(f"\n{'='*70}")
    print(f"Testing LLM Categorization Service with Azure OpenAI")
    print(f"{'='*70}\n")
    
    try:
        llm_service = CategorizationService()
        
        if not llm_service.is_available():
            print("ERROR: LLM service is not available")
            print("Check your Azure OpenAI configuration")
            sys.exit(1)
        
        print(f"✓ Azure OpenAI service initialized successfully")
        print(f"  Endpoint: {azure_endpoint}")
        print(f"  Deployment: {azure_deployment}\n")
        
        # Test each sample transcription
        for i, transcription in enumerate(SAMPLE_TRANSCRIPTIONS, 1):
            print(f"{i}. Testing: \"{transcription}\"")
            
            result = llm_service.categorize(transcription)
            category = result.get('category', 'error')
            
            if 'error' in result:
                print(f"   ✗ ERROR: {result['error']}\n")
            else:
                requires_review = result.get('requires_manual_review', False)
                review_flag = " ⚠️  (needs review)" if requires_review else ""
                print(f"   ✓ Category: {category.upper()}{review_flag}\n")
                print(f"   ✓ Datetime: {result.get('log_date')}, {result.get('log_time')}\n")
        
        print(f"{'='*70}")
        print("Testing complete!")
        print(f"{'='*70}\n")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
