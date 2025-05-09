// Playground tab navigation and logic for WebSim Vibe Coding Starter
const tabList = document.querySelector('.tab-list');
const tabPanes = document.querySelectorAll('.tab-pane');
if (tabList) {
  tabList.addEventListener('click', e => {
    if (e.target.classList.contains('tab')) {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      e.target.classList.add('active');
      const tabId = e.target.getAttribute('data-tab');
      tabPanes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
    }
  });
}

// Step navigation buttons
const toStep3Btn = document.getElementById('to-step3');
const toStep4Btn = document.getElementById('to-step4');
if (toStep3Btn) {
  toStep3Btn.onclick = () => {
    document.querySelector('.tab[data-tab="step3"]').click();
  };
}
if (toStep4Btn) {
  toStep4Btn.onclick = () => {
    document.querySelector('.tab[data-tab="step4"]').click();
  };
}
