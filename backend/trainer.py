"""
ML model training and promotion.
Trains on labeled data from MongoDB (malicious & safe collections).
"""
import os
import shutil
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, accuracy_score, precision_score, recall_score
import joblib

from features import extract_features, features_to_dataframe_row


# Minimum samples required for training
MIN_TRAINING_SAMPLES = 20
MIN_SAMPLES_PER_CLASS = 5

# Model promotion threshold
F1_IMPROVEMENT_THRESHOLD = 0.02  # Promote if new model is 2% better


async def load_training_data_from_mongo(db) -> pd.DataFrame:
    """
    Load training data from malicious and safe collections.
    Returns DataFrame with features + label column.
    """
    from db import get_collection
    
    malicious_collection = get_collection("malicious")
    safe_collection = get_collection("safe")
    
    rows = []
    
    # Load malicious samples
    async for doc in malicious_collection.find():
        try:
            feats = extract_features(doc)
            row = features_to_dataframe_row(feats)
            row["label"] = "malicious"
            rows.append(row)
        except Exception as e:
            print(f"[TRAINER] Warning: Failed to extract features from malicious doc: {e}")
            continue
    
    # Load safe samples
    async for doc in safe_collection.find():
        try:
            feats = extract_features(doc)
            row = features_to_dataframe_row(feats)
            row["label"] = "benign"
            rows.append(row)
        except Exception as e:
            print(f"[TRAINER] Warning: Failed to extract features from safe doc: {e}")
            continue
    
    if not rows:
        raise ValueError("No training data found in malicious/safe collections")
    
    df = pd.DataFrame(rows)
    print(f"[TRAINER] Loaded {len(df)} training samples")
    print(f"[TRAINER] Label distribution: {df['label'].value_counts().to_dict()}")
    
    return df


def train_model(df: pd.DataFrame) -> Tuple[Pipeline, Dict[str, float]]:
    """
    Train ML model using the same pipeline as final_model.py
    
    Returns:
        (trained_pipeline, metrics_dict)
    """
    print("[TRAINER] Starting model training...")
    
    # Validate data
    if len(df) < MIN_TRAINING_SAMPLES:
        raise ValueError(f"Insufficient training data: {len(df)} samples (need {MIN_TRAINING_SAMPLES})")
    
    label_counts = df['label'].value_counts()
    if len(label_counts) < 2:
        raise ValueError("Need both malicious and benign samples for training")
    
    if label_counts.min() < MIN_SAMPLES_PER_CLASS:
        raise ValueError(f"Need at least {MIN_SAMPLES_PER_CLASS} samples per class")
    
    # Define features (must match final_model.py exactly)
    categorical_features = [
        'agent_name', 'srcuser', 'decoder_name', 
        'program_name', 'rule_groups', 'rule_description'
    ]
    numerical_features = ['rule_level', 'hour_of_day', 'day_of_week']
    
    # Prepare X and y
    X = df[categorical_features + numerical_features]
    y = df['label'].map({'benign': 0, 'malicious': 1})
    
    # Split for validation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"[TRAINER] Train samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Build preprocessing pipeline (same as final_model.py)
    numeric_transformer = StandardScaler()
    categorical_transformer = OneHotEncoder(handle_unknown='ignore')
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numerical_features),
            ('cat', categorical_transformer, categorical_features)
        ]
    )
    
    # Build full pipeline
    model = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        n_jobs=-1
    )
    
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', model)
    ])
    
    # Train
    print("[TRAINER] Training RandomForest classifier...")
    pipeline.fit(X_train, y_train)
    
    # Evaluate
    y_pred = pipeline.predict(X_test)
    
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred)),
        'recall': float(recall_score(y_test, y_pred)),
        'f1_score': float(f1_score(y_test, y_pred)),
        'train_samples': len(X_train),
        'test_samples': len(X_test)
    }
    
    print(f"[TRAINER] Model trained successfully!")
    print(f"[TRAINER] Metrics: {metrics}")
    
    # Retrain on full dataset for production
    print("[TRAINER] Retraining on full dataset for production...")
    pipeline.fit(X, y)
    
    return pipeline, metrics


