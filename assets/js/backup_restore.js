// Backup & Restore JavaScript

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await initializeBackupRestore();
});

async function initializeBackupRestore() {
    // Check user role and adjust UI
    const user = authManager.currentUserProfile;
    if (!user) return;
    
    const restoreSection = document.getElementById('restoreSection');
    const systemAdminBackupOptions = document.getElementById('systemAdminBackupOptions');
    const systemAdminRestoreOptions = document.getElementById('systemAdminRestoreOptions');
    
    // Show/hide options based on role
    if (user.role === 'systemAdmin') {
        systemAdminBackupOptions.style.display = 'block';
        systemAdminRestoreOptions.style.display = 'block';
        await loadApartmentsList();
    } else if (user.role === 'apartmentAdmin') {
        restoreSection.style.display = 'block';
    } else if (user.role === 'apartmentUser') {
        restoreSection.style.display = 'none';
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load backup history
    await loadBackupHistory();
}

// Setup event listeners
function setupEventListeners() {
    const backupScope = document.getElementById('backupScope');
    const createBackupBtn = document.getElementById('createBackupBtn');
    const restoreFile = document.getElementById('restoreFile');
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    
    if (backupScope) {
        backupScope.addEventListener('change', (e) => {
            const apartmentSelector = document.getElementById('apartmentSelector');
            apartmentSelector.style.display = e.target.value === 'apartment' ? 'block' : 'none';
        });
    }
    
    createBackupBtn.addEventListener('click', createBackup);
    
    restoreFile.addEventListener('change', (e) => {
        restoreBackupBtn.disabled = !e.target.files.length;
    });
    
    restoreBackupBtn.addEventListener('click', restoreBackup);
}

// Load apartments list for system admin
async function loadApartmentsList() {
    try {
        const usersSnapshot = await database.ref('users').once('value');
        const apartments = new Set();
        
        usersSnapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            if (userData.apartmentId) {
                apartments.add(userData.apartmentId);
            }
        });
        
        const apartmentSelect = document.getElementById('apartmentSelect');
        apartmentSelect.innerHTML = '<option value="" data-i18n="select_apartment">Select Apartment</option>';
        
        apartments.forEach(apartmentId => {
            const option = document.createElement('option');
            option.value = apartmentId;
            option.textContent = `Apartment ${apartmentId}`;
            apartmentSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading apartments:', error);
    }
}

// Create backup
async function createBackup() {
    try {
        showNotification('Creating backup...', 'info');
        
        const user = authManager.currentUserProfile;
        const backupFormat = document.getElementById('backupFormat').value;
        const includeDeleted = document.getElementById('includeDeletedItems').checked;
        
        let backupData = {};
        let scope = 'apartment';
        let apartmentId = user.apartmentId;
        
        // Determine backup scope
        if (user.role === 'systemAdmin') {
            const backupScope = document.getElementById('backupScope').value;
            if (backupScope === 'all') {
                scope = 'all';
                backupData = await getFullSystemBackup(includeDeleted);
            } else {
                apartmentId = document.getElementById('apartmentSelect').value;
                if (!apartmentId) {
                    showNotification('Please select an apartment', 'error');
                    return;
                }
                backupData = await getApartmentBackup(apartmentId, includeDeleted);
            }
        } else {
            backupData = await getApartmentBackup(apartmentId, includeDeleted);
        }
        
        // Create backup metadata
        const metadata = {
            version: '1.0',
            timestamp: dateManager.getCurrentDateInfo(),
            scope: scope,
            apartmentId: scope === 'apartment' ? apartmentId : null,
            createdBy: user.userName,
            createdById: authManager.currentUser.uid,
            includeDeleted: includeDeleted,
            format: backupFormat
        };
        
        const backup = {
            metadata: metadata,
            data: backupData
        };
        
        // Encrypt if needed
        let fileContent;
        let fileExtension;
        
        if (backupFormat === 'encrypted') {
            fileContent = await encryptBackup(backup);
            fileExtension = 'enc';
        } else {
            fileContent = JSON.stringify(backup, null, 2);
            fileExtension = 'json';
        }
        
        // Save backup record
        await saveBackupRecord(metadata, fileContent.length);
        
        // Download backup file
        const blob = new Blob([fileContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_${scope}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('Backup created successfully', 'success');
        await loadBackupHistory();
    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification('Error creating backup: ' + error.message, 'error');
    }
}

// Get full system backup
async function getFullSystemBackup(includeDeleted) {
    const data = {};
    const tables = ['users', 'purchases', 'vendors', 'items', 'system'];
    
    for (const table of tables) {
        const snapshot = await database.ref(table).once('value');
        const tableData = snapshot.val() || {};
        
        if (!includeDeleted && table !== 'users' && table !== 'system') {
            // Filter out deleted items
            const filtered = {};
            for (const [key, value] of Object.entries(tableData)) {
                if (!value.isDeleted) {
                    filtered[key] = value;
                }
            }
            data[table] = filtered;
        } else {
            data[table] = tableData;
        }
    }
    
    return data;
}

// Get apartment-specific backup
async function getApartmentBackup(apartmentId, includeDeleted) {
    const data = {};
    
    // Get apartment users
    const usersSnapshot = await database.ref('users').orderByChild('apartmentId').equalTo(apartmentId).once('value');
    data.users = usersSnapshot.val() || {};
    
    // Get apartment purchases
    const purchasesSnapshot = await database.ref('purchases').orderByChild('apartmentId').equalTo(apartmentId).once('value');
    const purchases = purchasesSnapshot.val() || {};
    if (!includeDeleted) {
        const filtered = {};
        for (const [key, value] of Object.entries(purchases)) {
            if (!value.isDeleted) {
                filtered[key] = value;
            }
        }
        data.purchases = filtered;
    } else {
        data.purchases = purchases;
    }
    
    // Get apartment-specific vendors and items (based on purchases)
    const vendorIds = new Set();
    const itemIds = new Set();
    
    for (const purchase of Object.values(data.purchases)) {
        if (purchase.vendorId) vendorIds.add(purchase.vendorId);
        if (purchase.itemId) itemIds.add(purchase.itemId);
    }
    
    // Get vendors
    data.vendors = {};
    for (const vendorId of vendorIds) {
        const vendorSnapshot = await database.ref(`vendors/${vendorId}`).once('value');
        if (vendorSnapshot.exists()) {
            data.vendors[vendorId] = vendorSnapshot.val();
        }
    }
    
    // Get items
    data.items = {};
    for (const itemId of itemIds) {
        const itemSnapshot = await database.ref(`items/${itemId}`).once('value');
        if (itemSnapshot.exists()) {
            data.items[itemId] = itemSnapshot.val();
        }
    }
    
    return data;
}

// Encrypt backup
async function encryptBackup(backup) {
    const password = prompt('Enter encryption password:');
    if (!password) throw new Error('Encryption password is required');
    
    const jsonString = JSON.stringify(backup);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    
    // Simple encryption using Web Crypto API
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );
    
    // Combine salt, iv, and encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode.apply(null, result));
}

// Decrypt backup
async function decryptBackup(encryptedData) {
    const password = prompt('Enter decryption password:');
    if (!password) throw new Error('Decryption password is required');
    
    // Decode base64
    const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract salt, iv, and data
    const salt = encrypted.slice(0, 16);
    const iv = encrypted.slice(16, 28);
    const data = encrypted.slice(28);
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );
    
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decrypted);
    return JSON.parse(jsonString);
}

