"""
Example script demonstrating LLM categorization service usage.

This can be used for testing the categorization service independently.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.speech.llm.categorization_service import CategorizationService

# Test cases with expected results
# Format: transcription -> {expected_category, expected_date, expected_time}
# Note: For time testing, run this at 11:46 PM (23:46) on 2026-02-08
TEST_CASES = {
    "breastfeed at 9:40 for 30 minutes": {
        "expected_category": "feed",
        "expected_date": "2026-02-08",
        "expected_time": "21:40",  # At 11:46 PM, "9:40" should be 21:40 (2 hrs ago), not 09:40 (14 hrs ago)
    },
    "Baby drank 60 ml of formula at 1040": {
        "expected_category": "feed",
        "expected_date": "2026-02-08",
        "expected_time": "22:40",  # At 11:46 PM, "1040" should be 22:40 (1 hr ago), not 10:40 (13 hrs ago)
    },
    "Changed diaper, baby peed twice in the last hour": {
        "expected_category": "susu",
        "expected_date": None,  # Will use current date
        "expected_time": None,  # Will use current time approximately
    },
    "Baby had a bowel movement, color was yellow and consistency was normal at 1:40": {
        "expected_category": "poti",
        "expected_date": "2026-02-08",
        "expected_time": "13:40",  # At 11:46 PM, "1:40" should be 13:40 PM (10 hrs ago)
    },
    "Took baby's temperature, it was 37.2 degrees Celsius at 12:45 in the morning": {
        "expected_category": "temperature",
        "expected_date": "2026-02-08",
        "expected_time": "00:45",  # Explicit "in the morning" = 12:45 AM
    },
    "Weighed the baby today, she is now 4.5 kilograms": {
        "expected_category": "weight",
        "expected_date": None,
        "expected_time": None,
    },
    "Baby was crying a lot and seemed uncomfortable, gave tummy time": {
        "expected_category": "general",
        "expected_date": None,
        "expected_time": None,
    },
    "Fed baby 80ml at 2pm, then changed a wet diaper and she had yellow poop": {
        "expected_category": "feed",  # Should pick first/primary category
        "expected_date": "2026-02-08",
        "expected_time": "14:00",  # Explicit "2pm"
    },
    "The weather is nice today": {
        "expected_category": "unclear",
        "expected_date": None,
        "expected_time": None,
    },
    "Baby feed taken at 12.30 pm of 40 ml.": {
        "expected_category": "feed",
        "expected_date": "2026-02-08",
        "expected_time": "12:30",  # Explicit "pm"
    },
}
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

        # Track test results
        total_tests = 0
        passed_tests = 0
        failed_tests = 0

        # Test each case
        for i, (transcription, expected) in enumerate(TEST_CASES.items(), 1):
            print(f"{i}. Testing: \"{transcription}\"")

            result = llm_service.categorize(transcription)
            category = result.get('category', 'error')
            log_date = result.get('log_date')
            log_time = result.get('log_time')

            if 'error' in result:
                print(f"   ✗ ERROR: {result['error']}\n")
                failed_tests += 1
                total_tests += 1
                continue

            # Verify results
            test_passed = True
            errors = []

            # Check category
            expected_category = expected.get('expected_category')
            if expected_category and category != expected_category:
                test_passed = False
                errors.append(f"Category mismatch: got '{category}', expected '{expected_category}'")

            # Check date (only if expected is not None)
            expected_date = expected.get('expected_date')
            if expected_date is not None and log_date != expected_date:
                test_passed = False
                errors.append(f"Date mismatch: got '{log_date}', expected '{expected_date}'")

            # Check time (only if expected is not None)
            expected_time = expected.get('expected_time')
            if expected_time is not None and log_time != expected_time:
                test_passed = False
                errors.append(f"Time mismatch: got '{log_time}', expected '{expected_time}'")

            # Print results
            if test_passed:
                print(f"   ✓ PASSED")
                print(f"   ✓ Category: {category.upper()}")
                print(f"   ✓ Datetime: {log_date}, {log_time}\n")
                passed_tests += 1
            else:
                print(f"   ✗ FAILED")
                print(f"   • Category: {category.upper()} (expected: {expected_category})")
                print(f"   • Datetime: {log_date}, {log_time} (expected: {expected_date}, {expected_time})")
                for error in errors:
                    print(f"   • {error}")
                print()
                failed_tests += 1

            total_tests += 1

        print(f"{'='*70}")
        print(f"Testing complete!")
        print(f"{'='*70}")
        print(f"Total: {total_tests} | Passed: {passed_tests} | Failed: {failed_tests}")
        if failed_tests > 0:
            print(f"\n⚠️  {failed_tests} test(s) failed!")
        else:
            print(f"\n✓ All tests passed!")
        print(f"{'='*70}\n")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
