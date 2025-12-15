// Trash JavaScript

// Load trash data
async function loadTrashData() {
    try {
        const trashTable = document.getElementById('trashTable');
        trashTable.innerHTML = '';
        
        // Load deleted purchases
        await loadDeletedPurchases();
        
        // Load deleted vendors
        await loadDeletedVendors();
        
        // Load deleted items
        await loadDeletedItems();
    } catch (error) {
        console.error('Error loading trash data:', error);
        showNotification('Error loading trash data', 'error');
    }
}

// Load deleted purchases
async function loadDeletedPurchases() {
    try {
        const purchasesSnapshot = await database.ref('purchases').once('value');
        const trashTable = document.getElementById('trashTable');
        
        purchasesSnapshot.forEach(childSnapshot => {
            const purchase = childSnapshot.val();
            if (purchase.isDeleted && purchase.deletedAt) {
                const daysLeft = calculateDaysLeft(purchase.deletedAt);
                
                // Get item and vendor names
                Promise.all([
                    database.ref(`items/${purchase.itemId}`).once('value'),
                    database.ref(`vendors/${purchase.vendorId}`).once('value')
                ]).then(([itemSnapshot, vendorSnapshot]) => {
                    const item = itemSnapshot.val();
                    const vendor = vendorSnapshot.val();
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><span class="badge badge-purchase">Purchase</span></td>
                        <td>${languageManager.currentLang === 'ar' && item ? item.arabicName : (item ? item.englishName : 'Unknown')}</td>
                        <td>${purchase.deletedBy || 'Unknown'}</td>
                        <td>${formatDate(purchase.deletedAt)}</td>
                        <td>${daysLeft}</td>
                        <td>
                            <button class="btn btn-sm btn-secondary restore-purchase-btn" data-purchase-id="${childSnapshot.key}" data-i18n="restore">Restore</button>
                            <button class="btn btn-sm btn-danger delete-permanent-btn" data-type="purchase" data-id="${childSnapshot.key}" data-i18n="delete_permanently">Delete Permanently</button>
                        </td>
                    `;
                    
                    trashTable.appendChild(row);
                    
                    // Apply translations to dynamically created elements
                    languageManager.updateTextContent();
                });
            }
        });
        
        // Add event listeners to restore buttons
        document.querySelectorAll('.restore-purchase-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const purchaseId = btn.getAttribute('data-purchase-id');
                restorePurchase(purchaseId);
            });
        });
        
        // Add event listeners to delete permanent buttons
        document.querySelectorAll('.delete-permanent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                const id = btn.getAttribute('data-id');
                deletePermanently(type, id);
            });
        });
    } catch (error) {
        console.error('Error loading deleted purchases:', error);
    }
}

// Load deleted vendors
async function loadDeletedVendors() {
    try {
        const vendorsSnapshot = await database.ref('vendors').once('value');
        const trashTable = document.getElementById('trashTable');
        
        vendorsSnapshot.forEach(childSnapshot => {
            const vendor = childSnapshot.val();
            if (vendor.isDeleted && vendor.deletedAt) {
                const daysLeft = calculateDaysLeft(vendor.deletedAt);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="badge badge-vendor">Vendor</span></td>
                    <td>${languageManager.currentLang === 'ar' ? vendor.arabicName : vendor.englishName}</td>
                    <td>${vendor.deletedBy || 'Unknown'}</td>
                    <td>${formatDate(vendor.deletedAt)}</td>
                    <td>${daysLeft}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary restore-vendor-btn" data-vendor-id="${childSnapshot.key}" data-i18n="restore">Restore</button>
                        <button class="btn btn-sm btn-danger delete-permanent-btn" data-type="vendor" data-id="${childSnapshot.key}" data-i18n="delete_permanently">Delete Permanently</button>
                    </td>
                `;
                
                trashTable.appendChild(row);
            }
        });
        
        // Add event listeners to restore buttons
        document.querySelectorAll('.restore-vendor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vendorId = btn.getAttribute('data-vendor-id');
                restoreVendor(vendorId);
            });
        });
    } catch (error) {
        console.error('Error loading deleted vendors:', error);
    }
}

