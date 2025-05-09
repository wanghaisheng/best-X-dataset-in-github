// Dynamic language switcher for WebSim Vibe Coding Starter
const locales = {
  en: '/locale/en.json',
  zh: '/locale/zh.json'
};

function setLanguage(lang) {
  fetch(locales[lang])
    .then(res => res.json())
    .then(dict => {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = dict[key];
          } else {
            el.textContent = dict[key];
          }
        }
      });
      localStorage.setItem('lang', lang);
    });
}

function buildLangSwitcher() {
  const switcher = document.getElementById('lang-switcher') || document.getElementById('footer-lang-switcher');
  if (!switcher) return;
  switcher.innerHTML = `
    <button data-lang="en">EN</button>
    <button data-lang="zh">中文</button>
  `;
  switcher.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => setLanguage(btn.getAttribute('data-lang'));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  buildLangSwitcher();
  const lang = localStorage.getItem('lang') || 'en';
  setLanguage(lang);
  // Footer switcher
  const footerSwitcher = document.getElementById('footer-lang-switcher');
  if (footerSwitcher) {
    buildLangSwitcher();
  }
});
