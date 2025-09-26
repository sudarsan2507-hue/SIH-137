// --- CONFIGURATION ---
const OPENWEATHER_API_KEY = "17d0cf1057d1b4b9d23beca65ab31658";
// --- Global variables ---
let map;
let userMarker, clickedMarker, safePlaceMarker;
let placesService;
let directionsService;
let directionsRenderer;

// initMap is called by the Google Maps script in the HTML when it's ready
async function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
    });
    placesService = new google.maps.places.PlacesService(map);
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map); // Tell the renderer which map to draw on

    // --- EVENT LISTENERS ---
    document.getElementById('disasterBtn').addEventListener('click', findSafePlace);
    document.getElementById('useMyLocationBtn').addEventListener('click', getUserLocation);
    map.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        updateForLocation(lat, lng, true); // true = this was a manual click
    });

    getUserLocation(); // Get user's location on initial load
}

// --- CORE FUNCTIONS ---

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            updateForLocation(pos.coords.latitude, pos.coords.longitude, false); // false = not a manual click
        }, () => {
            alert("Geolocation failed. Defaulting to Chennai.");
            updateForLocation(13.0827, 80.2707, false);
        });
    }
}

async function updateForLocation(lat, lng, isClick) {
    const location = { lat, lng };
    map.setCenter(location);
    map.setZoom(12);

    if (isClick) {
        if (clickedMarker) clickedMarker.setMap(null);
        clickedMarker = new google.maps.Marker({ position: location, map: map, title: "Selected Location" });
    } else {
        if (userMarker) userMarker.setMap(null);
        userMarker = new google.maps.Marker({ position: location, map: map, title: "Your Location" });
    }
    
    // Clear previous results when a new location is selected
    if (safePlaceMarker) safePlaceMarker.setMap(null);
    directionsRenderer.setDirections({ routes: [] }); // Clears the route
    document.getElementById('safePlaceResult').innerHTML = Click "Find Safe Place" for a recommendation.;


    try {
        const weather = await fetchWeather(lat, lng);
        updateWeatherDisplay(weather);
        document.getElementById('riskDescription').textContent = "Current weather loaded. Click 'Find Safe Place' for full analysis.";
    } catch (error) {
        console.error("Failed to fetch weather:", error);
        document.getElementById('riskDescription').textContent = "Could not load weather data for this location.";
    }
}

async function findSafePlace() {
    let currentLocation;
    if (clickedMarker && clickedMarker.getMap()) {
        currentLocation = clickedMarker.getPosition().toJSON();
    } else if (userMarker && userMarker.getMap()) {
        currentLocation = userMarker.getPosition().toJSON();
    } else {
        alert("Please select a location first by clicking the map or 'Use My Location'.");
        return;
    }
    
    document.getElementById('riskDescription').textContent = "Analyzing surrounding weather...";

    const saferDirection = await analyzeSurroundingWeather(currentLocation.lat, currentLocation.lng);
    document.getElementById('riskDescription').textContent = Safest weather vector is to the ${saferDirection.name}. Searching for shelters...;
    
    const places = await searchForPlaces(currentLocation, 10000); // 10km radius
    if (places.length === 0) {
        document.getElementById('riskDescription').textContent = "Could not find any nearby shelters.";
        return;
    }
    
    const bestPlace = findBestPlace(currentLocation, places, saferDirection);
    displaySafePlaceAndRoute(currentLocation, bestPlace);
}

// --- HELPER AND API FUNCTIONS ---

async function analyzeSurroundingWeather(lat, lng) {
    const offset = 0.09; // Approx 10km
    const points = {
        north: { lat: lat + offset, lng: lng },
        south: { lat: lat - offset, lng: lng },
        east: { lat: lat, lng: lng + offset },
        west: { lat: lat, lng: lng - offset }
    };
    const promises = Object.entries(points).map(async ([name, coords]) => {
        const weather = await fetchWeather(coords.lat, coords.lng);
        const rain = weather.rain ? weather.rain['1h'] : 0;
        const wind = weather.wind.speed;
        return { name, score: rain + wind }; // Lower score is better
    });
    const results = await Promise.all(promises);
    results.sort((a, b) => a.score - b.score);
    return results[0];
}

function searchForPlaces(location, radius) {
    return new Promise((resolve, reject) => {
        placesService.nearbySearch({ location, radius, types: ['hospital', 'police'] }, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                resolve(results);
            } else {
                reject(new Error("Places API failed: " + status));
            }
        });
    });
}

function findBestPlace(origin, places, saferDirection) {
    let bestPlace = null;
    let minAngle = Infinity;
    const targetAngle = { north: 0, east: 90, south: 180, west: 270 }[saferDirection.name];
    const originLatLng = new google.maps.LatLng(origin.lat, origin.lng);
    places.forEach(place => {
        const placeLoc = place.geometry.location;
        const bearing = google.maps.geometry.spherical.computeHeading(originLatLng, placeLoc);
        const angle = (bearing < 0) ? 360 + bearing : bearing;
        const angleDifference = Math.min(Math.abs(angle - targetAngle), 360 - Math.abs(angle - targetAngle));
        if (angleDifference < minAngle) {
            minAngle = angleDifference;
            bestPlace = place;
        }
    });
    return bestPlace || places[0]; // Fallback to the first result if no good match is found
}

function fetchWeather(lat, lon) {
    const url = https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric;
    return fetch(url).then(res => {
        if (!res.ok) throw new Error(Weather fetch failed: ${res.status});
        return res.json();
    });
}

// --- UI AND MAP DISPLAY FUNCTIONS ---

function displaySafePlaceAndRoute(origin, place) {
    if (safePlaceMarker) safePlaceMarker.setMap(null);
    
    const placeLoc = place.geometry.location;
    safePlaceMarker = new google.maps.Marker({
        position: placeLoc,
        map: map,
        title: place.name,
        icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
    });
    
    const request = {
        origin: origin,
        destination: placeLoc,
        travelMode: 'DRIVING'
    };

    directionsService.route(request, (result, status) => {
        if (status == 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            console.error("Directions request failed due to " + status);
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(origin);
            bounds.extend(placeLoc);
            map.fitBounds(bounds);
        }
    });

    const resultPanel = document.getElementById('safePlaceResult');
    const directionsUrl = https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${placeLoc.lat()},${placeLoc.lng()};
    
    resultPanel.innerHTML = `
        <h5>${place.name}</h5>
        <p>${place.vicinity}</p>
        <a href="${directionsUrl}" target="_blank" class="directions-link">Open in Google Maps</a>
    `;
    document.getElementById('riskDescription').textContent = "Route to recommended safe place is now on the map.";
}

function updateWeatherDisplay(data) {
    if (!data.main) return;
    const rainfall = data.rain && data.rain['1h'] ? data.rain['1h'] : 0;
    document.getElementById('temperature').textContent = data.main.temp.toFixed(1) + '°C';
    document.getElementById('humidity').textContent = data.main.humidity + '%';
    document.getElementById('pressure').textContent = data.main.pressure + ' hPa';
    document.getElementById('rainfall').textContent = rainfall + ' mm';
}
