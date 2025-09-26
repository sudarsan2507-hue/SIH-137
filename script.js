// --- CONFIG ---
const OPENWEATHER_API_KEY = "17d0cf1057d1b4b9d23beca65ab31658";

// --- Globals ---
let map, userMarker, clickedMarker, safePlaceMarker;
let placesService, directionsService, directionsRenderer;

// Expose initMap for Google Maps callback
window.initMap = function () {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 20.5937, lng: 78.9629 },
    zoom: 5,
    mapTypeControl: false,
    streetViewControl: false,
  });

  placesService = new google.maps.places.PlacesService(map);
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  document.getElementById("disasterBtn").addEventListener("click", findSafePlace);
  document.getElementById("useMyLocationBtn").addEventListener("click", getUserLocation);

  map.addListener("click", (e) => {
    updateForLocation(e.latLng.lat(), e.latLng.lng(), true);
  });

  getUserLocation();
};

// --- User Location ---
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => updateForLocation(pos.coords.latitude, pos.coords.longitude, false),
      () => {
        alert("Geolocation failed. Defaulting to Chennai.");
        updateForLocation(13.0827, 80.2707, false);
      }
    );
  }
}

// --- Update Map for Location ---
async function updateForLocation(lat, lng, isClick) {
  const location = { lat, lng };
  map.setCenter(location);
  map.setZoom(12);

  if (isClick) {
    if (clickedMarker) clickedMarker.setMap(null);
    clickedMarker = new google.maps.Marker({ position: location, map, title: "Selected Location" });
  } else {
    if (userMarker) userMarker.setMap(null);
    userMarker = new google.maps.Marker({ position: location, map, title: "Your Location" });
  }

  if (safePlaceMarker) safePlaceMarker.setMap(null);
  directionsRenderer.setDirections({ routes: [] });
  document.getElementById("safePlaceResult").innerHTML = `Click "Find Safe Place" for a recommendation.`;

  try {
    const weather = await fetchWeather(lat, lng);
    updateWeatherDisplay(weather);
    document.getElementById("riskDescription").textContent =
      "Current weather loaded. Click 'Find Safe Place' for full analysis.";
  } catch (err) {
    document.getElementById("riskDescription").textContent = "Could not load weather data.";
  }
}

// --- Fetch Weather ---
function fetchWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  return fetch(url).then(r => {
    if (!r.ok) throw new Error("Weather fetch failed");
    return r.json();
  });
}

// --- Update UI ---
function updateWeatherDisplay(data) {
  const rainfall = data.rain?.["1h"] || 0;
  document.getElementById("temperature").textContent = data.main.temp.toFixed(1) + "°C";
  document.getElementById("humidity").textContent = data.main.humidity + "%";
  document.getElementById("pressure").textContent = data.main.pressure + " hPa";
  document.getElementById("rainfall").textContent = rainfall + " mm";
}

// --- Find Safe Place ---
async function findSafePlace() {
  let currentLocation = clickedMarker?.getPosition()?.toJSON() || userMarker?.getPosition()?.toJSON();
  if (!currentLocation) {
    alert("Please select a location first.");
    return;
  }

  document.getElementById("riskDescription").textContent = "Analyzing surrounding weather...";

  const saferDirection = await analyzeSurroundingWeather(currentLocation.lat, currentLocation.lng);
  document.getElementById("riskDescription").textContent = `Safest weather vector: ${saferDirection.name}. Searching shelters...`;

  const places = await searchForPlaces(currentLocation, 10000);
  if (!places.length) {
    document.getElementById("riskDescription").textContent = "No shelters found nearby.";
    return;
  }

  const bestPlace = findBestPlace(currentLocation, places, saferDirection);
  displaySafePlaceAndRoute(currentLocation, bestPlace);
}

// --- Analyze Weather Around ---
async function analyzeSurroundingWeather(lat, lng) {
  const offset = 0.09; // ~10km
  const points = {
    north: { lat: lat + offset, lng },
    south: { lat: lat - offset, lng },
    east: { lat, lng: lng + offset },
    west: { lat, lng: lng - offset },
  };

  const results = await Promise.all(
    Object.entries(points).map(async ([name, coords]) => {
      const weather = await fetchWeather(coords.lat, coords.lng);
      const rain = weather.rain?.["1h"] || 0;
      const wind = weather.wind.speed;
      return { name, score: rain + wind };
    })
  );

  results.sort((a, b) => a.score - b.score);
  return results[0];
}

// --- Search Places ---
function searchForPlaces(location, radius) {
  return new Promise((resolve, reject) => {
    placesService.nearbySearch({ location, radius, type: ["hospital", "police"] }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) resolve(results);
      else resolve([]);
    });
  });
}

// --- Find Best Place ---
function findBestPlace(origin, places, saferDirection) {
  let bestPlace = null;
  let minAngle = Infinity;
  const targetAngle = { north: 0, east: 90, south: 180, west: 270 }[saferDirection.name];
  const originLatLng = new google.maps.LatLng(origin.lat, origin.lng);

  places.forEach(place => {
    const placeLoc = place.geometry.location;
    const bearing = google.maps.geometry.spherical.computeHeading(originLatLng, placeLoc);
    const angle = bearing < 0 ? 360 + bearing : bearing;
    const angleDiff = Math.min(Math.abs(angle - targetAngle), 360 - Math.abs(angle - targetAngle));
    if (angleDiff < minAngle) { minAngle = angleDiff; bestPlace = place; }
  });

  return bestPlace || places[0];
}

// --- Display Safe Place ---
function displaySafePlaceAndRoute(origin, place) {
  if (safePlaceMarker) safePlaceMarker.setMap(null);

  const placeLoc = place.geometry.location;
  safePlaceMarker = new google.maps.Marker({
    position: placeLoc,
    map,
    title: place.name,
    icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
  });

  directionsService.route(
    { origin, destination: placeLoc, travelMode: "DRIVING" },
    (result, status) => {
      if (status === "OK") directionsRenderer.setDirections(result);
    }
  );

  const resultPanel = document.getElementById("safePlaceResult");
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${placeLoc.lat()},${placeLoc.lng()}`;

  resultPanel.innerHTML = `
    <h5>${place.name}</h5>
    <p>${place.vicinity || "No address"}</p>
    <a href="${url}" target="_blank" class="directions-link">Open in Google Maps</a>
  `;

  document.getElementById("riskDescription").textContent = "Safe route displayed.";
}
