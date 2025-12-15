// Form validation utilities
class FormValidator {
    constructor() {
        this.rules = {
            required: (value) => {
                if (!value || value.trim() === '') {
                    return 'This field is required';
                }
                return null;
            },
            email: (value) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    return 'Please enter a valid email address';
                }
                return null;
            },
            phone: (value) => {
                const phoneRegex = /^[\d\s\-\+\(\)]+$/;
                if (value && !phoneRegex.test(value)) {
                    return 'Please enter a valid phone number';
                }
                return null;
            },
            minLength: (min) => (value) => {
                if (value && value.length < min) {
                    return `Minimum length is ${min} characters`;
                }
                return null;
            },
            maxLength: (max) => (value) => {
                if (value && value.length > max) {
                    return `Maximum length is ${max} characters`;
                }
                return null;
            },
            numeric: (value) => {
                if (value && isNaN(parseFloat(value))) {
                    return 'Please enter a valid number';
                }
                return null;
            },
            positive: (value) => {
                const num = parseFloat(value);
                if (value && (isNaN(num) || num <= 0)) {
                    return 'Please enter a positive number';
                }
                return null;
            },
            username: (value) => {
                const usernameRegex = /^[a-zA-Z0-9_]+$/;
                if (!usernameRegex.test(value)) {
                    return 'Username can only contain letters, numbers, and underscores';
                }
                return null;
            },
            password: (value) => {
                if (!value || value.length < 8) {
                    return 'Password must be at least 8 characters long';
                }
                return null;
            },
            url: (value) => {
                try {
                    if (value) {
                        new URL(value);
                    }
                    return null;
                } catch (e) {
                    return 'Please enter a valid URL';
                }
            }
        };
    }

    // Validate a single field
    validateField(value, rules) {
        for (const rule of rules) {
            const error = this.applyRule(value, rule);
            if (error) {
                return error;
            }
        }
        return null;
    }

    // Apply a validation rule
    applyRule(value, rule) {
        if (typeof rule === 'string') {
            return this.rules[rule] ? this.rules[rule](value) : null;
        } else if (typeof rule === 'function') {
            return rule(value);
        } else if (typeof rule === 'object' && rule.type) {
            const ruleFunction = this.rules[rule.type];
            if (ruleFunction) {
                const error = ruleFunction(value);
                if (error && rule.message) {
                    return rule.message;
                }
                return error;
            }
        }
        return null;
    }

    // Validate an entire form
    validateForm(formData, validationRules) {
        const errors = {};
        let isValid = true;

        for (const field in validationRules) {
            const value = formData[field];
            const rules = validationRules[field];
            const error = this.validateField(value, rules);
            
            if (error) {
                errors[field] = error;
                isValid = false;
            }
        }

        return {
            isValid,
            errors
        };
    }

    // Show validation errors in form
    showFormErrors(errors, formElement) {
        // Clear previous errors
        this.clearFormErrors(formElement);

        for (const field in errors) {
            const fieldElement = formElement.querySelector(`[name="${field}"], #${field}`);
            if (fieldElement) {
                // Add error class to field
                fieldElement.classList.add('error');
                
                // Create or update error message
                let errorElement = fieldElement.parentNode.querySelector('.error-message');
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.className = 'error-message';
                    fieldElement.parentNode.appendChild(errorElement);
                }
                errorElement.textContent = errors[field];
            }
        }
    }

    // Clear validation errors from form
    clearFormErrors(formElement) {
        // Remove error classes
        formElement.querySelectorAll('.error').forEach(element => {
            element.classList.remove('error');
        });
        
        // Remove error messages
        formElement.querySelectorAll('.error-message').forEach(element => {
            element.remove();
        });
    }

    // Validate real-time as user types
    setupRealtimeValidation(formElement, validationRules) {
        const inputs = formElement.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            const fieldName = input.name || input.id;
            const rules = validationRules[fieldName];
            
            if (rules) {
                input.addEventListener('blur', () => {
                    const value = input.value;
                    const error = this.validateField(value, rules);
                    
                    // Remove previous error
                    input.classList.remove('error');
                    const errorElement = input.parentNode.querySelector('.error-message');
                    if (errorElement) {
                        errorElement.remove();
                    }
                    
                    // Show new error if exists
                    if (error) {
                        input.classList.add('error');
                        const newErrorElement = document.createElement('div');
                        newErrorElement.className = 'error-message';
                        newErrorElement.textContent = error;
                        input.parentNode.appendChild(newErrorElement);
                    }
                });
                
                input.addEventListener('input', () => {
                    // Clear error on input
                    input.classList.remove('error');
                    const errorElement = input.parentNode.querySelector('.error-message');
                    if (errorElement) {
                        errorElement.remove();
                    }
                });
            }
        });
    }
}

// Password strength validator
class PasswordStrengthValidator {
    constructor() {
        this.criteria = {
            length: { min: 8, weight: 1 },
            lowercase: { pattern: /[a-z]/, weight: 1 },
            uppercase: { pattern: /[A-Z]/, weight: 1 },
            numbers: { pattern: /[0-9]/, weight: 1 },
            special: { pattern: /[^a-zA-Z0-9]/, weight: 2 },
            bonusLength: { min: 12, weight: 1 },
            strongLength: { min: 16, weight: 1 }
        };
    }

    validate(password) {
        let score = 0;
        const feedback = [];
        const passedCriteria = [];

        // Check each criterion
        for (const [name, criterion] of Object.entries(this.criteria)) {
            if (criterion.pattern) {
                if (criterion.pattern.test(password)) {
                    score += criterion.weight;
                    passedCriteria.push(name);
                } else {
                    feedback.push(this.getFeedbackMessage(name));
                }
            } else if (criterion.min) {
                if (password.length >= criterion.min) {
                    score += criterion.weight;
                    passedCriteria.push(name);
                } else if (name === 'length') {
                    feedback.push(`Password must be at least ${criterion.min} characters long`);
                }
            }
        }

        // Determine strength level
        let strength = 'Very Weak';
        if (score >= 6) strength = 'Very Strong';
        else if (score >= 5) strength = 'Strong';
        else if (score >= 3) strength = 'Medium';
        else if (score >= 2) strength = 'Weak';

        return {
            score,
            strength,
            feedback: feedback.length > 0 ? feedback : ['Password is strong'],
            passedCriteria
        };
    }

    getFeedbackMessage(criteria) {
        const messages = {
            lowercase: 'Include lowercase letters',
            uppercase: 'Include uppercase letters',
            numbers: 'Include numbers',
            special: 'Include special characters'
        };
        return messages[criteria] || 'Password requirement not met';
    }
}

// Initialize validators
const formValidator = new FormValidator();
const passwordValidator = new PasswordStrengthValidator();

// Export for use in other files
window.formValidator = formValidator;
window.passwordValidator = passwordValidator;