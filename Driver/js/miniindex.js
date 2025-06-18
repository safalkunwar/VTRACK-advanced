// Check if the user is logged in
auth.onAuthStateChanged(user => {
    if (user) {
        // User is logged in, redirect to the dashboard
        window.location.href = 'driver-dashboard.html';
    } else {
        // User is not logged in, redirect to the login page
        window.location.href = 'driverlogin.html';
    }
}); 