import os
import joblib
import logging
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support

from src.data_processing import load_and_clean_data
from src.feature_engineering import engineer_features
from src.labeling import generate_labels

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def evaluate_model():
    model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models', 'xgb_model.joblib')
    if not os.path.exists(model_path):
        logger.error(f"Model not found at {model_path}. Please run train.py first.")
        return

    logger.info("Loading model artifact...")
    artifact = joblib.load(model_path)
    pipeline = artifact['pipeline']
    le = artifact['label_encoder']
    features = artifact['features']
    
    # Load separate hold-out test set
    logger.info("Loading test data (2023 Zandvoort)...")
    test_config = [{'year': 2023, 'event': 'Zandvoort', 'session': 'R'}]
    
    try:
        raw_df = load_and_clean_data(test_config)
        features_df = engineer_features(raw_df)
        labeled_df = generate_labels(features_df)
    except Exception as e:
        logger.error(f"Failed to load test data: {e}")
        return
        
    X_test = labeled_df[features]
    y_test_true = labeled_df['action']
    
    logger.info("Running predictions...")
    y_pred = pipeline.predict(X_test)
    y_pred_labels = le.inverse_transform(y_pred)
    
    acc = accuracy_score(y_test_true, y_pred_labels)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test_true, y_pred_labels, average='weighted', zero_division=0)
    
    logger.info("=== EVALUATION RESULTS ===")
    logger.info(f"Accuracy:  {acc:.4f}")
    logger.info(f"Precision: {precision:.4f}")
    logger.info(f"Recall:    {recall:.4f}")
    logger.info(f"F1 Score:  {f1:.4f}")
    
    logger.info("\nClassification Report:\n" + classification_report(y_test_true, y_pred_labels, zero_division=0))
    logger.info("\nConfusion Matrix:\n" + str(confusion_matrix(y_test_true, y_pred_labels)))

if __name__ == '__main__':
    evaluate_model()
