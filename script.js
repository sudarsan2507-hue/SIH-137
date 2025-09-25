// Global variables
let map;
let userMarker;
let clickedLocationMarker; // To keep track of the last clicked marker
let currentStep = 1;
const totalSteps = 5;
let weatherData = {};
const isFirstVisit = !localStorage.getItem('tutorialCompleted');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    if (isFirstVisit) {
        showTutorial();
    }
    getCurrentLocation();
    fetchWeatherData();
    setupRealTimeUpdates();
});

// Initialize Leaflet map
function initMap() {
    // Define India's geographical boundaries
    const indiaBounds = L.latLngBounds(
        L.latLng(6.0, 68.0), // Southwest corner
        L.latLng(38.0, 98.0)  // Northeast corner
    );

    map = L.map('map', {
        center: [20.5937, 78.9629],
        zoom: 5,
        minZoom: 5, // Prevent zooming out too far
        maxBounds: indiaBounds,
        maxBoundsViscosity: 1.0 // Makes the bounds fully solid
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add click event listener
    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        getLocationWeather(lat, lng);
        addLocationMarker(lat, lng);
    });

    // Add sample risk zones
    addRiskZones();
}

// Add risk zones to map
function addRiskZones() {
    // High risk zone (example: cyclone prone area)
    L.circle([22.5726, 88.3639], {
        color: 'red',
        fillColor: '#ff0000',
        fillOpacity: 0.2,
        radius: 100000
    }).addTo(map).bindPopup('High Risk Zone: Cyclone Alert');

    // Medium risk zone (example: flood prone)
    L.circle([26.9124, 75.7873], {
        color: 'orange',
        fillColor: '#ffa500',
        fillOpacity: 0.2,
        radius: 80000
    }).addTo(map).bindPopup('Medium Risk Zone: Flood Watch');

    // Low risk zone
    L.circle([15.2993, 74.1240], {
        color: 'yellow',
        fillColor: '#ffff00',
        fillOpacity: 0.2,
        radius: 60000
    }).addTo(map).bindPopup('Low Risk Zone: Normal Conditions');
}

// Get current location
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                map.setView([lat, lng], 10);
                addUserMarker(lat, lng);
                getLocationWeather(lat, lng);
                findNearbyServices(lat, lng);
            },
            function(error) {
                console.log('Geolocation error:', error);
                // Default to Delhi if location access denied
                const lat = 28.6139;
                const lng = 77.2090;
                map.setView([lat, lng], 10);
                getLocationWeather(lat, lng);
            }
        );
    }
}

// Add user location marker
function addUserMarker(lat, lng) {
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: '<i class="fas fa-user" style="color: #3742fa; font-size: 20px;"></i>',
            className: 'user-marker',
            iconSize: [30, 30]
        })
    }).addTo(map).bindPopup('Your Location');
}

// Add location marker
function addLocationMarker(lat, lng) {
    // If a marker from a previous click exists, remove it
    if (clickedLocationMarker) {
        map.removeLayer(clickedLocationMarker);
    }

    // Add the new marker and store it
    clickedLocationMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: '<i class="fas fa-map-marker-alt" style="color: #ff4757; font-size: 20px;"></i>',
            className: 'location-marker',
            iconSize: [30, 30]
        })
    }).addTo(map);
}

// Fetch weather data (simulated)
function getLocationWeather(lat, lng) {
    // Simulate API call with random data
    const weatherInfo = {
        temperature: Math.round(Math.random() * 15 + 20),
        humidity: Math.round(Math.random() * 40 + 40),
        pressure: Math.round(Math.random() * 50 + 1000),
        rainfall: Math.round(Math.random() * 20),
        riskLevel: ['LOW', 'MODERATE', 'HIGH', 'EXTREME'][Math.floor(Math.random() * 4)]
    };

    updateWeatherDisplay(weatherInfo);
    updateRiskLevel(weatherInfo.riskLevel);
}

// Update weather display
function updateWeatherDisplay(data) {
    document.getElementById('temperature').textContent = data.temperature + '°C';
    document.getElementById('humidity').textContent = data.humidity + '%';
    document.getElementById('pressure').textContent = data.pressure + ' hPa';
    document.getElementById('rainfall').textContent = data.rainfall + ' mm';
}

// Update risk level
function updateRiskLevel(level) {
    const riskElement = document.getElementById('riskLevel');
    const descElement = document.getElementById('riskDescription');
    
    riskElement.textContent = level;
    
    const riskIndicator = document.querySelector('.risk-indicator');
    
    switch(level) {
        case 'LOW':
            riskIndicator.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
            descElement.textContent = 'Normal conditions expected';
            break;
        case 'MODERATE':
            riskIndicator.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
            descElement.textContent = 'Monitor weather conditions';
            break;
        case 'HIGH':
            riskIndicator.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            descElement.textContent = 'Prepare for severe weather';
            break;
        case 'EXTREME':
            riskIndicator.style.background = 'linear-gradient(135deg, #d32f2f, #b71c1c)';
            descElement.textContent = 'Immediate action required';
            triggerAlert();
            break;
    }
}

