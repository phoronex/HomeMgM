// System Administration JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize language manager
    await languageManager.init();
    
    // Initialize auth manager
    authManager.init();
    
    // Check if user is logged in and has system admin role
    authManager.addAuthListener(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        // Load user profile
        await authManager.loadUserProfile(user.uid);
        
        // Check if user has system admin role
        if (!authManager.hasRole('systemAdmin')) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Load system admin data
        loadSystemData();
        
        // Set up event listeners
        setupEventListeners();
    });
    
    // Setup language switcher
    setupLanguageSwitcher();
    
    // Setup modal close buttons
    setupModalCloseButtons();
});

// Load system data
async function loadSystemData() {
    try {
        // Load dashboard stats
        await loadDashboardStats();
        
        // Load users
        await loadUsers();
        
        // Load activity log
        await loadActivityLog();
        
        // Load system config
        await loadSystemConfig();
        
        // Load performance metrics
        await loadPerformanceMetrics();
    } catch (error) {
        console.error('Error loading system data:', error);
        showNotification('Error loading system data', 'error');
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Get total users count
        const usersSnapshot = await database.ref('users').once('value');
        const usersCount = usersSnapshot.numChildren();
        document.getElementById('totalUsersCount').textContent = usersCount;
        
        // Get unique apartments count
        const apartments = new Set();
        usersSnapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            if (userData.apartmentId) {
                apartments.add(userData.apartmentId);
            }
        });
        document.getElementById('totalApartmentsCount').textContent = apartments.size;
        
        // Get total purchases count
        const purchasesSnapshot = await database.ref('purchases').once('value');
        const purchasesCount = purchasesSnapshot.numChildren();
        document.getElementById('totalPurchasesCount').textContent = purchasesCount;
        
        // Get last backup date
        const systemSnapshot = await database.ref('system/metadata/lastBackup').once('value');
        const lastBackup = systemSnapshot.val();
        if (lastBackup && lastBackup.formatted) {
            document.getElementById('lastBackupDate').textContent = lastBackup.formatted;
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load users
async function loadUsers() {
    try {
        const usersSnapshot = await database.ref('users').once('value');
        const usersTableBody = document.getElementById('usersTableBody');
        usersTableBody.innerHTML = '';
        
        usersSnapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            const userId = childSnapshot.key;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userData.userName}</td>
                <td>${languageManager.currentLang === 'ar' ? userData.arabicName : userData.englishName}</td>
                <td>${userData.apartmentId}</td>
                <td>${languageManager.getText(userData.role)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary edit-user-btn" data-user-id="${userId}" data-i18n="edit">Edit</button>
                    <button class="btn btn-sm btn-secondary reset-password-btn" data-user-id="${userId}" data-i18n="reset_password">Reset Password</button>
                </td>
            `;
            
            usersTableBody.appendChild(row);
        });
        
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
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load activity log
async function loadActivityLog() {
    try {
        const activityLogSnapshot = await database.ref('backup_transactions').limitToLast(50).once('value');
        const activityLogTableBody = document.getElementById('activityLogTableBody');
        activityLogTableBody.innerHTML = '';
        
        // Convert to array and sort by timestamp descending
        const logs = [];
        activityLogSnapshot.forEach(childSnapshot => {
            logs.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        logs.sort((a, b) => b.performedAt.unix - a.performedAt.unix);
        
        logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${log.performedAt.formatted}</td>
                <td>${languageManager.getText(log.action)}</td>
                <td>${log.performedBy}</td>
                <td>${log.targetTable} - ${log.targetId}</td>
            `;
            
            activityLogTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading activity log:', error);
    }
}

// Load system configuration
async function loadSystemConfig() {
    try {
        const configSnapshot = await database.ref('system/config').once('value');
        const config = configSnapshot.val() || {};
        
        document.getElementById('defaultLanguage').value = config.defaultLanguage || 'en';
        document.getElementById('backupSchedule').value = config.backupSchedule || 'weekly';
    } catch (error) {
        console.error('Error loading system config:', error);
    }
}

// Load performance metrics
async function loadPerformanceMetrics() {
    try {
        // Get storage usage
        const storageUsage = await getStorageUsage();
        document.getElementById('storageUsage').textContent = formatBytes(storageUsage);
        
        // Get database size
        const dbSize = await getDatabaseSize();
        document.getElementById('dbSize').textContent = formatBytes(dbSize);
        
        // Get active connections (simulated)
        document.getElementById('activeConnections').textContent = Math.floor(Math.random() * 10) + 1;
    } catch (error) {
        console.error('Error loading performance metrics:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            showAdminPage(page);
            
            // Update active state
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    // Database tools buttons
    document.getElementById('fullBackupBtn').addEventListener('click', createFullBackup);
    document.getElementById('restoreBackupBtn').addEventListener('click', () => {
        document.getElementById('restoreBackupModal').classList.add('active');
    });
    document.getElementById('resetDbBtn').addEventListener('click', () => {
        document.getElementById('resetDbModal').classList.add('active');
    });
    document.getElementById('exportStatsBtn').addEventListener('click', exportStatistics);
    
    // User management buttons
    document.getElementById('addUserBtn').addEventListener('click', () => {
        openUserModal();
    });
    
    // System configuration buttons
    document.getElementById('saveConfigBtn').addEventListener('click', saveSystemConfig);
    
    // Maintenance buttons
    document.getElementById('rebuildIndexesBtn').addEventListener('click', rebuildIndexes);
    document.getElementById('cleanupBackupsBtn').addEventListener('click', cleanupBackups);
    document.getElementById('optimizeDbBtn').addEventListener('click', optimizeDatabase);
    
    // User form submission
    document.getElementById('userForm').addEventListener('submit', saveUser);
    
    // Password strength indicator
    document.getElementById('password').addEventListener('input', updatePasswordStrength);
    
    // Restore backup confirmation
    document.getElementById('confirmRestoreBtn').addEventListener('click', restoreFromBackup);
    
    // Reset database confirmation
    document.getElementById('confirmText').addEventListener('input', (e) => {
        const confirmBtn = document.getElementById('confirmResetBtn');
        confirmBtn.disabled = e.target.value !== 'RESET';
    });
    document.getElementById('confirmResetBtn').addEventListener('click', resetDatabase);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await authManager.logout();
    });
}

// Show admin page
function showAdminPage(page) {
    // Hide all pages
    document.querySelectorAll('.admin-page').forEach(p => {
        p.style.display = 'none';
    });
    
    // Show selected page
    document.getElementById(`${page}Page`).style.display = 'block';
}

// Setup language switcher
function setupLanguageSwitcher() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            languageManager.switchLanguage(lang);
            
            // Update active state
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Set initial active state
    document.querySelector(`.lang-btn[data-lang="${languageManager.currentLang}"]`).classList.add('active');
}

