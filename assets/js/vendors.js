// Vendors JavaScript
let currentEditingVendorId = null;

// Load vendors data
async function loadVendorsData() {
    try {
        const vendorsSnapshot = await database.ref('vendors').once('value');
        const vendorsTable = document.getElementById('vendorsTable');
        vendorsTable.innerHTML = '';
        
        vendorsSnapshot.forEach(childSnapshot => {
            const vendor = childSnapshot.val();
            const vendorId = childSnapshot.key;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${languageManager.currentLang === 'ar' ? vendor.arabicName : vendor.englishName}</td>
                <td>${vendor.contact || ''}</td>
                <td>${vendor.phone || ''}</td>
                <td>${vendor.email || ''}</td>
                <td>
                    <button class="btn btn-sm btn-secondary edit-vendor-btn" data-vendor-id="${vendorId}" data-i18n="edit">Edit</button>
                    <button class="btn btn-sm btn-danger delete-vendor-btn" data-vendor-id="${vendorId}" data-i18n="delete">Delete</button>
                </td>
            `;
            
            vendorsTable.appendChild(row);
        });
        
        // Apply translations to dynamically created elements
        languageManager.updateTextContent();
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-vendor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vendorId = btn.getAttribute('data-vendor-id');
                openVendorModal(vendorId);
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-vendor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vendorId = btn.getAttribute('data-vendor-id');
                deleteVendor(vendorId);
            });
        });
    } catch (error) {
        console.error('Error loading vendors:', error);
        showNotification('Error loading vendors', 'error');
    }
}

// Setup vendor modal
function setupVendorModal() {
    const addVendorBtn = document.getElementById('addVendorBtn');
    const vendorModal = document.getElementById('vendorModal');
    const vendorForm = document.getElementById('vendorForm');
    
    // Add event listener to add button
    addVendorBtn.addEventListener('click', () => {
        openVendorModal();
    });
    
    // Handle form submission
    vendorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const vendorData = {
                englishName: document.getElementById('vendorEnglishName').value,
                arabicName: document.getElementById('vendorArabicName').value,
                contact: document.getElementById('vendorContact').value,
                phone: document.getElementById('vendorPhone').value,
                email: document.getElementById('vendorEmail').value,
                updatedAt: dateManager.getCurrentDateInfo()
            };
            
            if (currentEditingVendorId) {
                // Update existing vendor
                await database.ref(`vendors/${currentEditingVendorId}`).update(vendorData);
                
                // Log action
                await logAction('UPDATE_VENDOR', 'vendors', currentEditingVendorId, {}, vendorData);
                
                showNotification('Vendor updated successfully', 'success');
            } else {
                // Add new vendor
                vendorData.createdAt = dateManager.getCurrentDateInfo();
                vendorData.createdBy = authManager.currentUser.uid;
                
                const result = await database.ref('vendors').push(vendorData);
                
                // Log action
                await logAction('CREATE_VENDOR', 'vendors', result.key, {}, vendorData);
                
                showNotification('Vendor added successfully', 'success');
            }
            
            // Close modal
            vendorModal.classList.remove('active');
            
            // Reset form
            vendorForm.reset();
            currentEditingVendorId = null;
            
            // Reload data
            await loadVendorsData();
        } catch (error) {
            console.error('Error saving vendor:', error);
            showNotification('Error saving vendor: ' + error.message, 'error');
        }
    });
}

// Open vendor modal
async function openVendorModal(vendorId = null) {
    const vendorModal = document.getElementById('vendorModal');
    const vendorForm = document.getElementById('vendorForm');
    const modalTitle = vendorModal.querySelector('.modal-title');
    
    // Reset form
    vendorForm.reset();
    currentEditingVendorId = null;
    
    if (vendorId) {
        // Load vendor data
        try {
            const vendorSnapshot = await database.ref(`vendors/${vendorId}`).once('value');
            const vendor = vendorSnapshot.val();
            
            document.getElementById('vendorEnglishName').value = vendor.englishName || '';
            document.getElementById('vendorArabicName').value = vendor.arabicName || '';
            document.getElementById('vendorContact').value = vendor.contact || '';
            document.getElementById('vendorPhone').value = vendor.phone || '';
            document.getElementById('vendorEmail').value = vendor.email || '';
            
            currentEditingVendorId = vendorId;
            modalTitle.textContent = languageManager.getText('edit_vendor');
        } catch (error) {
            console.error('Error loading vendor data:', error);
            showNotification('Error loading vendor data', 'error');
            return;
        }
    } else {
        modalTitle.textContent = languageManager.getText('add_vendor');
    }
    
    // Show modal
    vendorModal.classList.add('active');
}

// Delete vendor
async function deleteVendor(vendorId) {
    confirmAction(languageManager.getText('confirm_delete_vendor'), async () => {
        try {
            // Get vendor data for logging
            const vendorSnapshot = await database.ref(`vendors/${vendorId}`).once('value');
            const vendor = vendorSnapshot.val();
            
            // Check if vendor is used in any purchases
            const purchasesSnapshot = await database.ref('purchases').orderByChild('vendorId').equalTo(vendorId).once('value');
            
            if (purchasesSnapshot.exists()) {
                showNotification('Cannot delete vendor: Vendor is used in purchases', 'error');
                return;
            }
            
            // Delete vendor
            await database.ref(`vendors/${vendorId}`).remove();
            
            // Log action
            await logAction('DELETE_VENDOR', 'vendors', vendorId, vendor, {});
            
            showNotification('Vendor deleted successfully', 'success');
            
            // Reload data
            await loadVendorsData();
        } catch (error) {
            console.error('Error deleting vendor:', error);
            showNotification('Error deleting vendor: ' + error.message, 'error');
        }
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

// Initialize vendors page
document.addEventListener('DOMContentLoaded', () => {
    // Setup vendor modal
    setupVendorModal();
    
    // Load vendors data if we're on the vendors page
    if (getCurrentPage() === 'vendors') {
        loadVendorsData();
    }
});

// Export functions for use in other files
window.loadVendorsData = loadVendorsData;