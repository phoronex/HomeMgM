// Users JavaScript
let currentEditingUserId = null;

// Load users data
async function loadUsersData() {
    try {
        const usersSnapshot = await database.ref('users').once('value');
        const usersTable = document.getElementById('usersTable');
        usersTable.innerHTML = '';
        
        const users = [];
        usersSnapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            // Only show users from the same apartment (unless system admin)
            if (authManager.hasRole('systemAdmin') || 
                (authManager.currentUserProfile && user.apartmentId === authManager.currentUserProfile.apartmentId)) {
                users.push({
                    id: childSnapshot.key,
                    ...user
                });
            }
        });
        
        // Sort by name
        users.sort((a, b) => {
            const nameA = languageManager.currentLang === 'ar' ? a.arabicName : a.englishName;
            const nameB = languageManager.currentLang === 'ar' ? b.arabicName : b.englishName;
            return nameA.localeCompare(nameB);
        });
        
        for (const user of users) {
            // Get last login info
            const lastLogin = await getLastLogin(user.id);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.userName}</td>
                <td>${languageManager.currentLang === 'ar' ? user.arabicName : user.englishName}</td>
                <td>${user.email}</td>
                <td>${languageManager.getText(user.role)}</td>
                <td>${lastLogin}</td>
                <td>
                    <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">
                        ${user.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary edit-user-btn" data-user-id="${user.id}" data-i18n="edit">Edit</button>
                    <button class="btn btn-sm btn-secondary reset-password-btn" data-user-id="${user.id}" data-i18n="reset_password">Reset Password</button>
                    <button class="btn btn-sm btn-danger toggle-user-btn" data-user-id="${user.id}" data-active="${user.isActive !== false}" data-i18n="${user.isActive !== false ? 'deactivate' : 'activate'}">${user.isActive !== false ? 'Deactivate' : 'Activate'}</button>
                </td>
            `;
            
            usersTable.appendChild(row);
        }
        
        // Apply translations to dynamically created elements
        languageManager.updateTextContent();
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-user-id');
                openUserModal(userId);
            });
        });
        
        // Add event listeners to reset password buttons
        document.querySelectorAll('.reset-password-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-user-id');
                resetUserPassword(userId);
            });
        });
        
        // Add event listeners to toggle user buttons
        document.querySelectorAll('.toggle-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-user-id');
                const isActive = btn.getAttribute('data-active') === 'true';
                toggleUserStatus(userId, !isActive);
            });
        });
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Error loading users', 'error');
    }
}

// Get last login for a user
async function getLastLogin(userId) {
    try {
        // In a real implementation, this would query user activity logs
        // For demo purposes, we'll return a placeholder
        return 'Unknown';
    } catch (error) {
        console.error('Error getting last login:', error);
        return 'Unknown';
    }
}

// Setup user modal
function setupUserModal() {
    const addUserBtn = document.getElementById('addUserBtn');
    const userModal = document.getElementById('userModal');
    const userForm = document.getElementById('userForm');
    const userPassword = document.getElementById('userPassword');
    const userPasswordStrength = document.getElementById('userPasswordStrength');
    
    // Add event listener to add button
    addUserBtn.addEventListener('click', () => {
        openUserModal();
    });
    
    // Handle form submission
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const userData = {
                userName: document.getElementById('userUsername').value,
                englishName: document.getElementById('userEnglishName').value,
                arabicName: document.getElementById('userArabicName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRole').value,
                preferredLanguage: document.getElementById('userPreferredLanguage').value,
                apartmentId: authManager.currentUserProfile.apartmentId,
                updatedAt: dateManager.getCurrentDateInfo()
            };
            
            if (currentEditingUserId) {
                // Update existing user
                await database.ref(`users/${currentEditingUserId}`).update(userData);
                
                // Log action
                await logAction('UPDATE_USER', 'users', currentEditingUserId, {}, userData);
                
                showNotification('User updated successfully', 'success');
            } else {
                // Add new user
                const password = document.getElementById('userPassword').value;
                if (!password) {
                    showNotification('Password is required for new users', 'error');
                    return;
                }
                
                // Create user in Firebase Auth
                const authResult = await auth.createUserWithEmailAndPassword(userData.email, password);
                
                // Create password hash
                const passwordHash = await passwordManager.createHash(password);
                
                // Add user to database
                userData.passwordHash = passwordHash;
                userData.createdAt = dateManager.getCurrentDateInfo();
                userData.createdBy = auth.currentUser.uid;
                
                const result = await database.ref(`users/${authResult.user.uid}`).set(userData);
                
                // Log action
                await logAction('CREATE_USER', 'users', authResult.user.uid, {}, userData);
                
                showNotification('User created successfully', 'success');
            }
            
            // Close modal
            userModal.classList.remove('active');
            
            // Reset form
            userForm.reset();
            currentEditingUserId = null;
            
            // Reload data
            await loadUsersData();
        } catch (error) {
            console.error('Error saving user:', error);
            showNotification('Error saving user: ' + error.message, 'error');
        }
    });
    
    // Password strength indicator
    userPassword.addEventListener('input', (e) => {
        const password = e.target.value;
        const strength = passwordManager.checkPasswordStrength(password);
        
        if (!password) {
            userPasswordStrength.innerHTML = '';
            return;
        }
        
        let strengthClass = 'strength-weak';
        if (strength.strength === 'Medium') strengthClass = 'strength-medium';
        if (strength.strength === 'Strong') strengthClass = 'strength-strong';
        if (strength.strength === 'Very Strong') strengthClass = 'strength-very-strong';
        
        userPasswordStrength.innerHTML = `
            <div class="password-strength ${strengthClass}">
                <div class="strength-bar" style="width: ${strength.score * 10}%"></div>
                <span>${strength.strength}</span>
            </div>
            <div class="password-feedback">
                ${strength.feedback.map(f => `<div>${f}</div>`).join('')}
            </div>
        `;
    });
    
    // Setup role filter
    const roleFilter = document.getElementById('roleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', filterUsers);
    }
}

// Open user modal
async function openUserModal(userId = null) {
    const userModal = document.getElementById('userModal');
    const userForm = document.getElementById('userForm');
    const modalTitle = userModal.querySelector('.modal-title');
    const userPassword = document.getElementById('userPassword');
    
    // Reset form
    userForm.reset();
    currentEditingUserId = null;
    
    if (userId) {
        // Load user data
        try {
            const userSnapshot = await database.ref(`users/${userId}`).once('value');
            const user = userSnapshot.val();
            
            document.getElementById('userUsername').value = user.userName || '';
            document.getElementById('userEnglishName').value = user.englishName || '';
            document.getElementById('userArabicName').value = user.arabicName || '';
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userRole').value = user.role || 'apartmentUser';
            document.getElementById('userPreferredLanguage').value = user.preferredLanguage || 'en';
            
            currentEditingUserId = userId;
            modalTitle.textContent = languageManager.getText('edit_user');
            
            // Password is optional for existing users
            userPassword.removeAttribute('required');
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Error loading user data', 'error');
            return;
        }
    } else {
        modalTitle.textContent = languageManager.getText('add_user');
        
        // Password is required for new users
        userPassword.setAttribute('required', 'required');
    }
    
    // Show modal
    userModal.classList.add('active');
}

// Reset user password
async function resetUserPassword(userId) {
    try {
        // Generate random password
        const newPassword = generateRandomPassword();
        
        // Get user data
        const userSnapshot = await database.ref(`users/${userId}`).once('value');
        const user = userSnapshot.val();
        
        // Update password in Firebase Auth
        await auth.updateUser(userId, { password: newPassword });
        
        // Update password hash in database
        const passwordHash = await passwordManager.createHash(newPassword);
        await database.ref(`users/${userId}`).update({ 
            passwordHash: passwordHash,
            updatedAt: dateManager.getCurrentDateInfo()
        });
        
        // Log action
        await logAction('RESET_PASSWORD', 'users', userId, {}, { passwordReset: true });
        
        // Show new password to admin
        showNotification(`Password reset successful. New password: ${newPassword}`, 'success');
    } catch (error) {
        console.error('Error resetting password:', error);
        showNotification('Error resetting password: ' + error.message, 'error');
    }
}

// Generate random password
function generateRandomPassword(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
}

// Toggle user status
async function toggleUserStatus(userId, isActive) {
    try {
        await database.ref(`users/${userId}`).update({ 
            isActive: isActive,
            updatedAt: dateManager.getCurrentDateInfo()
        });
        
        // Log action
        await logAction('TOGGLE_USER_STATUS', 'users', userId, {}, { isActive: isActive });
        
        showNotification(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
        
        // Reload data
        await loadUsersData();
    } catch (error) {
        console.error('Error toggling user status:', error);
        showNotification('Error toggling user status: ' + error.message, 'error');
    }
}

// Filter users by role
async function filterUsers() {
    const roleFilter = document.getElementById('roleFilter').value;
    
    try {
        const usersSnapshot = await database.ref('users').once('value');
        const usersTable = document.getElementById('usersTable');
        usersTable.innerHTML = '';
        
        usersSnapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            const userId = childSnapshot.key;
            
            // Filter by role and apartment
            if ((roleFilter && user.role !== roleFilter) ||
                (!authManager.hasRole('systemAdmin') && 
                 authManager.currentUserProfile && 
                 user.apartmentId !== authManager.currentUserProfile.apartmentId)) {
                return;
            }
            
            // Get last login info
            getLastLogin(userId).then(lastLogin => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.userName}</td>
                    <td>${languageManager.currentLang === 'ar' ? user.arabicName : user.englishName}</td>
                    <td>${user.email}</td>
                    <td>${languageManager.getText(user.role)}</td>
                    <td>${lastLogin}</td>
                    <td>
                        <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">
                            ${user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-secondary edit-user-btn" data-user-id="${userId}" data-i18n="edit">Edit</button>
                        <button class="btn btn-sm btn-secondary reset-password-btn" data-user-id="${userId}" data-i18n="reset_password">Reset Password</button>
                        <button class="btn btn-sm btn-danger toggle-user-btn" data-user-id="${userId}" data-active="${user.isActive !== false}" data-i18n="${user.isActive !== false ? 'deactivate' : 'activate'}">${user.isActive !== false ? 'Deactivate' : 'Activate'}</button>
                    </td>
                `;
                
                usersTable.appendChild(row);
                
                // Apply translations to dynamically created elements
                languageManager.updateTextContent();
                
                // Add event listeners to edit buttons
                document.querySelectorAll('.edit-user-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const userId = btn.getAttribute('data-user-id');
                        openUserModal(userId);
                    });
                });
                
                // Add event listeners to reset password buttons
                document.querySelectorAll('.reset-password-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const userId = btn.getAttribute('data-user-id');
                        resetUserPassword(userId);
                    });
                });
                
                // Add event listeners to toggle user buttons
                document.querySelectorAll('.toggle-user-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const userId = btn.getAttribute('data-user-id');
                        const isActive = btn.getAttribute('data-active') === 'true';
                        toggleUserStatus(userId, !isActive);
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error filtering users:', error);
        showNotification('Error filtering users', 'error');
    }
}

// Log action
async function logAction(action, targetTable, targetId, oldData, newData) {
    try {
        const logEntry = {
            action: action,
            targetTable: targetTable,
            targetId: targetId,
            oldData: oldData,
            newData: newData,
            performedBy: authManager.currentUser.uid,
            performedAt: dateManager.getCurrentDateInfo()
        };
        
        await database.ref('backup_transactions').push(logEntry);
    } catch (error) {
        console.error('Error logging action:', error);
    }
}

// Initialize users page
document.addEventListener('DOMContentLoaded', () => {
    // Setup user modal
    setupUserModal();
    
    // Load users data if we're on users page
    if (getCurrentPage() === 'users') {
        loadUsersData();
    }
});

// Export functions for use in other files
window.loadUsersData = loadUsersData;