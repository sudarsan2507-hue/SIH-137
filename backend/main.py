from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random

from models.flood_classifier import flood_classifier
from models.storm_trajectory import storm_predictor

app = FastAPI(title="WeatherGuard ML Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class RiskRequest(BaseModel):
    lat: float
    lon: float
    rainfall: float
    wind_speed: float
    wind_deg: float

@app.post("/api/analyze-risk")
def analyze_risk(req: RiskRequest):
    mock_elevation = (abs(req.lat) + abs(req.lon)) % 30
    mock_dist_water = (abs(req.lat) * abs(req.lon)) % 2000

    flood_prob = flood_classifier.predict_risk(
        elevation=mock_elevation, 
        rainfall=req.rainfall, 
        dist_water=mock_dist_water
    )
    trajectory = storm_predictor.predict_next_vectors(
        current_lat=req.lat,
        current_lon=req.lon,
        wind_speed=req.wind_speed,
        wind_deg=req.wind_deg
    )
    danger_score = (flood_prob * 100) + (req.wind_speed * 1.5)
    safe_angle = (req.wind_deg + 90) % 360
    directions = {0: 'north', 90: 'east', 180: 'south', 270: 'west'}
    closest_dir = min(directions.keys(), key=lambda k: min(abs(k - safe_angle), 360 - abs(k - safe_angle)))

    return {
        "flood_probability": round(flood_prob * 100, 2),
        "synthetic_topography": {
            "elevation_m": round(mock_elevation, 1),
            "dist_to_water_m": round(mock_dist_water, 1)
        },
        "storm_trajectory": trajectory,
        "overall_danger_index": round(danger_score, 2),
        "recommendation": "EVACUATE" if danger_score > 60 else "SHELTER_IN_PLACE",
        "safer_direction": directions[closest_dir]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
