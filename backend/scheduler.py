"""
Background scheduler for periodic ML model retraining.
Uses APScheduler to trigger training jobs based on MongoDB settings.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone
from typing import Dict, Any

# Global scheduler instance
_scheduler: BackgroundScheduler | None = None
_JOB_ID = "model_retrain"


def get_scheduler() -> BackgroundScheduler:
    """Get or create scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler()
        _scheduler.start()
        print("[SCHEDULER] ✓ Background scheduler started")
    return _scheduler


async def retrain_job():
    """
    Scheduled job: retrain model and reload if promoted.
    """
    print(f"[SCHEDULER] Running scheduled retraining job at {datetime.now(timezone.utc)}")
    
    try:
        from trainer import train_and_maybe_promote
        from model_runtime import reload_model
        from db import get_client
        
        # Get MongoDB client
        client = get_client()
        
        # Run training
        result = await train_and_maybe_promote(client)
        
        print(f"[SCHEDULER] Training result: {result['message']}")
        
        # Reload model if promoted
        if result['promoted']:
            print("[SCHEDULER] New model promoted, reloading...")
            reload_model()  # This will load models/current.joblib
            print("[SCHEDULER] ✓ Model reloaded successfully")
        
    except Exception as e:
        print(f"[SCHEDULER] ERROR: Retrain job failed: {e}")
        import traceback
        traceback.print_exc()


async def get_default_settings() -> Dict[str, Any]:
    """Get default scheduler settings."""
    return {
        "retrain_interval_hours": 24,  # Retrain daily by default
        "confidence_threshold": 0.85,  # Auto-classify above 85% confidence
        "auto_classify": False,  # Manual classification by default
        "scheduler_enabled": True
    }


async def get_settings_from_db() -> Dict[str, Any]:
    """Get settings from MongoDB or use defaults."""
    try:
        from db import get_settings
        settings = await get_settings()
        if settings:
            return settings
        return await get_default_settings()
    except Exception as e:
        print(f"[SCHEDULER] Warning: Could not load settings from DB: {e}")
        return await get_default_settings()


async def reschedule_from_settings(db=None) -> None:
    """
    Update scheduler trigger based on current settings.
    Call this after settings are updated.
    """
    settings = await get_settings_from_db()
    
    interval_hours = settings.get("retrain_interval_hours", 24)
    enabled = settings.get("scheduler_enabled", True)
    
    scheduler = get_scheduler()
    
    # Remove existing job if present
    if scheduler.get_job(_JOB_ID):
        scheduler.remove_job(_JOB_ID)
        print(f"[SCHEDULER] Removed existing retraining job")
    
    if enabled:
        # Add new job with updated interval
        trigger = IntervalTrigger(hours=interval_hours)
        scheduler.add_job(
            func=retrain_job,
            trigger=trigger,
            id=_JOB_ID,
            name="ML Model Retraining",
            replace_existing=True
        )
        print(f"[SCHEDULER] ✓ Retraining scheduled every {interval_hours} hours")
    else:
        print("[SCHEDULER] Retraining disabled in settings")


async def start_scheduler():
    """Initialize and start the scheduler with settings from DB."""
    print("[SCHEDULER] Initializing scheduler...")
    
    # Ensure scheduler is running
    get_scheduler()
    
    # Schedule jobs based on settings
    await reschedule_from_settings()
    
    print("[SCHEDULER] ✓ Scheduler initialized")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=True)
        _scheduler = None
        print("[SCHEDULER] ✓ Scheduler stopped")


def get_scheduler_status() -> Dict[str, Any]:
    """Get current scheduler status and jobs."""
    if _scheduler is None:
        return {"running": False, "jobs": []}
    
    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None
        })
    
    return {
        "running": _scheduler.running,
        "jobs": jobs
    }

