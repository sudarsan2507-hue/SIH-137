import numpy as np

class StormTrajectoryPredictor:
    def __init__(self):
        print("Initialized Mock LSTM Trajectory Predictor")

    def predict_next_vectors(self, current_lat, current_lon, wind_speed, wind_deg, hours=3):
        predictions = []
        rad = np.radians(270 - wind_deg)
        speed_deg_per_hour = (wind_speed * 3.6) / 111.0 
        
        lat = current_lat
        lon = current_lon
        
        for h in range(1, hours + 1):
            curve_factor = h * 0.05
            lat += np.sin(rad + curve_factor) * speed_deg_per_hour
            lon += np.cos(rad + curve_factor) * speed_deg_per_hour
            
            predictions.append({
                "hour": h,
                "predicted_lat": round(lat, 5),
                "predicted_lon": round(lon, 5),
                "confidence": round(max(0.9 - (h * 0.15), 0.3), 2)
            })
            
        return predictions

storm_predictor = StormTrajectoryPredictor()