// Save backup record
async function saveBackupRecord(metadata, size) {
    try {
        const record = {
            ...metadata,
            size: size,
            sizeFormatted: formatBytes(size)
        };
        
        await database.ref('backupHistory').push(record);
    } catch (error) {
        console.error('Error saving backup record:', error);
    }
}

// Restore backup
async function restoreBackup() {
    try {
        const confirmed = confirm('Are you sure you want to restore this backup? This will replace your current data and cannot be undone.');
        if (!confirmed) return;
        
        showNotification('Restoring backup...', 'info');
        
        const file = document.getElementById('restoreFile').files[0];
        if (!file) {
            showNotification('Please select a backup file', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let backup;
                
                // Check if encrypted
                if (file.name.endsWith('.enc')) {
                    backup = await decryptBackup(e.target.result);
                } else {
                    backup = JSON.parse(e.target.result);
                }
                
                // Validate backup
                if (!backup.metadata || !backup.data) {
                    throw new Error('Invalid backup file format');
                }
                
                const user = authManager.currentUserProfile;
                
                // Check permissions
                if (user.role === 'apartmentUser') {
                    showNotification('You do not have permission to restore backups', 'error');
                    return;
                }
                
                // Check if user can restore this backup
                if (user.role === 'apartmentAdmin' && backup.metadata.apartmentId !== user.apartmentId) {
                    showNotification('You can only restore backups for your apartment', 'error');
                    return;
                }
                
                // Get restore options for system admin
                const restoreOptions = {};
                if (user.role === 'systemAdmin') {
                    document.querySelectorAll('input[name="restoreOption"]:checked').forEach(checkbox => {
                        restoreOptions[checkbox.value] = true;
                    });
                } else {
                    // Apartment admin restores everything
                    restoreOptions.users = true;
                    restoreOptions.purchases = true;
                    restoreOptions.vendors = true;
                    restoreOptions.items = true;
                }
                
                // Restore data
                await restoreData(backup.data, restoreOptions);
                
                // Log restore action
                await logAction('RESTORE_BACKUP', 'system', 'backup', {}, backup.metadata);
                
                showNotification('Backup restored successfully. Please refresh the page.', 'success');
                
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } catch (error) {
                console.error('Error restoring backup:', error);
                showNotification('Error restoring backup: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    } catch (error) {
        console.error('Error restoring backup:', error);
        showNotification('Error restoring backup: ' + error.message, 'error');
    }
}

// Restore data to database
async function restoreData(data, options) {
    const updates = {};
    
    if (options.users && data.users) {
        for (const [userId, userData] of Object.entries(data.users)) {
            updates[`users/${userId}`] = userData;
        }
    }
    
    if (options.purchases && data.purchases) {
        for (const [purchaseId, purchaseData] of Object.entries(data.purchases)) {
            updates[`purchases/${purchaseId}`] = purchaseData;
        }
    }
    
    if (options.vendors && data.vendors) {
        for (const [vendorId, vendorData] of Object.entries(data.vendors)) {
            updates[`vendors/${vendorId}`] = vendorData;
        }
    }
    
    if (options.items && data.items) {
        for (const [itemId, itemData] of Object.entries(data.items)) {
            updates[`items/${itemId}`] = itemData;
        }
    }
    
    if (data.system) {
        updates['system'] = data.system;
    }
    
    await database.ref().update(updates);
}

// Load backup history
async function loadBackupHistory() {
    try {
        const user = authManager.currentUserProfile;
        const backupHistoryTable = document.getElementById('backupHistoryTable');
        backupHistoryTable.innerHTML = '';
        
        const backupHistorySnapshot = await database.ref('backupHistory').limitToLast(20).once('value');
        
        if (!backupHistorySnapshot.exists()) {
            backupHistoryTable.innerHTML = '<tr><td colspan="5" style="text-align: center;" data-i18n="no_backups">No backups found</td></tr>';
            languageManager.updateTextContent();
            return;
        }
        
        const backups = [];
        backupHistorySnapshot.forEach(childSnapshot => {
            const backup = childSnapshot.val();
            
            // Filter based on user role
            if (user.role === 'systemAdmin' || 
                (user.role === 'apartmentAdmin' && backup.apartmentId === user.apartmentId) ||
                (user.role === 'apartmentUser' && backup.apartmentId === user.apartmentId && backup.createdById === authManager.currentUser.uid)) {
                backups.push({
                    id: childSnapshot.key,
                    ...backup
                });
            }
        });
        
        backups.sort((a, b) => b.timestamp.unix - a.timestamp.unix);
        
        backups.forEach(backup => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(backup.timestamp)}</td>
                <td>${backup.scope === 'all' ? 'Full System' : `Apartment ${backup.apartmentId}`}</td>
                <td>${backup.sizeFormatted}</td>
                <td>${backup.createdBy}</td>
                <td>
                    <button class="btn btn-sm btn-secondary download-backup-btn" data-backup-id="${backup.id}">
                        <span data-i18n="download">Download</span>
                    </button>
                </td>
            `;
            backupHistoryTable.appendChild(row);
        });
        
        languageManager.updateTextContent();
    } catch (error) {
        console.error('Error loading backup history:', error);
    }
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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