// Setup modal close buttons
function setupModalCloseButtons() {
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });
    
    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Open user modal
async function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    
    // Reset form
    form.reset();
    
    // Clear password strength indicator
    document.getElementById('passwordStrength').innerHTML = '';
    
    if (userId) {
        // Load user data
        try {
            const userSnapshot = await database.ref(`users/${userId}`).once('value');
            const userData = userSnapshot.val();
            
            document.getElementById('userName').value = userData.userName || '';
            document.getElementById('englishName').value = userData.englishName || '';
            document.getElementById('arabicName').value = userData.arabicName || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('apartmentId').value = userData.apartmentId || '';
            document.getElementById('role').value = userData.role || 'apartmentUser';
            document.getElementById('preferredLanguage').value = userData.preferredLanguage || 'en';
            
            // Store user ID for form submission
            form.setAttribute('data-user-id', userId);
            
            // Change modal title
            document.querySelector('#userModal .modal-title').textContent = languageManager.getText('edit_user');
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Error loading user data', 'error');
            return;
        }
    } else {
        // Remove user ID attribute
        form.removeAttribute('data-user-id');
        
        // Change modal title
        document.querySelector('#userModal .modal-title').textContent = languageManager.getText('add_user');
    }
    
    // Show modal
    modal.classList.add('active');
}

