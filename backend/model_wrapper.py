"""
Wrapper for the LightGBM model pipeline.
Handles loading, prediction, and model management.
"""
import os
import joblib
import pandas as pd
from typing import Dict, Any


class WazuhMLModel:
    """
    Wrapper for the full preprocessing + LightGBM pipeline.
    Handles single-alert predictions and model reloading.
    """
    
    def __init__(self, model_path: str = "models/current.joblib"):
        self.model = None
        self.version = "unknown"
        self.model_path = model_path
        self.threshold = 0.5
        self.load_model(model_path)
    
    def load_model(self, path: str = None) -> bool:
        """
        Load the full pipeline (preprocessor + LGBMClassifier) from disk.
        The pipeline includes StandardScaler + OneHotEncoder + LGBMClassifier.
        """
        if path:
            self.model_path = path
        
        if not os.path.exists(self.model_path):
            print(f"[ML] Warning: Model not found at {self.model_path}")
            return False
        
        try:
            self.model = joblib.load(self.model_path)
            self.version = os.path.basename(self.model_path)
            print(f"[ML] ✓ Model loaded: {self.version}")
            return True
        except Exception as e:
            print(f"[ML] ERROR loading model: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def predict(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict single alert.
        
        Args:
            alert: Raw Wazuh alert dictionary
            
        Returns:
            {
                "label": "malicious" | "benign",
                "score": 0.0-1.0,
                "version": str,
                "features": dict (for debugging)
            }
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        try:
            # Import here to avoid circular dependency
            from features import extract_features
            
            # Extract features
            feats = extract_features(alert)
            
            # Convert to DataFrame with correct column order
            # MUST match the training order exactly!
            feature_order = [
                "agent_name", 
                "srcuser", 
                "decoder_name", 
                "program_name",
                "rule_groups",
                "rule_level", 
                "hour_of_day", 
                "day_of_week", 
                "success"
            ]
            
            df = pd.DataFrame([feats])[feature_order]
            
            # Predict (model is the full pipeline: preprocessor + classifier)
            proba = self.model.predict_proba(df)[0][1]  # Probability of class 1 (malicious)
            label = "malicious" if proba >= self.threshold else "benign"
            
            return {
                "label": label,
                "score": float(proba),
                "version": self.version,
                "features": feats  # For debugging
            }
            
        except Exception as e:
            print(f"[ML] Prediction error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "label": "unknown",
                "score": 0.0,
                "version": self.version,
                "error": str(e)
            }
    
    def set_threshold(self, threshold: float):
        """Update classification threshold"""
        self.threshold = threshold
        print(f"[ML] Threshold updated to {threshold}")
    
    def get_threshold(self) -> float:
        """Get current threshold"""
        return self.threshold
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.model is not None
    
    def get_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "loaded": self.is_loaded(),
            "version": self.version,
            "path": self.model_path,
            "threshold": self.threshold
        }
    
    def reload(self, path: str = None):
        """Reload model (hot-swap)"""
        return self.load_model(path)


# Global singleton instance
_model_instance = None


def get_model() -> WazuhMLModel:
    """Get global model instance (singleton)"""
    global _model_instance
    if _model_instance is None:
        _model_instance = WazuhMLModel()
    return _model_instance


def is_model_loaded() -> bool:
    """Check if global model is loaded"""
    model = get_model()
    return model.is_loaded()


def predict_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to predict a single alert"""
    model = get_model()
    return model.predict(alert)


def set_threshold(threshold: float):
    """Update global model threshold"""
    model = get_model()
    model.set_threshold(threshold)


def reload_model(path: str = None):
    """Reload global model"""
    model = get_model()
    return model.reload(path)


def get_model_info() -> Dict[str, Any]:
    """Get global model info"""
    model = get_model()
    return model.get_info()

