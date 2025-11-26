"""
Background scheduler for periodic ML model retraining.
Uses APScheduler to trigger training jobs based on MongoDB settings.
"""
import asyncio
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


async def _retrain_job_async():
    """
    Async scheduled job: retrain model and reload if promoted.
    Creates a new MongoDB client for this event loop.
    """
    print(f"[SCHEDULER] Running scheduled retraining job at {datetime.now(timezone.utc)}")
    
    try:
        from trainer import train_and_maybe_promote
        from model_wrapper import get_model
        from motor.motor_asyncio import AsyncIOMotorClient
        import os
        
        # Create a NEW MongoDB client for this event loop
        # Motor clients are tied to the event loop they're created in
        mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        client = AsyncIOMotorClient(
            mongo_url,
            maxPoolSize=5,
            minPoolSize=1,
            serverSelectionTimeoutMS=5000
        )
        
        try:
            # Run training with the new client
            result = await train_and_maybe_promote(client)
            
            print(f"[SCHEDULER] Training result: {result['message']}")
            
            # Reload model if promoted
            if result['promoted']:
                print("[SCHEDULER] New model promoted, reloading...")
                model = get_model()
                model.reload()  # This will load models/current.joblib
                print("[SCHEDULER] ✓ Model reloaded successfully")
        finally:
            # Close the client when done
            client.close()
        
    except Exception as e:
        print(f"[SCHEDULER] ERROR: Retrain job failed: {e}")
        import traceback
        traceback.print_exc()


def retrain_job():
    """
    Synchronous wrapper for async retrain job.
    APScheduler requires synchronous functions, so we run the async one in a new thread.
    """
    import threading
    
    def run_async():
        """Run async function in a new event loop."""
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            new_loop.run_until_complete(_retrain_job_async())
        finally:
            new_loop.close()
    
    # Run in a separate thread to avoid blocking the scheduler
    thread = threading.Thread(target=run_async, daemon=True)
    thread.start()
    thread.join(timeout=300)  # Wait up to 5 minutes for training to complete


async def get_default_settings() -> Dict[str, Any]:
    """Get default scheduler settings."""
    return {
        "retrain_interval_value": 24,  # Interval value
        "retrain_interval_unit": "hours",  # "minutes" or "hours"
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
    
    # Support both old format (hours only) and new format (value + unit)
    if "retrain_interval_hours" in settings:
        # Legacy format
        interval_value = settings.get("retrain_interval_hours", 24)
        interval_unit = "hours"
    else:
        # New format
        interval_value = settings.get("retrain_interval_value", 24)
        interval_unit = settings.get("retrain_interval_unit", "hours")
    
    enabled = settings.get("scheduler_enabled", True)
    
    scheduler = get_scheduler()
    
    # Remove existing job if present
    if scheduler.get_job(_JOB_ID):
        scheduler.remove_job(_JOB_ID)
        print(f"[SCHEDULER] Removed existing retraining job")
    
    if enabled:
        # Add new job with updated interval
        if interval_unit == "minutes":
            trigger = IntervalTrigger(minutes=interval_value)
            print(f"[SCHEDULER] ✓ Retraining scheduled every {interval_value} minutes")
        else:
            trigger = IntervalTrigger(hours=interval_value)
            print(f"[SCHEDULER] ✓ Retraining scheduled every {interval_value} hours")
        
        scheduler.add_job(
            func=retrain_job,
            trigger=trigger,
            id=_JOB_ID,
            name="ML Model Retraining",
            replace_existing=True
        )
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

