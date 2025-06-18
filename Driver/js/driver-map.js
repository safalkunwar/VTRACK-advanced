// Driver Map - Enhanced Map functionality for Driver Panel
class DriverMap {
    constructor() {
        this.liveMap = null;
        this.routeMap = null;
        this.driverMarker = null;
        this.routePolyline = null;
        this.routeMarkers = [];
        this.currentLocation = null;
        this.routeData = null;
        this.mapInitialized = false;
        
        // Enhanced tracking properties
        this.locationHistory = [];
        this.trackingPolyline = null;
        this.maxHistoryPoints = 100; // Keep last 100 points (roughly 3-4km)
        this.lastValidLocation = null;
        this.isTracking = false;
        this.locationUpdateInterval = null;
    }

    // Initialize live map for tracking
    initializeMap() {
        if (this.liveMap) {
            this.liveMap.invalidateSize();
            return;
        }

        const mapContainer = document.getElementById('liveMap');
        if (!mapContainer) return;

        try {
            // Initialize map with default location (Colombo, Sri Lanka)
            this.liveMap = L.map('liveMap').setView([6.9271, 79.8612], 13);
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(this.liveMap);

            // Add custom controls
            this.addMapControls();

            // Initialize driver marker
            this.initializeDriverMarker();

            // Initialize tracking polyline
            this.initializeTrackingPolyline();

            // Listen for location updates
            this.listenForLocationUpdates();

            this.mapInitialized = true;
            console.log('Live map initialized successfully');

        } catch (error) {
            console.error('Error initializing live map:', error);
        }
    }

    // Initialize route map for assigned route
    initializeRouteMap() {
        if (this.routeMap) {
            this.routeMap.invalidateSize();
            return;
        }

        const mapContainer = document.getElementById('routeMap');
        if (!mapContainer) return;

        try {
            // Initialize map with default location
            this.routeMap = L.map('routeMap').setView([6.9271, 79.8612], 13);
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(this.routeMap);

            // Load and display assigned route
            this.loadAndDisplayRoute();

            console.log('Route map initialized successfully');

        } catch (error) {
            console.error('Error initializing route map:', error);
        }
    }

    // Add custom map controls
    addMapControls() {
        if (!this.liveMap) return;

        // Center map control
        const centerButton = L.Control.extend({
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.innerHTML = `
                    <a href="#" title="Center on driver location" style="display: block; width: 30px; height: 30px; line-height: 30px; text-align: center; background: white; border: 2px solid rgba(0,0,0,0.2); border-radius: 4px;">
                        <i class="fas fa-crosshairs" style="color: #333;"></i>
                    </a>
                `;
                
                container.onclick = () => {
                    if (this.currentLocation) {
                        this.liveMap.setView([this.currentLocation.lat, this.currentLocation.lng], 15);
                    }
                };
                
                return container;
            }
        });

