// --- CONFIGURATION ---
const OPENWEATHER_API_KEY = "17d0cf1057d1b4b9d23beca65ab31658";

// --- Global variables for Google Maps ---
let map;
let userMarker;
let safePlaceMarker;
let placesService;

async function initMap() {
    const mapOptions = {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
    };
    map = new google.maps.Map(document.getElementById("map"), mapOptions);
    placesService = new google.maps.places.PlacesService(map);

    // Event listener for the new disaster button
    document.getElementById('disasterBtn').addEventListener('click', findSafePlace);

    // Get user's current location on load
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (userMarker) userMarker.setMap(null);
            userMarker = new google.maps.Marker({ position: userLocation, map: map, title: "Your Location" });
            map.setCenter(userLocation);
            map.setZoom(12);
            // Fetch initial weather for user's location
            fetchWeather(userLocation.lat, userLocation.lng).then(updateWeatherDisplay);
        });
    }
}

// --- CORE DISASTER SIMULATION LOGIC ---

async function findSafePlace() {
    if (!userMarker) {
        alert("Could not determine your current location.");
        return;
    }
    const userLocation = userMarker.getPosition().toJSON();
    
    document.getElementById('riskDescription').textContent = "Analyzing surrounding weather...";

    // 1. Analyze weather in a 10km radius to find the safest direction
    const saferDirection = await analyzeSurroundingWeather(userLocation.lat, userLocation.lng);
    document.getElementById('riskDescription').textContent = `Safest weather vector found to the ${saferDirection.name}. Searching for shelters...`;
    
    // 2. Search for official places (hospitals, police stations)
    const places = await searchForPlaces(userLocation, 10000); // 10km radius
    if (places.length === 0) {
        document.getElementById('riskDescription').textContent = "Could not find any nearby shelters.";
        return;
    }
    
    // 3. Triangulate: find the best place in the safest direction
    const bestPlace = findBestPlace(userLocation, places, saferDirection);
    
    // 4. Display the result
    displaySafePlace(userLocation, bestPlace);
}

// Analyzes N, S, E, W points to find the best weather direction
async function analyzeSurroundingWeather(lat, lng) {
    const offset = 0.09; // Approx 10km in degrees
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
        return { name, score: rain + wind, weather }; // Lower score is better
    });
    
    const results = await Promise.all(promises);
    results.sort((a, b) => a.score - b.score); // Sort by best score
    
    return results[0]; // Return the direction with the best weather
}

// Uses Google Places API to find hospitals and police stations
function searchForPlaces(location, radius) {
    return new Promise((resolve, reject) => {
        const request = {
            location: location,
            radius: radius,
            types: ['hospital', 'police']
        };
        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                resolve(results);
            } else {
                reject(new Error("Places API search failed: " + status));
            }
        });
    });
}

// Finds the place that is closest to the safest weather direction
function findBestPlace(origin, places, saferDirection) {
    let bestPlace = null;
    let minAngle = Infinity;

    // Calculate the angle for the safest direction (North is 0, East is 90, etc.)
    const targetAngle = { north: 0, east: 90, south: 180, west: 270 }[saferDirection.name];

    places.forEach(place => {
        const placeLoc = place.geometry.location;
        const bearing = google.maps.geometry.spherical.computeHeading(origin, placeLoc);
        const angle = (bearing < 0) ? 360 + bearing : bearing; // Normalize to 0-360

        // Find the place with the angle closest to our target direction
        const angleDifference = Math.abs(angle - targetAngle);
        if (angleDifference < minAngle) {
            minAngle = angleDifference;
            bestPlace = place;
        }
    });
    return bestPlace;
}


// --- UTILITY AND UI FUNCTIONS ---

function fetchWeather(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    return fetch(url).then(res => res.json());
}

function displaySafePlace(origin, place) {
    if (safePlaceMarker) safePlaceMarker.setMap(null);
    
    const placeLoc = place.geometry.location;
    safePlaceMarker = new google.maps.Marker({
        position: placeLoc,
        map: map,
        title: place.name,
        icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        }
    });

    map.fitBounds(new google.maps.LatLngBounds(origin, placeLoc));

    const resultPanel = document.getElementById('safePlaceResult');
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${placeLoc.lat()},${placeLoc.lng()}`;
    
    resultPanel.innerHTML = `
        <h5>${place.name}</h5>
        <p>${place.vicinity}</p>
        <a href="${directionsUrl}" target="_blank" class="directions-link">Get Directions</a>
    `;
    document.getElementById('riskDescription').textContent = "Recommended safe place has been marked on the map.";
}

function updateWeatherDisplay(data) {
    if (!data.main) return;
    const rainfall = data.rain && data.rain['1h'] ? data.rain['1h'] : 0;
    document.getElementById('temperature').textContent = data.main.temp.toFixed(1) + '°C';
    document.getElementById('humidity').textContent = data.main.humidity + '%';
    document.getElementById('pressure').textContent = data.main.pressure + ' hPa';
    document.getElementById('rainfall').textContent = rainfall + ' mm';
}
