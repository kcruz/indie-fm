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

// Sample a logo image and tint the cassette shell with its dominant color
function tintCassetteFromLogo(iconSrc, cardElement) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        try {
            const size = 16;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;

            let r = 0, g = 0, b = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha < 128) continue;
                // Skip near-white/near-black pixels so the average isn't washed out
                const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (lum > 240 || lum < 15) continue;
                r += data[i]; g += data[i + 1]; b += data[i + 2];
                count++;
            }
            if (count === 0) return;
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);

            cardElement.style.setProperty('--shell', `rgb(${r}, ${g}, ${b})`);
            cardElement.style.setProperty('--shell-dark', `rgb(${Math.round(r * 0.5)}, ${Math.round(g * 0.5)}, ${Math.round(b * 0.5)})`);
        } catch (e) {
            // Logo served without CORS headers — canvas is tainted, keep default shell color
        }
    };
    img.src = iconSrc;
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
            <div class="cassette-top-holes"><span></span><span></span></div>
            <div class="cassette-label">
                <img src="${iconSrc}" class="station-img" onerror="this.src='https://cdn-icons-png.flaticon.com/512/4472/4472584.png'">
                <div class="station-info">
                    <div class="station-name">${station.name}</div>
                    <div class="station-location">${station.country} ${station.state ? '• ' + station.state : ''}</div>
                </div>
                <div class="play-icon">▶</div>
            </div>
            <div class="cassette-window">
                <div class="screw tl"></div><div class="screw tr"></div>
                <div class="reel left"><div class="spokes"></div><div class="hub"></div></div>
                <div class="tape-strip"></div>
                <div class="reel right"><div class="spokes"></div><div class="hub"></div></div>
                <div class="screw bl"></div><div class="screw br"></div>
            </div>
            <div class="cassette-feet"><span></span><span></span></div>
        `;

        card.addEventListener('click', () => {
            playStation(station, card);
            focusMarker(station);
        });

        container.appendChild(card);
        tintCassetteFromLogo(iconSrc, card);

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
