// Items JavaScript
let currentEditingItemId = null;

// Load items data
async function loadItemsData() {
    try {
        const itemsSnapshot = await database.ref('items').once('value');
        const itemsTable = document.getElementById('itemsTable');
        itemsTable.innerHTML = '';
        
        const items = [];
        itemsSnapshot.forEach(childSnapshot => {
            const item = childSnapshot.val();
            items.push({
                id: childSnapshot.key,
                ...item
            });
        });
        
        // Sort by name
        items.sort((a, b) => {
            const nameA = languageManager.currentLang === 'ar' ? a.arabicName : a.englishName;
            const nameB = languageManager.currentLang === 'ar' ? b.arabicName : b.englishName;
            return nameA.localeCompare(nameB);
        });
        
        for (const item of items) {
            // Get last purchase date for this item
            const lastPurchaseDate = await getLastPurchaseDate(item.id);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${languageManager.currentLang === 'ar' ? item.arabicName : item.englishName}</td>
                <td>${languageManager.getText(item.category)}</td>
                <td>${formatCurrency(item.unitPrice)}</td>
                <td>${lastPurchaseDate}</td>
                <td>
                    <button class="btn btn-sm btn-secondary edit-item-btn" data-item-id="${item.id}" data-i18n="edit">Edit</button>
                    <button class="btn btn-sm btn-danger delete-item-btn" data-item-id="${item.id}" data-i18n="delete">Delete</button>
                </td>
            `;
            
            itemsTable.appendChild(row);
        }
        
        // Apply translations to dynamically created elements
        languageManager.updateTextContent();
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.getAttribute('data-item-id');
                openItemModal(itemId);
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.getAttribute('data-item-id');
                deleteItem(itemId);
            });
        });
    } catch (error) {
        console.error('Error loading items:', error);
        showNotification('Error loading items', 'error');
    }
}

// Get last purchase date for an item
async function getLastPurchaseDate(itemId) {
    try {
        const purchasesSnapshot = await database.ref('purchases')
            .orderByChild('itemId')
            .equalTo(itemId)
            .limitToLast(1)
            .once('value');
        
        let lastDate = '-';
        purchasesSnapshot.forEach(childSnapshot => {
            const purchase = childSnapshot.val();
            if (!purchase.isDeleted && purchase.dateInfo) {
                lastDate = formatDate(purchase.dateInfo);
            }
        });
        
        return lastDate;
    } catch (error) {
        console.error('Error getting last purchase date:', error);
        return '-';
    }
}

// Setup item modal
function setupItemModal() {
    const addItemBtn = document.getElementById('addItemBtn');
    const itemModal = document.getElementById('itemModal');
    const itemForm = document.getElementById('itemForm');
    
    // Add event listener to add button
    addItemBtn.addEventListener('click', () => {
        openItemModal();
    });
    
    // Handle form submission
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const itemData = {
                englishName: document.getElementById('itemEnglishName').value,
                arabicName: document.getElementById('itemArabicName').value,
                category: document.getElementById('itemCategory').value,
                unitPrice: parseFloat(document.getElementById('itemUnitPrice').value),
                description: document.getElementById('itemDescription').value,
                updatedAt: dateManager.getCurrentDateInfo()
            };
            
            if (currentEditingItemId) {
                // Update existing item
                await database.ref(`items/${currentEditingItemId}`).update(itemData);
                
                // Log action
                await logAction('UPDATE_ITEM', 'items', currentEditingItemId, {}, itemData);
                
                showNotification('Item updated successfully', 'success');
            } else {
                // Add new item
                itemData.createdAt = dateManager.getCurrentDateInfo();
                itemData.createdBy = authManager.currentUser.uid;
                
                const result = await database.ref('items').push(itemData);
                
                // Log action
                await logAction('CREATE_ITEM', 'items', result.key, {}, itemData);
                
                showNotification('Item added successfully', 'success');
            }
            
            // Close modal
            itemModal.classList.remove('active');
            
            // Reset form
            itemForm.reset();
            currentEditingItemId = null;
            
            // Reload data
            await loadItemsData();
        } catch (error) {
            console.error('Error saving item:', error);
            showNotification('Error saving item: ' + error.message, 'error');
        }
    });
    
    // Setup category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterItems);
    }
}

// Open item modal
async function openItemModal(itemId = null) {
    const itemModal = document.getElementById('itemModal');
    const itemForm = document.getElementById('itemForm');
    const modalTitle = itemModal.querySelector('.modal-title');
    
    // Reset form
    itemForm.reset();
    currentEditingItemId = null;
    
    if (itemId) {
        // Load item data
        try {
            const itemSnapshot = await database.ref(`items/${itemId}`).once('value');
            const item = itemSnapshot.val();
            
            document.getElementById('itemEnglishName').value = item.englishName || '';
            document.getElementById('itemArabicName').value = item.arabicName || '';
            document.getElementById('itemCategory').value = item.category || '';
            document.getElementById('itemUnitPrice').value = item.unitPrice || '';
            document.getElementById('itemDescription').value = item.description || '';
            
            currentEditingItemId = itemId;
            modalTitle.textContent = languageManager.getText('edit_item');
        } catch (error) {
            console.error('Error loading item data:', error);
            showNotification('Error loading item data', 'error');
            return;
        }
    } else {
        modalTitle.textContent = languageManager.getText('add_item');
    }
    
    // Show modal
    itemModal.classList.add('active');
}

// Delete item
async function deleteItem(itemId) {
    confirmAction(languageManager.getText('confirm_delete_item'), async () => {
        try {
            // Get item data for logging
            const itemSnapshot = await database.ref(`items/${itemId}`).once('value');
            const item = itemSnapshot.val();
            
            // Check if item is used in any purchases
            const purchasesSnapshot = await database.ref('purchases').orderByChild('itemId').equalTo(itemId).once('value');
            
            if (purchasesSnapshot.exists()) {
                showNotification('Cannot delete item: Item is used in purchases', 'error');
                return;
            }
            
            // Delete item
            await database.ref(`items/${itemId}`).remove();
            
            // Log action
            await logAction('DELETE_ITEM', 'items', itemId, item, {});
            
            showNotification('Item deleted successfully', 'success');
            
            // Reload data
            await loadItemsData();
        } catch (error) {
            console.error('Error deleting item:', error);
            showNotification('Error deleting item: ' + error.message, 'error');
        }
    });
}

// Filter items by category
async function filterItems() {
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    try {
        const itemsSnapshot = await database.ref('items').once('value');
        const itemsTable = document.getElementById('itemsTable');
        itemsTable.innerHTML = '';
        
        itemsSnapshot.forEach(childSnapshot => {
            const item = childSnapshot.val();
            const itemId = childSnapshot.key;
            
            // Filter by category
            if (categoryFilter && item.category !== categoryFilter) {
                return;
            }
            
            // Get last purchase date for this item
            getLastPurchaseDate(itemId).then(lastPurchaseDate => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${languageManager.currentLang === 'ar' ? item.arabicName : item.englishName}</td>
                    <td>${languageManager.getText(item.category)}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>${lastPurchaseDate}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary edit-item-btn" data-item-id="${itemId}" data-i18n="edit">Edit</button>
                        <button class="btn btn-sm btn-danger delete-item-btn" data-item-id="${itemId}" data-i18n="delete">Delete</button>
                    </td>
                `;
                
                itemsTable.appendChild(row);
                
                // Apply translations to dynamically created elements
                languageManager.updateTextContent();
                
                // Add event listeners to edit buttons
                document.querySelectorAll('.edit-item-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const itemId = btn.getAttribute('data-item-id');
                        openItemModal(itemId);
                    });
                });
                
                // Add event listeners to delete buttons
                document.querySelectorAll('.delete-item-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const itemId = btn.getAttribute('data-item-id');
                        deleteItem(itemId);
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error filtering items:', error);
        showNotification('Error filtering items', 'error');
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

// Initialize items page
document.addEventListener('DOMContentLoaded', () => {
    // Setup item modal
    setupItemModal();
    
    // Load items data if we're on the items page
    if (getCurrentPage() === 'items') {
        loadItemsData();
    }
});

// Export functions for use in other files
window.loadItemsData = loadItemsData;