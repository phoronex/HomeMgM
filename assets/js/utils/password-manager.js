class PasswordManager {
    constructor() {
        this.iterations = 10000; // Number of iterations for PBKDF2
        this.keyLength = 64; // Key length in bytes
        this.saltLength = 32; // Salt length in bytes
    }

    // Generate a cryptographically secure random salt
    generateSalt() {
        const array = new Uint8Array(this.saltLength);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Hash password using PBKDF2
    async hashPassword(password, salt) {
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
                salt: encoder.encode(salt),
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        const exported = await crypto.subtle.exportKey('raw', key);
        const hashArray = Array.from(new Uint8Array(exported));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Create a password hash with salt
    async createHash(password) {
        const salt = this.generateSalt();
        const hash = await this.hashPassword(password, salt);
        return `${hash}:${salt}:${this.iterations}`;
    }

    // Verify a password against a stored hash
    async verifyPassword(password, storedHash) {
        const [hash, salt, iterations] = storedHash.split(':');
        
        if (!hash || !salt || !iterations) {
            throw new Error('Invalid hash format');
        }
        
        this.iterations = parseInt(iterations);
        const newHash = await this.hashPassword(password, salt);
        return hash === newHash;
    }

    // Check password strength
    checkPasswordStrength(password) {
        if (!password) return { score: 0, feedback: 'Password cannot be empty' };
        
        let score = 0;
        const feedback = [];
        
        // Length check
        if (password.length >= 8) {
            score += 1;
        } else {
            feedback.push('Password should be at least 8 characters');
        }
        
        // Complexity checks
        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('Include lowercase letters');
        
        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('Include uppercase letters');
        
        if (/[0-9]/.test(password)) score += 1;
        else feedback.push('Include numbers');
        
        if (/[^a-zA-Z0-9]/.test(password)) score += 1;
        else feedback.push('Include special characters');
        
        // Additional length bonus
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;
        
        let strength = 'Very Weak';
        if (score >= 6) strength = 'Very Strong';
        else if (score >= 4) strength = 'Strong';
        else if (score >= 3) strength = 'Medium';
        else if (score >= 2) strength = 'Weak';
        
        return {
            score,
            strength,
            feedback: feedback.length > 0 ? feedback : ['Password is strong']
        };
    }
}

// Initialize globally
const passwordManager = new PasswordManager();