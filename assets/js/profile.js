// Profile JavaScript

// Load profile data
async function loadProfileData() {
    try {
        if (!authManager.currentUserProfile) {
            return;
        }
        
        const user = authManager.currentUserProfile;
        
        // Populate profile form
        document.getElementById('profileUsername').value = user.userName || '';
        document.getElementById('profileEnglishName').value = user.englishName || '';
        document.getElementById('profileArabicName').value = user.arabicName || '';
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profilePreferredLanguage').value = user.preferredLanguage || 'en';
        
        // Load account activity
        await loadAccountActivity();
    } catch (error) {
        console.error('Error loading profile data:', error);
        showNotification('Error loading profile data', 'error');
    }
}

// Load account activity
async function loadAccountActivity() {
    try {
        const user = authManager.currentUserProfile;
        
        // Member since
        const memberSince = user.createdAt ? formatDate(user.createdAt) : 'Unknown';
        document.getElementById('memberSince').textContent = memberSince;
        
        // Last login (simplified - in real app, this would come from user activity logs)
        document.getElementById('lastLogin').textContent = 'Unknown';
        
        // Total purchases
        const purchasesSnapshot = await database.ref('purchases')
            .orderByChild('addedBy')
            .equalTo(authManager.currentUser.uid)
            .once('value');
        
        let totalPurchases = 0;
        let totalSpent = 0;
        
        purchasesSnapshot.forEach(childSnapshot => {
            const purchase = childSnapshot.val();
            if (!purchase.isDeleted) {
                totalPurchases++;
                totalSpent += purchase.totalPrice || 0;
            }
        });
        
        document.getElementById('totalPurchases').textContent = totalPurchases;
        document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
    } catch (error) {
        console.error('Error loading account activity:', error);
    }
}

// Setup profile form
function setupProfileForm() {
    const profileForm = document.getElementById('profileForm');
    
    // Handle form submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const updateData = {
                englishName: document.getElementById('profileEnglishName').value,
                arabicName: document.getElementById('profileArabicName').value,
                email: document.getElementById('profileEmail').value,
                preferredLanguage: document.getElementById('profilePreferredLanguage').value,
                updatedAt: dateManager.getCurrentDateInfo()
            };
            
            // Update profile in database
            await database.ref(`users/${authManager.currentUser.uid}`).update(updateData);
            
            // Update email in Firebase Auth if changed
            if (updateData.email !== authManager.currentUser.email) {
                await auth.currentUser.updateEmail(updateData.email);
            }
            
            // Update local profile
            Object.assign(authManager.currentUserProfile, updateData);
            
            // Update UI
            updateUserInfo();
            
            // Log action
            await logAction('UPDATE_PROFILE', 'users', authManager.currentUser.uid, {}, updateData);
            
            showNotification('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification('Error updating profile: ' + error.message, 'error');
        }
    });
}

// Setup change password form
function setupChangePasswordForm() {
    const changePasswordForm = document.getElementById('changePasswordForm');
    const newPassword = document.getElementById('newPassword');
    const newPasswordStrength = document.getElementById('newPasswordStrength');
    
    // Handle form submission
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const currentPassword = document.getElementById('currentPassword').value;
            const newPasswordValue = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;
            
            // Validate passwords match
            if (newPasswordValue !== confirmNewPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }
            
            // Verify current password
            const user = authManager.currentUserProfile;
            const isCurrentPasswordValid = await passwordManager.verifyPassword(currentPassword, user.passwordHash);
            
            if (!isCurrentPasswordValid) {
                showNotification('Current password is incorrect', 'error');
                return;
            }
            
            // Update password in Firebase Auth
            await auth.currentUser.updatePassword(newPasswordValue);
            
            // Create new password hash
            const passwordHash = await passwordManager.createHash(newPasswordValue);
            
            // Update password in database
            await database.ref(`users/${authManager.currentUser.uid}`).update({
                passwordHash: passwordHash,
                updatedAt: dateManager.getCurrentDateInfo()
            });
            
            // Log action
            await logAction('CHANGE_PASSWORD', 'users', authManager.currentUser.uid, {}, { passwordChanged: true });
            
            showNotification('Password changed successfully', 'success');
            
            // Reset form
            changePasswordForm.reset();
            newPasswordStrength.innerHTML = '';
        } catch (error) {
            console.error('Error changing password:', error);
            showNotification('Error changing password: ' + error.message, 'error');
        }
    });
    
    // Password strength indicator
    newPassword.addEventListener('input', (e) => {
        const password = e.target.value;
        const strength = passwordManager.checkPasswordStrength(password);
        
        if (!password) {
            newPasswordStrength.innerHTML = '';
            return;
        }
        
        let strengthClass = 'strength-weak';
        if (strength.strength === 'Medium') strengthClass = 'strength-medium';
        if (strength.strength === 'Strong') strengthClass = 'strength-strong';
        if (strength.strength === 'Very Strong') strengthClass = 'strength-very-strong';
        
        newPasswordStrength.innerHTML = `
            <div class="password-strength ${strengthClass}">
                <div class="strength-bar" style="width: ${strength.score * 10}%"></div>
                <span>${strength.strength}</span>
            </div>
            <div class="password-feedback">
                ${strength.feedback.map(f => `<div>${f}</div>`).join('')}
            </div>
        `;
    });
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

// Initialize profile page
document.addEventListener('DOMContentLoaded', () => {
    // Setup forms
    setupProfileForm();
    setupChangePasswordForm();
    
    // Load profile data if we're on profile page
    if (getCurrentPage() === 'profile') {
        loadProfileData();
    }
});

// Export functions for use in other files
window.loadProfileData = loadProfileData;