// Load deleted items
async function loadDeletedItems() {
    try {
        const itemsSnapshot = await database.ref('items').once('value');
        const trashTable = document.getElementById('trashTable');
        
        itemsSnapshot.forEach(childSnapshot => {
            const item = childSnapshot.val();
            if (item.isDeleted && item.deletedAt) {
                const daysLeft = calculateDaysLeft(item.deletedAt);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="badge badge-item">Item</span></td>
                    <td>${languageManager.currentLang === 'ar' ? item.arabicName : item.englishName}</td>
                    <td>${item.deletedBy || 'Unknown'}</td>
                    <td>${formatDate(item.deletedAt)}</td>
                    <td>${daysLeft}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary restore-item-btn" data-item-id="${childSnapshot.key}" data-i18n="restore">Restore</button>
                        <button class="btn btn-sm btn-danger delete-permanent-btn" data-type="item" data-id="${childSnapshot.key}" data-i18n="delete_permanently">Delete Permanently</button>
                    </td>
                `;
                
                trashTable.appendChild(row);
            }
        });
        
        // Add event listeners to restore buttons
        document.querySelectorAll('.restore-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.getAttribute('data-item-id');
                restoreItem(itemId);
            });
        });
    } catch (error) {
        console.error('Error loading deleted items:', error);
    }
}

// Calculate days left until permanent deletion
function calculateDaysLeft(deletedAt) {
    const deletedDate = new Date(deletedAt.iso);
    const currentDate = new Date();
    const daysDiff = Math.floor((currentDate - deletedDate) / (1000 * 60 * 60 * 24));
    const daysLeft = 30 - daysDiff;
    
    if (daysLeft <= 0) {
        return 'Will be deleted soon';
    } else if (daysLeft === 1) {
        return '1 day';
    } else {
        return `${daysLeft} days`;
    }
}

// Restore purchase
async function restorePurchase(purchaseId) {
    try {
        // Get purchase data for logging
        const purchaseSnapshot = await database.ref(`purchases/${purchaseId}`).once('value');
        const purchase = purchaseSnapshot.val();
        
        // Restore purchase
        await database.ref(`purchases/${purchaseId}`).update({
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            restoredAt: dateManager.getCurrentDateInfo(),
            restoredBy: authManager.currentUser.uid
        });
        
        // Log action
        await logAction('RESTORE_PURCHASE', 'purchases', purchaseId, purchase, { isDeleted: false });
        
        showNotification('Purchase restored successfully', 'success');
        
        // Reload data
        await loadTrashData();
    } catch (error) {
        console.error('Error restoring purchase:', error);
        showNotification('Error restoring purchase: ' + error.message, 'error');
    }
}

// Restore vendor
async function restoreVendor(vendorId) {
    try {
        // Get vendor data for logging
        const vendorSnapshot = await database.ref(`vendors/${vendorId}`).once('value');
        const vendor = vendorSnapshot.val();
        
        // Restore vendor
        await database.ref(`vendors/${vendorId}`).update({
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            restoredAt: dateManager.getCurrentDateInfo(),
            restoredBy: authManager.currentUser.uid
        });
        
        // Log action
        await logAction('RESTORE_VENDOR', 'vendors', vendorId, vendor, { isDeleted: false });
        
        showNotification('Vendor restored successfully', 'success');
        
        // Reload data
        await loadTrashData();
    } catch (error) {
        console.error('Error restoring vendor:', error);
        showNotification('Error restoring vendor: ' + error.message, 'error');
    }
}

// Restore item
async function restoreItem(itemId) {
    try {
        // Get item data for logging
        const itemSnapshot = await database.ref(`items/${itemId}`).once('value');
        const item = itemSnapshot.val();
        
        // Restore item
        await database.ref(`items/${itemId}`).update({
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            restoredAt: dateManager.getCurrentDateInfo(),
            restoredBy: authManager.currentUser.uid
        });
        
        // Log action
        await logAction('RESTORE_ITEM', 'items', itemId, item, { isDeleted: false });
        
        showNotification('Item restored successfully', 'success');
        
        // Reload data
        await loadTrashData();
    } catch (error) {
        console.error('Error restoring item:', error);
        showNotification('Error restoring item: ' + error.message, 'error');
    }
}

// Delete permanently
async function deletePermanently(type, id) {
    confirmAction(languageManager.getText('confirm_delete_permanently'), async () => {
        try {
            let oldData;
            
            switch (type) {
                case 'purchase':
                    const purchaseSnapshot = await database.ref(`purchases/${id}`).once('value');
                    oldData = purchaseSnapshot.val();
                    await database.ref(`purchases/${id}`).remove();
                    break;
                case 'vendor':
                    const vendorSnapshot = await database.ref(`vendors/${id}`).once('value');
                    oldData = vendorSnapshot.val();
                    await database.ref(`vendors/${id}`).remove();
                    break;
                case 'item':
                    const itemSnapshot = await database.ref(`items/${id}`).once('value');
                    oldData = itemSnapshot.val();
                    await database.ref(`items/${id}`).remove();
                    break;
                default:
                    throw new Error('Invalid type');
            }
            
            // Log action
            await logAction('DELETE_PERMANENTLY', type + 's', id, oldData, {});
            
            showNotification('Item deleted permanently', 'success');
            
            // Reload data
            await loadTrashData();
        } catch (error) {
            console.error('Error deleting permanently:', error);
            showNotification('Error deleting permanently: ' + error.message, 'error');
        }
    });
}

// Empty trash
async function emptyTrash() {
    confirmAction(languageManager.getText('confirm_empty_trash'), async () => {
        try {
            showNotification('Emptying trash...', 'info');
            
            // Get all deleted items
            const purchasesSnapshot = await database.ref('purchases').once('value');
            const vendorsSnapshot = await database.ref('vendors').once('value');
            const itemsSnapshot = await database.ref('items').once('value');
            
            // Delete all permanently
            const deletePromises = [];
            
            purchasesSnapshot.forEach(childSnapshot => {
                const purchase = childSnapshot.val();
                if (purchase.isDeleted) {
                    deletePromises.push(
                        database.ref(`purchases/${childSnapshot.key}`).remove()
                    );
                }
            });
            
            vendorsSnapshot.forEach(childSnapshot => {
                const vendor = childSnapshot.val();
                if (vendor.isDeleted) {
                    deletePromises.push(
                        database.ref(`vendors/${childSnapshot.key}`).remove()
                    );
                }
            });
            
            itemsSnapshot.forEach(childSnapshot => {
                const item = childSnapshot.val();
                if (item.isDeleted) {
                    deletePromises.push(
                        database.ref(`items/${childSnapshot.key}`).remove()
                    );
                }
            });
            
            await Promise.all(deletePromises);
            
            // Log action
            await logAction('EMPTY_TRASH', 'system', 'all', {}, { itemsDeleted: deletePromises.length });
            
            showNotification('Trash emptied successfully', 'success');
            
            // Reload data
            await loadTrashData();
        } catch (error) {
            console.error('Error emptying trash:', error);
            showNotification('Error emptying trash: ' + error.message, 'error');
        }
    });
}

// Setup trash page
function setupTrashPage() {
    const emptyTrashBtn = document.getElementById('emptyTrashBtn');
    const trashFilter = document.getElementById('trashFilter');
    
    // Empty trash button
    if (emptyTrashBtn) {
        emptyTrashBtn.addEventListener('click', emptyTrash);
    }
    
    // Trash filter
    if (trashFilter) {
        trashFilter.addEventListener('change', filterTrash);
    }
}

// Filter trash items
async function filterTrash() {
    const filter = document.getElementById('trashFilter').value;
    
    try {
        const trashTable = document.getElementById('trashTable');
        trashTable.innerHTML = '';
        
        switch (filter) {
            case 'purchases':
                await loadDeletedPurchases();
                break;
            case 'vendors':
                await loadDeletedVendors();
                break;
            case 'items':
                await loadDeletedItems();
                break;
            default:
                await loadDeletedPurchases();
                await loadDeletedVendors();
                await loadDeletedItems();
                break;
        }
    } catch (error) {
        console.error('Error filtering trash:', error);
        showNotification('Error filtering trash', 'error');
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

// Initialize trash page
document.addEventListener('DOMContentLoaded', () => {
    // Setup trash page
    setupTrashPage();
    
    // Load trash data if we're on trash page
    if (getCurrentPage() === 'trash') {
        loadTrashData();
    }
});

// Export functions for use in other files
window.loadTrashData = loadTrashData;