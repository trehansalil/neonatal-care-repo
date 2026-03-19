#!/usr/bin/env python3
"""Test script for Redis-based notification state management.

This script verifies that the NotificationService correctly stores and retrieves
notification state from Redis instead of using file-based storage.
"""

import sys
from datetime import datetime
import pytz

from src.services.notification_service import NotificationService
from src.log import get_logger

logger = get_logger(__name__)


def test_redis_state_management():
    """Test Redis-based notification state save/load."""

    print("🧪 Testing Redis-based notification state management...")
    print("-" * 60)

    # Initialize notification service
    service = NotificationService()

    # Check if Redis is available
    if not service.redis_client:
        print("❌ FAILED: Redis client not initialized")
        print("   Make sure Redis is running and REDIS_URL is configured")
        return False

    print("✓ Redis client initialized")

    # Test 1: Save state
    print("\n📝 Test 1: Saving notification state to Redis...")
    test_state = {
        'last_notification_time': datetime.now(pytz.UTC).isoformat(),
        'last_notified_entry_id': 12345
    }

    success = service._save_notification_state(test_state)
    if not success:
        print("❌ FAILED: Could not save state to Redis")
        return False

    print("✓ State saved successfully")
    print(f"   Saved: {test_state}")

    # Test 2: Load state
    print("\n📖 Test 2: Loading notification state from Redis...")
    loaded_state = service._load_notification_state()

    if not loaded_state:
        print("❌ FAILED: Could not load state from Redis")
        return False

    print("✓ State loaded successfully")
    print(f"   Loaded: {loaded_state}")

    # Test 3: Verify state matches
    print("\n🔍 Test 3: Verifying state integrity...")
    if (loaded_state.get('last_notified_entry_id') != test_state['last_notified_entry_id'] or
        loaded_state.get('last_notification_time') != test_state['last_notification_time']):
        print("❌ FAILED: Loaded state doesn't match saved state")
        print(f"   Expected: {test_state}")
        print(f"   Got: {loaded_state}")
        return False

    print("✓ State integrity verified")

    # Test 4: Clear state
    print("\n🗑️  Test 4: Clearing notification state...")
    success = service._save_notification_state({})
    if not success:
        print("❌ FAILED: Could not clear state")
        return False

    cleared_state = service._load_notification_state()
    if cleared_state:
        print("❌ FAILED: State not properly cleared")
        print(f"   Expected empty dict, got: {cleared_state}")
        return False

    print("✓ State cleared successfully")

    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("\n📊 Summary:")
    print("   • Redis client initialization: ✓")
    print("   • State save operation: ✓")
    print("   • State load operation: ✓")
    print("   • State integrity verification: ✓")
    print("   • State clear operation: ✓")
    print("\n🎉 Redis-based notification state management is working correctly!")

    return True


if __name__ == '__main__':
    try:
        success = test_redis_state_management()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Test failed with exception: {e}", exc_info=True)
        print(f"\n❌ FATAL ERROR: {e}")
        sys.exit(1)

