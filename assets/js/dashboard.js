// Dashboard JavaScript
let spendingChart = null;

// Add this at the VERY TOP of dashboard.js
(function() {
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!currentUser) {
        // Redirect to login page
        console.log("No user found, redirecting to login...");
        window.location.href = 'index.html';
        return;
    }
    
    console.log("User logged in:", currentUser);
    
    // Initialize Firebase if not already initialized
    if (!window.firebaseInitialized) {
        // Your Firebase initialization code here
        // Make sure to set window.firebaseInitialized = true after init
    }
    
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Set user info in the navbar
        const userNameElement = document.getElementById('userName');
        const userRoleElement = document.getElementById('userRole');
        
        if (userNameElement) {
            userNameElement.textContent = currentUser.userName || currentUser.englishName || 'User';
        }
        
        if (userRoleElement) {
            userRoleElement.textContent = currentUser.role || 'User';
        }
        
        // Load purchases when page loads
        if (typeof loadPurchasesData === 'function') {
            loadPurchasesData();
        } else {
            console.error('loadPurchasesData function not loaded');
            // Try to load it after a delay
            setTimeout(() => {
                if (typeof loadPurchasesData === 'function') {
                    loadPurchasesData();
                }
            }, 1000);
        }
    });
})();

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load statistics
        await loadDashboardStats();
        
        // Load recent purchases
        await loadRecentPurchases();
        
        // Load spending chart
        await loadSpendingChart();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        // Get purchases for current month
        const purchasesSnapshot = await database.ref('purchases').once('value');
        let monthlyPurchasesCount = 0;
        let monthlySpentAmount = 0;
        
        purchasesSnapshot.forEach(childSnapshot => {
            const purchase = childSnapshot.val();
            if (!purchase.isDeleted && purchase.dateInfo) {
                const purchaseDate = new Date(purchase.dateInfo.iso);
                if (purchaseDate.getMonth() === currentMonth && purchaseDate.getFullYear() === currentYear) {
                    monthlyPurchasesCount++;
                    monthlySpentAmount += purchase.totalPrice || 0;
                }
            }
        });
        
        // Update UI
        document.getElementById('monthlyPurchasesCount').textContent = monthlyPurchasesCount;
        document.getElementById('monthlySpentAmount').textContent = formatCurrency(monthlySpentAmount);
        
        // Get active vendors count
        const vendorsSnapshot = await database.ref('vendors').once('value');
        const activeVendorsCount = vendorsSnapshot.numChildren();
        document.getElementById('activeVendorsCount').textContent = activeVendorsCount;
        
        // Get unique items count
        const itemsSnapshot = await database.ref('items').once('value');
        const uniqueItemsCount = itemsSnapshot.numChildren();
        document.getElementById('uniqueItemsCount').textContent = uniqueItemsCount;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load recent purchases
