class FloodClassifier:
    def __init__(self):
        print("Initialized Mock Pure-Math Flood Classifier")

    def predict_risk(self, elevation: float, rainfall: float, dist_water: float) -> float:
        risk_score = (rainfall * 0.5) - (elevation * 2) - (dist_water * 0.01)
        prob = max(0.0, min(1.0, (risk_score + 50) / 100.0))
        return prob

flood_classifier = FloodClassifier()
