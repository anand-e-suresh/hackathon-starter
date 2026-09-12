import os
import joblib
import logging
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

from src.data_processing import load_and_clean_data
from src.feature_engineering import engineer_features
from src.labeling import generate_labels

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Basic Config
SESSIONS_CONFIG = [
    {'year': 2023, 'event': 'Monza', 'session': 'R'}, # Train
    {'year': 2023, 'event': 'Spa', 'session': 'R'}    # Test
]

FEATURES = [
    'speed', 'throttle', 'brake', 'gear', 'drs_available', 
    'ers_level', 'energy_deployment', 'energy_recovery',
    'gap_ahead', 'gap_behind', 'closing_speed', 'lap', 
    'energy_per_remaining_lap', 'attack_opportunity_score',
    'recovery_opportunity_score', 'grid_energy_condition'
]

def main():
    logger.info("Starting training pipeline...")
    
    # 1. Load and clean data (Race 1 and Race 2 for temporal split)
    logger.info("Loading FastF1 data...")
    raw_df = load_and_clean_data(SESSIONS_CONFIG)
    
    # 2. Engineer features
    logger.info("Engineering features...")
    features_df = engineer_features(raw_df)
    
    # Add metadata back for splitting
    features_df['Year'] = raw_df['Year']
    features_df['Event'] = raw_df['Event']
    features_df['Driver'] = raw_df['Driver']
    
    # 3. Generate labels
    logger.info("Generating heuristic labels...")
    labeled_df = generate_labels(features_df)
    
    # Class distribution
    logger.info(f"Class Distribution:\n{labeled_df['action'].value_counts()}")
    
    # 4. Temporal Split (Train on Monza, Test on Spa)
    # This prevents data leakage across adjacent timesteps
    train_df = labeled_df[labeled_df['Event'] == 'Monza']
    test_df = labeled_df[labeled_df['Event'] == 'Spa']
    
    if test_df.empty:
        # Fallback if only 1 race loaded
        logger.warning("Only 1 event found, falling back to chronological split by lap...")
        train_df = labeled_df[labeled_df['lap'] <= 35]
        test_df = labeled_df[labeled_df['lap'] > 35]

    X_train = train_df[FEATURES]
    y_train_text = train_df['action']
    X_test = test_df[FEATURES]
    y_test_text = test_df['action']
    
    # Encode labels
    le = LabelEncoder()
    y_train = le.fit_transform(y_train_text)
    y_test = le.transform(y_test_text)
    
    # 5. Train XGBoost
    logger.info("Training Random Forest Model (Fallback from XGBoost due to env limitations)...")
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', RandomForestClassifier(
            n_estimators=100, 
            max_depth=5, 
            random_state=42
        ))
    ])
    
    pipeline.fit(X_train, y_train)
    
    # Quick evaluation
    logger.info("Evaluating on Validation Set...")
    y_pred = pipeline.predict(X_test)
    y_pred_labels = le.inverse_transform(y_pred)
    
    report = classification_report(y_test_text, y_pred_labels)
    logger.info(f"Classification Report:\n{report}")
    
    # 6. Save Artifacts
    model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')
    os.makedirs(model_dir, exist_ok=True)
    
    artifact = {
        'pipeline': pipeline,
        'label_encoder': le,
        'features': FEATURES
    }
    
    artifact_path = os.path.join(model_dir, 'xgb_model.joblib')
    joblib.dump(artifact, artifact_path)
    logger.info(f"Model saved to {artifact_path}")

if __name__ == '__main__':
    main()
