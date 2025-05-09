/**
 * LanguageSwitcher.js - Language switching component
 * Handles the UI for language selection
 */

import i18n from '../i18n.js';

class LanguageSwitcher {
    constructor(container) {
        this.container = container;
        this.currentLang = i18n.currentLang;
        this.availableLanguages = {
            en: 'English',
            zh: '中文'
        };
        this.init();
    }

    /**
     * Initialize the language switcher
     */
    init() {
        this.render();
        this.attachEventListeners();
    }

    /**
     * Render the language switcher UI
     */
    render() {
        const html = `
            <div class="language-switcher">
                <button class="language-button" aria-label="Select language">
                    <span class="current-lang">${this.availableLanguages[this.currentLang]}</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="language-dropdown">
                    ${Object.entries(this.availableLanguages)
                        .map(([code, name]) => `
                            <button class="language-option ${code === this.currentLang ? 'active' : ''}"
                                    data-lang="${code}">
                                ${name}
                            </button>
                        `).join('')}
                </div>
            </div>
        `;
        this.container.innerHTML = html;
    }

    /**
     * Attach event listeners for language switching
     */
    attachEventListeners() {
        const button = this.container.querySelector('.language-button');
        const dropdown = this.container.querySelector('.language-dropdown');
        const options = this.container.querySelectorAll('.language-option');

        // Toggle dropdown
        button.addEventListener('click', () => {
            dropdown.classList.toggle('show');
        });

        // Handle language selection
        options.forEach(option => {
            option.addEventListener('click', async () => {
                const lang = option.dataset.lang;
                if (lang !== this.currentLang) {
                    try {
                        await i18n.switchLanguage(lang);
                        this.currentLang = lang;
                        this.render();
                    } catch (error) {
                        console.error('Failed to switch language:', error);
                    }
                }
                dropdown.classList.remove('show');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!this.container.contains(event.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
}

export default LanguageSwitcher; 