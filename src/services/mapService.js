import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix typical Leaflet missing marker icons issue internally
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

let map;
let userMarker;
let clickedMarker;
let safePlaceMarker;
let routeLine;
let stormLine;

export async function initMapAPI() {
    // Leaflet and OSM require no API keys or async loaders!
    return true;
}

export function initializeMap(mapElement) {
    // Initialize Leaflet Map
    map = L.map(mapElement, { zoomControl: false }).setView([20.5937, 78.9629], 5);
    
    // Use OpenStreetMap Tiles completely FREE
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    return map;
}

export function updateMarkers(lat, lng, isClick) {
    const location = { lat, lng };
    map.setView([lat, lng], 13, { animate: true }); // Smooth zoom

    if (isClick) {
        if (clickedMarker) map.removeLayer(clickedMarker);
        clickedMarker = L.marker([lat, lng], { title: "Selected Location" }).addTo(map);
        // Add a popup to show the searched/clicked location prominently
        clickedMarker.bindPopup("Target Location").openPopup();
    } else {
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([lat, lng], { title: "Your Location" }).addTo(map);
        userMarker.bindPopup("Your Location").openPopup();
    }

    if (safePlaceMarker) map.removeLayer(safePlaceMarker);
    if (routeLine) map.removeLayer(routeLine);
    if (stormLine) map.removeLayer(stormLine);
    return location;
}

export function getCurrentLocation() {
    if (clickedMarker) {
        return { lat: clickedMarker.getLatLng().lat, lng: clickedMarker.getLatLng().lng };
    } else if (userMarker) {
        return { lat: userMarker.getLatLng().lat, lng: userMarker.getLatLng().lng };
    }
    return null;
}

export async function searchForPlaces(location, radius) {
    // Overpass API for FREE nearby places (hospitals, police)
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
          node["amenity"="police"](around:${radius},${location.lat},${location.lng});
        );
        out body;
    `;
    
    try {
        const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (!data.elements || data.elements.length === 0) {
            return []; // No places found
        }
        
        // Map Overpass syntax to match our internal expectation
        return data.elements.map(el => ({
            name: el.tags.name || el.tags.amenity || 'Safe Place',
            vicinity: el.tags['addr:street'] || 'Nearby',
            geometry: {
                location: { lat: el.lat, lng: el.lon }
            }
        }));
    } catch (e) {
        console.error("Overpass query failed:", e);
        throw new Error("Places API failed: Overpass connection issue.");
    }
}

function computeBearing(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function findBestPlace(origin, places, saferDirectionName) {
    let bestPlace = null;
    let minAngle = Infinity;
    const targetAngle = { north: 0, east: 90, south: 180, west: 270 }[saferDirectionName];
    
    places.forEach(place => {
        const placeLoc = place.geometry.location;
        const bearing = computeBearing(origin.lat, origin.lng, placeLoc.lat, placeLoc.lng);
        const angleDifference = Math.min(Math.abs(bearing - targetAngle), 360 - Math.abs(bearing - targetAngle));
        if (angleDifference < minAngle) {
            minAngle = angleDifference;
            bestPlace = place;
        }
    });
    return bestPlace || places[0]; 
}

export async function displaySafePlaceAndRoute(origin, place, updateUiCallback) {
    if (safePlaceMarker) map.removeLayer(safePlaceMarker);
    if (routeLine) map.removeLayer(routeLine);

    const placeLoc = place.geometry.location;
    
    // Leaflet marker for the safe location
    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    
    safePlaceMarker = L.marker([placeLoc.lat, placeLoc.lng], { icon: greenIcon })
        .addTo(map)
        .bindPopup(`<b>${place.name}</b>`)
        .openPopup();

    // Use OSRM for FREE Routing API
    try {
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${placeLoc.lng},${placeLoc.lat}?overview=full&geometries=geojson`;
        const res = await fetch(routeUrl);
        const routeData = await res.json();
        
        if (routeData.code === 'Ok') {
            const geojsonRoute = routeData.routes[0].geometry;
            routeLine = L.geoJSON(geojsonRoute, {
                style: { color: '#4361ee', weight: 5, opacity: 0.8 }
            }).addTo(map);
            
            // Adjust bounds to fit route
            map.fitBounds(routeLine.getBounds());
        }
    } catch(e) {
        console.warn("Could not fetch route from OSRM, drawing direct line instead", e);
        // Fallback boundary fitting covering origin to destination
        map.fitBounds([
             [origin.lat, origin.lng],
             [placeLoc.lat, placeLoc.lng]
        ]);
        routeLine = L.polyline([[origin.lat, origin.lng], [placeLoc.lat, placeLoc.lng]], {color: 'red'}).addTo(map);
    }

    // Link to OpenStreetMap directions
    const directionsUrl = `https://www.openstreetmap.org/directions?engine=osrm_car&route=${origin.lat}%2C${origin.lng}%3B${placeLoc.lat}%2C${placeLoc.lng}`;
    updateUiCallback(place, directionsUrl);
}

export function drawStormTrajectory(trajectoryPoints) {
    if (!map || !trajectoryPoints || trajectoryPoints.length === 0) return;
    if (stormLine) map.removeLayer(stormLine);

    const latlngs = trajectoryPoints.map(p => [p.predicted_lat, p.predicted_lon]);
    
    stormLine = L.polyline(latlngs, {
        color: 'red', 
        dashArray: '10, 10', 
        weight: 3, 
        opacity: 0.8
    }).addTo(map);
    
    // Add warning popup to the final predicted point
    const endpoint = trajectoryPoints[trajectoryPoints.length - 1];
    L.circleMarker([endpoint.predicted_lat, endpoint.predicted_lon], {color: 'red', radius: 6})
     .addTo(map)
     .bindPopup("Predicted Storm Center in 3 Hours");
}

// Emulate Google Maps callback for main.js by passing an object with lat/lng
export function onMapClick(callback) {
    map.on('click', (e) => {
        // e.latlng contains .lat and .lng
        callback(e.latlng.lat, e.latlng.lng);
    });
}
