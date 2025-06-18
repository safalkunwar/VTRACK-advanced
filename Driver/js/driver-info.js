document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('driverID'); // Get the logged-in driver's ID

    if (!userId) {
        window.location.href = 'driverlogin.html'; // Redirect to login if no user ID
        return;
    }

    // Load driver information
    database.ref(`driverInfo/${userId}`).once('value').then(snapshot => {
        const driverData = snapshot.val();
        if (driverData) {
            document.getElementById('driverName').textContent = driverData.name;
            document.getElementById('driverId').textContent = userId;
            document.getElementById('driverEmail').textContent = driverData.email || 'N/A';
            document.getElementById('assignedBus').textContent = driverData.assignedBus || 'N/A';
            document.getElementById('assignedRoute').textContent = driverData.assignedRoute || 'N/A';
            document.getElementById('driverRating').textContent = driverData.rating || 'N/A';
        } else {
            document.getElementById('driverProfile').innerHTML = '<p>No driver information found.</p>';
        }
    }).catch(error => {
        console.error('Error loading driver info:', error);
        document.getElementById('driverProfile').innerHTML = '<p>Error loading driver information.</p>';
    });
}); 