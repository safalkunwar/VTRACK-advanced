// Show/hide login/signup forms
function showTab(tabName) {
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tabName}Form`).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
}

// Driver Authentication - Enhanced Firebase Auth System
class DriverAuth {
    constructor() {
        this.currentUser = null;
        this.notificationToast = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        try {
            // Show loading screen
            this.showLoading();
            
            // Initialize Firebase auth listener
            this.setupAuthListener();
            
            // Initialize UI components
            this.initializeUI();
            
            // Hide loading screen
            this.hideLoading();
            
            this.isInitialized = true;
            console.log('Driver Auth initialized successfully');
        } catch (error) {
            console.error('Error initializing Driver Auth:', error);
            this.showError('Failed to initialize authentication system');
        }
    }

    showLoading() {
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    }

    setupAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
                
                // Check if user is a verified driver
                await this.checkDriverVerification(user.uid);
            } else {
                this.currentUser = null;
                console.log('User signed out');
            }
        });
    }

    async checkDriverVerification(userId) {
        try {
            // Check if user exists in driverInfo
            const driverSnapshot = await database.ref(`driverInfo/${userId}`).once('value');
            
            if (driverSnapshot.exists()) {
                const driverData = driverSnapshot.val();
                
                // Allow login regardless of verification status
                console.log('Driver found, redirecting to panel');
                window.location.href = 'DriverPanel.html';
            } else {
                // User exists but not in driverInfo
                this.showNotification('You are not authorized as a driver. Please contact your administrator.', 'error');
                await auth.signOut();
            }
        } catch (error) {
            console.error('Error checking driver verification:', error);
            this.showNotification('Error verifying driver status', 'error');
            await auth.signOut();
        }
    }

    initializeUI() {
        // Initialize form event listeners
        this.initializeFormListeners();
        
        // Initialize password toggles
        this.initializePasswordToggles();
        
        // Initialize toast notifications
        this.initializeToast();
        
        // Check for remember me
        this.checkRememberMe();
    }

    initializeFormListeners() {
        // Login form
        const loginForm = document.getElementById('loginFormElement');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Forgot password form
        const forgotPasswordForm = document.getElementById('forgotPasswordFormElement');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }

        // Signup form
        const signupForm = document.getElementById('signupFormElement');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }
    }

    initializePasswordToggles() {
        const passwordToggles = document.querySelectorAll('.password-toggle');
        
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const input = toggle.parentElement.querySelector('input[type="password"], input[type="text"]');
                const icon = toggle.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            });
        });
    }

    initializeToast() {
        this.notificationToast = new bootstrap.Toast(document.getElementById('notificationToast'));
    }

    checkRememberMe() {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            const emailInput = document.getElementById('loginEmail');
            if (emailInput) {
                emailInput.value = rememberedEmail;
                document.getElementById('rememberMe').checked = true;
            }
        }
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            // Show loading state
            this.setButtonLoading('loginBtn', true);

            // Sign in with Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const userId = userCredential.user.uid;

            // Check if user is a driver (regardless of verification status)
            const driverSnapshot = await database.ref(`driverInfo/${userId}`).once('value');
            
            if (driverSnapshot.exists()) {
                const driverData = driverSnapshot.val();
                
                // Save remember me preference
                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }

                // Update last login
                await database.ref(`driverInfo/${userId}`).update({
                    lastLogin: Date.now(),
                    loginCount: (driverData.loginCount || 0) + 1
                });

                // Show appropriate message based on verification status
                if (driverData.verified === true) {
                    this.showNotification('Login successful! Redirecting...', 'success');
                } else {
                    this.showNotification('Login successful! Your account is pending admin approval.', 'warning');
                }
                
                // Redirect to driver panel
                setTimeout(() => {
                    window.location.href = 'DriverPanel.html';
                }, 1000);
            } else {
                throw new Error('Not authorized as driver');
            }
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'Login failed';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Please try again later';
            } else if (error.message === 'Not authorized as driver') {
                errorMessage = 'You are not authorized as a driver';
            }
            
            this.showNotification(errorMessage, 'error');
        } finally {
            this.setButtonLoading('loginBtn', false);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('forgotEmail').value;

        if (!email) {
            this.showNotification('Please enter your email address', 'error');
            return;
        }

        try {
            this.setButtonLoading('forgotPasswordBtn', true);

            // Check if email exists in driverInfo
            const driverSnapshot = await database.ref('driverInfo').orderByChild('email').equalTo(email).once('value');
            
            if (driverSnapshot.exists()) {
                // Send password reset email
                await auth.sendPasswordResetEmail(email);
                
                this.showNotification('Password reset email sent! Check your inbox.', 'success');
                
                // Clear form
                document.getElementById('forgotEmail').value = '';
                
                // Show login form
                setTimeout(() => {
                    showLogin();
                }, 2000);
            } else {
                this.showNotification('No driver account found with this email', 'error');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            
            let errorMessage = 'Failed to send reset email';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please try again later';
            }
            
            this.showNotification(errorMessage, 'error');
        } finally {
            this.setButtonLoading('forgotPasswordBtn', false);
        }
    }

    async handleSignup() {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const phone = document.getElementById('signupPhone').value;
        const license = document.getElementById('signupLicense').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        // Validation
        if (!name || !email || !phone || !license || !password || !confirmPassword) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters long', 'error');
            return;
        }

        try {
            this.setButtonLoading('signupBtn', true);

            // Check if email already exists
            const existingDriver = await database.ref('driverInfo').orderByChild('email').equalTo(email).once('value');
            if (existingDriver.exists()) {
                this.showNotification('An account with this email already exists', 'error');
                return;
            }

            // Create Firebase Auth account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const userId = userCredential.user.uid;

            // Create driver profile
            const driverProfile = {
                name: name,
                email: email,
                phone: phone,
                license: license,
                verified: false, // Pending admin approval
                status: 'pending',
                rank: 'Bronze', // Default rank
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Save to driverInfo
            await database.ref(`driverInfo/${userId}`).set(driverProfile);

            // Don't sign out - let them log in immediately
            this.showNotification('Account created successfully! You can now log in.', 'success');
            
            // Clear form and show login
            document.getElementById('signupFormElement').reset();
            setTimeout(() => {
                showLogin();
            }, 2000);

        } catch (error) {
            console.error('Signup error:', error);
            
            let errorMessage = 'Failed to create account';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email already exists';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address';
            }
            
            this.showNotification(errorMessage, 'error');
        } finally {
            this.setButtonLoading('signupBtn', false);
        }
    }

    setButtonLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (button) {
            if (loading) {
                button.classList.add('loading');
                button.disabled = true;
            } else {
                button.classList.remove('loading');
                button.disabled = false;
            }
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
        
        if (this.notificationToast) {
            this.notificationToast.show();
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    // Form navigation functions
    showLogin() {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById('loginForm').classList.add('active');
    }

    showForgotPassword() {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById('forgotPasswordForm').classList.add('active');
    }

    showSignup() {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById('signupForm').classList.add('active');
    }
}

// Initialize Driver Auth when DOM is loaded
let driverAuth;
document.addEventListener('DOMContentLoaded', () => {
    driverAuth = new DriverAuth();
});

// Make functions globally available
window.showLogin = () => driverAuth.showLogin();
window.showForgotPassword = () => driverAuth.showForgotPassword();
window.showSignup = () => driverAuth.showSignup(); 