// Driver Panel - Main JavaScript File
class DriverPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.isTracking = false;
        this.watchId = null;
        this.currentUser = null;
        this.driverData = null;
        this.notificationToast = null;
        this.updateInterval = null;
        
        this.init();
    }

    async init() {
        try {
            // Show loading screen
            this.showLoading();
            
            // Initialize Firebase authentication
            await this.initializeAuth();
            
            // Initialize UI components
            this.initializeUI();
            
            // Load driver data
            await this.loadDriverData();
            
            // Initialize real-time updates
            this.initializeRealTimeUpdates();
            
            // Hide loading screen and show main content
            this.hideLoading();
            
            console.log('Driver Panel initialized successfully');
        } catch (error) {
            console.error('Error initializing Driver Panel:', error);
            this.showError('Failed to initialize Driver Panel');
        }
    }

    showLoading() {
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'flex';
    }

    async initializeAuth() {
        return new Promise((resolve, reject) => {
            auth.onAuthStateChanged(user => {
                if (user) {
                    this.currentUser = user;
                    console.log('Driver authenticated:', user.uid);
                    resolve(user);
                } else {
                    console.log('No driver authenticated, redirecting to login');
                    window.location.href = 'driverlogin.html';
                    reject(new Error('No user authenticated'));
                }
            });
        });
    }

    initializeUI() {
        // Initialize sidebar toggle
        this.initializeSidebar();
        
        // Initialize navigation
        this.initializeNavigation();
        
        // Initialize tracking controls
        this.initializeTrackingControls();
        
        // Initialize toast notifications
        this.initializeToast();
        
        // Initialize time display
        this.initializeTimeDisplay();
        
        // Initialize connection status
        this.initializeConnectionStatus();
    }

    initializeSidebar() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });

        // Mobile sidebar toggle
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-open');
        }
    }

    initializeNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.showSection(section);
            });
        });
    }

    initializeTrackingControls() {
        const trackingToggle = document.getElementById('trackingToggle');
        
        trackingToggle.addEventListener('click', () => {
            if (this.isTracking) {
                this.stopTracking();
            } else {
                this.startTracking();
            }
        });
    }

    initializeToast() {
        this.notificationToast = new bootstrap.Toast(document.getElementById('notificationToast'));
    }

    initializeTimeDisplay() {
        const updateTime = () => {
            const now = new Date();
            document.getElementById('currentTime').textContent = now.toLocaleTimeString();
        };
        
        updateTime();
        setInterval(updateTime, 1000);
    }

    initializeConnectionStatus() {
        // Firebase connection status
        const connectedRef = database.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            const firebaseStatus = document.getElementById('firebaseStatus');
            if (snap.val() === true) {
                firebaseStatus.className = 'fas fa-circle connected';
            } else {
                firebaseStatus.className = 'fas fa-circle disconnected';
            }
        });

        // Location service status
        if (navigator.geolocation) {
            document.getElementById('locationStatus').className = 'fas fa-circle connected';
        } else {
            document.getElementById('locationStatus').className = 'fas fa-circle disconnected';
        }
    }

    async loadDriverData() {
        try {
            const driverRef = await database.ref(`driverInfo/${this.currentUser.uid}`).once('value');
            this.driverData = driverRef.val() || {};
            
            // Update UI with driver data
            this.updateDriverInfo();
            
            // Load assigned route
            await this.loadAssignedRoute();
            
            // Load notices
            this.loadNotices();
            
            // Load messages
            this.loadMessages();
            
            // Load performance stats
            this.loadPerformanceStats();
            
        } catch (error) {
            console.error('Error loading driver data:', error);
            this.showNotification('Error loading driver data', 'error');
        }
    }

    updateDriverInfo() {
        // Update driver name and ID
        document.getElementById('driverName').textContent = this.driverData.name || 'Driver Name';
        document.getElementById('driverId').textContent = `ID: ${this.currentUser.uid.substring(0, 8)}`;
        
        // Update driver rank
        const rank = this.driverData.rank || 'Bronze';
        const rankBadge = document.getElementById('rankBadge');
        if (rankBadge) {
            rankBadge.textContent = rank;
            rankBadge.className = `rank-badge rank-${rank.toLowerCase()}`;
        }
        
        // Update driver status
        const status = this.driverData.status || 'Active';
        const statusBadge = document.getElementById('statusBadge');
        if (statusBadge) {
            statusBadge.textContent = status;
            statusBadge.className = `status-badge status-${status.toLowerCase()}`;
        }
        
        // Update assigned bus
        const busNumber = document.getElementById('busNumber');
        if (busNumber) {
            if (this.driverData.assignedBus) {
                busNumber.textContent = this.driverData.assignedBus;
            } else {
                busNumber.textContent = 'No Bus Assigned';
            }
        }
        
        // Update dashboard stats
        document.getElementById('currentRoute').textContent = this.driverData.assignedRoute || 'No Route';
        document.getElementById('hoursActive').textContent = this.driverData.hoursActive || '0h';
        document.getElementById('rating').textContent = this.driverData.rating || '0.0';
        
        // Update profile form
        if (this.driverData) {
            document.getElementById('profileName').value = this.driverData.name || '';
            document.getElementById('profilePhone').value = this.driverData.phone || '';
            document.getElementById('profileEmail').value = this.driverData.email || '';
            document.getElementById('profileLicense').value = this.driverData.license || '';
        }
    }

    async loadAssignedRoute() {
        try {
            if (!this.driverData.assignedRoute) {
                document.getElementById('routeInfo').innerHTML = 
                    '<div class="text-center py-4"><i class="fas fa-info-circle text-muted"></i><p>No route assigned</p></div>';
                document.getElementById('routeStops').innerHTML = 
                    '<div class="text-center py-4"><i class="fas fa-info-circle text-muted"></i><p>No stops available</p></div>';
                return;
            }

            const routeRef = await database.ref(`routes/${this.driverData.assignedRoute}`).once('value');
            const routeData = routeRef.val();

            if (routeData) {
                // Update route info
                document.getElementById('routeInfo').innerHTML = `
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
                if (routeData.stops && routeData.stops.length > 0) {
                    const stopsHTML = routeData.stops.map((stop, index) => `
                        <div class="stop-item">
                            <div class="stop-number">${index + 1}</div>
                            <div class="stop-details">
                                <h6>${stop.name}</h6>
                                <p class="text-muted">${stop.address || ''}</p>
                            </div>
                        </div>
                    `).join('');
                    
                    document.getElementById('routeStops').innerHTML = stopsHTML;
                }

                // Initialize route map
                this.initializeRouteMap(routeData);
            }
        } catch (error) {
            console.error('Error loading assigned route:', error);
        }
    }

    loadNotices() {
        const noticesContainer = document.getElementById('noticesContainer');
        
        database.ref('notices').orderByChild('timestamp').limitToLast(5).on('value', snapshot => {
            const notices = [];
            snapshot.forEach(child => {
                notices.unshift({
                    id: child.key,
                    ...child.val()
                });
            });

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
        });
    }

    loadMessages() {
        const messagesContainer = document.getElementById('messagesContainer');
        
        database.ref(`messages/${this.currentUser.uid}`).orderByChild('timestamp').on('value', snapshot => {
            const messages = [];
            snapshot.forEach(child => {
                messages.unshift({
                    id: child.key,
                    ...child.val()
                });
            });

            if (messages.length > 0) {
                const messagesHTML = messages.map(msg => `
                    <div class="message-item ${msg.read ? '' : 'unread'}">
                        <div class="message-content">
                            <p>${msg.text}</p>
                            <small class="text-muted">${new Date(msg.timestamp).toLocaleString()}</small>
                        </div>
                        ${!msg.read ? `
                            <button onclick="driverPanel.markAsRead('${msg.id}')" class="btn btn-sm btn-primary mt-2">
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

            // Update message badge
            const unreadCount = messages.filter(msg => !msg.read).length;
            this.updateMessageBadge(unreadCount);
        });
    }

    loadPerformanceStats() {
        // Load performance statistics
        database.ref(`driverStats/${this.currentUser.uid}`).once('value').then(snapshot => {
            const stats = snapshot.val() || {};
            
            document.getElementById('totalTrips').textContent = stats.totalTrips || 0;
            document.getElementById('avgRating').textContent = (stats.avgRating || 0).toFixed(1);
            document.getElementById('totalHours').textContent = `${stats.totalHours || 0}h`;
            document.getElementById('onTimeRate').textContent = `${stats.onTimeRate || 0}%`;
        });
    }

    initializeRealTimeUpdates() {
        // Update stats every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateRealTimeStats();
        }, 30000);
    }

    updateRealTimeStats() {
        // Update current speed if tracking
        if (this.isTracking && window.currentSpeed !== undefined) {
            document.getElementById('currentSpeed').textContent = `${window.currentSpeed} km/h`;
        }
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Show selected section
        const selectedSection = document.getElementById(sectionId);
        if (selectedSection) {
            selectedSection.classList.add('active');
        }
        
        // Add active class to corresponding nav link
        const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Update page title and breadcrumb
        this.updatePageTitle(sectionId);
        
        // Store current section
        this.currentSection = sectionId;
        
        // Initialize section-specific functionality
        this.initializeSection(sectionId);
    }

    updatePageTitle(sectionId) {
        const titles = {
            'dashboard': 'Dashboard',
            'live-map': 'Live Map',
            'my-route': 'My Route',
            'messages': 'Messages',
            'profile': 'Profile'
        };
        
        const title = titles[sectionId] || 'Dashboard';
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('currentPage').textContent = title;
    }

    initializeSection(sectionId) {
        switch (sectionId) {
            case 'live-map':
                if (window.driverMap) {
                    window.driverMap.initializeMap();
                }
                break;
            case 'my-route':
                if (window.driverMap) {
                    window.driverMap.initializeRouteMap();
                }
                break;
        }
    }

    startTracking() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by this browser', 'error');
            return;
        }

        this.isTracking = true;
        const trackingToggle = document.getElementById('trackingToggle');
        
        trackingToggle.innerHTML = '<i class="fas fa-stop"></i><span>Stop Tracking</span>';
        trackingToggle.classList.add('tracking');
        trackingToggle.classList.remove('btn-success');
        trackingToggle.classList.add('btn-danger');

        this.watchId = navigator.geolocation.watchPosition(
            position => {
                const { latitude, longitude, speed } = position.coords;
                this.updateLocation(latitude, longitude, speed);
            },
            error => {
                console.error('Error getting location:', error);
                this.showNotification('Error getting location: ' + error.message, 'error');
                this.stopTracking();
            },
            { 
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );

        this.showNotification('Location tracking started', 'success');
    }

    stopTracking() {
        this.isTracking = false;
        const trackingToggle = document.getElementById('trackingToggle');
        
        trackingToggle.innerHTML = '<i class="fas fa-play"></i><span>Start Tracking</span>';
        trackingToggle.classList.remove('tracking');
        trackingToggle.classList.remove('btn-danger');
        trackingToggle.classList.add('btn-success');

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // Update Firebase with inactive status
        database.ref(`driverLocation/${this.currentUser.uid}`).update({
            active: false,
            lastUpdate: Date.now()
        });

        this.showNotification('Location tracking stopped', 'info');
    }

    updateLocation(latitude, longitude, speed = 0) {
        const locationData = {
            latitude: latitude,
            longitude: longitude,
            speed: speed,
            timestamp: Date.now(),
            active: true,
            driverId: this.currentUser.uid,
            routeId: this.driverData.assignedRoute || null
        };

        // Update Firebase
        database.ref(`driverLocation/${this.currentUser.uid}`).set(locationData);
        
        // Update current speed display
        window.currentSpeed = Math.round(speed * 3.6); // Convert m/s to km/h
        document.getElementById('currentSpeed').textContent = `${window.currentSpeed} km/h`;
        
        // Update map if available
        if (window.driverMap) {
            window.driverMap.updateDriverLocation(latitude, longitude);
        }
    }

    markAsRead(messageId) {
        database.ref(`messages/${this.currentUser.uid}/${messageId}`).update({
            read: true,
            readAt: Date.now()
        });
    }

    updateMessageBadge(count) {
        const badge = document.getElementById('messageBadge');
        if (badge) {
            badge.textContent = count || '';
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        const toastTitle = document.getElementById('toastTitle');
        const toastBody = document.getElementById('toastBody');
        
        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        
        toastTitle.innerHTML = `<i class="${icons[type]} me-2"></i>${type.charAt(0).toUpperCase() + type.slice(1)}`;
        toastBody.textContent = message;
        
        this.notificationToast.show();
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    // Profile form submission
    initializeProfileForm() {
        const profileForm = document.getElementById('profileForm');
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });
    }

    async updateProfile() {
        const profileData = {
            name: document.getElementById('profileName').value,
            phone: document.getElementById('profilePhone').value,
            email: document.getElementById('profileEmail').value,
            license: document.getElementById('profileLicense').value,
            updatedAt: Date.now()
        };

        try {
            await database.ref(`driverInfo/${this.currentUser.uid}`).update(profileData);
            this.driverData = { ...this.driverData, ...profileData };
            this.updateDriverInfo();
            this.showNotification('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Error updating profile', 'error');
        }
    }

    refreshMessages() {
        this.loadMessages();
        this.showNotification('Messages refreshed', 'info');
    }

    logout() {
        if (this.isTracking) {
            this.stopTracking();
        }
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        auth.signOut().then(() => {
            window.location.href = 'driverlogin.html';
        }).catch(error => {
            console.error('Error logging out:', error);
            this.showNotification('Error logging out', 'error');
        });
    }
}

// Initialize Driver Panel when DOM is loaded
let driverPanel;
document.addEventListener('DOMContentLoaded', () => {
    driverPanel = new DriverPanel();
});

// Make functions globally available
window.showSection = (sectionId) => driverPanel.showSection(sectionId);
window.refreshMessages = () => driverPanel.refreshMessages();
window.logout = () => driverPanel.logout(); 