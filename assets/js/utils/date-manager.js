class DateManager {
    constructor() {
        this.arabicDays = {
            0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء',
            4: 'الخميس', 5: 'الجمعة', 6: 'السبت'
        };
        this.englishDays = {
            0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
            4: 'Thursday', 5: 'Friday', 6: 'Saturday'
        };
        this.monthNames = {
            en: ["January", "February", "March", "April", "May", "June", 
                 "July", "August", "September", "October", "November", "December"],
            ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", 
                 "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
        };
    }

    // Parse purchase date and extract all date components
    parsePurchaseDate(dateString) {
        const date = this.convertToDateObject(dateString);
        
        return {
            dateTime: dateString,
            unix: Math.floor(date.getTime() / 1000),
            iso: date.toISOString(),
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            dayNameAr: this.arabicDays[date.getDay()],
            dayNameEn: this.englishDays[date.getDay()],
            monthNameAr: this.monthNames.ar[date.getMonth()],
            monthNameEn: this.monthNames.en[date.getMonth()]
        };
    }

    // Convert formatted string to Date object
    convertToDateObject(dateString) {
        // Handle format: "13/04/2025 10:15:30 صباحاً" or "13/04/2025 10:15:30 PM"
        const regex = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(صباحاً|مساءً|AM|PM)$/i;
        const match = dateString.match(regex);
        
        if (!match) {
            return new Date(); // Return current date if parsing fails
        }
        
        const [, day, month, year, hours, minutes, seconds, period] = match;
        let hour = parseInt(hours, 10);
        
        // Convert 12-hour to 24-hour format
        if (period === 'PM' || period === 'مساءً') {
            if (hour < 12) hour += 12;
        } else if (period === 'AM' || period === 'صباحاً') {
            if (hour === 12) hour = 0;
        }
        
        return new Date(year, month - 1, day, hour, minutes, seconds);
    }

    // Generate date object for new records
    generateDateInfo(date = new Date()) {
        return this.parsePurchaseDate(this.formatDateTime(date));
    }

    // Format Date to dd/mm/yyyy hh:mm:ss AM/PM
    formatDateTime(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        
        let period;
        if (languageManager && languageManager.currentLang === 'ar') {
            period = hours < 12 ? 'صباحاً' : 'مساءً';
        } else {
            period = hours < 12 ? 'AM' : 'PM';
        }
        
        if (hours > 12) {
            hours -= 12;
        } else if (hours === 0) {
            hours = 12;
        }
        
        hours = hours.toString().padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${period}`;
    }

    // Get current date in all formats
    getCurrentDateInfo() {
        return this.generateDateInfo();
    }

    // Format date for display based on language preference
    formatDateForDisplay(dateInfo, format = 'full') {
        if (!dateInfo) return '';
        
        const lang = languageManager ? languageManager.currentLang : 'en';
        
        switch (format) {
            case 'full':
                return lang === 'ar' 
                    ? `${dateInfo.day} ${dateInfo.monthNameAr} ${dateInfo.year}`
                    : `${dateInfo.monthNameEn} ${dateInfo.day}, ${dateInfo.year}`;
            case 'short':
                return lang === 'ar'
                    ? `${dateInfo.day}/${dateInfo.month}/${dateInfo.year}`
                    : `${dateInfo.month}/${dateInfo.day}/${dateInfo.year}`;
            case 'time':
                return dateInfo.dateTime.split(' ').slice(1).join(' ');
            default:
                return dateInfo.dateTime;
        }
    }
}

// Initialize globally
const dateManager = new DateManager();