export async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${Math.round(lat * 1000) / 1000}&longitude=${Math.round(lon * 1000) / 1000}&current=temperature_2m,relative_humidity_2m,surface_pressure,precipitation,wind_speed_10m,wind_direction_10m`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Open-Meteo returned HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            main: {
                temp: data.current.temperature_2m,
                humidity: data.current.relative_humidity_2m,
                pressure: data.current.surface_pressure
            },
            rain: {
                '1h': data.current.precipitation
            },
            wind: {
                speed: data.current.wind_speed_10m,
                deg: data.current.wind_direction_10m
            }
        };
    } catch (e) {
        throw new Error("Failed to fetch from keyless weather API: " + e.message);
    }
}