def save_model_with_version(pipeline: Pipeline, metrics: Dict[str, float]) -> str:
    """
    Save model with timestamp version.
    Returns path to saved model.
    """
    # Create models directory if it doesn't exist
    os.makedirs("models", exist_ok=True)
    
    # Generate version filename
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    version_filename = f"authclf-{timestamp}.joblib"
    version_path = os.path.join("models", version_filename)
    
    # Save versioned model
    joblib.dump(pipeline, version_path)
    print(f"[TRAINER] Saved versioned model: {version_path}")
    
    return version_path


def promote_to_production(version_path: str) -> None:
    """
    Atomically promote a model version to production (current.joblib).
    Uses temp file + atomic rename for safety.
    """
    current_path = "models/current.joblib"
    temp_path = "models/current.joblib.tmp"
    
    # Copy to temp location
    shutil.copy2(version_path, temp_path)
    
    # Atomic rename (overwrites existing current.joblib)
    os.replace(temp_path, current_path)
    
    print(f"[TRAINER] ✓ Promoted to production: {current_path}")


async def train_and_maybe_promote(db) -> Dict[str, Any]:
    """
    Full training pipeline:
    1. Load training data from MongoDB
    2. Train new model
    3. Compare with current production model
    4. Promote if better
    
    Returns:
        {
            "promoted": bool,
            "version": str,
            "metrics": dict,
            "message": str
        }
    """
    try:
        print("[TRAINER] ========================================")
        print("[TRAINER] Starting training pipeline...")
        print("[TRAINER] ========================================")
        
        # Load training data
        df = await load_training_data_from_mongo(db)
        
        # Train new model
        new_pipeline, new_metrics = train_model(df)
        
        # Save versioned model
        version_path = save_model_with_version(new_pipeline, new_metrics)
        version_name = os.path.basename(version_path)
        
        # Check if we should promote
        should_promote = True
        current_path = "models/current.joblib"
        
        if os.path.exists(current_path):
            # Load current model and evaluate on same test set
            try:
                print("[TRAINER] Comparing with current production model...")
                current_pipeline = joblib.load(current_path)
                
                # Quick evaluation on recent data
                X = df[['agent_name', 'srcuser', 'decoder_name', 
                       'program_name', 'rule_groups', 'rule_description',
                       'rule_level', 'hour_of_day', 'day_of_week']]
                y = df['label'].map({'benign': 0, 'malicious': 1})
                
                current_pred = current_pipeline.predict(X)
                current_f1 = f1_score(y, current_pred)
                
                new_f1 = new_metrics['f1_score']
                
                print(f"[TRAINER] Current model F1: {current_f1:.4f}")
                print(f"[TRAINER] New model F1: {new_f1:.4f}")
                
                # Promote only if significantly better
                if new_f1 > current_f1 + F1_IMPROVEMENT_THRESHOLD:
                    print(f"[TRAINER] ✓ New model is better by {new_f1 - current_f1:.4f}")
                    should_promote = True
                else:
                    print(f"[TRAINER] ✗ New model not significantly better")
                    should_promote = False
                    
            except Exception as e:
                print(f"[TRAINER] Warning: Could not compare with current model: {e}")
                print("[TRAINER] Promoting new model anyway...")
                should_promote = True
        else:
            print("[TRAINER] No current production model found. Promoting new model...")
            should_promote = True
        
        # Promote if approved
        if should_promote:
            promote_to_production(version_path)
            
            # Store metadata in MongoDB
            from db import get_collection
            models_collection = get_collection("models")
            await models_collection.insert_one({
                "version": version_name,
                "path": version_path,
                "metrics": new_metrics,
                "is_production": True,
                "promoted_at": datetime.now(timezone.utc).isoformat(),
                "training_samples": len(df)
            })
            
            return {
                "promoted": True,
                "version": version_name,
                "metrics": new_metrics,
                "message": f"Model promoted to production (F1: {new_metrics['f1_score']:.4f})"
            }
        else:
            return {
                "promoted": False,
                "version": version_name,
                "metrics": new_metrics,
                "message": "Model trained but not promoted (no significant improvement)"
            }
            
    except Exception as e:
        print(f"[TRAINER] ERROR: Training failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "promoted": False,
            "version": "none",
            "metrics": {},
            "message": f"Training failed: {str(e)}"
        }

