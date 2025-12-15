class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentUserProfile = null;
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
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // Register new user
    async register(userData) {
        try {
            // Validate input
            if (!userData.userName || !userData.password || !userData.apartmentId) {
                throw new Error('Missing required fields');
            }

            // Check if username already exists
            const usernameSnapshot = await database.ref('users').orderByChild('userName').equalTo(userData.userName).once('value');
            if (usernameSnapshot.exists()) {
                throw new Error('Username already exists');
            }

            // Check if email already exists in Firebase Auth
            try {
                const existingUser = await auth.fetchSignInMethodsForEmail(userData.email);
                if (existingUser.length > 0) {
                    throw new Error('Email already in use');
                }
            } catch (error) {
                // If error is not about existing email, continue
                if (error.code !== 'auth/user-not-found') {
                    throw error;
                }
            }

            // Hash password
            const passwordHash = await passwordManager.createHash(userData.password);

            // Create user in Firebase Auth
            const authResult = await auth.createUserWithEmailAndPassword(userData.email, userData.password);

            // Create user profile in database
            const dateInfo = dateManager.getCurrentDateInfo();
            const userProfile = {
                arabicName: userData.arabicName || '',
                englishName: userData.englishName || '',
                userName: userData.userName,
                passwordHash: passwordHash,
                apartmentId: userData.apartmentId,
                role: userData.role || 'apartmentUser',
                preferredLanguage: userData.preferredLanguage || 'en',
                createdAt: dateInfo,
                createdBy: authResult.user.uid,
                updatedAt: {
                    unix: dateInfo.unix,
                    iso: dateInfo.iso
                }
            };

            await database.ref(`users/${authResult.user.uid}`).set(userProfile);

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

    // Login user
    async login(userName, password) {
        try {
            // Find user by username
            const snapshot = await database.ref('users').orderByChild('userName').equalTo(userName).once('value');

            if (!snapshot.exists()) {
                throw new Error('User not found');
            }

            let userId;
            let userData;

            snapshot.forEach(childSnapshot => {
                userId = childSnapshot.key;
                userData = childSnapshot.val();
            });

            // Verify password
            const isValidPassword = await passwordManager.verifyPassword(password, userData.passwordHash);

            if (!isValidPassword) {
                throw new Error('Invalid password');
            }

            // Get user email from Firebase Auth
            try {
                const userRecord = await auth.getUser(userId);

                // Sign in with Firebase Auth
                await auth.signInWithEmailAndPassword(userRecord.email, password);

                return {
                    success: true,
                    uid: userId,
                    role: userData.role
                };
            } catch (authError) {
                // If user doesn't exist in Auth, create them
                if (authError.code === 'auth/user-not-found') {
                    // Create user in Firebase Auth
                    const authResult = await auth.createUserWithEmailAndPassword(
                        `${userName}@temp.local`, // Temporary email
                        password
                    );

                    // Update email in Firebase Auth
                    await authResult.user.updateEmail(userData.email);

                    // Sign in
                    await auth.signInWithEmailAndPassword(userData.email, password);

                    return {
                        success: true,
                        uid: userId,
                        role: userData.role
                    };
                } else {
                    throw authError;
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Logout user
    async logout() {
        try {
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
}

// Initialize globally
const authManager = new AuthManager();
