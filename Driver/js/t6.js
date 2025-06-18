// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBZpF...",
    authDomain: "v-track-gu999.firebaseapp.com",
    databaseURL: "https://v-track-gu999-default-rtdb.firebaseio.com",
    projectId: "v-track-gu999",
    storageBucket: "v-track-gu999.appspot.com",
    messagingSenderId: "1046512747961",
    appId: "1:1046512747961:web:80df40c48bca3159296268",
    measurementId: "G-38X29VT1YT"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const dbRef = database.ref('BusLocation');



// Variables
const busMarkers = {}; // Store bus markers
const busPaths = {};   // Store polylines for buses
const busSpeeds = {};  // Store speed information for logged-in bus
const nearbyBusesRadius = 0.005;  // Radius in degrees to consider buses as "nearby"
let routeControl = null;

let isTracking = false; // State for tracking
let trackingInterval = null;
let loggedInBusID = localStorage.getItem('driverID'); // Get logged-in bus ID
let lastLocation = {}; // Store last location of logged-in bus for speed calculation


// Helper to update or add marker for bus
function updateBusMarker(busID, location, isLoggedInBus = false) {
    const { latitude, longitude } = location;

    if (!latitude || !longitude) return; // Skip invalid locations

    if (busMarkers[busID]) {
        busMarkers[busID].setLatLng([latitude, longitude]); // Update position of existing marker
    } else {
        // Set marker for the bus with custom bus icon
        const marker = L.marker([latitude, longitude], { icon: busIcon }).bindPopup(`Bus ID: ${busID}`);
        busMarkers[busID] = marker;
        map.addLayer(marker); // Add new marker to the map
    }
    if (isLoggedInBus) {
        map.setView([latitude, longitude], 14); // Auto-center the map on logged-in bus
    }
    
    // If it's the logged-in bus, calculate speed and update
    if (isLoggedInBus && lastLocation.latitude && lastLocation.longitude) {
        const { speed } = calculateSpeedAndDirection(lastLocation, location);
        displaySpeed(speed); // Display speed of logged-in bus
    }

    lastLocation = location; // Update last known location for speed calculation
}

// Helper to calculate speed and direction for the logged-in bus
function calculateSpeedAndDirection(lastLocation, currentLocation) {
    const R = 6371; // Radius of Earth in km
    const lat1 = lastLocation.latitude * Math.PI / 180;
    const lon1 = lastLocation.longitude * Math.PI / 180;
    const lat2 = currentLocation.latitude * Math.PI / 180;
    const lon2 = currentLocation.longitude * Math.PI / 180;

    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in km

    // Speed in km/h
    const timeDiff = (Date.now() - lastLocation.timestamp) / 1000; // Time difference in seconds
    const speed = (distance / timeDiff) * 3600; // Speed in km/h

    return { speed };
}

// Display speed of the logged-in bus on the map
function displaySpeed(speed) {
    const speedElement = document.getElementById('speedDisplay');
    speedElement.textContent = `Speed: ${speed.toFixed(2)} km/h`;
}



// Fetch and update bus locations from Firebase (Historical Path)
function fetchBusLocations() {
    if (!loggedInBusID) {
        alert('Driver ID not found. Redirecting to login...');
        window.location.href = '../index.html';
        return;
    }

    dbRef.child(loggedInBusID).once('value', snapshot => {
        try {
            const busData = snapshot.val();
    
            if (!busData) {
                console.warn(`No data found for bus ${loggedInBusID}`);
                return;
            }
    
            const locations = Object.values(busData)
                .filter(item => item.latitude && item.longitude)
                .map(item => ({
                    latitude: item.latitude,
                    longitude: item.longitude,
                    timestamp: parseInt(item.timestamp, 10)
                }));
    
            if (locations.length > 0) {
                locations.forEach(location => {
                    updateBusMarker(loggedInBusID, location, true);
                    updateBusPath(loggedInBusID, location);
                });
            }
        } catch (error) {
            console.error("Error processing bus data:", error);
        }
    });
    
    // Handle data changes or new location updates for any bus
    dbRef.on('child_added', snapshot => {
        const busID = snapshot.key;
        const busData = snapshot.val();
    
        if (!busData) return;
    
        const location = {
            latitude: busData.latitude,
            longitude: busData.longitude
        };
    
        updateBusMarker(busID, location);
        updateBusPath(busID, location);
    });
    
    dbRef.on('child_removed', snapshot => {
        const busID = snapshot.key;
    
        if (busMarkers[busID]) {
            map.removeLayer(busMarkers[busID]);
            delete busMarkers[busID];
        }
    
        if (busPaths[busID]) {
            map.removeLayer(busPaths[busID]);
            delete busPaths[busID];
        }
    });
    
    
}

