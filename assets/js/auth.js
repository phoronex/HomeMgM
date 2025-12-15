class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authListeners = [];
    }

    // Initialize auth state listener
    init() {
        auth.onAuthStateChanged(user => {
            this.currentUser = user;
            this.notifyListeners(user);
            
            if (user) {
                // Load user profile
                this.loadUserProfile(user.uid);
                
                // Apply user's language preference
                database.ref(`users/${user.uid}/preferredLanguage`).once('value')
                    .then(snapshot => {
                        const preferredLang = snapshot.val();
                        if (preferredLang && preferredLang !== languageManager.currentLang) {
                            languageManager.switchLanguage(preferredLang);
                        }
                    });
            } else {
                // Redirect to login if not on login page
                if (!window.location.pathname.includes('index.html')) {
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // Load user profile from database
    async loadUserProfile(uid) {
        try {
            const snapshot = await database.ref(`users/${uid}`).once('value');
            const userData = snapshot.val();
            
            if (userData) {
                this.currentUserProfile = {
                    uid: uid,
                    ...userData
                };
                
                // Remove passwordHash from profile for security
                delete this.currentUserProfile.passwordHash;
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // Register new user with secure password hashing
    async register(userData) {
        try {
            // Validate input
            if (!userData.userName || !userData.password || !userData.apartmentId || !userData.email) {
                throw new Error('Missing required fields');
            }
            
            // Validate password strength
            const passwordStrength = passwordManager.checkPasswordStrength(userData.password);
            if (passwordStrength.score < 3) {
                throw new Error('Password is too weak. Please use a stronger password.');
            }
            
            // Check if username already exists
            const usernameSnapshot = await database.ref('users').orderByChild('userName').equalTo(userData.userName).once('value');
            if (usernameSnapshot.exists()) {
                throw new Error('Username already exists');
            }
            
            // Check if email already exists
            try {
                const existingMethods = await auth.fetchSignInMethodsForEmail(userData.email);
                if (existingMethods.length > 0) {
                    throw new Error('Email already in use');
                }
            } catch (error) {
                if (error.code !== 'auth/user-not-found') {
                    throw error;
                }
            }
            
            // Create secure password hash (NOT plain text)
            const passwordHash = await passwordManager.createHash(userData.password);
            
            // Create user in Firebase Auth with email/password
            const authResult = await auth.createUserWithEmailAndPassword(userData.email, userData.password);
            
            // Create user profile in database
            const dateInfo = dateManager.getCurrentDateInfo();
            const userProfile = {
                arabicName: userData.arabicName || '',
                englishName: userData.englishName || '',
                userName: userData.userName,
                email: userData.email,
                passwordHash: passwordHash, // Securely hashed password
                apartmentId: userData.apartmentId,
                role: userData.role || 'apartmentUser',
                preferredLanguage: userData.preferredLanguage || 'en',
                isActive: true,
                createdAt: dateInfo,
                createdBy: authResult.user.uid,
                updatedAt: {
                    unix: dateInfo.unix,
                    iso: dateInfo.iso
                }
            };
            
            await database.ref(`users/${authResult.user.uid}`).set(userProfile);
            
            // Log registration
            await this.logAuthAction('USER_REGISTERED', authResult.user.uid, {
                userName: userData.userName,
                apartmentId: userData.apartmentId,
                role: userProfile.role
            });
            
            return {
                success: true,
                uid: authResult.user.uid
            };
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Login user with secure password verification
    async login(userName, password) {
        try {
            // Find user by username
            const snapshot = await database.ref('users').orderByChild('userName').equalTo(userName).once('value');
            
            if (!snapshot.exists()) {
                throw new Error('Invalid username or password');
            }
            
            let userId;
            let userData;
            
            snapshot.forEach(childSnapshot => {
                userId = childSnapshot.key;
                userData = childSnapshot.val();
            });
            
            // Check if user is active
            if (userData.isActive === false) {
                throw new Error('Account is deactivated. Please contact administrator.');
            }
            
            // Verify password against hashed version
            const isValidPassword = await passwordManager.verifyPassword(password, userData.passwordHash);
            
            if (!isValidPassword) {
                throw new Error('Invalid username or password');
            }
            
            // Sign in with Firebase Auth using email
            await auth.signInWithEmailAndPassword(userData.email, password);
            
            // Update last login timestamp
            await database.ref(`users/${userId}`).update({
                lastLogin: dateManager.getCurrentDateInfo()
            });
            
            // Log successful login
            await this.logAuthAction('USER_LOGIN', userId, {
                userName: userData.userName
            });
            
            return {
                success: true,
                uid: userId,
                role: userData.role
            };
        } catch (error) {
            console.error('Login error:', error);
            
            // Log failed login attempt
            await this.logAuthAction('LOGIN_FAILED', null, {
                userName: userName,
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Logout user
    async logout() {
        try {
            const userId = this.currentUser ? this.currentUser.uid : null;
            
            // Log logout
            if (userId) {
                await this.logAuthAction('USER_LOGOUT', userId, {});
            }
            
            await auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Change password with secure hashing
    async changePassword(currentPassword, newPassword) {
        try {
            const user = this.currentUser;
            if (!user) {
                throw new Error('No user logged in');
            }
            
            // Validate new password strength
            const passwordStrength = passwordManager.checkPasswordStrength(newPassword);
            if (passwordStrength.score < 3) {
                throw new Error('New password is too weak. Please use a stronger password.');
            }
            
            // Get user data
            const userSnapshot = await database.ref(`users/${user.uid}`).once('value');
            const userData = userSnapshot.val();
            
            // Verify current password
            const isValidPassword = await passwordManager.verifyPassword(currentPassword, userData.passwordHash);
            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }
            
            // Update password in Firebase Auth
            await user.updatePassword(newPassword);
            
            // Create new password hash
            const newPasswordHash = await passwordManager.createHash(newPassword);
            
            // Update password hash in database
            await database.ref(`users/${user.uid}`).update({
                passwordHash: newPasswordHash,
                passwordChangedAt: dateManager.getCurrentDateInfo(),
                updatedAt: dateManager.getCurrentDateInfo()
            });
            
            // Log password change
            await this.logAuthAction('PASSWORD_CHANGED', user.uid, {});
            
            return { success: true };
        } catch (error) {
            console.error('Change password error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Reset user password (Admin only)
    async resetUserPassword(targetUserId, newPassword) {
        try {
            // Check if current user is admin
            if (!this.hasRole('systemAdmin') && !this.hasRole('apartmentAdmin')) {
                throw new Error('Insufficient permissions');
            }
            
            // Validate new password strength
            const passwordStrength = passwordManager.checkPasswordStrength(newPassword);
            if (passwordStrength.score < 3) {
                throw new Error('Password is too weak. Please use a stronger password.');
            }
            
            // Get target user data
            const userSnapshot = await database.ref(`users/${targetUserId}`).once('value');
            const userData = userSnapshot.val();
            
            // Check if apartment admin is trying to reset password for user in different apartment
            if (this.hasRole('apartmentAdmin') && 
                userData.apartmentId !== this.currentUserProfile.apartmentId) {
                throw new Error('You can only reset passwords for users in your apartment');
            }
            
            // Create new password hash
            const newPasswordHash = await passwordManager.createHash(newPassword);
            
            // Update password hash in database
            await database.ref(`users/${targetUserId}`).update({
                passwordHash: newPasswordHash,
                passwordResetBy: this.currentUser.uid,
                passwordResetAt: dateManager.getCurrentDateInfo(),
                updatedAt: dateManager.getCurrentDateInfo()
            });
            
            // Log password reset
            await this.logAuthAction('PASSWORD_RESET', targetUserId, {
                resetBy: this.currentUser.uid
            });
            
            return { 
                success: true,
                message: 'Password has been reset successfully'
            };
        } catch (error) {
            console.error('Reset password error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Add auth state listener
    addAuthListener(callback) {
        this.authListeners.push(callback);
        
        // Call immediately with current state
        callback(this.currentUser);
    }

    // Remove auth state listener
    removeAuthListener(callback) {
        const index = this.authListeners.indexOf(callback);
        if (index > -1) {
            this.authListeners.splice(index, 1);
        }
    }

    // Notify all listeners of auth state change
    notifyListeners(user) {
        this.authListeners.forEach(callback => {
            callback(user);
        });
    }

    // Check if current user has specific role
    hasRole(role) {
        if (!this.currentUserProfile) return false;
        return this.currentUserProfile.role === role;
    }

    // Check if current user can access apartment
    canAccessApartment(apartmentId) {
        if (!this.currentUserProfile) return false;
        
        // System admins can access all apartments
        if (this.currentUserProfile.role === 'systemAdmin') return true;
        
        // Otherwise, check if user belongs to the apartment
        return this.currentUserProfile.apartmentId === apartmentId;
    }

    // Log authentication-related actions
    async logAuthAction(action, userId, metadata) {
        try {
            const logEntry = {
                action: action,
                userId: userId,
                metadata: metadata,
                timestamp: dateManager.getCurrentDateInfo(),
                ipAddress: await this.getClientIP()
            };
            
            await database.ref('auth_logs').push(logEntry);
        } catch (error) {
            console.error('Error logging auth action:', error);
        }
    }

    // Get client IP address (simplified)
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }
}

// Initialize globally
const authManager = new AuthManager();
