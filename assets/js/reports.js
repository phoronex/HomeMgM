// Reports JavaScript
let currentReportData = null;
let reportCharts = [];

// Load reports data
async function loadReportsData() {
    try {
        // Set default report period to current month
        const reportPeriod = document.getElementById('reportPeriod');
        if (reportPeriod) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            reportPeriod.value = `${year}-${month}`;
        }
        
        // Setup report form
        setupReportForm();
    } catch (error) {
        console.error('Error loading reports data:', error);
        showNotification('Error loading reports data', 'error');
    }
}

// Setup report form
function setupReportForm() {
    const reportForm = document.getElementById('reportForm');
    const previewReportBtn = document.getElementById('previewReportBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    
    // Handle form submission
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateReport();
    });
    
    // Handle preview button
    previewReportBtn.addEventListener('click', async () => {
        await generateReport(true);
    });
    
    // Handle download button
    downloadReportBtn.addEventListener('click', () => {
        downloadReport();
    });
    
    // Handle close preview button
    closePreviewBtn.addEventListener('click', () => {
        document.getElementById('reportPreview').style.display = 'none';
    });
}

// Generate report
async function generateReport(preview = false) {
    try {
        showNotification('Generating report...', 'info');
        
        const reportType = document.getElementById('reportType').value;
        const reportPeriod = document.getElementById('reportPeriod').value;
        const reportLanguage = document.getElementById('reportLanguage').value;
        const reportFormat = document.getElementById('reportFormat').value;
        const includeCharts = document.getElementById('includeCharts').checked;
        
        // Parse report period
        const [year, month] = reportPeriod.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month
        
        // Get report data based on type
        let reportData;
        switch (reportType) {
            case 'monthly':
                reportData = await generateMonthlyReport(startDate, endDate, reportLanguage);
                break;
            case 'yearly':
                reportData = await generateYearlyReport(year, reportLanguage);
                break;
            case 'category':
                reportData = await generateCategoryReport(startDate, endDate, reportLanguage);
                break;
            case 'vendor':
                reportData = await generateVendorReport(startDate, endDate, reportLanguage);
                break;
            case 'item':
                reportData = await generateItemReport(startDate, endDate, reportLanguage);
                break;
            default:
                throw new Error('Invalid report type');
        }
        
        currentReportData = {
            type: reportType,
            period: reportPeriod,
            language: reportLanguage,
            format: reportFormat,
            includeCharts: includeCharts,
            data: reportData
        };
        
        if (preview) {
            await showReportPreview(currentReportData);
        } else {
            await downloadReport();
        }
        
        showNotification('Report generated successfully', 'success');
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('Error generating report: ' + error.message, 'error');
    }
}

// Generate monthly report
async function generateMonthlyReport(startDate, endDate, language) {
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);
    
    const purchasesSnapshot = await database.ref('purchases')
        .orderByChild('dateInfo/unix')
        .startAt(startUnix)
        .endAt(endUnix)
        .once('value');
    
    const purchases = [];
    const categoryTotals = {};
    const vendorTotals = {};
    let totalAmount = 0;
    
    purchasesSnapshot.forEach(childSnapshot => {
        const purchase = childSnapshot.val();
        if (!purchase.isDeleted) {
            purchases.push({
                id: childSnapshot.key,
                ...purchase
            });
            
            // Get item details
            database.ref(`items/${purchase.itemId}`).once('value').then(itemSnapshot => {
                const item = itemSnapshot.val();
                if (item) {
                    const category = item.category || 'other';
                    if (!categoryTotals[category]) {
                        categoryTotals[category] = 0;
                    }
                    categoryTotals[category] += purchase.totalPrice || 0;
                }
            });
            
            // Get vendor details
            database.ref(`vendors/${purchase.vendorId}`).once('value').then(vendorSnapshot => {
                const vendor = vendorSnapshot.val();
                if (vendor) {
                    const vendorName = language === 'ar' ? vendor.arabicName : vendor.englishName;
                    if (!vendorTotals[vendorName]) {
                        vendorTotals[vendorName] = 0;
                    }
                    vendorTotals[vendorName] += purchase.totalPrice || 0;
                }
            });
            
            totalAmount += purchase.totalPrice || 0;
        }
    });
    
    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        title: language === 'ar' ? 'تقرير شهري' : 'Monthly Report',
        period: `${startDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}`,
        summary: {
            totalPurchases: purchases.length,
            totalAmount: totalAmount,
            averagePurchase: purchases.length > 0 ? totalAmount / purchases.length : 0
        },
        categoryBreakdown: categoryTotals,
        vendorBreakdown: vendorTotals,
        purchases: purchases
    };
}

