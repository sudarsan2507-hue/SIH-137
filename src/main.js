
import { fetchWeather } from './services/weatherService.js';
import { initMapAPI, initializeMap, updateMarkers, getCurrentLocation, searchForPlaces, findBestPlace, displaySafePlaceAndRoute, onMapClick, drawStormTrajectory } from './services/mapService.js';
import { analyzeRiskWithML } from './core/RiskAnalyzer.js';

const disasterBtn = document.getElementById('disasterBtn');
const useMyLocationBtn = document.getElementById('useMyLocationBtn');
const riskDescription = document.getElementById('riskDescription');
const safePlaceResult = document.getElementById('safePlaceResult');
const mapElement = document.getElementById('map');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

function updateWeatherDisplay(data) {
    if (!data.main) return;
    const rainfall = data.rain && data.rain['1h'] ? data.rain['1h'] : 0;
    document.getElementById('temperature').textContent = data.main.temp.toFixed(1) + '°C';
    document.getElementById('humidity').textContent = data.main.humidity + '%';
    document.getElementById('pressure').textContent = data.main.pressure + ' hPa';
    document.getElementById('rainfall').textContent = rainfall + ' mm';
}

function updateUiWithSafePlace(place, directionsUrl) {
    safePlaceResult.innerHTML = `
        <h5>${place.name}</h5>
        <p>${place.vicinity}</p>
        <a href="${directionsUrl}" target="_blank" class="directions-link">Open in OSM routing</a>
    `;
    riskDescription.textContent = "Route to recommended safe place is now drawn on the map.";
}

let currentWeather = null;

async function handleLocationUpdate(lat, lng, isClick) {
    updateMarkers(lat, lng, isClick);
    safePlaceResult.innerHTML = '<p>Click "Find Safe Place" for a recommendation.</p>';

    try {
        currentWeather = await fetchWeather(lat, lng);
        updateWeatherDisplay(currentWeather);
        riskDescription.textContent = "Current weather loaded. Click 'Find Safe Place' to query the ML Predictor models.";
    } catch (error) {
        console.error("Failed to fetch weather:", error);
        riskDescription.textContent = "Could not load weather data: " + error.message;
        currentWeather = null;
    }
}

async function searchLocationByNominatim() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            handleLocationUpdate(lat, lng, true);
        } else {
            alert("Location not found via Nominatim OpenStreetMap.");
        }
    } catch(e) {
        console.error("Nominatim search failed", e);
        alert("Search failed. Check your network.");
    } finally {
        searchBtn.innerHTML = '<i class="fas fa-search"></i>';
    }
}

async function findSafePlace() {
    const currentLocation = getCurrentLocation();
    if (!currentLocation || !currentWeather) {
        alert("Please select a location and wait for weather data to load first.");
        return;
    }

    riskDescription.innerHTML = `<em>Querying ML Backend (Flood Prediction & Storm Path)...</em>`;
    disasterBtn.disabled = true;

    try {
        const riskData = await analyzeRiskWithML(currentLocation.lat, currentLocation.lng, currentWeather);
        
        drawStormTrajectory(riskData.storm_trajectory);
        
        riskDescription.innerHTML = `
            <strong>Flood Probability:</strong> ${riskData.flood_probability}% <br>
            <strong>Danger Index:</strong> ${riskData.overall_danger_index} <br>
            <strong style="color: ${riskData.recommendation === 'EVACUATE' ? 'red' : 'green'};">${riskData.recommendation}</strong><br>
            <strong>Safest Vector:</strong> ${riskData.safer_direction.toUpperCase()} <br>
            <em>Querying Overpass for shelters...</em>
        `;

        const places = await searchForPlaces(currentLocation, 10000); 
        
        if (places.length === 0) {
            riskDescription.innerHTML += `<br><span style="color:red;">No shelters found in 10km radius.</span>`;
            disasterBtn.disabled = false;
            return;
        }

        const bestPlace = findBestPlace(currentLocation, places, riskData.safer_direction);
        
        riskDescription.innerHTML += `<br><strong>Routed to:</strong> ${bestPlace.name}. Connecting to OSRM...`;
        await displaySafePlaceAndRoute(currentLocation, bestPlace, updateUiWithSafePlace);

    } catch (e) {
        console.error(e);
        riskDescription.textContent = "ML Analysis failed: " + e.message;
    } finally {
        disasterBtn.disabled = false;
    }
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            handleLocationUpdate(pos.coords.latitude, pos.coords.longitude, false);
        }, () => {
            alert("Geolocation failed or denied. Defaulting to Chennai.");
            handleLocationUpdate(13.0827, 80.2707, false);
        });
    } else {
        alert("Geolocation not supported. Defaulting to Chennai.");
        handleLocationUpdate(13.0827, 80.2707, false);
    }
}

async function bootstrap() {
    try {
        await initMapAPI();
        initializeMap(mapElement);

        useMyLocationBtn.addEventListener('click', getUserLocation);
        disasterBtn.addEventListener('click', findSafePlace);
        searchBtn.addEventListener('click', searchLocationByNominatim);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchLocationByNominatim();
        });

        onMapClick((lat, lng) => {
            handleLocationUpdate(lat, lng, true);
        });

        getUserLocation();
    } catch (e) {
        riskDescription.textContent = "Application Error: " + e.message;
        console.error(e);
    }
}

bootstrap();
