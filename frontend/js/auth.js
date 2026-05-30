import { getCourses } from './api.js?v=4.5';
import { translatePage } from './i18n.js?v=4.5';
import { getCsrfToken, apiPost } from './auth-shared.js';
import { showToast } from './toast.js';

function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const email = (formData.get('u_email') || formData.get('email'))?.trim().toLowerCase() || '';
  const password = formData.get('u_pass') || formData.get('password') || '';

  apiPost('/api/auth/login', { email, password })
    .then((data) => {
      localStorage.setItem('userJustLoggedIn', 'true');
      if (data.role) localStorage.setItem('userRole', data.role);
      const submitBtn = event.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-rounded spinning" style="font-size: 20px;">refresh</span> Redirecting...';
      }
      setTimeout(() => {
        window.location.href = data.redirect || (data.role === 'admin' ? '/admin' : '/classroom');
      }, 500);
    })
    .catch((err) => showToast(`Login failed: ${err.message}`, 'error'));
}

function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const email = formData.get('email')?.trim().toLowerCase() || '';
  const username = formData.get('fullName')?.trim() || '';
  const phone = formData.get('phone')?.trim() || '';
  const password = formData.get('password') || '';
  const confirmPassword = formData.get('confirmPassword') || '';

  if (password !== confirmPassword) return showToast('Passwords do not match', 'error');
  if (!phone) return showToast('Phone number is required', 'error');

  apiPost('/api/auth/register', { email, username, password, phone })
    .then(() => {
      localStorage.setItem('userJustLoggedIn', 'true');
      const formEl = document.getElementById('signup-form');
      const successDiv = document.getElementById('signup-success');
      if (formEl) formEl.style.display = 'none';
      if (successDiv) successDiv.style.display = 'block';
      showToast('Account created successfully', 'success');
      setTimeout(() => {
        window.location.href = '/classroom';
      }, 2000);
    })
    .catch((err) => showToast(`Signup failed: ${err.message}`, 'error'));
}

const ENROLL_SUBMIT_HTML =
  '<span data-i18n="btn_register_submit">Complete Registration</span><span class="material-symbols-rounded">arrow_right_alt</span>';

async function handleEnrollment(event) {
  event.preventDefault();
  const form = event.target;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const fd = new FormData(form);
  const courseId = fd.get('course');
  if (!courseId) {
    showToast('Please select a course', 'error');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="material-symbols-rounded spinning">progress_activity</span> Submitting...';
  }

  try {
    const data = await apiPost('/api/auth/enroll-course', {
      email: String(fd.get('email') || '').trim(),
      fullName: String(fd.get('fullName') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      courseId,
    });
    showToast(
      localStorage.getItem('lang') === 'ar'
        ? 'تم تقديم الطلب بنجاح! برجاء انتظر الموافقه بعد الدفع.'
        : 'Registration submitted! Please wait for approval after payment.',
      'success',
    );
    if (submitBtn) {
      submitBtn.innerHTML =
        localStorage.getItem('lang') === 'ar'
          ? '<span class="material-symbols-rounded spinning">check_circle</span> جاري التوجيه...'
          : '<span class="material-symbols-rounded spinning">check_circle</span> Redirecting...';
    }
    setTimeout(() => {
      window.location.href =
        data.redirect || `/classroom?course=${courseId}&enrolled=1`;
    }, 2500);
  } catch (err) {
    showToast(err.message || 'Registration failed', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = ENROLL_SUBMIT_HTML;
      translatePage();
    }
  }
}

function setupPasswordToggle() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('input-toggle-password')) {
      const toggle = e.target;
      const input = toggle.parentElement.querySelector('input');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      toggle.textContent = input.type === 'password' ? 'visibility_off' : 'visibility';
    }
  });
}

async function logout() {
  document.body.style.opacity = '0.5';
  document.body.style.pointerEvents = 'none';
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {}
  localStorage.removeItem('userJustLoggedIn');
  localStorage.removeItem('userRole');
  setTimeout(() => {
    window.location.href = '/logout';
  }, 500);
}

async function fillCourseSelect(courseSelect) {
  if (!courseSelect) return;
  const courses = await getCourses();
  const keys = Object.keys(courses || {});
  const preselect = new URLSearchParams(window.location.search).get('course');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = !preselect;
  placeholder.textContent = 'Choose your path...';
  placeholder.setAttribute('data-i18n', 'label_course_placeholder');

  courseSelect.innerHTML = '';
  courseSelect.appendChild(placeholder);

  keys.forEach((id) => {
    const c = courses[id];
    const option = document.createElement('option');
    option.value = id;
    if (c.titleStr) option.setAttribute('data-i18n', c.titleStr);
    option.textContent = c.title || id;
    if (preselect && String(preselect) === String(id)) option.selected = true;
    courseSelect.appendChild(option);
  });
  translatePage();
}

async function initForms() {
  const courseSelect = document.getElementById('course');
  if (courseSelect) {
    try {
      await fillCourseSelect(courseSelect);
    } catch (err) {
      console.error('Failed to load courses for select:', err);
    }
  }

  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('signup-form')?.addEventListener('submit', handleSignup);
  document.getElementById('enrollment-form')?.addEventListener('submit', handleEnrollment);
  setupPasswordToggle();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initForms);
} else {
  initForms();
}

window.logout = logout;
window.showToast = showToast;
