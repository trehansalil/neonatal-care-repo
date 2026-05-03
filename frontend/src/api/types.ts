export interface User {
  id: number
  email: string
  full_name: string
  onboarding_complete: boolean
  telegram_notifications: boolean
  telegram_chat_id: string | null
  created_at: string
}

export interface Baby {
  id: number
  name: string
  date_of_birth: string
  birth_weight_kg: number
  current_weight_kg: number | null
  gender: string | null
  care_plan: 'hydronephrosis' | 'standard'
  feeding_method: 'breast' | 'bottle' | 'mixed'
  is_active: boolean
  created_at: string
}

export interface LogEntry {
  id: number
  baby_id: number
  log_type: string
  amount_ml: number | null
  duration_min: number | null
  detail: string | null
  temperature_c: number | null
  notes: string | null
  logged_at: string
  created_at: string
}

export interface GrowthRecord {
  id: number
  baby_id: number
  recorded_at: string
  weight_kg: number | null
  length_cm: number | null
  head_cm: number | null
  notes: string | null
  created_at: string
}

export interface DayStats {
  date: string
  feed_count: number
  total_ml: number
  wet_count: number
  soiled_count: number
  sleep_minutes: number
  avg_temp: number | null
}

export interface FeedScheduleItem {
  time: string
  label: string
  amount_ml: number
  notes: string
}

export interface RoutineResponse {
  weight_kg: number
  feeds_per_day: number
  amount_per_feed_ml: number
  interval_hours: number
  daily_total_ml: number
  schedule: FeedScheduleItem[]
  wet_goal_per_day: number
  notes: string[]
}
