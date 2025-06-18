let currentNoticeIndex = 0; // Initialize currentNoticeIndex
let notices = []; // Initialize notices array

// Initialize Firebase and check authentication
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            loadDriverInfo(user.uid); // Load driver info
            showSection('overview');
            loadAssignedRoute();
            loadNotices();
            loadDriverMessages();
            initializeTracking();
        } else {
            window.location.href = 'driverlogin.html'; // Redirect to login if not logged in
        }
    });
});

// Load driver information
function loadDriverInfo(driverId) {
    database.ref(`driverInfo/${driverId}`).once('value').then(snapshot => {
        const driverData = snapshot.val();
        if (driverData) {
            document.getElementById('routeStatus').textContent = driverData.assignedRoute || 'No route assigned';
            document.getElementById('hoursActive').textContent = driverData.hoursActive || '0h';
            document.getElementById('avgRating').textContent = driverData.rating || '0.0';
        }
    });
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'driverlogin.html'; // Redirect to login page
    }).catch(error => {
        console.error('Error logging out:', error);
    });
}

// Load notices
function loadNotices() {
    const noticesContainer = document.getElementById('notices');
    if (!noticesContainer) return;

    database.ref('notices').orderByChild('timestamp').limitToLast(5).on('value', snapshot => {
        notices = [];
        snapshot.forEach(child => {
            notices.unshift(child.val());
        });

        noticesContainer.innerHTML = `
            <h3><i class="fas fa-bullhorn"></i> Public Notices</h3>
            <div class="notice-slideshow">
                ${notices.map((notice, index) => `
                    <div class="notice-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                        <div class="notice-content">
                            <p>${notice.content}</p>
                            <small>${new Date(notice.timestamp).toLocaleString()}</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Start the slideshow
        if (notices.length > 1) {
            startNoticeSlideshow();
        }
    });
}

// Start notice slideshow
function startNoticeSlideshow() {
    setInterval(() => {
        const noticeItems = document.querySelectorAll('.notice-item');
        if (!noticeItems.length) return;

        noticeItems[currentNoticeIndex].classList.remove('active');
        currentNoticeIndex = (currentNoticeIndex + 1) % notices.length;
        noticeItems[currentNoticeIndex].classList.add('active');
    }, 5000); // Change notice every 5 seconds
}

// Load driver messages
function loadDriverMessages() {
    const messagesContainer = document.getElementById('driverMessages');
    if (!messagesContainer) return;

    const driverId = auth.currentUser.uid;
    database.ref(`messages/${driverId}`).orderByChild('timestamp').on('value', snapshot => {
        const messages = [];
        snapshot.forEach(child => {
            messages.unshift({
                id: child.key,
                ...child.val()
            });
        });

        messagesContainer.innerHTML = `
            <h3><i class="fas fa-envelope"></i> Messages for You</h3>
            ${messages.map(msg => `
                <div class="message-item ${msg.read ? '' : 'unread'}">
                    <div class="message-content">
                        <p>${msg.text}</p>
                        <small>${new Date(msg.timestamp).toLocaleString()}</small>
                    </div>
                    ${!msg.read ? `
                        <button onclick="markAsRead('${msg.id}')" class="mark-read-btn">
                            Mark as Read
                        </button>
                    ` : ''}
                </div>
            `).join('') || '<p>No messages available</p>'}
        `;

        // Update badge count
        updateMessageBadge(messages.filter(msg => !msg.read).length);
    });
}

// Update message badge
function updateMessageBadge(count) {
    const badge = document.getElementById('messageBadge');
    if (badge) {
        badge.textContent = count || '';
        badge.style.display = count ? 'block' : 'none';
    }
}

// Load assigned route
async function loadAssignedRoute() {
    try {
        const driverId = auth.currentUser.uid;
        const driverRef = await database.ref(`driverInfo/${driverId}`).once('value');
        const driverData = driverRef.val();

        if (!driverData || !driverData.assignedRoute) {
            document.getElementById('routeDisplay').innerHTML = 
                '<p class="no-route">No route assigned yet</p>';
            return;
        }

        const routeSnapshot = await database.ref(`routes/${driverData.assignedRoute}`).once('value');
        const routeData = routeSnapshot.val();

        if (!routeData) return;

        // Initialize map if not exists
        if (!window.routeMap) {
            window.routeMap = L.map('routeMap').setView([28.2096, 83.9856], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(window.routeMap);
        }

        // Display route on map
        const points = routeData.points.map(p => [p.lat, p.lng]);
        const routeLine = L.polyline(points, { 
            color: '#007bff',
            className: 'route-line'
        }).addTo(window.routeMap);

        // Add markers for each point
        routeData.points.forEach((point, index) => {
            L.marker([point.lat, point.lng])
                .bindPopup(`
                    <div class="route-point">
                        <div class="route-point-number">${index + 1}</div>
                        <div class="route-point-name">${point.name}</div>
                    </div>
                `)
                .addTo(window.routeMap);
        });
    } catch (error) {
        console.error('Error loading assigned route:', error);
    }
}

// Add showSection function
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.style.display = 'block';
    }
}

// Add message checking function
function checkMessages() {
    const driverId = auth.currentUser.uid;
    database.ref(`messages/${driverId}`).on('value', snapshot => {
        const messages = snapshot.val() || {};
        const unreadCount = Object.values(messages)
            .filter(msg => !msg.read && msg.from === 'admin').length;
        
        updateMessageBadge(unreadCount);
        
        if (unreadCount > 0) {
            showNotification(`You have ${unreadCount} new message(s)`);
        }
    });
}

function markAsRead(messageId) {
    const driverId = auth.currentUser.uid;
    database.ref(`messages/${driverId}/${messageId}`).update({
        read: true,
        readAt: Date.now()
    });
}

// Update tracking status in real-time
function initializeTracking() {
    const driverId = auth.currentUser.uid;
    let trackingActive = false;
    let watchId = null;

    const trackingBtn = document.getElementById('startTracking');
    const statusDiv = document.getElementById('trackingStatus');

    trackingBtn.addEventListener('click', () => {
        if (!trackingActive) {
            startTracking();
        } else {
            stopTracking();
        }
    });

    function startTracking() {
        trackingActive = true;
        trackingBtn.textContent = 'Stop Tracking';
        trackingBtn.classList.add('active');

        watchId = navigator.geolocation.watchPosition(
            position => {
                const { latitude, longitude } = position.coords;
                updateLocation(latitude, longitude);
            },
            error => {
                console.error('Error getting location:', error);
                showNotification('Error getting location', 'error');
            },
            { enableHighAccuracy: true }
        );
    }

    function stopTracking() {
        trackingActive = false;
        trackingBtn.textContent = 'Start Tracking';
        trackingBtn.classList.remove('active');
        
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
        }
        
        database.ref(`driverLocation/${driverId}`).update({
            active: false,
            lastUpdate: Date.now()
        });
    }

    function updateLocation(lat, lng) {
        database.ref(`driverLocation/${driverId}`).update({
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            active: true
        });
    }
}

// Make function globally available
window.showSection = showSection; 