// Generate yearly report
async function generateYearlyReport(year, language) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);
    
    const purchasesSnapshot = await database.ref('purchases')
        .orderByChild('dateInfo/unix')
        .startAt(startUnix)
        .endAt(endUnix)
        .once('value');
    
    const monthlyTotals = {};
    const categoryTotals = {};
    let totalAmount = 0;
    
    purchasesSnapshot.forEach(childSnapshot => {
        const purchase = childSnapshot.val();
        if (!purchase.isDeleted) {
            const month = purchase.dateInfo.month - 1; // Adjust for 0-based month
            const monthKey = language === 'ar' 
                ? dateManager.monthNames.ar[month] 
                : dateManager.monthNames.en[month];
            
            if (!monthlyTotals[monthKey]) {
                monthlyTotals[monthKey] = 0;
            }
            monthlyTotals[monthKey] += purchase.totalPrice || 0;
            
            // Get item category
            database.ref(`items/${purchase.itemId}`).once('value').then(itemSnapshot => {
                const item = itemSnapshot.val();
                if (item) {
                    const category = item.category || 'other';
                    if (!categoryTotals[category]) {
                        categoryTotals[category] = 0;
                    }
                    categoryTotals[category] += purchase.totalPrice || 0;
                }
            });
            
            totalAmount += purchase.totalPrice || 0;
        }
    });
    
    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        title: language === 'ar' ? 'تقرير سنوي' : 'Yearly Report',
        period: year.toString(),
        summary: {
            totalAmount: totalAmount,
            averageMonthly: totalAmount / 12
        },
        monthlyBreakdown: monthlyTotals,
        categoryBreakdown: categoryTotals
    };
}

// Generate category report
async function generateCategoryReport(startDate, endDate, language) {
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);
    
    const purchasesSnapshot = await database.ref('purchases')
        .orderByChild('dateInfo/unix')
        .startAt(startUnix)
        .endAt(endUnix)
        .once('value');
    
    const categoryDetails = {};
    
    purchasesSnapshot.forEach(childSnapshot => {
        const purchase = childSnapshot.val();
        if (!purchase.isDeleted) {
            // Get item details
            database.ref(`items/${purchase.itemId}`).once('value').then(itemSnapshot => {
                const item = itemSnapshot.val();
                if (item) {
                    const category = item.category || 'other';
                    const categoryName = language === 'ar' 
                        ? (item.arabicName || item.englishName)
                        : item.englishName;
                    
                    if (!categoryDetails[category]) {
                        categoryDetails[category] = {
                            name: language === 'ar' ? dateManager.monthNames.ar[category] || category : category,
                            totalAmount: 0,
                            itemCount: 0,
                            items: {}
                        };
                    }
                    
                    categoryDetails[category].totalAmount += purchase.totalPrice || 0;
                    categoryDetails[category].itemCount += 1;
                    
                    if (!categoryDetails[category].items[categoryName]) {
                        categoryDetails[category].items[categoryName] = {
                            amount: 0,
                            count: 0
                        };
                    }
                    
                    categoryDetails[category].items[categoryName].amount += purchase.totalPrice || 0;
                    categoryDetails[category].items[categoryName].count += 1;
                }
            });
        }
    });
    
    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        title: language === 'ar' ? 'تقرير الفئة' : 'Category Report',
        period: `${startDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}`,
        categories: categoryDetails
    };
}