// Find nearby emergency services (simulated)
function findNearbyServices(lat, lng) {
    const services = [
        { name: 'City Hospital', distance: '2.3 km', phone: '108' },
        { name: 'Fire Station', distance: '1.8 km', phone: '101' },
        { name: 'Police Station', distance: '3.1 km', phone: '100' },
        { name: 'Emergency Shelter', distance: '4.2 km', phone: '1070' }
    ];

    let servicesHTML = '';
    services.forEach(service => {
        servicesHTML += `
            <div style="background: #f8f9fa; padding: 0.8rem; border-radius: 6px; margin-bottom: 0.5rem;">
                <div style="font-weight: 600; color: #2c3e50;">${service.name}</div>
                <div style="font-size: 0.9rem; color: #666;">${service.distance} • 📞 ${service.phone}</div>
            </div>
        `;
    });

    document.getElementById('emergencyServices').innerHTML = servicesHTML;
}

// Trigger SOS
function triggerSOS() {
    if (confirm('This will send an emergency alert with your location to nearby hospitals. Continue?')) {
        // Simulate SOS call
        playAlertSound();
        vibrateDevice();
        
        // Show success message
        alert('🚨 SOS ACTIVATED\n\nYour location has been sent to:\n• Emergency Services\n• Nearest Hospital\n• Local Authorities\n\nHelp is on the way!');
        
        // Add SOS marker to map
        if (userMarker) {
            const lat = userMarker.getLatLng().lat;
            const lng = userMarker.getLatLng().lng;
            
            L.marker([lat, lng], {
                icon: L.divIcon({
                    html: '<i class="fas fa-exclamation-circle" style="color: #ff0000; font-size: 24px; animation: pulse 1s infinite;"></i>',
                    className: 'sos-marker',
                    iconSize: [40, 40]
                })
            }).addTo(map).bindPopup('🚨 SOS ACTIVATED - Emergency Response En Route');
        }
    }
}

// Play alert sound
function playAlertSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    function playBeep(frequency, duration) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            playBeep(800, 0.5);
            setTimeout(() => playBeep(600, 0.5), 600);
        }, i * 2000);
    }
}

// Vibrate device
function vibrateDevice() {
    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500]);
    }
}

// Trigger alert system
function triggerAlert() {
    playAlertSound();
    vibrateDevice();
    
    const alertsContainer = document.getElementById('alertsContainer');
    const newAlert = document.createElement('div');
    newAlert.className = 'alert-item';
    newAlert.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
    newAlert.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <div>
            <strong>CRITICAL ALERT:</strong> Extreme weather conditions detected. Take immediate shelter and follow evacuation procedures.
        </div>
    `;
    alertsContainer.insertBefore(newAlert, alertsContainer.firstChild);
}

// Fetch weather data (simulated API calls)
function fetchWeatherData() {
    console.log('Fetching data from multiple sources...');
    
    setInterval(() => {
        if (userMarker) {
            const lat = userMarker.getLatLng().lat;
            const lng = userMarker.getLatLng().lng;
            getLocationWeather(lat, lng);
        }
    }, 30000); // Update every 30 seconds
}

// Setup real-time updates
function setupRealTimeUpdates() {
    console.log('Setting up real-time WebSocket connection...');
    
    setTimeout(() => {
        addNewAlert('Weather Update', 'Monsoon activity increasing in northern regions');
    }, 10000);
}

// Add new alert
function addNewAlert(title, message) {
    const alertsContainer = document.getElementById('alertsContainer');
    const newAlert = document.createElement('div');
    newAlert.className = 'alert-item';
    newAlert.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <div>
            <strong>${title}:</strong> ${message}
        </div>
    `;
    alertsContainer.appendChild(newAlert);
}

// --- Tutorial Functions ---
function showTutorial() {
    document.getElementById('tutorialOverlay').style.display = 'flex';
}

function skipTutorial() {
    document.getElementById('tutorialOverlay').style.display = 'none';
    localStorage.setItem('tutorialCompleted', 'true');
}

function nextStep() {
    if (currentStep < totalSteps) {
        document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
        currentStep++;
        document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
        
        document.getElementById('prevBtn').style.display = 'inline-block';
        
        if (currentStep === totalSteps) {
            document.getElementById('nextBtn').textContent = 'Finish';
        }
    } else {
        skipTutorial();
    }
}

function previousStep() {
    if (currentStep > 1) {
        document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
        currentStep--;
        document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

        document.getElementById('nextBtn').textContent = 'Next';

        if (currentStep === 1) {
            document.getElementById('prevBtn').style.display = 'none';
        }
    }
}