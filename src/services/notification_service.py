"""Notification Service for Baby Care Alerts

Handles sending notifications to external webhooks for care reminders.
"""

import requests
import json
import os
from datetime import datetime, timedelta
import pytz
from typing import Optional, Dict, Any
from clickhouse_connect.driver.client import Client

from src.log import get_logger
from src.settings import configured_settings

logger = get_logger(__name__)

# File to track notification state across workers
NOTIFICATION_STATE_FILE = '/tmp/baby_tracker_notification_state.json'


def _load_notification_state() -> Dict[str, Any]:
    """Load notification state from file."""
    try:
        if os.path.exists(NOTIFICATION_STATE_FILE):
            with open(NOTIFICATION_STATE_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading notification state: {e}")
    return {}


def _save_notification_state(state: Dict[str, Any]):
    """Save notification state to file."""
    try:
        with open(NOTIFICATION_STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception as e:
        logger.error(f"Error saving notification state: {e}")


class NotificationService:
    """Service for sending notifications about baby care events."""
    
    def __init__(self, webhook_url: Optional[str] = None):
        """Initialize notification service.
        
        Args:
            webhook_url: n8n webhook URL for sending notifications. If not provided,
                        builds URL from settings (N8N_HOST + N8N_WEBHOOK_ID).
        """
        self.webhook_url = webhook_url or configured_settings.n8n_webhook_url
        self.diaper_alert_hours = configured_settings.diaper_alert_hours
        self.reminder_interval_minutes = 15  # Send reminder every 15 minutes when overdue
        
    def is_configured(self) -> bool:
        """Check if notification service is properly configured."""
        return bool(self.webhook_url)
    
    def send_notification(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Send a notification to the configured webhook.
        
        Args:
            message: The notification message to send
            metadata: Additional context data to include in the notification
            
        Returns:
            True if notification was sent successfully, False otherwise
        """
        if not self.is_configured():
            logger.warning("Notification service not configured - skipping notification")
            return False
        
        payload = {
            "message": message,
            "timestamp": datetime.now(pytz.UTC).isoformat(),
        }
        
        if metadata:
            payload["metadata"] = metadata
        
        try:
            response = requests.post(
                self.webhook_url,
                json=payload,
                timeout=10,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            logger.info(f"Notification sent successfully: {message}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send notification: {e}")
            return False
    
    def check_overdue_diaper_change(self, db_client: Client, timezone: pytz.timezone) -> bool:
        """Check if diaper change is overdue and send notification if needed.
        
        Args:
            db_client: ClickHouse database client
            timezone: Timezone for date calculations
            
        Returns:
            True if notification was sent, False otherwise
        """
        if not self.is_configured():
            return False
        
        try:
            # Get the most recent entry with ANY diaper change (susu_count OR poti_count > 0)
            query = """
                SELECT 
                    id,
                    susu_count,
                    poti_count,
                    timestamp,
                    notes
                FROM entries
                WHERE susu_count > 0 OR poti_count > 0
                ORDER BY timestamp DESC
                LIMIT 1
            """
            
            result = db_client.query(query)
            
            if not result.result_rows:
                logger.info("No diaper changes found in database")
                return False
            
            last_entry = result.result_rows[0]
            entry_id = last_entry[0]
            susu_count = last_entry[1]
            poti_count = last_entry[2]
            last_timestamp = last_entry[3]
            
            # Ensure timestamp is timezone-aware
            if last_timestamp.tzinfo is None:
                last_timestamp = timezone.localize(last_timestamp)
            
            # Calculate time since last diaper change
            now = datetime.now(timezone)
            hours_since = (now - last_timestamp).total_seconds() / 3600
            
            logger.debug(f"Last diaper change was {hours_since:.1f} hours ago (susu: {susu_count}, poti: {poti_count})")
            
            # Send notification if overdue
            if hours_since >= self.diaper_alert_hours:
                # Load state from file
                state = _load_notification_state()
                last_notified_entry_id = state.get('last_notified_entry_id')
                last_notification_time_str = state.get('last_notification_time')
                last_notification_time = None
                if last_notification_time_str:
                    try:
                        last_notification_time = datetime.fromisoformat(last_notification_time_str)
                    except:
                        pass
                
                # Check if we need to send a reminder
                should_send = False
                
                # Send if this is a new entry (different from last notified)
                if last_notified_entry_id != entry_id:
                    should_send = True
                    logger.info(f"New overdue entry detected (entry {entry_id})")
                # Send if enough time has passed since last notification (15 min reminder)
                elif last_notification_time is None:
                    should_send = True
                else:
                    minutes_since_last_notification = (now - last_notification_time).total_seconds() / 60
                    if minutes_since_last_notification >= self.reminder_interval_minutes:
                        should_send = True
                        logger.info(f"Sending reminder (last notification was {minutes_since_last_notification:.1f} minutes ago)")
                    else:
                        logger.debug(f"Skipping notification (last sent {minutes_since_last_notification:.1f} minutes ago, waiting for {self.reminder_interval_minutes} min)")
                
                if not should_send:
                    return False
                
                # Build description of last change
                change_type = []
                if susu_count > 0:
                    change_type.append(f"{susu_count} wet")
                if poti_count > 0:
                    change_type.append(f"{poti_count} soiled")
                change_description = " + ".join(change_type) + " diaper(s)"
                
                # Check if this is a reminder
                is_reminder = (last_notified_entry_id == entry_id and last_notification_time is not None)
                reminder_text = "🔔 REMINDER: " if is_reminder else ""
                
                message = (
                    f"⚠️ {reminder_text}Diaper Alert: It's been {hours_since:.1f} hours since the last diaper change. "
                    f"Last change was {change_description} at {last_timestamp.strftime('%I:%M %p on %B %d')}."
                )
                
                # Calculate time left until next reminder (for n8n scheduling)
                time_since_seconds = (now - last_timestamp).total_seconds()
                threshold_seconds = self.diaper_alert_hours * 3600
                time_left_seconds = max(0, threshold_seconds - time_since_seconds)
                
                metadata = {
                    "alert_type": "diaper_overdue",
                    "is_reminder": is_reminder,
                    "hours_since_last_change": round(hours_since, 2),
                    "last_change_timestamp": last_timestamp.isoformat(),
                    "entry_id": entry_id,
                    "susu_count": susu_count,
                    "poti_count": poti_count,
                    "threshold_hours": self.diaper_alert_hours,
                    "time_left": int(time_left_seconds)  # Seconds until threshold (0 if overdue)
                }
                
                # Send the notification
                success = self.send_notification(message, metadata)
                
                # Update state if successful
                if success:
                    _save_notification_state({
                        'last_notification_time': now.isoformat(),
                        'last_notified_entry_id': entry_id
                    })
                
                return success
            else:
                # Not overdue - reset tracking
                state = _load_notification_state()
                if state.get('last_notified_entry_id') is not None:
                    logger.info("Diaper change no longer overdue - resetting notification tracking")
                    _save_notification_state({})
                    
                logger.debug(f"Diaper change not overdue ({hours_since:.1f}h < {self.diaper_alert_hours}h)")
                return False
                
        except Exception as e:
            logger.error(f"Error checking for overdue diaper change: {e}")
            return False
