import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

class FloodClassifier:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.train_synthetic_model()

    def train_synthetic_model(self):
        np.random.seed(42)
        n_samples = 1000
        
        elevations = np.random.uniform(0, 50, n_samples)
        rainfall = np.random.uniform(0, 200, n_samples)
        dist_water = np.random.uniform(10, 5000, n_samples)
        risk_score = (rainfall * 0.5) - (elevations * 2) - (dist_water * 0.01)
        labels = (risk_score > 20).astype(int)
        
        X = pd.DataFrame({'elevation': elevations, 'rainfall': rainfall, 'dist_water': dist_water})
        self.model.fit(X, labels)
        print("Trained Synthetic Random Forest Flood Classifier")

    def predict_risk(self, elevation: float, rainfall: float, dist_water: float) -> float:
        X_new = pd.DataFrame({'elevation': [elevation], 'rainfall': [rainfall], 'dist_water': [dist_water]})
        return self.model.predict_proba(X_new)[0][1]

flood_classifier = FloodClassifier()
