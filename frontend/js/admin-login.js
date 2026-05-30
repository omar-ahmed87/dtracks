// Admin Login JS - API Integration with CSRF

async function getCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    if (!res.ok) throw new Error('CSRF fetch failed');
    return await res.json().then(d => d.csrfToken);
  } catch {
    console.warn('CSRF unavailable');
    return null;
  }
}

async function adminLogin(email, password) {
  try {
    const csrfToken = await getCsrfToken();
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // After successful login, the server sets the cookie.
    localStorage.setItem('userJustLoggedIn', 'true');
    if (data.role) localStorage.setItem('userRole', data.role);
    window.location.href = '/admin';
  } catch (error) {
    uiAlert(error.message, 'Login Error', 'error');
  }
}

function initAdminLogin() {
  const form = document.getElementById('admin-login-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailEl = document.getElementById('admin-email');
      const passEl = document.getElementById('admin-password');
      
      if (!emailEl || !passEl) {
        console.error('Admin login inputs not found');
        return;
      }
      
      adminLogin(emailEl.value, passEl.value);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminLogin);
} else {
  initAdminLogin();
}