// Start Tracking the Driver's Bus
function startTracking() {
    if (!loggedInBusID) {
        alert('Driver ID not found. Redirecting to login...');
        window.location.href = '../index.html';
        return;
    }

    if (!trackingInterval && !isTracking) {
        isTracking = true;
        trackingInterval = setInterval(() => updateDriverLocation(loggedInBusID), 2000); // Update every 2 seconds
    }
}

// Stop Tracking the Driver's Bus
function stopTracking() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
        isTracking = false;
        alert("Tracking stopped.");
    }
}

// Update Driver's Location
function updateDriverLocation(driverID) {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        const timestamp = Date.now();

        // Update Firebase with the driver's current location
        dbRef.child(driverID).child(timestamp).set({
            latitude,
            longitude,
            timestamp
        });

        updateBusMarker(driverID, { latitude, longitude }, true); // Update marker for logged-in bus
        updateBusPath(driverID, { latitude, longitude });  // Update path for logged-in bus
    }, error => {
        console.error("Error retrieving location:", error);
    });
}

// Initialize Buttons
document.getElementById('startTracking').addEventListener('click', startTracking);
document.getElementById('stopTracking').addEventListener('click', stopTracking);

// Load Locations on Page Load
window.onload = () => {
    fetchBusLocations(); // Start fetching bus locations (historical paths)
};


// Function to display road-aligned path
function showDirections(start, end, busID) {
    if (!routeControl) {
        routeControl = L.Routing.control({
            waypoints: [
                L.latLng(start.latitude, start.longitude),
                L.latLng(end.latitude, end.longitude)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false
        }).addTo(map);
    } else {
        routeControl.setWaypoints([
            L.latLng(start.latitude, start.longitude),
            L.latLng(end.latitude, end.longitude)
        ]);
    }

    // Handle filled roadside area
    routeControl.on('routesfound', function (e) {
        const route = e.routes[0];
        const routePolyline = L.polyline(route.coordinates, {
            color: 'blue',
            weight: 5,
            opacity: 0.5,
            fill: true,
            fillColor: 'blue',
            fillOpacity: 0.2
        }).addTo(map);

        // Save route to busPaths
        if (!busPaths[busID].roadsideFill) {
            busPaths[busID].roadsideFill = [];
        }
        busPaths[busID].roadsideFill.push(routePolyline);
    });
}
// Initialize Leaflet Map
const map = L.map('map').setView([28.215176984699085, 83.98871119857192], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Add geocoder for location search
const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false
}).addTo(map);

let pointA = null;
let pointB = null;

// Search fields and recommendations
const searchA = document.getElementById('searchA');
const searchB = document.getElementById('searchB');

// Search A handler
searchA.addEventListener('change', async (event) => {
    const location = await geocode(event.target.value);
    if (location) {
        pointA = location;
        L.marker(location).addTo(map).bindPopup("Point A").openPopup();
        if (pointB) {
            showOptimalPath(pointA, pointB);
        }
    }
});

// Search B handler
searchB.addEventListener('change', async (event) => {
    const location = await geocode(event.target.value);
    if (location) {
        pointB = location;
        L.marker(location).addTo(map).bindPopup("Point B").openPopup();
        if (pointA) {
            showOptimalPath(pointA, pointB);
        }
    }
});
const searchControl = L.Control.geocoder({
    defaultMarkGeocode: false
}).addTo(map);