// Save user
async function saveUser(e) {
    e.preventDefault();
    
    const form = e.target;
    const userId = form.getAttribute('data-user-id');
    const isEdit = !!userId;
    
    try {
        const formData = {
            userName: document.getElementById('userName').value,
            englishName: document.getElementById('englishName').value,
            arabicName: document.getElementById('arabicName').value,
            email: document.getElementById('email').value,
            apartmentId: document.getElementById('apartmentId').value,
            role: document.getElementById('role').value,
            preferredLanguage: document.getElementById('preferredLanguage').value
        };
        
        // Validate form data
        if (!formData.userName || !formData.email || !formData.apartmentId) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Check if username already exists (for new users)
        if (!isEdit) {
            const usernameSnapshot = await database.ref('users').orderByChild('userName').equalTo(formData.userName).once('value');
            if (usernameSnapshot.exists()) {
                showNotification('Username already exists', 'error');
                return;
            }
            
            // Check if email already exists in Firebase Auth
            try {
                const existingUser = await auth.fetchSignInMethodsForEmail(formData.email);
                if (existingUser.length > 0) {
                    showNotification('Email already in use', 'error');
                    return;
                }
            } catch (error) {
                console.error('Error checking email:', error);
            }
        }
        
        // Get current date info
        const dateInfo = dateManager.getCurrentDateInfo();
        
        if (isEdit) {
            // Update existing user
            const updateData = {
                ...formData,
                updatedAt: {
                    unix: dateInfo.unix,
                    iso: dateInfo.iso
                }
            };
            
            // Only update password if provided
            const password = document.getElementById('password').value;
            if (password) {
                updateData.passwordHash = await passwordManager.createHash(password);
            }
            
            await database.ref(`users/${userId}`).update(updateData);
            showNotification('User updated successfully', 'success');
        } else {
            // Create new user
            const password = document.getElementById('password').value;
            if (!password) {
                showNotification('Password is required for new users', 'error');
                return;
            }
            
            // Create user in Firebase Auth
            const authResult = await auth.createUserWithEmailAndPassword(formData.email, password);
            
            // Create user profile in database
            const passwordHash = await passwordManager.createHash(password);
            const userProfile = {
                ...formData,
                passwordHash: passwordHash,
                createdAt: dateInfo,
                createdBy: auth.currentUser.uid,
                updatedAt: {
                    unix: dateInfo.unix,
                    iso: dateInfo.iso
                }
            };
            
            await database.ref(`users/${authResult.user.uid}`).set(userProfile);
            showNotification('User created successfully', 'success');
        }
        
        // Close modal
        document.getElementById('userModal').classList.remove('active');
        
        // Reload users
        await loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        showNotification('Error saving user: ' + error.message, 'error');
    }
}

