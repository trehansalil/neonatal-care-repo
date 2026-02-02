"""Test notification service for diaper change alerts

Run this script to test the notification service functionality.
"""

import os
import sys
from datetime import datetime, timedelta
import pytz

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.notification_service import NotificationService
from src.settings import configured_settings
from src.log import get_logger

logger = get_logger(__name__)


def test_basic_notification():
    """Test basic notification sending"""
    print("\n" + "="*60)
    print("TEST 1: Basic Notification")
    print("="*60)
    
    service = NotificationService()
    
    if not service.is_configured():
        print("❌ Notification service not configured")
        print("   Please set N8N_WEBHOOK_URL in your .env file")
        return False
    
    print(f"✓ Webhook URL configured")
    print(f"✓ Alert threshold: {service.diaper_alert_hours} hours")
    
    # Send a test notification
    success = service.send_notification(
        "🧪 Test notification from neonatal management system",
        metadata={
            "test": True,
            "timestamp": datetime.now(pytz.UTC).isoformat()
        }
    )
    
    if success:
        print("✓ Test notification sent successfully")
        return True
    else:
        print("❌ Failed to send test notification")
        return False


def test_diaper_check_simulation():
    """Test diaper check logic with simulated data"""
    print("\n" + "="*60)
    print("TEST 2: Diaper Check Simulation")
    print("="*60)
    
    service = NotificationService()
    
    if not service.is_configured():
        print("❌ Skipping (webhook not configured)")
        return False
    
    # Test the logic simulation
    tz = pytz.timezone('Asia/Kolkata')
    now = datetime.now(tz)
    
    # Simulate 5 hour old diaper change
    simulated_last_change = now - timedelta(hours=5)
    hours_since = 5.0
    
    print(f"Simulated scenario:")
    print(f"  Current time: {now.strftime('%I:%M %p')}")
    print(f"  Last change: {simulated_last_change.strftime('%I:%M %p')} ({hours_since} hours ago)")
    print(f"  Threshold: {service.diaper_alert_hours} hours")
    
    if hours_since >= service.diaper_alert_hours:
        print(f"✓ Would trigger notification (overdue)")
        
        message = (
            f"⚠️ Diaper Alert: It's been {hours_since:.1f} hours since the last diaper change. "
            f"Last change was at {simulated_last_change.strftime('%I:%M %p on %B %d')}."
        )
        
        success = service.send_notification(
            message,
            metadata={
                "test": True,
                "alert_type": "diaper_overdue",
                "hours_since_last_change": hours_since,
                "threshold_hours": service.diaper_alert_hours
            }
        )
        
        if success:
            print("✓ Alert notification sent successfully")
            return True
        else:
            print("❌ Failed to send alert notification")
            return False
    else:
        print(f"✓ Would NOT trigger notification (not overdue)")
        return True


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("NEONATAL MANAGEMENT - NOTIFICATION SERVICE TEST")
    print("="*60)
    
    print(f"\nConfiguration:")
    print(f"  N8N_WEBHOOK_ID: {'✓ Set' if configured_settings.n8n_webhook_id else '❌ Not set'}")
    print(f"  N8N_HOST: {configured_settings.n8n_host}")
    if configured_settings.n8n_webhook_url:
        print(f"  Full Webhook URL: {configured_settings.n8n_webhook_url}")
    else:
        print(f"  Full Webhook URL: ❌ Not configured (set N8N_WEBHOOK_ID)")
    print(f"  DIAPER_ALERT_HOURS: {configured_settings.diaper_alert_hours}")
    print(f"  NOTIFICATION_CHECK_INTERVAL_MINUTES: {configured_settings.notification_check_interval_minutes}")
    
    results = []
    
    # Run tests
    results.append(("Basic Notification", test_basic_notification()))
    results.append(("Diaper Check Simulation", test_diaper_check_simulation()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, success in results:
        status = "✓ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n✓ All tests passed!")
    else:
        print("\n❌ Some tests failed")
    
    print("\n" + "="*60)
    print("NEXT STEPS")
    print("="*60)
    print("\nTo enable notifications in your app:")
    print("1. Create webhook in n8n (http://localhost:5678)")
    print("2. Copy the webhook UUID from Production URL")
    print("   Example: http://localhost:5678/webhook/977281dd-6d27-4c67-a734-e78513b6935e")
    print("              Copy this part: ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^")
    print("3. Set in .env file:")
    print("   N8N_WEBHOOK_ID=977281dd-6d27-4c67-a734-e78513b6935e")
    print("4. Restart backend: docker-compose restart backend")
    print("5. Optionally adjust DIAPER_ALERT_HOURS (default: 4)")
    print("6. Optionally adjust NOTIFICATION_CHECK_INTERVAL_MINUTES (default: 60)")
    print("\nAPI Endpoints:")
    print("  GET  /api/notifications/diaper-status  - Check current status")
    print("  POST /api/notifications/check-diaper   - Manually trigger check")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
