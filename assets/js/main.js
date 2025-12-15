// Main JavaScript file
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize language manager
    await languageManager.init();
    
    // Initialize auth manager
    authManager.init();
    
    // Setup global event listeners
    setupGlobalEventListeners();
    
    // Check authentication
    authManager.addAuthListener(async (user) => {
        if (!user) {
            // Redirect to login if not on login page
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
            return;
        }
        
        // Load user profile
        await authManager.loadUserProfile(user.uid);
        
        // Update UI with user info
        updateUserInfo();
        
        // Show/hide menu items based on role
        updateMenuVisibility();
        
        // Initialize page-specific functionality
        initializePage();
    });
});

// Setup global event listeners
function setupGlobalEventListeners() {
    // Language switcher
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
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authManager.logout();
        });
    }
    
    // Modal close buttons
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
    
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            if (page) {
                navigateToPage(page);
            }
        });
    });
    
    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
        // Update date formats if date manager is available
        if (window.dateManager) {
            // Re-render any date elements
            updateDateElements();
        }
    });
}

// Update user info in UI
function updateUserInfo() {
    const userNameElement = document.getElementById('userName');
    if (userNameElement && authManager.currentUserProfile) {
        const name = languageManager.currentLang === 'ar' 
            ? authManager.currentUserProfile.arabicName 
            : authManager.currentUserProfile.englishName;
        userNameElement.textContent = name || authManager.currentUserProfile.userName;
    }
}

// Update menu visibility based on user role
function updateMenuVisibility() {
    if (!authManager.currentUserProfile) return;
    
    const role = authManager.currentUserProfile.role;
    
    // Show/hide users menu item
    const usersMenuItem = document.getElementById('usersMenuItem');
    if (usersMenuItem) {
        usersMenuItem.style.display = (role === 'apartmentAdmin' || role === 'systemAdmin') ? 'flex' : 'none';
    }
    
    // Show/hide system admin menu item
    const systemAdminMenuItem = document.getElementById('systemAdminMenuItem');
    if (systemAdminMenuItem) {
        systemAdminMenuItem.style.display = role === 'systemAdmin' ? 'flex' : 'none';
    }
}

// Navigate to page
function navigateToPage(page) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    
    // Show selected page
    const pageElement = document.getElementById(`${page}Page`);
    if (pageElement) {
        pageElement.style.display = 'block';
    }
    
    // Update active state in sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`.sidebar-item[data-page="${page}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // Load page-specific data
    loadPageData(page);
}

// Load page-specific data
function loadPageData(page) {
    switch (page) {
        case 'dashboard':
            if (window.loadDashboardData) {
                window.loadDashboardData();
            }
            break;
        case 'purchases':
            if (window.loadPurchasesData) {
                window.loadPurchasesData();
            }
            break;
        case 'vendors':
            if (window.loadVendorsData) {
                window.loadVendorsData();
            }
            break;
        case 'items':
            if (window.loadItemsData) {
                window.loadItemsData();
            }
            break;
        case 'reports':
            if (window.loadReportsData) {
                window.loadReportsData();
            }
            break;
        case 'users':
            if (window.loadUsersData) {
                window.loadUsersData();
            }
            break;
        case 'profile':
            if (window.loadProfileData) {
                window.loadProfileData();
            }
            break;
    }
}

// Initialize page
function initializePage() {
    const currentPage = getCurrentPage();
    navigateToPage(currentPage);
}

// Get current page from URL
function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '');
    
    // Default to dashboard if no specific page
    if (page === '' || page === 'index') {
        return 'dashboard';
    }
    
    return page;
}

// Update date elements
function updateDateElements() {
    document.querySelectorAll('[data-date]').forEach(element => {
        const dateString = element.getAttribute('data-date');
        if (dateString) {
            const dateInfo = dateManager.parsePurchaseDate(dateString);
            element.textContent = dateManager.formatDateForDisplay(dateInfo);
        }
    });
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

// Format currency
function formatCurrency(amount) {
    return languageManager.formatCurrency(amount, 'SAR');
}

// Format date
function formatDate(dateInfo) {
    return dateManager.formatDateForDisplay(dateInfo);
}

// Confirm action
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// Export utility functions for use in other files
window.showNotification = showNotification;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.confirmAction = confirmAction;
window.navigateToPage = navigateToPage;