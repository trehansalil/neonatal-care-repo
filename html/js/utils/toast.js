/**
 * Toast Notification Utility
 * Shows temporary notification messages
 */

/**
 * Show a toast notification
 * @param {string} text - Message to display
 * @param {string} type - Notification type: 'success', 'error', or 'info'
 * @param {number} duration - Duration in milliseconds (default: 2000)
 */
export function showToast(text, type = 'info', duration = 2000) {
  const palette = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  const toast = document.createElement('div');
  toast.className = `fixed top-20 right-4 p-4 rounded-lg shadow-lg z-50 ${palette[type] || 'bg-slate-700'} text-white font-semibold`;
  toast.textContent = text;
  toast.style.transition = 'all 0.3s ease';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-20px)';

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
