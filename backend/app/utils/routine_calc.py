"""Weight-based feeding routine calculator with hydronephrosis support."""

from app.schemas import RoutineResponse, FeedScheduleItem


def calculate_routine(
    weight_kg: float,
    care_plan: str = "standard",
    feeding_method: str = "bottle",
) -> RoutineResponse:
    """
    WHO/AAP guidelines: 150-180 ml/kg/day for newborns.
    Hydronephrosis: aim for upper range (170-180 ml/kg) to maximise urine output.
    Feed frequency: every 2-3 hours for newborns (<4 kg), every 3-4 hours for larger.
    """
    if care_plan == "hydronephrosis":
        ml_per_kg = 175.0
        wet_goal = max(8, round(weight_kg * 2.5))
    else:
        ml_per_kg = 160.0
        wet_goal = 6

    daily_total_ml = round(weight_kg * ml_per_kg, 0)

    if weight_kg < 3.5:
        feeds_per_day = 10
    elif weight_kg < 4.5:
        feeds_per_day = 8
    else:
        feeds_per_day = 7

    amount_per_feed = round(daily_total_ml / feeds_per_day, 0)
    interval_hours = 24 / feeds_per_day

    schedule = _build_schedule(feeds_per_day, amount_per_feed, feeding_method, care_plan)

    notes = [
        f"Daily total: {int(daily_total_ml)} ml ({int(ml_per_kg)} ml/kg)",
        f"Feed every ~{interval_hours:.1f} hours",
        f"Wet diaper goal: {wet_goal}+ per day",
    ]
    if care_plan == "hydronephrosis":
        notes.append("Higher fluid intake supports kidney drainage — always follow nephrologist's advice.")
    if feeding_method == "breast":
        notes.append("Breast: nurse 10-20 min per side; times are start-of-feed targets.")

    return RoutineResponse(
        weight_kg=weight_kg,
        feeds_per_day=feeds_per_day,
        amount_per_feed_ml=amount_per_feed,
        interval_hours=round(interval_hours, 2),
        daily_total_ml=daily_total_ml,
        schedule=schedule,
        wet_goal_per_day=wet_goal,
        notes=notes,
    )


def _build_schedule(
    feeds: int, amount_ml: float, method: str, care_plan: str
) -> list[FeedScheduleItem]:
    start_hour = 6  # first feed at 06:00
    interval = 24 / feeds
    items = []
    for i in range(feeds):
        total_minutes = (start_hour * 60) + round(i * interval * 60)
        h, m = divmod(total_minutes % (24 * 60), 60)
        time_str = f"{h:02d}:{m:02d}"
        label = "Breast feed" if method == "breast" else f"Bottle {int(amount_ml)} ml"
        note = ""
        if care_plan == "hydronephrosis" and i % 3 == 0:
            note = "Check output after this feed"
        items.append(FeedScheduleItem(
            time=time_str, label=label, amount_ml=amount_ml, notes=note
        ))
    return items