// Reset user password
async function resetUserPassword(userId) {
    try {
        // Generate random password
        const newPassword = generateRandomPassword();
        
        // Get user data
        const userSnapshot = await database.ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();
        
        // Get user email from Firebase Auth
        const userRecord = await auth.getUser(userId);
        
        // Update password in Firebase Auth
        await auth.updateUser(userId, { password: newPassword });
        
        // Update password hash in database
        const passwordHash = await passwordManager.createHash(newPassword);
        await database.ref(`users/${userId}`).update({ 
            passwordHash: passwordHash,
            updatedAt: {
                unix: dateManager.getCurrentDateInfo().unix,
                iso: dateManager.getCurrentDateInfo().iso
            }
        });
        
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

// Update password strength indicator
function updatePasswordStrength(e) {
    const password = e.target.value;
    const strengthContainer = document.getElementById('passwordStrength');
    
    if (!password) {
        strengthContainer.innerHTML = '';
        return;
    }
    
    const strength = passwordManager.checkPasswordStrength(password);
    
    let strengthClass = 'strength-weak';
    if (strength.strength === 'Medium') strengthClass = 'strength-medium';
    if (strength.strength === 'Strong') strengthClass = 'strength-strong';
    if (strength.strength === 'Very Strong') strengthClass = 'strength-very-strong';
    
    strengthContainer.innerHTML = `
        <div class="password-strength ${strengthClass}">
            <div class="strength-bar" style="width: ${strength.score * 10}%"></div>
            <span>${languageManager.getText(strength.strength.toLowerCase().replace(' ', '_'))}</span>
        </div>
        <div class="password-feedback">
            ${strength.feedback.map(f => `<div>${f}</div>`).join('')}
        </div>
    `;
}

// Create full backup
async function createFullBackup() {
    try {
        showNotification('Creating backup...', 'info');
        
        // Get all data
        const snapshot = await database.ref().once('value');
        const data = snapshot.val();
        
        // Create backup data
        const backupData = {
            timestamp: dateManager.getCurrentDateInfo(),
            data: data
        };
        
        // Convert to JSON
        const jsonData = JSON.stringify(backupData, null, 2);
        
        // Create blob
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Update last backup timestamp
        await database.ref('system/metadata/lastBackup').set(dateManager.getCurrentDateInfo());
        
        // Log backup action
        await logAction('CREATE_BACKUP', 'system', 'full_backup', {}, backupData);
        
        // Update UI
        document.getElementById('lastBackupDate').textContent = dateManager.formatDateTime(new Date());
        
        showNotification('Backup created successfully', 'success');
    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification('Error creating backup: ' + error.message, 'error');
    }
}

// Restore from backup
async function restoreFromBackup() {
    try {
        const fileInput = document.getElementById('backupFile');
        const file = fileInput.files[0];
        
        if (!file) {
            showNotification('Please select a backup file', 'error');
            return;
        }
        
        showNotification('Restoring from backup...', 'info');
        
        // Read file
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                
                // Validate backup data
                if (!backupData.data) {
                    throw new Error('Invalid backup file format');
                }
                
                // Get current data for logging
                const currentDataSnapshot = await database.ref().once('value');
                const currentData = currentDataSnapshot.val();
                
                // Restore data
                await database.ref().set(backupData.data);
                
                // Log restore action
                await logAction('RESTORE_BACKUP', 'system', 'full_backup', currentData, backupData.data);
                
                // Close modal
                document.getElementById('restoreBackupModal').classList.remove('active');
                
                // Reset file input
                fileInput.value = '';
                
                showNotification('Database restored successfully', 'success');
                
                // Reload page to reflect changes
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } catch (error) {
                console.error('Error processing backup file:', error);
                showNotification('Error processing backup file: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    } catch (error) {
        console.error('Error restoring from backup:', error);
        showNotification('Error restoring from backup: ' + error.message, 'error');
    }
}

// Reset database
async function resetDatabase() {
    try {
        showNotification('Resetting database...', 'info');
        
        // Get current data for logging
        const currentDataSnapshot = await database.ref().once('value');
        const currentData = currentDataSnapshot.val();
        
        // Clear all data
        await database.ref().set(null);
        
        // Log reset action
        await logAction('RESET_DATABASE', 'system', 'all', currentData, {});
        
        // Close modal
        document.getElementById('resetDbModal').classList.remove('active');
        
        // Reset confirm text
        document.getElementById('confirmText').value = '';
        document.getElementById('confirmResetBtn').disabled = true;
        
        showNotification('Database reset successfully', 'success');
        
        // Reload page to reflect changes
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } catch (error) {
        console.error('Error resetting database:', error);
        showNotification('Error resetting database: ' + error.message, 'error');
    }
}

// Export statistics
async function exportStatistics() {
    try {
        showNotification('Exporting statistics...', 'info');
        
        // Get statistics data
        const stats = await getStatistics();
        
        // Create CSV content
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add headers
        csvContent += "Category,Count\n";
        
        // Add data
        Object.keys(stats).forEach(key => {
            csvContent += `${key},${stats[key]}\n`;
        });
        
        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `statistics_${new Date().toISOString().split('T')[0]}.csv`);
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Statistics exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting statistics:', error);
        showNotification('Error exporting statistics: ' + error.message, 'error');
    }
}

// Get statistics
async function getStatistics() {
    try {
        // Get total users count
        const usersSnapshot = await database.ref('users').once('value');
        const usersCount = usersSnapshot.numChildren();
        
        // Get unique apartments count
        const apartments = new Set();
        usersSnapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            if (userData.apartmentId) {
                apartments.add(userData.apartmentId);
            }
        });
        
        // Get total purchases count
        const purchasesSnapshot = await database.ref('purchases').once('value');
        const purchasesCount = purchasesSnapshot.numChildren();
        
        // Get total vendors count
        const vendorsSnapshot = await database.ref('vendors').once('value');
        const vendorsCount = vendorsSnapshot.numChildren();
        
        // Get total items count
        const itemsSnapshot = await database.ref('items').once('value');
        const itemsCount = itemsSnapshot.numChildren();
        
        // Get total purchases amount
        let totalAmount = 0;
        purchasesSnapshot.forEach(childSnapshot => {
            const purchaseData = childSnapshot.val();
            if (purchaseData.totalPrice) {
                totalAmount += purchaseData.totalPrice;
            }
        });
        
        return {
            'Total Users': usersCount,
            'Total Apartments': apartments.size,
            'Total Purchases': purchasesCount,
            'Total Vendors': vendorsCount,
            'Total Items': itemsCount,
            'Total Purchase Amount': totalAmount.toFixed(2)
        };
    } catch (error) {
        console.error('Error getting statistics:', error);
        throw error;
    }
}

