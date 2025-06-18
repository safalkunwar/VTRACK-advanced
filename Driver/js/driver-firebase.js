// Driver Firebase Integration - Firebase operations for Driver Panel
class DriverFirebase {
    constructor() {
        this.currentUser = null;
        this.driverData = null;
        this.locationRef = null;
        this.messagesRef = null;
        this.noticesRef = null;
        this.routeRef = null;
        this.statsRef = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        // Wait for Firebase to be initialized
        if (typeof firebase !== 'undefined' && auth) {
            this.setupAuthListener();
        } else {
            // Retry after a short delay
            setTimeout(() => this.init(), 1000);
        }
    }

    setupAuthListener() {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.currentUser = user;
                this.setupFirebaseReferences();
                this.setupRealTimeListeners();
                console.log('Driver Firebase initialized for user:', user.uid);
            } else {
                this.cleanup();
                console.log('Driver logged out, cleaning up Firebase listeners');
            }
        });
    }

    setupFirebaseReferences() {
        if (!this.currentUser) return;

        const driverId = this.currentUser.uid;
        
        // Set up Firebase references
        this.locationRef = database.ref(`driverLocation/${driverId}`);
        this.messagesRef = database.ref(`messages/${driverId}`);
        this.noticesRef = database.ref('notices');
        this.routeRef = database.ref(`driverInfo/${driverId}/assignedRoute`);
        this.statsRef = database.ref(`driverStats/${driverId}`);
    }

    setupRealTimeListeners() {
        if (!this.currentUser) return;

        // Listen for messages
        this.listenForMessages();
        
        // Listen for notices
        this.listenForNotices();
        
        // Listen for route changes
        this.listenForRouteChanges();
        
        // Listen for stats updates
        this.listenForStatsUpdates();
    }

    // Location tracking methods
    updateLocation(latitude, longitude, speed = 0, routeId = null) {
        if (!this.currentUser || !this.locationRef) return;

        const locationData = {
            latitude: latitude,
            longitude: longitude,
            speed: speed,
            timestamp: Date.now(),
            active: true,
            driverId: this.currentUser.uid,
            routeId: routeId || this.driverData?.assignedRoute || null,
            lastUpdate: Date.now()
        };

        return this.locationRef.set(locationData);
    }

    stopLocationTracking() {
        if (!this.currentUser || !this.locationRef) return;

        return this.locationRef.update({
            active: false,
            lastUpdate: Date.now()
        });
    }

    // Message handling methods
    listenForMessages() {
        if (!this.messagesRef) return;

        const listener = this.messagesRef.orderByChild('timestamp').on('value', snapshot => {
            const messages = [];
            snapshot.forEach(child => {
                messages.unshift({
                    id: child.key,
                    ...child.val()
                });
            });

            // Update UI with messages
            this.updateMessagesUI(messages);
            
            // Update badge count
            const unreadCount = messages.filter(msg => !msg.read).length;
            this.updateMessageBadge(unreadCount);
        });

        this.listeners.push({ ref: this.messagesRef, listener });
    }

    markMessageAsRead(messageId) {
        if (!this.currentUser || !this.messagesRef) return;

        return this.messagesRef.child(messageId).update({
            read: true,
            readAt: Date.now()
        });
    }

    // Notice handling methods
    listenForNotices() {
        if (!this.noticesRef) return;

        const listener = this.noticesRef.orderByChild('timestamp').limitToLast(5).on('value', snapshot => {
            const notices = [];
            snapshot.forEach(child => {
                notices.unshift({
                    id: child.key,
                    ...child.val()
                });
            });

            // Update UI with notices
            this.updateNoticesUI(notices);
        });

        this.listeners.push({ ref: this.noticesRef, listener });
    }

    // Route handling methods
    listenForRouteChanges() {
        if (!this.routeRef) return;

        const listener = this.routeRef.on('value', snapshot => {
            const routeId = snapshot.val();
            if (routeId && routeId !== this.driverData?.assignedRoute) {
                this.loadRouteData(routeId);
            }
        });

        this.listeners.push({ ref: this.routeRef, listener });
    }

    async loadRouteData(routeId) {
        try {
            const routeSnapshot = await database.ref(`routes/${routeId}`).once('value');
            const routeData = routeSnapshot.val();
            
            if (routeData) {
                this.driverData = { ...this.driverData, assignedRoute: routeId };
                this.updateRouteUI(routeData);
                
                // Update map if available
                if (window.driverMap) {
                    window.driverMap.displayRoute(routeData);
                }
            }
        } catch (error) {
            console.error('Error loading route data:', error);
        }
    }

    // Stats handling methods
    listenForStatsUpdates() {
        if (!this.statsRef) return;

        const listener = this.statsRef.on('value', snapshot => {
            const stats = snapshot.val() || {};
            this.updateStatsUI(stats);
        });

        this.listeners.push({ ref: this.statsRef, listener });
    }

    updateDriverStats(stats) {
        if (!this.currentUser || !this.statsRef) return;

        return this.statsRef.update({
            ...stats,
            lastUpdate: Date.now()
        });
    }

    // Profile management methods
    async updateDriverProfile(profileData) {
        if (!this.currentUser) return;

        try {
            const driverInfoRef = database.ref(`driverInfo/${this.currentUser.uid}`);
            await driverInfoRef.update({
                ...profileData,
                updatedAt: Date.now()
            });

            // Update local data
            this.driverData = { ...this.driverData, ...profileData };
            
            return true;
        } catch (error) {
            console.error('Error updating driver profile:', error);
            throw error;
        }
    }

    async getDriverProfile() {
        if (!this.currentUser) return null;

        try {
            const snapshot = await database.ref(`driverInfo/${this.currentUser.uid}`).once('value');
            this.driverData = snapshot.val() || {};
            return this.driverData;
        } catch (error) {
            console.error('Error getting driver profile:', error);
            return null;
        }
    }

    // Trip management methods
    startTrip(tripData) {
        if (!this.currentUser) return;

        const tripRef = database.ref(`driverTrips/${this.currentUser.uid}`).push();
        const tripId = tripRef.key;

        const trip = {
            id: tripId,
            driverId: this.currentUser.uid,
            routeId: this.driverData?.assignedRoute || null,
            startTime: Date.now(),
            status: 'active',
            ...tripData
        };

        return tripRef.set(trip);
    }

    endTrip(tripId, endData = {}) {
        if (!this.currentUser) return;

        const tripRef = database.ref(`driverTrips/${this.currentUser.uid}/${tripId}`);
        
        return tripRef.update({
            endTime: Date.now(),
            status: 'completed',
            duration: Date.now() - (endData.startTime || Date.now()),
            ...endData
        });
    }

    // Alert and notification methods
    sendAlert(alertData) {
        if (!this.currentUser) return;

        const alertRef = database.ref('alerts').push();
        const alert = {
            id: alertRef.key,
            driverId: this.currentUser.uid,
            timestamp: Date.now(),
            status: 'active',
            ...alertData
        };

        return alertRef.set(alert);
    }

    // UI update methods
    updateMessagesUI(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        if (messages.length > 0) {
            const messagesHTML = messages.map(msg => `
                <div class="message-item ${msg.read ? '' : 'unread'}">
                    <div class="message-content">
                        <p>${msg.text}</p>
                        <small class="text-muted">${new Date(msg.timestamp).toLocaleString()}</small>
                    </div>
                    ${!msg.read ? `
                        <button onclick="driverFirebase.markMessageAsRead('${msg.id}')" class="btn btn-sm btn-primary mt-2">
                            Mark as Read
                        </button>
                    ` : ''}
                </div>
            `).join('');
            
            messagesContainer.innerHTML = messagesHTML;
        } else {
            messagesContainer.innerHTML = 
                '<div class="text-center py-4"><i class="fas fa-envelope text-muted"></i><p>No messages available</p></div>';
        }
    }

    updateNoticesUI(notices) {
        const noticesContainer = document.getElementById('noticesContainer');
        if (!noticesContainer) return;

        if (notices.length > 0) {
            const noticesHTML = notices.map(notice => `
                <div class="notice-item">
                    <div class="notice-content">
                        <p>${notice.content}</p>
                        <small class="text-muted">${new Date(notice.timestamp).toLocaleString()}</small>
                    </div>
                </div>
            `).join('');
            
            noticesContainer.innerHTML = noticesHTML;
        } else {
            noticesContainer.innerHTML = 
                '<div class="text-center py-4"><i class="fas fa-info-circle text-muted"></i><p>No notices available</p></div>';
        }
    }

    updateRouteUI(routeData) {
        const routeInfo = document.getElementById('routeInfo');
        if (!routeInfo) return;

        routeInfo.innerHTML = `
            <div class="route-details">
                <h6>${routeData.name || 'Route Name'}</h6>
                <p class="text-muted">${routeData.description || 'Route description'}</p>
                <div class="route-stats">
                    <div class="stat-item">
                        <span class="stat-label">Distance</span>
                        <span class="stat-value">${routeData.distance || '0'} km</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Duration</span>
                        <span class="stat-value">${routeData.duration || '0'} min</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Stops</span>
                        <span class="stat-value">${routeData.stops ? routeData.stops.length : 0}</span>
                    </div>
                </div>
            </div>
        `;

        // Update route stops
        this.updateRouteStops(routeData);
    }

    updateRouteStops(routeData) {
        const routeStops = document.getElementById('routeStops');
        if (!routeStops || !routeData.stops) return;

        const stopsHTML = routeData.stops.map((stop, index) => `
            <div class="stop-item">
                <div class="stop-number">${index + 1}</div>
                <div class="stop-details">
                    <h6>${stop.name}</h6>
                    <p class="text-muted">${stop.address || ''}</p>
                </div>
            </div>
        `).join('');
        
        routeStops.innerHTML = stopsHTML;
    }

    updateStatsUI(stats) {
        // Update dashboard stats
        const elements = {
            'totalTrips': stats.totalTrips || 0,
            'avgRating': (stats.avgRating || 0).toFixed(1),
            'totalHours': `${stats.totalHours || 0}h`,
            'onTimeRate': `${stats.onTimeRate || 0}%`
        };

        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = elements[id];
            }
        });
    }

    updateMessageBadge(count) {
        const badge = document.getElementById('messageBadge');
        if (badge) {
            badge.textContent = count || '';
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    // Connection monitoring
    monitorConnection() {
        const connectedRef = database.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            const isConnected = snap.val() === true;
            this.updateConnectionStatus(isConnected);
        });
    }

    updateConnectionStatus(isConnected) {
        const firebaseStatus = document.getElementById('firebaseStatus');
        if (firebaseStatus) {
            firebaseStatus.className = isConnected ? 'fas fa-circle connected' : 'fas fa-circle disconnected';
        }
    }

    // Data validation methods
    validateLocation(latitude, longitude) {
        return latitude >= -90 && latitude <= 90 && 
               longitude >= -180 && longitude <= 180 &&
               !isNaN(latitude) && !isNaN(longitude);
    }

    validateSpeed(speed) {
        return speed >= 0 && speed <= 200 && !isNaN(speed);
    }

    // Error handling methods
    handleFirebaseError(error, operation) {
        console.error(`Firebase error during ${operation}:`, error);
        
        // Show user-friendly error message
        const errorMessages = {
            'permission-denied': 'You don\'t have permission to perform this action',
            'unavailable': 'Service temporarily unavailable. Please try again.',
            'network-error': 'Network error. Please check your connection.',
            'default': 'An error occurred. Please try again.'
        };

        const message = errorMessages[error.code] || errorMessages.default;
        
        // Show notification if available
        if (window.driverPanel) {
            window.driverPanel.showNotification(message, 'error');
        }
    }

    // Cleanup methods
    cleanup() {
        // Remove all listeners
        this.listeners.forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
        this.listeners = [];

        // Clear references
        this.locationRef = null;
        this.messagesRef = null;
        this.noticesRef = null;
        this.routeRef = null;
        this.statsRef = null;
        this.currentUser = null;
        this.driverData = null;
    }

    // Utility methods
    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Export data methods
    async exportDriverData() {
        if (!this.currentUser) return null;

        try {
            const [profile, stats, trips] = await Promise.all([
                this.getDriverProfile(),
                this.statsRef?.once('value').then(s => s.val()),
                database.ref(`driverTrips/${this.currentUser.uid}`).once('value').then(s => s.val())
            ]);

            return {
                profile,
                stats,
                trips,
                exportDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error exporting driver data:', error);
            return null;
        }
    }
}

// Initialize Driver Firebase when DOM is loaded
let driverFirebase;
document.addEventListener('DOMContentLoaded', () => {
    driverFirebase = new DriverFirebase();
    window.driverFirebase = driverFirebase;
});

// Make Firebase functions globally available
window.markMessageAsRead = (messageId) => driverFirebase.markMessageAsRead(messageId);
window.updateLocation = (lat, lng, speed) => driverFirebase.updateLocation(lat, lng, speed);
window.stopLocationTracking = () => driverFirebase.stopLocationTracking(); 