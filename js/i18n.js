/**
 * i18n.js - Internationalization module
 * Handles language switching and translation loading from modular files.
 */

/**
 * Recursively merge properties of two objects.
 * Source properties overwrite target properties unless both are objects,
 * in which case they are merged recursively.
 * @param {object} target - The target object to merge into.
 * @param {object} source - The source object.
 * @returns {object} - The merged target object.
 */
function mergeObjects(target, source) {
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
                target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                // Both are objects, merge recursively
                mergeObjects(target[key], source[key]);
            } else {
                // Overwrite target property with source property
                target[key] = source[key];
            }
        }
    }
    return target;
}

class I18n {
    constructor() {
        this.translations = {}; // Will hold merged translations for each language
        this.currentLang = localStorage.getItem('lang') || 'en'; // Or your default language
        this.loadedLanguages = new Set(); // Track which languages have been fully loaded
    }

    /**
     * Get the module name corresponding to the current HTML page.
     * Extracts the filename without extension from the URL path.
     * Defaults to 'index' if the path is '/' or empty.
     * @returns {string} - The page module name (e.g., 'index', 'models', 'faq')
     * @private
     */
    _getPageModuleName() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        if (filename === '' || path === '/') {
            return 'index'; // Default for root page
        }
        // Remove extension
        const moduleName = filename.substring(0, filename.lastIndexOf('.')) || filename;
        // Handle potential edge cases or map specific filenames if needed
        // e.g., if 'product-detail.html' should load 'product.json'
        // switch (moduleName) {
        //     case 'product-detail': return 'product';
        // }
        return moduleName;
    }

    /**
     * Load translations for a specific language from common and page-specific files.
     * @param {string} lang - Language code (e.g., 'en', 'zh')
     * @returns {Promise<void>} - Promise that resolves when translations are loaded and merged.
     */
    async loadTranslations(lang) {
        if (this.loadedLanguages.has(lang)) {
            // console.log(`Translations for ${lang} already loaded.`);
            return Promise.resolve();
        }
        console.log(`Loading translations for ${lang}...`);

        // Initialize language object if it doesn't exist
        if (!this.translations[lang]) {
            this.translations[lang] = {};
        }

        const pageModuleName = this._getPageModuleName();
        console.log(`Current page module detected: ${pageModuleName}`);

        const commonPath = `locale/${lang}/common.json`;
        const pageSpecificPath = `locale/${lang}/${pageModuleName}.json`;

        // Create fetch promises for common and page-specific modules
        const fetchPromises = [
            // Fetch common translations
            fetch(commonPath)
                .then(response => {
                    if (!response.ok) {
                        console.error(`Failed to load common translations: ${commonPath} (Status: ${response.status})`);
                        // Common translations are essential, throw error if missing
                        throw new Error(`Failed to load common translations for ${lang}`);
                    }
                    return response.json();
                })
                .catch(error => {
                    console.error(`Error fetching common translation module ${commonPath}:`, error);
                    throw error; // Re-throw to fail the Promise.all
                }),

            // Fetch page-specific translations (optional)
            fetch(pageSpecificPath)
                .then(response => {
                    if (!response.ok) {
                        // Don't throw error if page-specific file missing, just warn and return empty.
                        console.warn(`Optional page-specific translation module not found or failed to load: ${pageSpecificPath} (Status: ${response.status})`);
                        return {}; // Return empty object on failure
                    }
                    return response.json();
                })
                .catch(error => {
                    // Log error but return empty object to allow app to continue with common translations
                    console.error(`Error fetching page-specific translation module ${pageSpecificPath}:`, error);
                    return {}; // Return empty object on fetch error
                })
        ];

        try {
            // Wait for both fetch operations to complete
            const [commonData, pageSpecificData] = await Promise.all(fetchPromises);

            // Merge common data first, then page-specific data over it
            let mergedTranslations = mergeObjects({}, commonData); // Start with common
            mergedTranslations = mergeObjects(mergedTranslations, pageSpecificData); // Merge page-specific

            // Assign the final merged object to the language
            this.translations[lang] = mergedTranslations;
            this.loadedLanguages.add(lang);
            console.log(`Translations for ${lang} (common + ${pageModuleName}) loaded successfully.`);

        } catch (error) {
            console.error(`Error processing translations for ${lang}:`, error);
            // Indicate loading failed
            return Promise.reject(error);
        }
    }

    /**
     * Switch to a different language
     * @param {string} lang - Language code
     * @returns {Promise<void>} - Promise that resolves when language is switched
     */
    async switchLanguage(lang) {
        console.log(`Attempting to switch language to: ${lang}`);
        // Check if the target language exists in our potential list (e.g., ['en', 'zh'])
        // This prevents attempting to load unsupported languages.
        const supportedLanguages = ['en', 'zh']; // Consider making this configurable
        if (!supportedLanguages.includes(lang)) {
            console.warn(`Unsupported language selected: ${lang}`);
            return Promise.reject(new Error(`Unsupported language: ${lang}`));
        }

        try {
            await this.loadTranslations(lang); // Load or ensure translations are loaded
            this.currentLang = lang;
            localStorage.setItem('lang', lang);
            document.documentElement.lang = lang; // Update the lang attribute of the HTML element
            this.updateContent(); // Apply translations to the page
            // Update language switcher dropdown if it exists
            const switcher = document.getElementById('languageSwitcher');
            if (switcher) {
                switcher.value = lang;
            }
            console.log(`Successfully switched language to: ${lang}`);
            return Promise.resolve();
        } catch (error) {
            console.error(`Error switching to language ${lang}:`, error);
            return Promise.reject(error);
        }
    }

    /**
     * Get translation for a key
     * @param {string} key - Translation key (e.g., 'nav.home')
     * @param {Object} [params={}] - Parameters for interpolation (e.g., { count: 5 })
     * @param {string} [fallback=key] - Value to return if key not found
     * @returns {string} - Translated text or fallback
     */
    t(key, params = {}, fallback = key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLang];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found for language '${this.currentLang}': ${key}`);
                return fallback; // Return the fallback string
            }
        }

        if (typeof value !== 'string') {
            console.warn(`Translation value is not a string for key '${key}' in language '${this.currentLang}'. Returning key.`);
            return fallback;
        }

        // Basic interpolation: Replace {paramName} with value from params
        return value.replace(/\{(\w+)\}/g, (match, paramName) => {
            return params[paramName] !== undefined ? params[paramName] : match;
        });
    }

    /**
     * Update all elements with data-i18n attributes
     */
    updateContent() {
        if (!this.translations[this.currentLang]) {
            console.warn(`No translations loaded for current language: ${this.currentLang}. Skipping content update.`);
            return;
        }

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (!key) return;

            const params = {};
            let fallbackText = element.textContent || element.getAttribute('placeholder') || key;

            // Check for specific attribute translations (like placeholder)
            let isPlaceholder = false;
            if (element.hasAttribute('data-i18n-placeholder')) {
                isPlaceholder = true;
                fallbackText = element.getAttribute('placeholder') || key;
            } else if (element.hasAttribute('data-i18n-title')) {
                 // Add support for title attribute if needed
            } // Add more attributes like 'aria-label' if necessary

            // Get parameters from data attributes
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('data-i18n-param-')) {
                    const paramName = attr.name.replace('data-i18n-param-', '');
                    params[paramName] = attr.value;
                }
            });

            const translatedText = this.t(key, params, fallbackText); // Use current content as fallback

            // Update the correct attribute or text content
            if (element.tagName === 'META' && element.name === 'description') {
                element.setAttribute('content', translatedText);
            } else if (element.tagName === 'TITLE') {
                element.textContent = translatedText;
            } else if (isPlaceholder) {
                element.setAttribute('placeholder', translatedText);
            } else {
                // Default to textContent
                element.textContent = translatedText;
            }
        });
        console.log(`Content updated for language: ${this.currentLang}`);
    }

    /**
     * Initialize the i18n system on page load
     */
    async init() {
        try {
            // Ensure loadTranslations is called before accessing this.translations or updating content
            await this.loadTranslations(this.currentLang);
            document.documentElement.lang = this.currentLang; // Set initial lang attribute
            this.updateContent(); // Apply initial translations

            // Setup language switcher listener
            const switcher = document.getElementById('languageSwitcher');
            if (switcher) {
                switcher.value = this.currentLang; // Set dropdown to current lang
                switcher.addEventListener('change', (event) => {
                    this.switchLanguage(event.target.value);
                });
            } else {
                console.warn('Language switcher element not found.');
            }
        } catch (error) {
            console.error("Failed to initialize i18n:", error);
            // Handle initialization error (e.g., display default language or error message)
        }
    }
}

// Create a single instance of the I18n class
const i18nInstance = new I18n();

// Export the instance as the default export
export default i18nInstance;