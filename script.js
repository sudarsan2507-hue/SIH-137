// --- CONFIGURATION ---
const OPENWEATHER_API_KEY = "17d0cf1057d1b4b9d23beca65ab31658";

// --- Global variables & Map Initialization ---
let map;
let userMarker;
document.addEventListener('DOMContentLoaded', initMap);

function initMap() {
    const indiaBounds = L.latLngBounds(L.latLng(6.0, 68.0), L.latLng(38.0, 98.0));
    map = L.map('map', { center: [20.5937, 78.9629], zoom: 5, minZoom: 5, maxBounds: indiaBounds, maxBoundsViscosity: 1.0 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);

    // Event listeners for search and map clicks
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    map.on('click', (e) => handleLocationSelect(e.latlng.lat, e.latlng.lng));
    
    // Get user's current location on load
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([latitude, longitude]).addTo(map).bindPopup('Your Location');
            map.setView([latitude, longitude], 10);
            handleLocationSelect(latitude, longitude);
        });
    }
}

// --- CORE LOGIC ---

// Handles the search button click
async function handleSearch() {
    const cityName = document.getElementById('locationInput').value;
    if (!cityName) {
        alert("Please enter a city name.");
        return;
    }
    const coords = await getCoordsForCity(cityName);
    if (coords) {
        handleLocationSelect(coords.lat, coords.lon);
        map.setView([coords.lat, coords.lon], 8);
    }
}

// Main handler for any location selection (search or click)
async function handleLocationSelect(lat, lng) {
    if (OPENWEATHER_API_KEY === "YOUR_API_KEY_HERE") {
        alert("API Key is not configured in script.js");
        return;
    }
    updateRiskLevel('ANALYZING', 'Fetching data for 5 points...');
    
    const analysisResult = await analyzeAreaWeather(lat, lng);
    
    // Update UI with analysis
    updateWeatherDisplay(analysisResult.centerData);
    updateRiskLevel(analysisResult.risk.level, analysisResult.risk.description);
    document.getElementById('saferAreaResult').textContent = analysisResult.saferArea.message;
}

// NEW: Fetches weather for 5 points and analyzes them
async function analyzeAreaWeather(lat, lng) {
    const offset = 0.5; // Approx. 55 km
    const points = {
        center: { lat: lat, lon: lng },
        north: { lat: lat + offset, lon: lng },
        south: { lat: lat - offset, lon: lng },
        east: { lat: lat, lon: lng + offset },
        west: { lat: lat, lon: lng - offset }
    };

    try {
        const promises = Object.values(points).map(p => fetchWeather(p.lat, p.lon));
        const [center, north, south, east, west] = await Promise.all(promises);
        
        const allData = { center, north, south, east, west };

        // --- Triangulation Logic ---
        const risk = checkCycloneSymptoms(allData);
        const saferArea = findSaferDirection(allData);

        return { centerData: center, risk, saferArea };

    } catch (error) {
        console.error("Failed to analyze area:", error);
        return {
            centerData: {},
            risk: { level: 'ERROR', description: 'Could not fetch data for triangulation.' },
            saferArea: { message: 'Analysis failed.' }
        };
    }
}

// NEW: Checks for cyclone patterns in the 5-point data
function checkCycloneSymptoms(data) {
    const centerPressure = data.center.main.pressure;
    const surroundingPressures = [data.north.main.pressure, data.south.main.pressure, data.east.main.pressure, data.west.main.pressure];
    const avgSurroundingPressure = surroundingPressures.reduce((a, b) => a + b, 0) / 4;

    const centerHumidity = data.center.main.humidity;
    const centerWind = data.center.wind.speed;

    // Symptom: Pressure in the center is significantly lower than the average of surrounding areas
    const pressureDrop = avgSurroundingPressure - centerPressure;

    if (pressureDrop > 6 && centerHumidity > 85 && centerWind > 15) {
        return { level: 'EXTREME', description: `Cyclone Warning: Significant pressure drop (${pressureDrop.toFixed(1)} hPa) detected with high wind and humidity.` };
    }
    if (pressureDrop > 4 && centerHumidity > 80 && centerWind > 10) {
        return { level: 'HIGH', description: `Storm Watch: Low-pressure system detected (${pressureDrop.toFixed(1)} hPa drop). Monitor conditions closely.` };
    }
    // Fallback to simple risk check for the center point
    const centerRain = data.center.rain ? data.center.rain['1h'] : 0;
    if (centerRain > 20 || data.center.main.temp > 40) {
         return { level: 'HIGH', description: 'Alert: Intense rainfall or extreme heat at the central location.' };
    }

    return { level: 'LOW', description: 'No significant cyclonic patterns or immediate threats detected.' };
}

// NEW: Finds the safest direction among the 5 points
function findSaferDirection(data) {
    let safer = { name: 'center', score: Infinity };

    for (const [name, weather] of Object.entries(data)) {
        const rain = weather.rain ? weather.rain['1h'] : 0;
        const wind = weather.wind.speed;
        // Simple score: lower is better
        const score = rain + wind;
        if (score < safer.score) {
            safer = { name, score };
        }
    }
    if (safer.name === 'center') {
        return { message: 'Current location conditions are the most stable in the immediate area.' };
    }
    return { message: `Conditions may be relatively calmer to the ${safer.name}. This is not an evacuation order.` };
}


// --- Utility and Helper Functions ---

// Fetches weather for a single point
async function fetchWeather(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API fetch failed for ${lat},${lon}`);
    return response.json();
}

// Converts a city name to coordinates
async function getCoordsForCity(city) {
    try {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${OPENWEATHER_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Geocoding API failed");
        const data = await response.json();
        if (data.length === 0) {
            alert("Could not find location: " + city);
            return null;
        }
        return { lat: data[0].lat, lon: data[0].lon };
    } catch (error) {
        console.error(error);
        return null;
    }
}

// --- UI Update Functions ---

function updateWeatherDisplay(data) {
    if (!data.main) { // Clear display on error
        document.getElementById('temperature').textContent = '--';
        document.getElementById('humidity').textContent = '--';
        document.getElementById('pressure').textContent = '--';
        document.getElementById('rainfall').textContent = '--';
        return;
    }
    const rainfall = data.rain && data.rain['1h'] ? data.rain['1h'] : 0;
    document.getElementById('temperature').textContent = data.main.temp.toFixed(1) + '°C';
    document.getElementById('humidity').textContent = data.main.humidity + '%';
    document.getElementById('pressure').textContent = data.main.pressure + ' hPa';
    document.getElementById('rainfall').textContent = rainfall + ' mm';
}

function updateRiskLevel(level, description) {
    const riskElement = document.getElementById('riskLevel');
    const descElement = document.getElementById('riskDescription');
    riskElement.textContent = level;
    descElement.textContent = description;

    const riskIndicator = document.querySelector('.risk-indicator');
    const levelColors = { 'LOW': '#138808', 'ANALYZING': '#6c757d', 'MODERATE': '#f39c12', 'HIGH': '#FF9933', 'EXTREME': '#D32F2F', 'ERROR': '#6c757d' };
    riskIndicator.style.background = levelColors[level] || '#6c757d';
}

// --- SOS and other functions (no change) ---
function triggerSOS() {
    alert('🚨 SOS ACTIVATED (Simulation)');
}
function findNearbyServices(){} // Placeholder
