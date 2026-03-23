# WeatherGuard - Safety Dashboard

A modern, responsive weather and safety dashboard that helps users navigate to safer locations during extreme weather conditions. The project has been modernized to use Vite and ES modules for a scalable and secure architecture.

## Features

- **Real-time Weather**: Displays temperature, humidity, pressure, and rainfall data.
- **Risk Analysis**: Analyzes surrounding weather vectors to independently determine the safest directions.
- **Safe Place Finder**: Locates nearby hospitals and police stations in the safest direction. Supports handling "No shelters found" gracefully.
- **Interactive Map**: Google Maps integration for dynamic location selection and route-drawing.
- **Premium UI**: Glassmorphism design with an interactive layout.
- **Modern Architecture**: `.env` injection, Modular Services (`weatherService.js`, `mapService.js`), and centralized Error Handling.

## Setup Instructions

### 1. Install Dependencies
Make sure you have Node.js installed on your machine.
In the project root folder (where `package.json` is located), open your terminal and run:
```bash
npm install
```

### 2. Environment Setup
The project uses a `.env` file to handle API Keys securely. 
1. Copy the provided `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and replace the placeholder keys with your actual API keys:
   - `VITE_OPENWEATHER_API_KEY`: You can generate it by creating a free account at [OpenWeatherMap](https://home.openweathermap.org/users/sign_up), going to "My API keys", and generating a new key.
   - **Google Maps has been replaced completely.** No mapping API keys are required anymore!

### 3. Run Commands
Start the development server:
```bash
npm run dev
```
Open the provided Local URL (e.g., `http://localhost:3000`) in your browser to view the application!

To build the project for production:
```bash
npm run build
```

## How To Use

1. **Set Origin**: Click **"My Location"** to fetch weather conditions at your current GPS location, or simply click anywhere on the Map to override it to a custom location.
2. **Find Safe Place**: Click **"Find Safe Place"**. The app will then:
    - Analyze the weather approximately 10km North, South, East, and West of the selected location to find the "Safest Vector" (lowest amount of rain + wind).
    - Query the Places API for a Hospital or Police Station nearby.
    - Choose the location best matching the Safest Vector.
3. **Route**: A route mapped directly to the safest location will be drawn on the map, with an openable link to Google Maps Native Directions.

## Technologies Used

- **Vite** (Build Tool)
- **Vanilla JavaScript** (ES Modules)
- **HTML5 & Vanilla CSS3**
- **Leaflet.js & OpenStreetMap** (Map Rendering)
- **Nominatim API** (Geocoding)
- **Overpass API** (Places Query)
- **OSRM** (Directions Routing)
- **OpenWeather API** (Vectors)
