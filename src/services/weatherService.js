export async function fetchWeather(lat, lon) {
    const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
    if (!apiKey || apiKey === 'your_openweather_api_key_here') {
        throw new Error("Missing OpenWeatherMap API Key in .env. Please check the Setup Instructions.");
    }
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    return fetch(url).then(res => {
        if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
        return res.json();
    });
}