// Save system configuration
async function saveSystemConfig() {
    try {
        const config = {
            defaultLanguage: document.getElementById('defaultLanguage').value,
            backupSchedule: document.getElementById('backupSchedule').value
        };
        
        await database.ref('system/config').set(config);
        
        showNotification('System configuration saved successfully', 'success');
    } catch (error) {
        console.error('Error saving system configuration:', error);
        showNotification('Error saving system configuration: ' + error.message, 'error');
    }
}

// Rebuild indexes
async function rebuildIndexes() {
    try {
        showNotification('Rebuilding indexes...', 'info');
        
        // In a real implementation, this would trigger a backend function
        // For demo purposes, we'll just simulate a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification('Indexes rebuilt successfully', 'success');
    } catch (error) {
        console.error('Error rebuilding indexes:', error);
        showNotification('Error rebuilding indexes: ' + error.message, 'error');
    }
}

// Cleanup old backups
async function cleanupBackups() {
    try {
        showNotification('Cleaning up old backups...', 'info');
        
        // In a real implementation, this would delete old backup files
        // For demo purposes, we'll just simulate a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification('Old backups cleaned up successfully', 'success');
    } catch (error) {
        console.error('Error cleaning up old backups:', error);
        showNotification('Error cleaning up old backups: ' + error.message, 'error');
    }
}

// Optimize database
async function optimizeDatabase() {
    try {
        showNotification('Optimizing database...', 'info');
        
        // In a real implementation, this would trigger a backend optimization process
        // For demo purposes, we'll just simulate a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification('Database optimized successfully', 'success');
    } catch (error) {
        console.error('Error optimizing database:', error);
        showNotification('Error optimizing database: ' + error.message, 'error');
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
            performedBy: auth.currentUser.uid,
            performedAt: dateManager.getCurrentDateInfo()
        };
        
        await database.ref('backup_transactions').push(logEntry);
    } catch (error) {
        console.error('Error logging action:', error);
    }
}

// Get storage usage (simulated)
async function getStorageUsage() {
    // In a real implementation, this would query Firebase for storage usage
    // For demo purposes, we'll return a simulated value
    return Math.floor(Math.random() * 100) * 1024 * 1024; // Random value in bytes
}

// Get database size (simulated)
async function getDatabaseSize() {
    // In a real implementation, this would query Firebase for database size
    // For demo purposes, we'll return a simulated value
    return Math.floor(Math.random() * 50) * 1024 * 1024; // Random value in bytes
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Hide and remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}