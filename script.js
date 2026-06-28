const API_URL = "https://de1.api.radio-browser.info/json/stations/search?tag=indie&limit=50&hidebroken=true&order=clickcount&reverse=true&https=true";
const ACCENT_COLOR = '#00f0ff';

const container = document.getElementById('station-container');
const audioPlayer = document.getElementById('audio-player');
const nowPlayingName = document.getElementById('now-playing-name');
const nowPlayingStatus = document.getElementById('now-playing-status');
const visualizer = document.getElementById('visualizer');
const map = L.map('map', {
    worldCopyJump: true,
    zoomControl: true
}).setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
const markerLayer = L.layerGroup().addTo(map);

// Fetch Data
async function fetchStations() {
    try {
        const response = await fetch(API_URL);
        const stations = await response.json();
        renderStations(stations);
    } catch (error) {
        container.innerHTML = `<div class="loader">Error loading stations. Please check your connection.</div>`;
        console.error("Error fetching stations:", error);
    }
}

// Render Cards
function renderStations(stations) {
    container.innerHTML = ''; // Clear loader
    markerLayer.clearLayers();

    if (stations.length === 0) {
        container.innerHTML = '<div class="loader">No stations found.</div>';
        return;
    }

    const coords = [];

    stations.forEach(station => {
        const card = document.createElement('div');
        card.className = 'station-card';
        card.dataset.url = station.url_resolved;
        card.dataset.name = station.name;
        card.dataset.id = station.stationuuid || station.name;

        // Handle missing icons
        const iconSrc = station.favicon ? station.favicon : 'https://cdn-icons-png.flaticon.com/512/4472/4472584.png';

        card.innerHTML = `
            <img src="${iconSrc}" class="station-img" onerror="this.src='https://cdn-icons-png.flaticon.com/512/4472/4472584.png'">
            <div class="station-info">
                <div class="station-name">${station.name}</div>
                <div class="station-location">${station.country} ${station.state ? '• ' + station.state : ''}</div>
            </div>
            <div class="play-icon">▶</div>
        `;

        card.addEventListener('click', () => {
            playStation(station, card);
            focusMarker(station);
        });

        container.appendChild(card);

        if (station.geo_lat && station.geo_long) {
            const lat = parseFloat(station.geo_lat);
            const lon = parseFloat(station.geo_long);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                coords.push([lat, lon]);
                const marker = L.circleMarker([lat, lon], {
                    radius: 6,
                    color: ACCENT_COLOR,
                    fillColor: ACCENT_COLOR,
                    fillOpacity: 0.8,
                    weight: 2
                }).addTo(markerLayer);
                marker.bindPopup(`<strong>${station.name}</strong><br>${station.country}${station.state ? ' • ' + station.state : ''}`);
                marker.on('click', () => {
                    playStation(station, card);
                });
                marker.layerId = card.dataset.id;
            }
        }
    });

    if (coords.length > 0) {
        map.fitBounds(coords, { padding: [30, 30] });
    } else {
        map.setView([20, 0], 2);
    }
}

// Play Logic
function playStation(station, cardElement) {
    // Update Visuals
    document.querySelectorAll('.station-card').forEach(c => c.classList.remove('playing'));
    cardElement.classList.add('playing');

    // Update Player UI
    nowPlayingName.textContent = station.name;
    nowPlayingStatus.textContent = "Buffering...";
    visualizer.classList.remove('active');

    // Play Audio
    audioPlayer.src = station.url_resolved;
    audioPlayer.play()
        .then(() => {
            nowPlayingStatus.textContent = "Live Stream";
            visualizer.classList.add('active');
        })
        .catch(e => {
            console.error("Playback error:", e);
            nowPlayingStatus.textContent = "Stream offline or blocked";
        });
}

// Focus marker associated with a station card
function focusMarker(station) {
    const targetId = station.stationuuid || station.name;
    let targetMarker = null;
    markerLayer.eachLayer(layer => {
        if (layer.layerId === targetId) {
            targetMarker = layer;
        }
    });
    if (targetMarker) {
        targetMarker.openPopup();
        map.setView(targetMarker.getLatLng(), Math.max(map.getZoom(), 4), { animate: true });
    }
}

// Handle Player Events
audioPlayer.addEventListener('playing', () => {
    visualizer.classList.add('active');
    nowPlayingStatus.textContent = "Live Stream";
});

audioPlayer.addEventListener('pause', () => {
    visualizer.classList.remove('active');
    nowPlayingStatus.textContent = "Paused";
});

// Initialize
fetchStations();