searchControl.on('markgeocode', function(e) {
    const { bbox, center } = e.geocode;
    map.fitBounds(bbox);
    L.marker(center).addTo(map).bindPopup(e.geocode.name).openPopup();
});


// Helper to geocode location names
async function geocode(query) {
    return new Promise((resolve, reject) => {
        geocoder.options.geocoder.geocode(query, (results) => {
            if (results && results.length > 0) {
                const latLng = results[0].center;
                resolve(latLng);
            } else {
                reject("No results found");
            }
        });
    });
}

document.getElementById("locationSearch").addEventListener("input", async function (e) {
    const query = e.target.value;

    if (query.length > 2) {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json`);
        const results = await response.json();

        const suggestions = results.map(result => `
            <div class="suggestion-item" data-lat="${result.lat}" data-lon="${result.lon}">
                ${result.display_name}
            </div>
        `).join("");

        document.getElementById("suggestions").innerHTML = suggestions;

        // Add click listeners to suggestion items
        document.querySelectorAll(".suggestion-item").forEach(item => {
            item.addEventListener("click", function () {
                const lat = this.getAttribute("data-lat");
                const lon = this.getAttribute("data-lon");

                map.setView([lat, lon], 15);
                L.marker([lat, lon]).addTo(map).bindPopup(this.textContent).openPopup();

                document.getElementById("suggestions").innerHTML = "";
            });
        });
    } else {
        document.getElementById("suggestions").innerHTML = "";
    }
});


function showOptimalPath(start, end) {
    if (!routeControl) {
        routeControl = L.Routing.control({
            waypoints: [
                L.latLng(start.latitude, start.longitude),
                L.latLng(end.latitude, end.longitude)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false
        }).addTo(map);
    } else {
        routeControl.setWaypoints([
            L.latLng(start.latitude, start.longitude),
            L.latLng(end.latitude, end.longitude)
        ]);
    }
}


function showOptimalPath(start, end) {
    if (!start || !end) {
        console.error("Invalid start or end points:", start, end);
        return;
    }

    if (!routeControl) {
        routeControl = L.Routing.control({
            waypoints: [
                L.latLng(start.latitude, start.longitude),
                L.latLng(end.latitude, end.longitude)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false
        }).addTo(map);
    } else {
        routeControl.setWaypoints([
            L.latLng(start.latitude, start.longitude),
            L.latLng(end.latitude, end.longitude)
        ]);
    }
}


// Fetch locations on load
window.onload = () => {
    fetchBusLocations(); // Start fetching bus locations (historical paths)
};
document.getElementById("directionButton").addEventListener("click", function () {
    const searchBox = document.getElementById("locationSearch");
    const suggestions = document.getElementById("suggestions");

    if (searchBox.style.display === "none") {
        searchBox.style.display = "block";
        suggestions.style.display = "block";
    } else {
        searchBox.style.display = "none";
        suggestions.style.display = "none";
    }
});
if (!latitude || !longitude) {
    console.error('Invalid LatLng:', latitude, longitude);
    return;
}
document.getElementById("directionsButton").addEventListener("click", () => {
    document.getElementById("directionPopup").style.display = "block";
});

document.getElementById("useMyLocation").addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        document.getElementById("startPoint").value = `${latitude},${longitude}`;
    });
});

document.getElementById("getDirections").addEventListener("click", async () => {
    const start = document.getElementById("startPoint").value;
    const end = document.getElementById("endPoint").value;

    if (!start || !end) {
        alert("Please enter both start and end points.");
        return;
    }

    // Geocode and show directions
    const startCoords = await geocode(start);
    const endCoords = await geocode(end);
    if (startCoords && endCoords) {
        showOptimalPath(startCoords, endCoords);
    }
    document.getElementById("directionPopup").style.display = "none";
});
