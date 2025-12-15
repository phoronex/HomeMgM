class LanguageManager {
    constructor() {
        this.currentLang = localStorage.getItem('preferredLanguage') || 'en';
        this.translations = {};
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        await this.loadTranslations();
        this.applyLanguage();
        this.isInitialized = true;
    }

    async loadTranslations() {
        try {
            const response = await fetch(`/assets/i18n/${this.currentLang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${this.currentLang}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            // Fallback to English if loading fails
            if (this.currentLang !== 'en') {
                this.currentLang = 'en';
                await this.loadTranslations();
            }
        }
    }

    applyLanguage() {
        // Update HTML lang attribute
        document.documentElement.lang = this.currentLang;
        document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';
        
        // Apply RTL CSS class
        document.body.classList.toggle('rtl-mode', this.currentLang === 'ar');
        
        // Update all translatable elements
        this.updateTextContent();
        
        // Trigger custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: this.currentLang } 
        }));
    }

    updateTextContent() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (this.translations[key]) {
                // Preserve child elements if any
                if (element.children.length > 0) {
                    // Only update the text nodes, not child elements
                    const textNodes = [];
                    const walker = document.createTreeWalker(
                        element,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    
                    let node;
                    while (node = walker.nextNode()) {
                        if (node.nodeValue.trim()) {
                            textNodes.push(node);
                        }
                    }
                    
                    textNodes.forEach(textNode => {
                        textNode.nodeValue = this.translations[key];
                    });
                } else {
                    element.textContent = this.translations[key];
                }
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (this.translations[key]) {
                element.placeholder = this.translations[key];
            }
        });

        // Update titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (this.translations[key]) {
                element.title = this.translations[key];
            }
        });

        // Update alt attributes for images
        document.querySelectorAll('[data-i18n-alt]').forEach(element => {
            const key = element.getAttribute('data-i18n-alt');
            if (this.translations[key]) {
                element.alt = this.translations[key];
            }
        });
    }

    async switchLanguage(lang) {
        if (lang === this.currentLang) return;
        
        this.currentLang = lang;
        localStorage.setItem('preferredLanguage', lang);
        
        await this.loadTranslations();
        this.applyLanguage();
        
        // Update user profile if logged in
        if (auth && auth.currentUser) {
            try {
                const userRef = firebase.database().ref(`users/${auth.currentUser.uid}`);
                await userRef.update({ preferredLanguage: lang });
            } catch (error) {
                console.error('Error updating language preference:', error);
            }
        }
    }

    getText(key, params = {}) {
        let text = this.translations[key] || key;
        
        // Replace parameters in the text
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        
        return text;
    }

    // Get current language direction
    getDirection() {
        return this.currentLang === 'ar' ? 'rtl' : 'ltr';
    }

    // Check if current language is RTL
    isRTL() {
        return this.currentLang === 'ar';
    }

    // Format numbers based on language
    formatNumber(number) {
        if (this.currentLang === 'ar') {
            return number.toLocaleString('ar-SA');
        }
        return number.toLocaleString('en-US');
    }

    // Format currency based on language
    formatCurrency(amount, currency = 'SAR') {
        const options = {
            style: 'currency',
            currency: currency
        };
        
        if (this.currentLang === 'ar') {
            options.localeMatcher = 'lookup';
            return amount.toLocaleString('ar-SA', options);
        }
        
        return amount.toLocaleString('en-US', options);
    }
}

// Initialize globally
const languageManager = new LanguageManager();