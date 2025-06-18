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
const busMarkers = {};
const busPaths = {};
let loggedInBusID = localStorage.getItem('driverID');
let routeControl = null;
let map = null;
let isTracking = false;
let trackingInterval = null;

// Initialize Leaflet Map
function initializeMap() {
    map = L.map('map').setView([28.215176984699085, 83.98871119857192], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Update or Add Marker for a Bus
function updateBusMarker(busID, location, isLoggedInBus = false) {
    const { latitude, longitude } = location;

    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        console.error('Invalid LatLng:', latitude, longitude);
        return;
    }

    if (busMarkers[busID]) {
        busMarkers[busID].setLatLng([latitude, longitude]);
    } else {
        const busIcon = L.icon({
            iconUrl: 'path/to/bus-icon.png',
            iconSize: [25, 25]
        });

        const marker = L.marker([latitude, longitude], { icon: busIcon })
            .bindPopup(`Bus ID: ${busID}`);
        busMarkers[busID] = marker;
        map.addLayer(marker);
    }

    if (isLoggedInBus) {
        map.setView([latitude, longitude], 14);
    }
}

// Update or Draw Polyline for a Bus
function updateBusPath(busID, location) {
    if (!busPaths[busID]) {
        busPaths[busID] = L.polyline([], { color: 'blue' }).addTo(map);
    }

    const latLng = [location.latitude, location.longitude];
    busPaths[busID].addLatLng(latLng);
}

// Fetch and Update Bus Locations
function fetchBusLocations() {
    if (!loggedInBusID) {
        alert('Driver ID not found. Redirecting to login...');
        window.location.href = '../index.html';
        return;
    }

    dbRef.child(loggedInBusID).once('value', snapshot => {
        const busData = snapshot.val();

        if (busData) {
            Object.values(busData).forEach(location => {
                if (location.latitude && location.longitude) {
                    updateBusMarker(loggedInBusID, location, true);
                    updateBusPath(loggedInBusID, location);
                }
            });
        } else {
            console.warn(`No data found for bus ${loggedInBusID}`);
        }
    });

    dbRef.on('child_added', snapshot => {
        const busID = snapshot.key;
        const location = snapshot.val();

        if (location.latitude && location.longitude) {
            updateBusMarker(busID, location);
            updateBusPath(busID, location);
        }
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

// Start Tracking Driver's Bus
function startTracking() {
    if (!loggedInBusID) {
        alert('Driver ID not found. Redirecting to login...');
        window.location.href = '../index.html';
        return;
    }

    if (!isTracking) {
        isTracking = true;
        trackingInterval = setInterval(() => updateDriverLocation(loggedInBusID), 2000);
    }
}

// Stop Tracking Driver's Bus
function stopTracking() {
    if (isTracking) {
        clearInterval(trackingInterval);
        trackingInterval = null;
        isTracking = false;
        alert("Tracking stopped.");
    }
}

// Update Driver's Location
function updateDriverLocation(driverID) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            const timestamp = Date.now();

            dbRef.child(driverID).child(timestamp).set({ latitude, longitude, timestamp });
            updateBusMarker(driverID, { latitude, longitude }, true);
            updateBusPath(driverID, { latitude, longitude });
        }, error => console.error("Geolocation error:", error));
    } else {
        alert('Geolocation is not supported by your browser.');
    }
}

// Draw Directions Between Two Points
function drawDirections(start, end) {
    if (routeControl) {
        map.removeControl(routeControl);
    }

    routeControl = L.Routing.control({
        waypoints: [L.latLng(start.latitude, start.longitude), L.latLng(end.latitude, end.longitude)],
        routeWhileDragging: true
    }).addTo(map);
}

// Event Listeners
document.getElementById('startTracking').addEventListener('click', startTracking);
document.getElementById('stopTracking').addEventListener('click', stopTracking);
document.getElementById('directionButton').addEventListener('click', () => {
    const start = { latitude: 28.215176, longitude: 83.988711 }; // Replace with actual start point
    const end = { latitude: 28.200000, longitude: 83.950000 }; // Replace with actual end point
    drawDirections(start, end);
});

// Initialize Map on Page Load
window.onload = () => {
    initializeMap();
    fetchBusLocations();
};
//
//
//direction wala
// Initialize the map


// Add the tile layer for the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Marker Icon
const busIcon = L.icon({
    iconUrl: './assets/images/bus-icon.png', // Ensure the path is correct
    iconSize: [32, 32]
});

// Add a marker for the bus
const busMarker = L.marker([28.215177, 83.988711], { icon: busIcon }).addTo(map);

// Polyline to display the path
let busPath = L.polyline([], { color: 'blue', weight: 4 }).addTo(map);

// Simulated stored locations
const storedLocations = [
    { lat: 28.215177, lng: 83.988711 },
    { lat: 28.215500, lng: 83.989000 },
    { lat: 28.216000, lng: 83.989500 },
    { lat: 28.216500, lng: 83.990000 },
    { lat: 28.217000, lng: 83.990500 }
];

// Function to align path with roads and display the route
function alignPathWithRoads() {
    const waypoints = storedLocations.map(loc => L.latLng(loc.lat, loc.lng));

    // Use Leaflet Routing Machine to snap waypoints to roads
    const routingControl = L.Routing.control({
        waypoints: waypoints,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1' // Free OSRM demo server
        }),
        createMarker: () => null, // Hide default markers
        lineOptions: {
            styles: [{ color: 'green', weight: 6 }] // Style for the snapped path
        },
        addWaypoints: false // Disable waypoint dragging
    }).addTo(map);

    routingControl.on('routesfound', function (e) {
        const route = e.routes[0]; // Get the best route
        const routeCoordinates = route.coordinates;

        // Move the marker along the snapped route
        animateBus(routeCoordinates);
    });
}

// Function to move the bus marker smoothly along the snapped path
function animateBus(routeCoordinates) {
    let index = 0;

    function move() {
        if (index < routeCoordinates.length) {
            const { lat, lng } = routeCoordinates[index];
            busMarker.setLatLng([lat, lng]); // Update marker position
            busPath.addLatLng([lat, lng]); // Extend the path
            index++;

            setTimeout(move, 100); // Adjust speed (lower = faster)
        }
    }

    move();
}

// Start aligning and animating
alignPathWithRoads();
