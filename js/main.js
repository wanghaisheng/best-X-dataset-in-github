// Main JavaScript file for interactions

document.addEventListener('DOMContentLoaded', () => {
    // Initialize i18n
    if (typeof initI18n === 'function') {
        initI18n();
    } else {
        console.error('i18n initialization function not found.');
    }

    // Add any other interactive functionality here
    const earlyAccessForm = document.querySelector('.early-access form');
    if (earlyAccessForm) {
        earlyAccessForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = earlyAccessForm.querySelector('input[type="email"]');
            const submitButton = earlyAccessForm.querySelector('button[type="submit"]');
            if (emailInput && submitButton) {
                // Basic email validation (can be improved)
                if (emailInput.value && emailInput.checkValidity()) {
                    // Simulate form submission (replace with actual API call)
                    submitButton.textContent = '注册中...'; // Change button text
                    submitButton.disabled = true;
                    console.log(`Simulating registration for: ${emailInput.value}`);
                    setTimeout(() => {
                        alert('感谢您的注册！我们将在产品发布时通知您。');
                        submitButton.textContent = '注册成功';
                        emailInput.value = ''; // Clear input
                        // Keep button disabled or re-enable as needed
                    }, 1500);
                } else {
                    alert('请输入有效的邮箱地址。');
                }
            }
        });
    }

    console.log('AppTrack Landing Page Initialized.');
});