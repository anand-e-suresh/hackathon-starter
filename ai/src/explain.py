import os
import joblib
import shap
import pandas as pd
import numpy as np

from src.predict import _adapt_state_for_model

def explain_prediction(race_state: dict) -> str:
    """
    Generates a natural language explanation for a given prediction based on SHAP values.
    """
    model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models', 'xgb_model.joblib')
    if not os.path.exists(model_path):
        return "Model not trained yet."
        
    artifact = joblib.load(model_path)
    pipeline = artifact['pipeline']
    le = artifact['label_encoder']
    features = artifact['features']
    
    # Prepare input
    adapted_state = _adapt_state_for_model(race_state)
    input_data = {}
    for feature in features:
        input_data[feature] = [adapted_state.get(feature, 0.0)]
    df_input = pd.DataFrame(input_data)
    
    # Predict to get the target class
    probs = pipeline.predict_proba(df_input)[0]
    max_prob_idx = np.argmax(probs)
    action = le.inverse_transform([max_prob_idx])[0]
    
    # Get components
    scaler = pipeline.named_steps['scaler']
    classifier = pipeline.named_steps['classifier']
    
    # Transform input
    scaled_input = scaler.transform(df_input)
    
    try:
        # SHAP explainer
        explainer = shap.TreeExplainer(classifier)
        shap_values = explainer.shap_values(scaled_input)
        
        # shap_values shape depends on objective. For multi:softprob, it's a list of arrays (one per class)
        if isinstance(shap_values, list):
            class_shap = shap_values[max_prob_idx][0]
        else:
            class_shap = shap_values[0] # Single array fallback
            
        # Get top 3 features
        top_indices = np.argsort(np.abs(class_shap))[-3:][::-1]
        top_features = [features[i] for i in top_indices]
        
        reason = f"{action} recommended primarily due to: {', '.join(top_features)}."
        
        # Add a bit of natural language context
        if 'gap_ahead' in top_features and action == 'OVERTAKE':
            reason += " The gap ahead is favorable for an attack."
        elif 'ers_level' in top_features and action == 'RECOVER':
            reason += " Battery reserves are critical."
            
        return reason
        
    except Exception as e:
        # Fallback to feature importance if SHAP fails
        importances = classifier.feature_importances_
        top_indices = np.argsort(importances)[-3:][::-1]
        top_features = [features[i] for i in top_indices]
        return f"{action} recommended. Key factors (Feature Importance): {', '.join(top_features)}."
