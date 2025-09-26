const OPENWEATHER_API_KEY = "17d0cf1057d1b4b9d23beca65ab31658";

let map, userMarker, clickedMarker, safePlaceMarker;
let placesService, directionsService, directionsRenderer;
const defaultLocation = { lat: 20.5937, lng: 78.9629 }; 

window.initMap = function () {
  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLocation,
    zoom: 5,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  placesService = new google.maps.places.PlacesService(map);
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
  });
  directionsRenderer.setMap(map);

  document.getElementById("disasterBtn").addEventListener("click", findSafePlace);
  document.getElementById("useMyLocationBtn").addEventListener("click", getUserLocation);
  map.addListener("click", (e) => {
    updateForLocation(e.latLng.lat(), e.latLng.lng(), true);
  });

  getUserLocation();
};

function getUserLocation() {
  updateRiskDescription("Getting your location...");
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => updateForLocation(pos.coords.latitude, pos.coords.longitude, false),
      () => {
        updateRiskDescription("Geolocation failed. Please click on the map to select a location.");
        map.setCenter(defaultLocation);
        map.setZoom(5);
      }
    );
  } else {
    updateRiskDescription("Geolocation is not supported by your browser.");
  }
}

async function updateForLocation(lat, lng, isClick) {
  const location = { lat, lng };
  map.setCenter(location);
  map.setZoom(12);
  clearMarkersAndRoute();
  
  const markerOptions = {
      position: location,
      map,
  };

  if (isClick) {
    clickedMarker = new google.maps.marker.AdvancedMarkerElement({ ...markerOptions, title: "Selected Location" });
  } else {
    userMarker = new google.maps.marker.AdvancedMarkerElement({ ...markerOptions, title: "Your Location" });
  }

  try {
    updateRiskDescription("Fetching weather data...");
    const weather = await fetchWeather(lat, lng);
    updateWeatherDisplay(weather);
    updateRiskDescription("Weather loaded. Click 'Find Safe Place' for a full analysis.");
  } catch (err) {
    console.error("Weather fetch error:", err);
    updateRiskDescription("Could not load weather data for the selected location.");
  }
}

function fetchWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  return fetch(url).then(response => {
    if (!response.ok) {
      throw new Error(`Weather API request failed with status ${response.status}`);
    }
    return response.json();
  });
}

async function analyzeSurroundingWeather(lat, lng) {
  const offset = 0.09;
  const points = {
    north: { lat: lat + offset, lng },
    south: { lat: lat - offset, lng },
    east: { lat, lng: lng + offset },
    west: { lat, lng: lng - offset },
  };

  const weatherPromises = Object.entries(points).map(async ([name, coords]) => {
    try {
      const weather = await fetchWeather(coords.lat, coords.lng);
      const rain = weather.rain?.["1h"] || 0;
      const wind = weather.wind.speed || 0;
      return { name, score: (rain * 0.5) + (wind * 1.5) };
    } catch (error) {
      console.warn(`Could not fetch weather for ${name}:`, error);
      return { name, score: Infinity }; 
    }
  });

  const results = await Promise.all(weatherPromises);
  results.sort((a, b) => a.score - b.score);
  return results[0]; 
}

async function findSafePlace() {
  const currentLocation = clickedMarker?.position || userMarker?.position;
  if (!currentLocation) {
    updateRiskDescription("Please select a location on the map first.");
    return;
  }
  
  clearMarkersAndRoute(true);
  updateRiskDescription("Analyzing surrounding weather patterns...");

  const saferDirection = await analyzeSurroundingWeather(currentLocation.lat, currentLocation.lng);
  updateRiskDescription(`Safest weather vector is to the ${saferDirection.name}. Searching for shelters...`);

  const places = await searchForPlaces(currentLocation, 10000);
  if (!places || places.length === 0) {
    updateRiskDescription("No suitable shelters (hospitals, police stations) found within a 10km radius.");
    return;
  }

  const bestPlace = findBestPlace(currentLocation, places, saferDirection);
  displaySafePlaceAndRoute(currentLocation, bestPlace);
}

function searchForPlaces(location, radius) {
  return new Promise((resolve) => {
    const request = { location, radius, type: ["hospital", "police_station", "school"] };
    placesService.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK || status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve(results);
      } else {
        console.error("Places search failed with status:", status);
        resolve([]);
      }
    });
  });
}

function findBestPlace(origin, places, saferDirection) {
  let bestPlace = null;
  let minAngleDiff = Infinity;
  const targetAngle = { north: 0, east: 90, south: 180, west: 270 }[saferDirection.name];
  const originLatLng = new google.maps.LatLng(origin.lat, origin.lng);

  places.forEach(place => {
    const placeLoc = place.geometry.location;
    const bearing = google.maps.geometry.spherical.computeHeading(originLatLng, placeLoc);
    const angle = (bearing < 0) ? 360 + bearing : bearing;
    const diff = Math.abs(angle - targetAngle);
    const angleDiff = Math.min(diff, 360 - diff);

    if (angleDiff < minAngleDiff) {
      minAngleDiff = angleDiff;
      bestPlace = place;
    }
  });

  return bestPlace || places[0];
}

function updateWeatherDisplay(data) {
  const rainfall = data.rain?.["1h"] || 0;
  document.getElementById("temperature").textContent = `${data.main.temp.toFixed(1)}°C`;
  document.getElementById("humidity").textContent = `${data.main.humidity}%`;
  document.getElementById("wind").textContent = `${data.main.speed.toFixed(1)} m/s`;
  document.getElementById("rainfall").textContent = `${rainfall} mm`;
}

function displaySafePlaceAndRoute(origin, place) {
  const placeLoc = place.geometry.location;
  
  safePlaceMarker = new google.maps.marker.AdvancedMarkerElement({
    position: placeLoc,
    map,
    title: place.name,
  });

  directionsService.route(
    { origin, destination: placeLoc, travelMode: google.maps.TravelMode.DRIVING },
    (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);
        updateRiskDescription("Safe route to shelter has been displayed.");
      } else {
        console.error("Directions request failed due to " + status);
        updateRiskDescription(`Could not display route. Reason: ${status}`);
      }
    }
  );

  const resultPanel = document.getElementById("safePlaceResult");
  const destination = `${placeLoc.lat()},${placeLoc.lng()}`;
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination}`;

  resultPanel.innerHTML = `
    <h5>${place.name}</h5>
    <p>${place.vicinity || "Address not available"}</p>
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="directions-link">Open in Google Maps</a>
  `;
}

function updateRiskDescription(message) {
  document.getElementById("riskDescription").textContent = message;
}

function clearMarkersAndRoute(keepOriginMarker = false) {
  if (safePlaceMarker) safePlaceMarker.map = null;
  directionsRenderer.setDirections({ routes: [] });

  if (!keepOriginMarker) {
    if (userMarker) userMarker.map = null;
    if (clickedMarker) clickedMarker.map = null;
  }

  document.getElementById("safePlaceResult").innerHTML = 'Click "Find Safe Place" for a recommendation.';
}