async function loadRecentPurchases() {
    try {
        const purchasesSnapshot = await database.ref('purchases')
            .orderByChild('addedAt/unix')
            .limitToLast(10)
            .once('value');
        
        const recentPurchasesTable = document.getElementById('recentPurchasesTable');
        recentPurchasesTable.innerHTML = '';
        
        const purchases = [];
        purchasesSnapshot.forEach(childSnapshot => {
            const purchase = childSnapshot.val();
            if (!purchase.isDeleted) {
                purchases.push({
                    id: childSnapshot.key,
                    ...purchase
                });
            }
        });
        
        // Sort by date (newest first)
        purchases.sort((a, b) => b.addedAt.unix - a.addedAt.unix);
        
        for (const purchase of purchases) {
            // Get vendor info
            const vendorSnapshot = await database.ref(`vendors/${purchase.vendorId}`).once('value');
            const vendor = vendorSnapshot.val();
            
            // Get item info
            const itemSnapshot = await database.ref(`items/${purchase.itemId}`).once('value');
            const item = itemSnapshot.val();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(purchase.dateInfo)}</td>
                <td>${languageManager.currentLang === 'ar' && item ? item.arabicName : (item ? item.englishName : '')}</td>
                <td>${languageManager.currentLang === 'ar' && vendor ? vendor.arabicName : (vendor ? vendor.englishName : '')}</td>
                <td>${purchase.quantity}</td>
                <td>${formatCurrency(purchase.itemPriceAtTime)}</td>
                <td>${formatCurrency(purchase.totalPrice)}</td>
            `;
            
            recentPurchasesTable.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading recent purchases:', error);
    }
}

// Load spending chart
async function loadSpendingChart() {
    try {
        const canvas = document.getElementById('spendingChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Get spending by category for current month
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const purchasesSnapshot = await database.ref('purchases').once('value');
        const categorySpending = {};
        
        purchasesSnapshot.forEach(childSnapshot => {
            const purchase = childSnapshot.val();
            if (!purchase.isDeleted && purchase.dateInfo) {
                const purchaseDate = new Date(purchase.dateInfo.iso);
                if (purchaseDate.getMonth() === currentMonth && purchaseDate.getFullYear() === currentYear) {
                    // Get item category
                    database.ref(`items/${purchase.itemId}`).once('value').then(itemSnapshot => {
                        const item = itemSnapshot.val();
                        if (item) {
                            const category = item.category || 'other';
                            if (!categorySpending[category]) {
                                categorySpending[category] = 0;
                            }
                            categorySpending[category] += purchase.totalPrice || 0;
                        }
                    });
                }
            }
        });
        
        // Wait for all item data to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Prepare chart data
        const labels = Object.keys(categorySpending).map(category => 
            languageManager.getText(category)
        );
        const data = Object.values(categorySpending);
        
        // Destroy existing chart if it exists
        if (spendingChart) {
            spendingChart.destroy();
        }
        
        // Create new chart
        spendingChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#FF9800',
                        '#2196F3',
                        '#4CAF50',
                        '#F44336',
                        '#9C27B0',
                        '#607D8B'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: languageManager.currentLang === 'ar' ? 'Cairo, sans-serif' : 'Segoe UI, sans-serif'
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = formatCurrency(context.raw);
                                return `${label}: ${value}`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading spending chart:', error);
    }
}

// Setup purchase modal
function setupPurchaseModal() {
    const addPurchaseBtns = document.querySelectorAll('#addPurchaseBtn, #addPurchaseBtn2');
    const purchaseModal = document.getElementById('purchaseModal');
    const purchaseForm = document.getElementById('purchaseForm');
    const purchaseDate = document.getElementById('purchaseDate');
    const purchaseVendor = document.getElementById('purchaseVendor');
    const purchaseItem = document.getElementById('purchaseItem');
    const purchaseQuantity = document.getElementById('purchaseQuantity');
    const purchasePrice = document.getElementById('purchasePrice');
    const purchaseTotal = document.getElementById('purchaseTotal');
    
    // Set default date to current date/time
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    purchaseDate.value = localDateTime;
    
    // Add event listeners to buttons
    addPurchaseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            purchaseModal.classList.add('active');
            loadVendorsAndItems();
        });
    });
    
    // Calculate total when quantity or price changes
    purchaseQuantity.addEventListener('input', calculateTotal);
    purchasePrice.addEventListener('input', calculateTotal);
    
    // Load item price when item changes
    purchaseItem.addEventListener('change', async () => {
        const itemId = purchaseItem.value;
        if (itemId) {
            try {
                const itemSnapshot = await database.ref(`items/${itemId}`).once('value');
                const item = itemSnapshot.val();
                if (item && item.unitPrice) {
                    purchasePrice.value = item.unitPrice;
                    calculateTotal();
                }
            } catch (error) {
                console.error('Error loading item price:', error);
            }
        }
    });
    
    // Handle form submission
    purchaseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const dateInfo = dateManager.generateDateInfo(new Date(purchaseDate.value));
            
            const purchaseData = {
                apartmentId: authManager.currentUserProfile.apartmentId,
                vendorId: purchaseVendor.value,
                itemId: purchaseItem.value,
                quantity: parseInt(purchaseQuantity.value),
                dateInfo: dateInfo,
                itemPriceAtTime: parseFloat(purchasePrice.value),
                totalPrice: parseFloat(purchaseTotal.value),
                addedBy: authManager.currentUser.uid,
                addedAt: dateInfo,
                updatedAt: dateInfo,
                isDeleted: false
            };
            
            // Save to database
            const result = await database.ref('purchases').push(purchaseData);
            
            // Log action
            await logAction('CREATE_PURCHASE', 'purchases', result.key, {}, purchaseData);
            
            // Close modal
            purchaseModal.classList.remove('active');
            
            // Reset form
            purchaseForm.reset();
            const now = new Date();
            const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            purchaseDate.value = localDateTime;
            
            // Show success message
            showNotification('Purchase added successfully', 'success');
            
            // Reload data
            await loadDashboardData();
        } catch (error) {
            console.error('Error adding purchase:', error);
            showNotification('Error adding purchase: ' + error.message, 'error');
        }
    });
}

// Load vendors and items for purchase form
async function loadVendorsAndItems() {
    try {
        // Load vendors
        const vendorsSnapshot = await database.ref('vendors').once('value');
        const purchaseVendor = document.getElementById('purchaseVendor');
        purchaseVendor.innerHTML = '<option value="" data-i18n="select_vendor">Select Vendor</option>';
        
        vendorsSnapshot.forEach(childSnapshot => {
            const vendor = childSnapshot.val();
            const option = document.createElement('option');
            option.value = childSnapshot.key;
            option.textContent = languageManager.currentLang === 'ar' ? vendor.arabicName : vendor.englishName;
            purchaseVendor.appendChild(option);
        });
        
        // Load items
        const itemsSnapshot = await database.ref('items').once('value');
        const purchaseItem = document.getElementById('purchaseItem');
        purchaseItem.innerHTML = '<option value="" data-i18n="select_item">Select Item</option>';
        
        itemsSnapshot.forEach(childSnapshot => {
            const item = childSnapshot.val();
            const option = document.createElement('option');
            option.value = childSnapshot.key;
            option.textContent = languageManager.currentLang === 'ar' ? item.arabicName : item.englishName;
            purchaseItem.appendChild(option);
        });
        
        // Apply translations
        languageManager.updateTextContent();
    } catch (error) {
        console.error('Error loading vendors and items:', error);
    }
}

// Calculate total
function calculateTotal() {
    const quantity = parseFloat(document.getElementById('purchaseQuantity').value) || 0;
    const price = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const total = quantity * price;
    document.getElementById('purchaseTotal').value = total.toFixed(2);
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

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Setup purchase modal
    setupPurchaseModal();
    
    // Load dashboard data if we're on the dashboard page
    if (getCurrentPage() === 'dashboard') {
        loadDashboardData();
    }
});
// Add this function before line 378 in dashboard.js
function loadPurchasesData() {
    console.log("loadPurchasesData called");
    
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!currentUser) {
        console.error("No user found in localStorage");
        window.location.href = 'index.html';
        return;
    }
    
    console.log("Loading purchases for user:", currentUser);
    
    // Show loading state
    document.getElementById('purchasesData').innerHTML = `
        <tr>
            <td colspan="8" class="text-center">
                <div class="spinner-border spinner-border-sm" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                Loading purchases...
            </td>
        </tr>
    `;
    
    // Load purchases for the user's apartment
    const purchasesRef = database.ref('purchases');
    const userApartmentId = currentUser.apartmentId;
    
    purchasesRef.orderByChild('apartmentId').equalTo(userApartmentId).once('value')
        .then((snapshot) => {
            const purchases = snapshot.val();
            const purchasesData = document.getElementById('purchasesData');
            purchasesData.innerHTML = '';
            
            if (!purchases) {
                purchasesData.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted">
                            No purchases found for your apartment
                        </td>
                    </tr>
                `;
                return;
            }
            
            let totalAmount = 0;
            let purchaseCount = 0;
            
            Object.keys(purchases).forEach((purchaseId) => {
                const purchase = purchases[purchaseId];
                
                // Skip if deleted
                if (purchase.isDeleted) return;
                
                const row = document.createElement('tr');
                
                // Format date
                const date = new Date(purchase.dateInfo?.unix * 1000 || Date.now());
                const formattedDate = date.toLocaleDateString();
                
                // Calculate total
                const purchaseTotal = purchase.totalPrice || (purchase.quantity * purchase.itemPriceAtTime);
                totalAmount += purchaseTotal;
                purchaseCount++;
                
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${purchase.vendorId || 'N/A'}</td>
                    <td>${purchase.itemId || 'N/A'}</td>
                    <td class="text-end">${purchase.quantity || 0}</td>
                    <td class="text-end">$${(purchase.itemPriceAtTime || 0).toFixed(2)}</td>
                    <td class="text-end">$${purchaseTotal.toFixed(2)}</td>
                    <td>${purchase.addedBy || 'Unknown'}</td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="editPurchase('${purchaseId}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deletePurchase('${purchaseId}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                purchasesData.appendChild(row);
            });
            
            // Update summary
            document.getElementById('totalPurchases').textContent = purchaseCount;
            document.getElementById('totalAmount').textContent = `$${totalAmount.toFixed(2)}`;
            
            // Initialize charts if they exist
            if (typeof initCharts === 'function') {
                initCharts(purchases);
            }
            
        })
        .catch((error) => {
            console.error("Error loading purchases:", error);
            document.getElementById('purchasesData').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger">
                        Error loading purchases: ${error.message}
                    </td>
                </tr>
            `;
        });
}

// Also add this function for chart initialization
function initCharts(purchasesData) {
    // Initialize purchase chart if canvas exists
    const purchaseChartCanvas = document.getElementById('purchaseChart');
    if (purchaseChartCanvas && window.Chart) {
        // Your chart initialization code here
        console.log("Initializing charts with data:", purchasesData);
    }
}

// Export functions for use in other files
window.loadDashboardData = loadDashboardData;
window.loadPurchasesData = loadPurchasesData;
window.loadVendorsData = loadVendorsData;
window.loadItemsData = loadItemsData;
window.loadReportsData = loadReportsData;
window.loadUsersData = loadUsersData;

window.loadProfileData = loadProfileData;

