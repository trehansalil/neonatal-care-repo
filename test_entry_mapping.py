"""
Integration test script for LLM entry mapping service.

This tests the actual LLM mapping functionality with real Azure OpenAI calls.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.entry_mapping_service import EntryMappingService
from src.services.llm_categorization_service import LLMCategorizationService
from src.settings import Settings

# Sample transcriptions organized by category
SAMPLE_TESTS = [
    {
        "category": "feed",
        "transcription": "Baby drank 60 ml of formula at 3 PM",
        "expected_fields": ["feed_amount", "feed_type"]
    },
    {
        "category": "feed",
        "transcription": "Fed baby 80ml of expressed breast milk from bottle",
        "expected_fields": ["feed_amount", "feed_type"]
    },
    {
        "category": "feed",
        "transcription": "Breastfed the baby directly for 15 minutes",
        "expected_fields": ["feed_type"]
    },
    {
        "category": "susu",
        "transcription": "Changed diaper, baby peed twice in the last hour",
        "expected_fields": ["susu_count", "notes"]
    },
    {
        "category": "susu",
        "transcription": "One wet diaper with clear urine",
        "expected_fields": ["susu_count", "notes"]
    },
    {
        "category": "poti",
        "transcription": "Baby had a bowel movement, color was yellow and consistency was soft",
        "expected_fields": ["poti_count", "poti_color", "notes"]
    },
    {
        "category": "poti",
        "transcription": "Changed dirty diaper, mustard colored stool, normal consistency",
        "expected_fields": ["poti_count", "poti_color", "notes"]
    },
    {
        "category": "temperature",
        "transcription": "Took baby's temperature, it was 37.2 degrees Celsius",
        "expected_fields": ["temperature"]
    },
    {
        "category": "temperature",
        "transcription": "Temperature is 38.5 degrees measured with digital thermometer",
        "expected_fields": ["temperature", "notes"]
    },
    {
        "category": "weight",
        "transcription": "Weighed the baby today, she is now 4500 grams",
        "expected_fields": ["weight"]
    },
    {
        "category": "weight",
        "transcription": "Baby weighs 3800 grams measured after feeding",
        "expected_fields": ["weight", "notes"]
    },
    {
        "category": "general",
        "transcription": "Baby was crying a lot and seemed uncomfortable, gave tummy time",
        "expected_fields": ["notes"]
    },
]

setting = Settings()


def print_result(result: dict, indent: int = 4):
    """Pretty print the mapping result."""
    spaces = " " * indent
    for key, value in result.items():
        if key == "error":
            print(f"{spaces}✗ ERROR: {value}")
        else:
            print(f"{spaces}{key}: {value}")


def main():
    """Test the LLM entry mapping service."""
    
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
    
    # Initialize the services
    print(f"\n{'='*80}")
    print(f"Testing LLM Entry Mapping Service with Azure OpenAI")
    print(f"{'='*80}\n")
    
    try:
        mapping_service = EntryMappingService()
        
        if not mapping_service.is_available():
            print("ERROR: Entry mapping service is not available")
            print("Check your Azure OpenAI configuration")
            sys.exit(1)
        
        print(f"✓ Azure OpenAI service initialized successfully")
        print(f"  Endpoint: {azure_endpoint}")
        print(f"  Deployment: {azure_deployment}\n")
        
        # Track results
        total_tests = len(SAMPLE_TESTS)
        successful_tests = 0
        failed_tests = 0
        
        # Test each sample
        for i, test in enumerate(SAMPLE_TESTS, 1):
            category = test["category"]
            transcription = test["transcription"]
            expected_fields = test["expected_fields"]
            
            print(f"{i}/{total_tests}. Testing {category.upper()} mapping:")
            print(f"     Input: \"{transcription}\"")
            
            try:
                result = mapping_service.map_to_entry(transcription, category)
                
                if 'error' in result:
                    print(f"     ✗ ERROR: {result['error']}")
                    failed_tests += 1
                else:
                    print(f"     ✓ Mapped successfully:")
                    print_result(result)
                    
                    # Check if expected fields are present
                    missing_fields = [f for f in expected_fields if f not in result or result[f] is None]
                    if missing_fields:
                        print(f"     ⚠️  Missing expected fields: {', '.join(missing_fields)}")
                    
                    successful_tests += 1
                
            except Exception as e:
                print(f"     ✗ EXCEPTION: {e}")
                failed_tests += 1
            
            print()
        
        # Summary
        print(f"{'='*80}")
        print(f"Test Summary:")
        print(f"  Total:      {total_tests}")
        print(f"  Successful: {successful_tests} ✓")
        print(f"  Failed:     {failed_tests} ✗")
        print(f"  Success Rate: {(successful_tests/total_tests)*100:.1f}%")
        print(f"{'='*80}\n")
        
        # Test with categorization first, then mapping
        print(f"\n{'='*80}")
        print(f"Testing Full Pipeline: Categorization → Mapping")
        print(f"{'='*80}\n")
        
        categorization_service = LLMCategorizationService()
        
        pipeline_tests = [
            "Baby had 75ml of formula",
            "Two wet diapers with clear urine",
            "Yellow poop, soft consistency",
            "Temperature is 37.8 degrees"
        ]
        
        for i, transcription in enumerate(pipeline_tests, 1):
            print(f"{i}. Full pipeline test:")
            print(f"   Input: \"{transcription}\"")
            
            # Step 1: Categorize
            cat_result = categorization_service.categorize(transcription)
            category = cat_result.get('category', 'unclear')
            print(f"   Step 1 - Categorized as: {category.upper()}")
            
            # Step 2: Map to entry
            if category not in ['unclear', 'multiple']:
                map_result = mapping_service.map_to_entry(transcription, category)
                print(f"   Step 2 - Mapped fields:")
                print_result(map_result)
            else:
                print(f"   Step 2 - Skipped (category: {category})")
            
            print()
        
        print(f"{'='*80}")
        print("Integration testing complete!")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