// Generate vendor report
async function generateVendorReport(startDate, endDate, language) {
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);
    
    const purchasesSnapshot = await database.ref('purchases')
        .orderByChild('dateInfo/unix')
        .startAt(startUnix)
        .endAt(endUnix)
        .once('value');
    
    const vendorDetails = {};
    
    purchasesSnapshot.forEach(childSnapshot => {
        const purchase = childSnapshot.val();
        if (!purchase.isDeleted) {
            // Get vendor details
            database.ref(`vendors/${purchase.vendorId}`).once('value').then(vendorSnapshot => {
                const vendor = vendorSnapshot.val();
                if (vendor) {
                    const vendorName = language === 'ar' ? vendor.arabicName : vendor.englishName;
                    
                    if (!vendorDetails[vendorName]) {
                        vendorDetails[vendorName] = {
                            name: vendorName,
                            contact: vendor.contact || '',
                            phone: vendor.phone || '',
                            email: vendor.email || '',
                            totalAmount: 0,
                            purchaseCount: 0,
                            purchases: []
                        };
                    }
                    
                    vendorDetails[vendorName].totalAmount += purchase.totalPrice || 0;
                    vendorDetails[vendorName].purchaseCount += 1;
                    vendorDetails[vendorName].purchases.push({
                        date: purchase.dateInfo,
                        amount: purchase.totalPrice || 0
                    });
                }
            });
        }
    });
    
    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        title: language === 'ar' ? 'تقرير المورد' : 'Vendor Report',
        period: `${startDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}`,
        vendors: vendorDetails
    };
}

// Generate item report
async function generateItemReport(startDate, endDate, language) {
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);
    
    const purchasesSnapshot = await database.ref('purchases')
        .orderByChild('dateInfo/unix')
        .startAt(startUnix)
        .endAt(endUnix)
        .once('value');
    
    const itemDetails = {};
    
    purchasesSnapshot.forEach(childSnapshot => {
        const purchase = childSnapshot.val();
        if (!purchase.isDeleted) {
            // Get item details
            database.ref(`items/${purchase.itemId}`).once('value').then(itemSnapshot => {
                const item = itemSnapshot.val();
                if (item) {
                    const itemName = language === 'ar' ? item.arabicName : item.englishName;
                    
                    if (!itemDetails[itemName]) {
                        itemDetails[itemName] = {
                            name: itemName,
                            category: language === 'ar' ? dateManager.monthNames.ar[item.category] || item.category : item.category,
                            unitPrice: item.unitPrice || 0,
                            totalQuantity: 0,
                            totalAmount: 0,
                            purchaseCount: 0,
                            averagePrice: 0
                        };
                    }
                    
                    itemDetails[itemName].totalQuantity += purchase.quantity || 0;
                    itemDetails[itemName].totalAmount += purchase.totalPrice || 0;
                    itemDetails[itemName].purchaseCount += 1;
                    
                    if (itemDetails[itemName].purchaseCount > 0) {
                        itemDetails[itemName].averagePrice = itemDetails[itemName].totalAmount / itemDetails[itemName].totalQuantity;
                    }
                }
            });
        }
    });
    
    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        title: language === 'ar' ? 'تقرير المنتج' : 'Item Report',
        period: `${startDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}`,
        items: itemDetails
    };
}

// Show report preview
async function showReportPreview(reportData) {
    const reportPreview = document.getElementById('reportPreview');
    const reportContent = document.getElementById('reportContent');
    
    // Clear previous charts
    reportCharts.forEach(chart => chart.destroy());
    reportCharts = [];
    
    // Generate HTML content based on report type
    let html = '';
    
    switch (reportData.type) {
        case 'monthly':
            html = generateMonthlyReportHTML(reportData);
            break;
        case 'yearly':
            html = generateYearlyReportHTML(reportData);
            break;
        case 'category':
            html = generateCategoryReportHTML(reportData);
            break;
        case 'vendor':
            html = generateVendorReportHTML(reportData);
            break;
        case 'item':
            html = generateItemReportHTML(reportData);
            break;
    }
    
    reportContent.innerHTML = html;
    
    // Create charts if enabled
    if (reportData.includeCharts) {
        await createReportCharts(reportData);
    }
    
    // Apply translations
    languageManager.updateTextContent();
    
    // Show preview
    reportPreview.style.display = 'block';
}