        // Route toggle control
        const routeToggleButton = L.Control.extend({
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.innerHTML = `
                    <a href="#" title="Toggle route display" style="display: block; width: 30px; height: 30px; line-height: 30px; text-align: center; background: white; border: 2px solid rgba(0,0,0,0.2); border-radius: 4px;">
                        <i class="fas fa-route" style="color: #333;"></i>
                    </a>
                `;
                
                container.onclick = () => {
                    this.toggleRouteDisplay();
                };
                
                return container;
            }
        });

        // Add controls to map
        this.liveMap.addControl(new centerButton({ position: 'topright' }));
        this.liveMap.addControl(new routeToggleButton({ position: 'topright' }));
    }

    // Initialize driver marker
    initializeDriverMarker() {
        if (!this.liveMap) return;

        // Create custom driver marker icon
        const driverIcon = L.divIcon({
            className: 'driver-marker',
            html: '<i class="fas fa-bus" style="color: #667eea; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Create driver marker
        this.driverMarker = L.marker([6.9271, 79.8612], { icon: driverIcon })
            .addTo(this.liveMap)
            .bindPopup('Driver Location<br>Speed: <span id="markerSpeed">0 km/h</span>');

        // Add CSS for driver marker
        this.addMarkerStyles();
    }

    // Add custom styles for markers
    addMarkerStyles() {
        if (!document.getElementById('marker-styles')) {
            const style = document.createElement('style');
            style.id = 'marker-styles';
            style.textContent = `
                .driver-marker {
                    background: none;
                    border: none;
                }
                .route-stop-marker {
                    background: #28a745;
                    border: 2px solid white;
                    border-radius: 50%;
                    width: 12px;
                    height: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
                .route-stop-marker.active {
                    background: #ffc107;
                    animation: pulse 2s infinite;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Listen for location updates from Firebase
    listenForLocationUpdates() {
        if (!auth.currentUser) return;

        const driverId = auth.currentUser.uid;
        database.ref(`driverLocation/${driverId}`).on('value', snapshot => {
            const locationData = snapshot.val();
            if (locationData && locationData.active) {
                this.updateDriverLocation(locationData.latitude, locationData.longitude, locationData.speed);
            }
        });
    }

    // Initialize tracking polyline for smooth road following
    initializeTrackingPolyline() {
        if (!this.liveMap) return;

        this.trackingPolyline = L.polyline([], {
            color: '#667eea',
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(this.liveMap);
    }

    // Enhanced location validation
    validateLocation(latitude, longitude, accuracy = null) {
        // Basic coordinate validation
        if (!latitude || !longitude || 
            isNaN(latitude) || isNaN(longitude) ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180) {
            return false;
        }

        // If we have a previous location, check for unrealistic jumps
        if (this.lastValidLocation) {
            const distance = this.calculateDistance(
                this.lastValidLocation.lat,
                this.lastValidLocation.lng,
                latitude,
                longitude
            );

            // Reject locations that are more than 1km away from last location
            // (assuming updates every few seconds, this would be unrealistic)
            if (distance > 1.0) {
                console.warn('Rejected location update - unrealistic distance:', distance, 'km');
                return false;
            }
        }

        // Accuracy check (if available)
        if (accuracy && accuracy > 100) { // More than 100m accuracy
            console.warn('Location accuracy is poor:', accuracy, 'm');
            return false;
        }

        return true;
    }

    // Start location tracking
    startTracking() {
        if (this.isTracking) return;

        this.isTracking = true;
        this.locationHistory = [];
        
        // Clear existing polyline
        if (this.trackingPolyline) {
            this.liveMap.removeLayer(this.trackingPolyline);
            this.initializeTrackingPolyline();
        }

        console.log('Location tracking started');
    }

    // Stop location tracking
    stopTracking() {
        this.isTracking = false;
        
        // Clear location history
        this.locationHistory = [];
        
        // Remove tracking polyline
        if (this.trackingPolyline) {
            this.liveMap.removeLayer(this.trackingPolyline);
            this.trackingPolyline = null;
        }

        console.log('Location tracking stopped');
    }

    // Enhanced location update with smooth polyline
    updateDriverLocation(latitude, longitude, speed = 0, accuracy = null) {
        if (!this.liveMap || !this.driverMarker) return;

        // Validate location
        if (!this.validateLocation(latitude, longitude, accuracy)) {
            return;
        }

        const newLocation = { lat: latitude, lng: longitude, timestamp: Date.now() };

        // Update current location
        this.currentLocation = newLocation;
        this.lastValidLocation = newLocation;

        // Update marker position
        this.driverMarker.setLatLng([latitude, longitude]);

        // Update popup content
        const speedKmh = Math.round(speed * 3.6);
        this.driverMarker.getPopup().setContent(`
            <div style="text-align: center;">
                <i class="fas fa-bus" style="color: #667eea; font-size: 20px;"></i>
                <br><strong>Driver Location</strong>
                <br>Speed: ${speedKmh} km/h
                <br>Updated: ${new Date().toLocaleTimeString()}
                ${accuracy ? `<br>Accuracy: ${Math.round(accuracy)}m` : ''}
            </div>
        `);

        // Update tracking polyline if tracking is active
        if (this.isTracking) {
            this.updateTrackingPolyline(newLocation);
        }

        // Center map on driver if it's the first location
        if (!this.mapInitialized) {
            this.liveMap.setView([latitude, longitude], 15);
            this.mapInitialized = true;
        }
    }

    // Update tracking polyline with smooth road following
    updateTrackingPolyline(newLocation) {
        if (!this.trackingPolyline) return;

        // Add new location to history
        this.locationHistory.push(newLocation);

        // Keep only the last maxHistoryPoints
        if (this.locationHistory.length > this.maxHistoryPoints) {
            this.locationHistory = this.locationHistory.slice(-this.maxHistoryPoints);
        }

        // Create smooth polyline points
        const polylinePoints = this.createSmoothPolyline();

        // Update polyline
        this.trackingPolyline.setLatLngs(polylinePoints);

        // Auto-fit polyline to map if it's getting too long
        if (this.locationHistory.length > 20) {
            this.liveMap.fitBounds(this.trackingPolyline.getBounds(), { 
                padding: [20, 20],
                maxZoom: 16 
            });
        }
    }

    // Create smooth polyline points using interpolation
    createSmoothPolyline() {
        if (this.locationHistory.length < 2) {
            return this.locationHistory.map(loc => [loc.lat, loc.lng]);
        }

        const points = [];
        const history = this.locationHistory;

        for (let i = 0; i < history.length; i++) {
            const current = history[i];
            
            if (i === 0) {
                // First point
                points.push([current.lat, current.lng]);
            } else if (i === history.length - 1) {
                // Last point
                points.push([current.lat, current.lng]);
            } else {
                // Middle points - add interpolation for smoothness
                const prev = history[i - 1];
                const next = history[i + 1];
                
                // Add current point
                points.push([current.lat, current.lng]);
                
                // Add interpolated point between current and next
                const interpolatedLat = (current.lat + next.lat) / 2;
                const interpolatedLng = (current.lng + next.lng) / 2;
                points.push([interpolatedLat, interpolatedLng]);
            }
        }

        return points;
    }

    // Get location history for export or analysis
    getLocationHistory() {
        return this.locationHistory.map(loc => ({
            latitude: loc.lat,
            longitude: loc.lng,
            timestamp: loc.timestamp
        }));
    }

    // Clear location history
    clearLocationHistory() {
        this.locationHistory = [];
        if (this.trackingPolyline) {
            this.liveMap.removeLayer(this.trackingPolyline);
            this.initializeTrackingPolyline();
        }
    }

    // Export location data
    exportLocationData() {
        const data = {
            history: this.getLocationHistory(),
            currentLocation: this.currentLocation,
            exportTime: new Date().toISOString(),
            totalPoints: this.locationHistory.length
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `driver-location-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Load and display assigned route
    async loadAndDisplayRoute() {
        if (!auth.currentUser) return;

        try {
            const driverId = auth.currentUser.uid;
            const driverRef = await database.ref(`driverInfo/${driverId}`).once('value');
            const driverData = driverRef.val();

            if (!driverData || !driverData.assignedRoute) {
                this.showNoRouteMessage();
                return;
            }

            const routeRef = await database.ref(`routes/${driverData.assignedRoute}`).once('value');
            this.routeData = routeRef.val();

            if (this.routeData && this.routeData.points) {
                this.displayRoute(this.routeData);
            } else {
                this.showNoRouteMessage();
            }

        } catch (error) {
            console.error('Error loading route:', error);
            this.showNoRouteMessage();
        }
    }

    // Display route on map
    displayRoute(routeData) {
        if (!this.routeMap) return;

        // Clear existing route
        this.clearRoute();

        // Create route points
        const routePoints = routeData.points.map(point => [point.lat, point.lng]);

        // Draw route line
        this.routePolyline = L.polyline(routePoints, {
            color: '#667eea',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(this.routeMap);

        // Add markers for each stop
        routeData.points.forEach((point, index) => {
            const stopIcon = L.divIcon({
                className: 'route-stop-marker',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            const marker = L.marker([point.lat, point.lng], { icon: stopIcon })
                .addTo(this.routeMap)
                .bindPopup(`
                    <div style="text-align: center;">
                        <div style="background: #667eea; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; margin: 0 auto 8px;">
                            ${index + 1}
                        </div>
                        <strong>${point.name}</strong>
                        <br>${point.address || ''}
                    </div>
                `);

            this.routeMarkers.push(marker);
        });

        // Fit map to route bounds
        if (routePoints.length > 0) {
            this.routeMap.fitBounds(this.routePolyline.getBounds(), { padding: [20, 20] });
        }

        // Also display on live map if available
        this.displayRouteOnLiveMap(routeData);
    }

    // Display route on live map
    displayRouteOnLiveMap(routeData) {
        if (!this.liveMap) return;

        // Clear existing route on live map
        if (this.liveMapRoutePolyline) {
            this.liveMap.removeLayer(this.liveMapRoutePolyline);
        }

        // Create route points
        const routePoints = routeData.points.map(point => [point.lat, point.lng]);

        // Draw route line on live map
        this.liveMapRoutePolyline = L.polyline(routePoints, {
            color: '#28a745',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 5'
        }).addTo(this.liveMap);
    }

    // Clear route display
    clearRoute() {
        if (this.routePolyline) {
            this.routeMap.removeLayer(this.routePolyline);
            this.routePolyline = null;
        }

        this.routeMarkers.forEach(marker => {
            this.routeMap.removeLayer(marker);
        });
        this.routeMarkers = [];

        if (this.liveMapRoutePolyline) {
            this.liveMap.removeLayer(this.liveMapRoutePolyline);
            this.liveMapRoutePolyline = null;
        }
    }

    // Toggle route display on live map
    toggleRouteDisplay() {
        if (this.liveMapRoutePolyline) {
            if (this.liveMap.hasLayer(this.liveMapRoutePolyline)) {
                this.liveMap.removeLayer(this.liveMapRoutePolyline);
            } else {
                this.liveMap.addLayer(this.liveMapRoutePolyline);
            }
        }
    }

    // Show no route message
    showNoRouteMessage() {
        if (!this.routeMap) return;

        const mapContainer = document.getElementById('routeMap');
        mapContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa;">
                <div style="text-align: center; color: #6c757d;">
                    <i class="fas fa-route" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <h5>No Route Assigned</h5>
                    <p>You haven't been assigned a route yet.</p>
                    <p>Please contact your administrator.</p>
                </div>
            </div>
        `;
    }

    // Center map on driver location
    centerOnDriver() {
        if (this.currentLocation && this.liveMap) {
            this.liveMap.setView([this.currentLocation.lat, this.currentLocation.lng], 15);
        }
    }

    // Get current driver location
    getCurrentLocation() {
        return this.currentLocation;
    }

    // Calculate distance between two points
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

    // Get nearest stop to current location
    getNearestStop() {
        if (!this.currentLocation || !this.routeData || !this.routeData.points) {
            return null;
        }

        let nearestStop = null;
        let minDistance = Infinity;

        this.routeData.points.forEach((stop, index) => {
            const distance = this.calculateDistance(
                this.currentLocation.lat,
                this.currentLocation.lng,
                stop.lat,
                stop.lng
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestStop = { ...stop, index, distance };
            }
        });

        return nearestStop;
    }

    // Update route progress
    updateRouteProgress() {
        if (!this.routeData || !this.currentLocation) return;

        const nearestStop = this.getNearestStop();
        if (nearestStop && nearestStop.distance < 0.1) { // Within 100m of a stop
            // Highlight the nearest stop
            this.routeMarkers.forEach((marker, index) => {
                const icon = marker.getIcon();
                if (index === nearestStop.index) {
                    icon.options.className = 'route-stop-marker active';
                } else {
                    icon.options.className = 'route-stop-marker';
                }
                marker.setIcon(icon);
            });
        }
    }

    // Initialize map event listeners
    initializeMapEvents() {
        if (!this.liveMap) return;

        // Map click event
        this.liveMap.on('click', (e) => {
            console.log('Map clicked at:', e.latlng);
        });

        // Map zoom event
        this.liveMap.on('zoomend', () => {
            console.log('Map zoom level:', this.liveMap.getZoom());
        });
    }

    // Destroy maps
    destroy() {
        if (this.liveMap) {
            this.liveMap.remove();
            this.liveMap = null;
        }

        if (this.routeMap) {
            this.routeMap.remove();
            this.routeMap = null;
        }

        this.driverMarker = null;
        this.routePolyline = null;
        this.routeMarkers = [];
        this.currentLocation = null;
        this.routeData = null;
        this.mapInitialized = false;
    }
}

// Initialize Driver Map when DOM is loaded
let driverMap;
document.addEventListener('DOMContentLoaded', () => {
    driverMap = new DriverMap();
    window.driverMap = driverMap;
});

// Make map functions globally available
window.centerMap = () => driverMap.centerOnDriver();
window.toggleRoute = () => driverMap.toggleRouteDisplay(); 