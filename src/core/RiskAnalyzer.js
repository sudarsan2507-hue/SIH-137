export async function analyzeRiskWithML(lat, lng, weather) {
    const payload = {
        lat: lat,
        lon: lng,
        rainfall: weather.rain && weather.rain['1h'] ? weather.rain['1h'] : 0,
        wind_speed: weather.wind?.speed || 0,
        wind_deg: weather.wind?.deg || 0
    };

    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    console.log(import.meta.env.VITE_BACKEND_URL);
    try {
        const res = await fetch(`${backendUrl}/api/analyze-risk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            throw new Error(`ML Backend returned HTTP ${res.status}`);
        }
        
        return await res.json();
    } catch (error) {
        console.error("ML Backend connection failed:", error);
        throw new Error("Unable to reach FastAPI ML Backend. Ensure it is running on port 8000.");
    }
}