// Generate monthly report HTML
function generateMonthlyReportHTML(reportData) {
    const { data, language } = reportData;
    const isRTL = language === 'ar';
    
    let html = `
        <div class="report-header">
            <h2>${data.title}</h2>
            <p>${data.period}</p>
        </div>
        
        <div class="report-summary">
            <h3>${language === 'ar' ? 'ملخص' : 'Summary'}</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span>${language === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases'}:</span>
                    <span>${data.summary.totalPurchases}</span>
                </div>
                <div class="summary-item">
                    <span>${language === 'ar' ? 'إجمالي المبلغ' : 'Total Amount'}:</span>
                    <span>${formatCurrency(data.summary.totalAmount)}</span>
                </div>
                <div class="summary-item">
                    <span>${language === 'ar' ? 'متوسط الشراء' : 'Average Purchase'}:</span>
                    <span>${formatCurrency(data.summary.averagePurchase)}</span>
                </div>
            </div>
        </div>
        
        <div class="report-charts">
            <div class="chart-container">
                <canvas id="categoryChart" width="400" height="200"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="vendorChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        <div class="report-table">
            <h3>${language === 'ar' ? 'تفاصيل المشتريات' : 'Purchase Details'}</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>${language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th>${language === 'ar' ? 'المنتج' : 'Item'}</th>
                        <th>${language === 'ar' ? 'المورد' : 'Vendor'}</th>
                        <th>${language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                        <th>${language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add purchase details
    for (const purchase of data.purchases) {
        // Get item and vendor names (simplified for preview)
        const itemName = language === 'ar' ? purchase.itemId : purchase.itemId;
        const vendorName = language === 'ar' ? purchase.vendorId : purchase.vendorId;
        
        html += `
            <tr>
                <td>${formatDate(purchase.dateInfo)}</td>
                <td>${itemName}</td>
                <td>${vendorName}</td>
                <td>${purchase.quantity}</td>
                <td>${formatCurrency(purchase.totalPrice)}</td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Generate yearly report HTML
function generateYearlyReportHTML(reportData) {
    const { data, language } = reportData;
    const isRTL = language === 'ar';
    
    let html = `
        <div class="report-header">
            <h2>${data.title}</h2>
            <p>${data.period}</p>
        </div>
        
        <div class="report-summary">
            <h3>${language === 'ar' ? 'ملخص' : 'Summary'}</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span>${language === 'ar' ? 'إجمالي المبلغ' : 'Total Amount'}:</span>
                    <span>${formatCurrency(data.summary.totalAmount)}</span>
                </div>
                <div class="summary-item">
                    <span>${language === 'ar' ? 'متوسط شهري' : 'Monthly Average'}:</span>
                    <span>${formatCurrency(data.summary.averageMonthly)}</span>
                </div>
            </div>
        </div>
        
        <div class="report-charts">
            <div class="chart-container">
                <canvas id="monthlyChart" width="400" height="200"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="categoryChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        <div class="report-table">
            <h3>${language === 'ar' ? 'تفاصيل شهرية' : 'Monthly Details'}</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>${language === 'ar' ? 'الشهر' : 'Month'}</th>
                        <th>${language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add monthly details
    for (const [month, amount] of Object.entries(data.monthlyBreakdown)) {
        html += `
            <tr>
                <td>${month}</td>
                <td>${formatCurrency(amount)}</td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Generate category report HTML
function generateCategoryReportHTML(reportData) {
    const { data, language } = reportData;
    const isRTL = language === 'ar';
    
    let html = `
        <div class="report-header">
            <h2>${data.title}</h2>
            <p>${data.period}</p>
        </div>
        
        <div class="report-charts">
            <div class="chart-container">
                <canvas id="categoryChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        <div class="report-table">
            <h3>${language === 'ar' ? 'تفاصيل الفئة' : 'Category Details'}</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>${language === 'ar' ? 'الفئة' : 'Category'}</th>
                        <th>${language === 'ar' ? 'المنتجات' : 'Items'}</th>
                        <th>${language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                        <th>${language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add category details
    for (const [category, details] of Object.entries(data.categories)) {
        html += `
            <tr>
                <td>${details.name}</td>
                <td>${details.itemCount}</td>
                <td>${Object.values(details.items).reduce((sum, item) => sum + item.count, 0)}</td>
                <td>${formatCurrency(details.totalAmount)}</td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Generate vendor report HTML
function generateVendorReportHTML(reportData) {
    const { data, language } = reportData;
    const isRTL = language === 'ar';
    
    let html = `
        <div class="report-header">
            <h2>${data.title}</h2>
            <p>${data.period}</p>
        </div>
        
        <div class="report-charts">
            <div class="chart-container">
                <canvas id="vendorChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        <div class="report-table">
            <h3>${language === 'ar' ? 'تفاصيل المورد' : 'Vendor Details'}</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>${language === 'ar' ? 'المورد' : 'Vendor'}</th>
                        <th>${language === 'ar' ? 'التواصل' : 'Contact'}</th>
                        <th>${language === 'ar' ? 'الهاتف' : 'Phone'}</th>
                        <th>${language === 'ar' ? 'البريد' : 'Email'}</th>
                        <th>${language === 'ar' ? 'المشتريات' : 'Purchases'}</th>
                        <th>${language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add vendor details
    for (const [vendorName, details] of Object.entries(data.vendors)) {
        html += `
            <tr>
                <td>${details.name}</td>
                <td>${details.contact}</td>
                <td>${details.phone}</td>
                <td>${details.email}</td>
                <td>${details.purchaseCount}</td>
                <td>${formatCurrency(details.totalAmount)}</td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Generate item report HTML
function generateItemReportHTML(reportData) {
    const { data, language } = reportData;
    const isRTL = language === 'ar';
    
    let html = `
        <div class="report-header">
            <h2>${data.title}</h2>
            <p>${data.period}</p>
        </div>
        
        <div class="report-charts">
            <div class="chart-container">
                <canvas id="itemChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        <div class="report-table">
            <h3>${language === 'ar' ? 'تفاصيل المنتج' : 'Item Details'}</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>${language === 'ar' ? 'المنتج' : 'Item'}</th>
                        <th>${language === 'ar' ? 'الفئة' : 'Category'}</th>
                        <th>${language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                        <th>${language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                        <th>${language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                        <th>${language === 'ar' ? 'متوسط السعر' : 'Avg Price'}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add item details
    for (const [itemName, details] of Object.entries(data.items)) {
        html += `
            <tr>
                <td>${details.name}</td>
                <td>${details.category}</td>
                <td>${formatCurrency(details.unitPrice)}</td>
                <td>${details.totalQuantity}</td>
                <td>${formatCurrency(details.totalAmount)}</td>
                <td>${formatCurrency(details.averagePrice)}</td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Create report charts
async function createReportCharts(reportData) {
    const { data, type, language } = reportData;
    
    switch (type) {
        case 'monthly':
            await createMonthlyCharts(data);
            break;
        case 'yearly':
            await createYearlyCharts(data);
            break;
        case 'category':
            await createCategoryCharts(data);
            break;
        case 'vendor':
            await createVendorCharts(data);
            break;
        case 'item':
            await createItemCharts(data);
            break;
    }
}

// Create monthly report charts
async function createMonthlyCharts(data) {
    // Category chart
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        const categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data.categoryBreakdown).map(cat => languageManager.getText(cat)),
                datasets: [{
                    data: Object.values(data.categoryBreakdown),
                    backgroundColor: [
                        '#FF9800', '#2196F3', '#4CAF50', '#F44336', '#9C27B0', '#607D8B'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        reportCharts.push(categoryChart);
    }
    
    // Vendor chart
    const vendorCtx = document.getElementById('vendorChart');
    if (vendorCtx) {
        const vendorChart = new Chart(vendorCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.vendorBreakdown),
                datasets: [{
                    label: 'Amount',
                    data: Object.values(data.vendorBreakdown),
                    backgroundColor: '#FF9800'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        reportCharts.push(vendorChart);
    }
}

// Create yearly report charts
async function createYearlyCharts(data) {
    // Monthly chart
    const monthlyCtx = document.getElementById('monthlyChart');
    if (monthlyCtx) {
        const monthlyChart = new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: Object.keys(data.monthlyBreakdown),
                datasets: [{
                    label: 'Monthly Spending',
                    data: Object.values(data.monthlyBreakdown),
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        reportCharts.push(monthlyChart);
    }
    
    // Category chart
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        const categoryChart = new Chart(categoryCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(data.categoryBreakdown).map(cat => languageManager.getText(cat)),
                datasets: [{
                    data: Object.values(data.categoryBreakdown),
                    backgroundColor: [
                        '#FF9800', '#2196F3', '#4CAF50', '#F44336', '#9C27B0', '#607D8B'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        reportCharts.push(categoryChart);
    }
}

// Create category report charts
async function createCategoryCharts(data) {
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        const categoryChart = new Chart(categoryCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.categories).map(cat => data.categories[cat].name),
                datasets: [{
                    label: 'Total Amount',
                    data: Object.values(data.categories).map(cat => cat.totalAmount),
                    backgroundColor: '#FF9800'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        reportCharts.push(categoryChart);
    }
}

// Create vendor report charts
async function createVendorCharts(data) {
    const vendorCtx = document.getElementById('vendorChart');
    if (vendorCtx) {
        const vendorChart = new Chart(vendorCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.vendors),
                datasets: [{
                    label: 'Total Amount',
                    data: Object.values(data.vendors).map(vendor => vendor.totalAmount),
                    backgroundColor: '#FF9800'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        reportCharts.push(vendorChart);
    }
}

// Create item report charts
async function createItemCharts(data) {
    const itemCtx = document.getElementById('itemChart');
    if (itemCtx) {
        const itemChart = new Chart(itemCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.items),
                datasets: [{
                    label: 'Total Amount',
                    data: Object.values(data.items).map(item => item.totalAmount),
                    backgroundColor: '#FF9800'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        reportCharts.push(itemChart);
    }
}

// Download report
async function downloadReport() {
    if (!currentReportData) {
        showNotification('No report data available', 'error');
        return;
    }
    
    try {
        showNotification('Downloading report...', 'info');
        
        const { format, data } = currentReportData;
        
        switch (format) {
            case 'pdf':
                await downloadPDFReport();
                break;
            case 'excel':
                await downloadExcelReport();
                break;
            case 'html':
                await downloadHTMLReport();
                break;
            default:
                throw new Error('Invalid report format');
        }
        
        showNotification('Report downloaded successfully', 'success');
    } catch (error) {
        console.error('Error downloading report:', error);
        showNotification('Error downloading report: ' + error.message, 'error');
    }
}

// Download PDF report
async function downloadPDFReport() {
    const { data, language } = currentReportData;
    
    // Create PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set font based on language
    if (language === 'ar') {
        doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
    }
    
    // Add title
    doc.setFontSize(20);
    doc.text(data.title, 20, 20);
    
    // Add period
    doc.setFontSize(12);
    doc.text(data.period, 20, 30);
    
    // Add summary
    if (data.summary) {
        doc.setFontSize(14);
        doc.text('Summary', 20, 45);
        
        doc.setFontSize(10);
        let yPosition = 55;
        for (const [key, value] of Object.entries(data.summary)) {
            doc.text(`${key}: ${value}`, 20, yPosition);
            yPosition += 10;
        }
    }
    
    // Add table
    if (data.purchases) {
        doc.autoTable({
            head: [['Date', 'Item', 'Vendor', 'Quantity', 'Total']],
            body: data.purchases.map(purchase => [
                formatDate(purchase.dateInfo),
                purchase.itemId,
                purchase.vendorId,
                purchase.quantity,
                formatCurrency(purchase.totalPrice)
            ]),
            startY: 100
        });
    }
    
    // Save PDF
    doc.save(`report_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Download Excel report
async function downloadExcelReport() {
    const { data } = currentReportData;
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Create worksheet
    let worksheetData = [];
    
    // Add header
    worksheetData.push([data.title]);
    worksheetData.push([data.period]);
    worksheetData.push([]);
    
    // Add summary
    if (data.summary) {
        worksheetData.push(['Summary']);
        for (const [key, value] of Object.entries(data.summary)) {
            worksheetData.push([key, value]);
        }
        worksheetData.push([]);
    }
    
    // Add purchases
    if (data.purchases) {
        worksheetData.push(['Date', 'Item', 'Vendor', 'Quantity', 'Total']);
        for (const purchase of data.purchases) {
            worksheetData.push([
                formatDate(purchase.dateInfo),
                purchase.itemId,
                purchase.vendorId,
                purchase.quantity,
                purchase.totalPrice
            ]);
        }
    }
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    
    // Save workbook
    XLSX.writeFile(workbook, `report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Download HTML report
async function downloadHTMLReport() {
    const reportContent = document.getElementById('reportContent');
    
    // Create HTML document
    const htmlDocument = `
        <!DOCTYPE html>
        <html lang="${currentReportData.language}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${currentReportData.data.title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .report-header { text-align: center; margin-bottom: 30px; }
                .report-summary { margin-bottom: 30px; }
                .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
                .summary-item { padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                .report-table { margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .chart-container { margin: 20px 0; text-align: center; }
            </style>
        </head>
        <body>
            ${reportContent.innerHTML}
        </body>
        </html>
    `;
    
    // Create blob
    const blob = new Blob([htmlDocument], { type: 'text/html' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${new Date().toISOString().split('T')[0]}.html`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
}

// Initialize reports page
document.addEventListener('DOMContentLoaded', () => {
    // Load reports data if we're on reports page
    if (getCurrentPage() === 'reports') {
        loadReportsData();
    }
});

// Export functions for use in other files
window.loadReportsData = loadReportsData;