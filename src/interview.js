/*
 * ═══════════════════════════════════════════════════════════════
 *  interview.js — Form submission
 * ═══════════════════════════════════════════════════════════════
 *
 *  When the user clicks "إنشاء حسابي", immediately redirect
 *  to the main platform (index.html) without any validation
 *  or server calls.
 * ═══════════════════════════════════════════════════════════════
 */

/** Show a notification using the global banner if available */
function showMessage(message, type) {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type || "error");
    return;
  }
  // Fallback notification
  const existing = document.getElementById("submitMessage");
  if (existing) existing.remove();
  const msg = document.createElement("div");
  msg.id = "submitMessage";
  msg.textContent = message;
  msg.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    z-index: 9999; padding: 14px 28px; border-radius: 12px;
    font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 15px;
    font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    direction: rtl; animation: fadeInDown 0.3s ease-out;
    background: #00796b; color: #ffffff;
  `;
  document.body.appendChild(msg);
  setTimeout(() => { if (msg.parentNode) msg.remove(); }, 3000);
}

/**
 * Override the global submitForm().
 * No validation, no server call — just go to index.html.
 */
window.submitForm = function () {
  window.location.href = "/index.html";
};
