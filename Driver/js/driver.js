let driverId = null;
let map = null;
let currentPositionMarker = null;
let isTracking = false;
let watchId = null; 

function loadStats() {
    if (!driverId) return;

    database.ref(`drivers/${driverId}`).on('value', snapshot => {
        const driverData = snapshot.val() || {};
        const stats = driverData.stats || {};
        
        document.getElementById('avgRating').textContent = 
            stats.averageRating?.toFixed(1) || '0.0';
        document.getElementById('distanceToday').textContent = 
            `${stats.distanceToday?.toFixed(1) || '0'} km`;
        document.getElementById('hoursActive').textContent = 
            `${stats.hoursActive || '0'}h`;
    });
}

function loadRatings() {
    if (!driverId) return;

    database.ref(`ratings/${driverId}`).orderByChild('timestamp').limitToLast(10)
        .on('value', snapshot => {
            const container = document.getElementById('ratingsContainer');
            if (!container) return;
            
            container.innerHTML = '';
            const ratings = [];
            
            snapshot.forEach(child => {
                ratings.unshift(child.val());
            });
            
            if (ratings.length === 0) {
                container.innerHTML = '<p>No ratings yet</p>';
                return;
            }
            
            ratings.forEach(rating => {
                container.innerHTML += `
                    <div class="rating-card">
                        <div class="rating-stars">
                            ${'★'.repeat(rating.rating)}${'☆'.repeat(5-rating.rating)}
                        </div>
                        <p>${rating.comment || 'No comment provided'}</p>
                        <small>${new Date(rating.timestamp).toLocaleString()}</small>
                    </div>
                `;
            });
        });
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = '../index.html';
    }).catch(error => {
        console.error('Error logging out:', error);
        showNotification('Error logging out', 'error');
    });
} 