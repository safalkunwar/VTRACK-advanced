let markers = []; // Array to hold markers

// Function to add a marker
function addMarker(lat, lng) {
    const marker = L.marker([lat, lng]).addTo(map);
    markers.push(marker);

    // Bind a popup to the marker
    marker.bindPopup(`
        <div>
            <button onclick="deleteMarker(${markers.length - 1})">Delete Marker</button>
        </div>
    `).openPopup();

    // Add click event to show options
    marker.on('click', () => {
        marker.openPopup();
    });
}

// Function to delete a marker
function deleteMarker(index) {
    if (markers[index]) {
        map.removeLayer(markers[index]); // Remove from map
        markers.splice(index, 1); // Remove from array
    }
}

// Example usage: Add a marker on map click
map.on('click', (e) => {
    addMarker(e.latlng.lat, e.latlng.lng);
});

// Initialize OpenStreetMap
function initializeMap() {
    const mapContainer = document.getElementById('trackingMap');
    if (mapContainer) {
        const map = L.map(mapContainer).setView([28.2096, 83.9856], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }
}

// Load driver ratings
function loadDriverRating(driverId) {
    database.ref(`ratings/${driverId}`).once('value')
        .then(snapshot => {
            const ratings = snapshot.val() || {};
            const ratingValues = Object.values(ratings).map(r => r.rating);
            const averageRating = ratingValues.length > 0 
                ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
                : 'N/A';
            
            document.getElementById('driver-rating').innerHTML = 
                `${averageRating} <i class="fas fa-star" style="color: #ffc107;"></i>`;
        });
}

// Load admin messages
function loadAdminMessages() {
    const messagesContainer = document.getElementById('driverMessages');
    database.ref('messages').on('value', snapshot => {
        messagesContainer.innerHTML = ''; // Clear existing messages
        snapshot.forEach(child => {
            const messageData = child.val();
            messagesContainer.innerHTML += `
                <div class="message-item">
                    <p><strong>${messageData.from}:</strong> ${messageData.message}</p>
                </div>
            `;
        });
    });
}

// Call these functions when the dashboard is loaded
document.addEventListener('DOMContentLoaded', () => {
    const driverId = localStorage.getItem('driverID');
    loadDriverRating(driverId);
    loadAdminMessages();
});

// Add event listener to the logo for redirecting to driver info
document.querySelector('.logo').addEventListener('click', () => {
    window.location.href = 'driver-info.html'; // Redirect to driver's info page
}); 