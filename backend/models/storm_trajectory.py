import numpy as np

class StormTrajectoryPredictor:
    def __init__(self):
        print("Initialized Mock LSTM Trajectory Predictor")

    def predict_next_vectors(self, current_lat, current_lon, wind_speed, wind_deg, hours=3):
        """
        Uses a mock LSTM-like smoothing function to predict where the storm center is moving.
        Instead of real tensor operations, this uses math to simulate the output of a Time-Series model.
        """
        predictions = []
        # Convert wind direction from meteorological (degrees from North) to mathematical angle
        rad = np.radians(270 - wind_deg)
        
        # Speed in m/s to rough degrees lat/lon per hour estimation
        speed_deg_per_hour = (wind_speed * 3.6) / 111.0 
        
        lat = current_lat
        lon = current_lon
        
        for h in range(1, hours + 1):
            # LSTM simulation: storm slows down slightly and curves over time
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
