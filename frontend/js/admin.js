/**
 * Admin Dashboard Module - Dynamic API Integration
 */

let adminData = {
  stats: {},
  courses: [],
  students: []
};

const API_BASE = '/api/admin';

function confirmAction(message, onConfirm, title = 'Confirm') {
  if (typeof window.uiConfirm === 'function') {
    window.uiConfirm(message, onConfirm, title);
    return;
  }
  onConfirm();
}

// Beautiful Non-blocking Toast Notification System
export function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  if (type === 'error') icon = 'error';

  toast.innerHTML = `
    <span class="material-symbols-rounded toast-icon">${icon}</span>
    <div class="toast-message">${message}</div>
    <button class="toast-close">
      <span class="material-symbols-rounded">close</span>
    </button>
  `;

  container.appendChild(toast);

  // Trigger smooth enter transition
  requestAnimationFrame(() => {
    toast.classList.add('active');
  });

  const closeToast = () => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-close').addEventListener('click', closeToast);

  // Auto-expire after 4 seconds
  setTimeout(closeToast, 4000);
}

// Global expose for ease of use
window.showToast = showToast;

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Get CSRF for mutating methods
  const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (mutatingMethods.includes(options.method)) {
    const token = await getCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers,
    ...options
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Admin API ${endpoint}: ${response.status}`);
  }

  return response.json();
}

async function getCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    return res.ok ? await res.json().then(d => d.csrfToken) : null;
  } catch {
    return null;
  }
}

export const initAdmin = async () => {
  try {
    await loadAdminData();
    renderDashboardOverview();
    await renderEnrolledStudentsOverview();

    // Bind logs events
    const clearLogsBtn = document.getElementById('btn-clear-logs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', async () => {
        confirmAction('Are you sure you want to clear all logs?', async () => {
        try {
          const token = await getCsrfToken();
          await apiRequest('/logs', { method: 'DELETE' });
          renderLogsView();
        } catch (err) {
          showToast('Failed to clear logs: ' + err.message, 'error');
        }
        });
      });
    }
  } catch (err) {
    console.error('Admin init failed:', err);
    // Server returned 401/403 — redirect to login
    if (err.message.includes('401') || err.message.includes('403')) {
      window.location.href = '/admin-login';
    }
  }
};

async function loadAdminData() {
  // Parallel fetches
  const [statsRes, coursesRes] = await Promise.all([
    apiRequest('/monitor'),
    apiRequest('/courses')
  ]);

  adminData.stats = statsRes;
  adminData.courses = coursesRes.courses || [];
}

function renderDashboardOverview() {
  // Update stats
  const totalStudentsEl = document.getElementById('val-total-students');
  if (totalStudentsEl && adminData.stats.totalUsers !== undefined) {
    totalStudentsEl.textContent = adminData.stats.totalUsers.toLocaleString();
  }

  const totalCoursesEl = document.getElementById('val-total-courses');
  if (totalCoursesEl && adminData.stats.totalCourses !== undefined) {
    totalCoursesEl.textContent = adminData.stats.totalCourses;
  }

  const publishedEl = document.getElementById('val-published');
  if (publishedEl && adminData.stats.courseStatusCounts?.approved !== undefined) {
    publishedEl.textContent = adminData.stats.courseStatusCounts.approved;
  }

  const pendingEl = document.getElementById('val-pending');
  if (pendingEl && adminData.stats.courseStatusCounts?.pending !== undefined) {
    pendingEl.textContent = adminData.stats.courseStatusCounts.pending;
  }

  const teachersEl = document.getElementById('val-total-teachers');
  if (teachersEl && adminData.stats.totalTeachers !== undefined) {
    teachersEl.textContent = adminData.stats.totalTeachers;
  }

  // Render recent courses table
  renderCoursesTable('course-tbody', adminData.courses.slice(0, 5));
}

function renderCoursesTable(tbodyId, courses) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = courses.length ?
    courses.map(course => `
      <tr>
        <td>
          <div class="course-cell">
            <span class="course-cell-title">${course.name}</span>
          </div>
        </td>
        <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${course.description || '-'}</td>
        <td>
          <a href="${course.link}" target="_blank" style="color:var(--admin-primary); display:inline-flex; align-items:center; justify-content:center;">
            <span class="material-symbols-rounded" style="font-size:20px;">link</span>
          </a>
        </td>
        <td>
          <span class="lms-status-badge ${course.status}">
            <span class="material-symbols-rounded" style="font-size:14px;">
              ${course.status === 'approved' ? 'check_circle' : (course.status === 'rejected' ? 'cancel' : 'pending')}
            </span>
            ${course.status}
          </span>
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon-sm" title="Edit Course" style="color: var(--admin-primary);" data-action="edit-course" data-id="${course.id}">
              <span class="material-symbols-rounded">edit_note</span>
            </button>
            ${course.status !== 'approved' ? `<button class="btn-icon-sm" title="Approve Course" style="color: #10b981;" data-action="approve-course" data-id="${course.id}"><span class="material-symbols-rounded">check_circle</span></button>` : ''}
            ${course.status !== 'rejected' ? `<button class="btn-icon-sm" title="Reject Course" style="color: #f59e0b;" data-action="reject-course" data-id="${course.id}"><span class="material-symbols-rounded">cancel</span></button>` : ''}
            <button class="btn-icon-sm" title="Delete Course" style="color: #ef4444;" data-action="delete-course" data-id="${course.id}"><span class="material-symbols-rounded">delete</span></button>
          </div>
        </td>
      </tr>
    `).join('') :
    '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No courses yet</td></tr>';
}

window.switchAdminView = async (viewId, triggerItem) => {
  document.querySelectorAll(".admin-view").forEach(v => v.style.display = "none");
  const view = document.getElementById(viewId);
  if (view) view.style.display = "block";

  document.querySelectorAll(".admin-nav-item").forEach(item => item.classList.remove("active"));
  triggerItem?.classList.add("active");

  // Load view-specific data
  if (viewId === "view-students") {
    await renderEnrollmentsView();
  } else if (viewId === "view-accounts") {
    await renderAccountsView();
  } else if (viewId === "view-manage-courses") {
    renderManageCoursesView();
  } else if (viewId === "view-course-messaging") {
    await renderCourseMessagingView();
  } else if (viewId === "view-dashboard") {
    await renderEnrolledStudentsOverview();
  } else if (viewId === "view-logs") {
    await renderLogsView();
  } else if (viewId === "view-backups") {
    await renderBackupsView();
  }

  // Close mobile menu
  const collapse = document.getElementById("adminSidebarCollapse");
  collapse?.classList.remove("active");
  document.querySelector(".admin-mobile-toggle")?.classList.remove("active");
};

function getApprovedCoursesForMessaging() {
  return (adminData.courses || []).filter((c) => c.status === "approved");
}

function fillCourseSelectOptions(selectEl, placeholder = "Select course…") {
  if (!selectEl) return;
  const approved = getApprovedCoursesForMessaging();
  const current = selectEl.value;
  selectEl.innerHTML =
    `<option value="">${placeholder}</option>` +
    approved
      .map((c) => `<option value="${c.id}">${c.name || c.title}</option>`)
      .join("");
  if (current) selectEl.value = current;
}

async function renderEnrolledStudentsOverview() {
  const tbody = document.getElementById('dashboard-enrolled-tbody');
  if (!tbody) return;

  try {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:32px;">Loading enrollments…</td></tr>';
    const res = await apiRequest('/enrolled-students');
    const students = res.students || [];

    if (!students.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--admin-text-muted);">No enrollments yet. Approve a lead or wait for course registration.</td></tr>';
      return;
    }

    tbody.innerHTML = students
      .map((s) => {
        const statusClass =
          s.status === 'active'
            ? 'approved'
            : s.status === 'pending'
              ? 'pending'
              : 'rejected';
        const canMessage = s.userId && s.status === 'active';
        return `
      <tr>
        <td style="font-weight:600">${s.name}</td>
        <td><a href="mailto:${s.email}" style="color:var(--text-main);text-decoration:none;">${s.email}</a></td>
        <td><span class="badge badge-primary">${s.courseTitle}</span></td>
        <td><span class="lms-status-badge ${statusClass}">${s.status}</span></td>
        <td style="font-size:13px;color:var(--text-muted);">${s.enrolledAt ? new Date(s.enrolledAt).toLocaleString() : '—'}</td>
        <td style="text-align:right;">
          ${
            canMessage
              ? `<button class="btn btn-outline btn-sm" data-action="open-message-student"
                  data-email="${s.email}" data-name="${s.name}"
                  data-user-id="${s.userId}" data-course-id="${s.courseId}">Message</button>`
              : '<span style="font-size:12px;color:var(--text-muted);">Approve first</span>'
          }
        </td>
      </tr>`;
      })
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#ef4444">${err.message}</td></tr>`;
  }
}

async function renderCourseMessagingView() {
  fillCourseSelectOptions(document.getElementById("course-students-filter"));
  fillCourseSelectOptions(document.getElementById("notify-course-id"));

  const filter = document.getElementById("course-students-filter");
  const notifyCourse = document.getElementById("notify-course-id");
  if (filter?.value && notifyCourse && !notifyCourse.value) {
    notifyCourse.value = filter.value;
  }

  if (filter?.value) {
    await loadCourseStudentsTable(filter.value);
  }
}

async function loadCourseStudentsTable(courseId) {
  const tbody = document.getElementById("course-students-tbody");
  if (!tbody || !courseId) {
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--admin-text-muted);">Choose a course to list students.</td></tr>';
    }
    return;
  }

  try {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:40px;">Loading students…</td></tr>';
    const res = await apiRequest(`/course-students?courseId=${encodeURIComponent(courseId)}`);
    const students = res.students || [];

    if (!students.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;padding:40px;">No students registered for this course yet.</td></tr>';
      return;
    }

    tbody.innerHTML = students
      .map((s) => {
        const statusClass =
          s.status === "active"
            ? "approved"
            : s.status === "pending"
              ? "pending"
              : "rejected";
        return `
      <tr data-user-id="${s.userId || ""}">
        <td>
          <input type="checkbox" class="course-student-cb" value="${s.userId || ""}" ${s.userId ? "" : "disabled"}>
        </td>
        <td style="font-weight:600">${s.name}</td>
        <td><a href="mailto:${s.email}" style="color:var(--text-main);text-decoration:none;">${s.email}</a></td>
        <td><span class="lms-status-badge ${statusClass}">${s.status || "—"}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-outline btn-sm" data-action="open-message-student"
            data-email="${s.email}"
            data-name="${s.name}"
            data-user-id="${s.userId || ""}"
            data-course-id="${s.courseId || courseId}">
            Message
          </button>
        </td>
      </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#ef4444">${err.message}</td></tr>`;
  }
}

window.sendCourseNotification = async () => {
  const courseId =
    document.getElementById("notify-course-id")?.value ||
    document.getElementById("course-students-filter")?.value;
  const title = document.getElementById("notify-title")?.value?.trim();
  const body = document.getElementById("notify-body")?.value?.trim();
  const audience = document.getElementById("notify-audience")?.value || "all";

  if (!courseId) {
    showToast("Select a course first", "error");
    return;
  }
  if (!title || !body) {
    showToast("Title and message are required", "error");
    return;
  }

  let userIds = [];
  if (audience === "selected") {
    userIds = [...document.querySelectorAll(".course-student-cb:checked")]
      .map((cb) => cb.value)
      .filter(Boolean);
    if (!userIds.length) {
      showToast("Select at least one student in the table", "error");
      return;
    }
  }

  try {
    showToast("Sending…", "info");
    const res = await apiRequest("/notifications/send", {
      method: "POST",
      body: JSON.stringify({ courseId, title, body, audience, userIds }),
    });
    showToast(res.message || "Message sent", "success");
    document.getElementById("notify-body").value = "";
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.sendDirectMessage = async () => {
  const userId = document.getElementById("message-user-id")?.value;
  const courseId = document.getElementById("message-course-select")?.value;
  const title = document.getElementById("message-title")?.value?.trim();
  const body = document.getElementById("message-body")?.value?.trim();

  if (!userId || !courseId) {
    showToast("Student and course are required", "error");
    return;
  }
  if (!title || !body) {
    showToast("Title and message are required", "error");
    return;
  }

  try {
    const res = await apiRequest("/notifications/send", {
      method: "POST",
      body: JSON.stringify({
        courseId,
        title,
        body,
        audience: "selected",
        userIds: [userId],
      }),
    });
    showToast(res.message || "Message sent", "success");
    document.getElementById("messageModal")?.classList.remove("active");
  } catch (err) {
    showToast(err.message, "error");
  }
};

async function renderEnrollmentsView() {
  const tbody = document.getElementById('enrollment-leads-tbody');
  if (!tbody) return;
  
  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">Syncing registry...</td></tr>';
    const res = await apiRequest('/enrollment-leads');
    const leads = res.leads || [];
    
    tbody.innerHTML = leads.map((lead) => `
      <tr>
        <td style="font-weight:600">${lead.name}</td>
        <td><a href="mailto:${lead.email}" style="color:var(--text-main);text-decoration:none;">${lead.email}</a></td>
        <td><a href="tel:${String(lead.phone).replace(/\s/g, '')}" style="font-weight:700;color:var(--admin-primary);text-decoration:none;white-space:nowrap;">${lead.phone}</a></td>
        <td><span class="badge badge-primary">${lead.courseTitle}</span></td>
        <td style="font-size:13px;color:var(--text-muted);">${lead.enrolledAt ? new Date(lead.enrolledAt).toLocaleString() : '—'}</td>
        <td style="text-align: right;">
           <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
             <button class="btn btn-primary btn-sm" data-action="approve-enrollment" data-id="${lead.id}" data-user-id="${lead.userId || ''}" data-course-id="${lead.courseId || ''}">Approve</button>
             <button class="btn btn-outline btn-sm" data-action="reject-enrollment" data-id="${lead.id}" style="color:#ef4444;border-color:#ef4444;background:transparent;">Reject</button>
           </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;padding:40px;">No pending enrollments.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#ef4444">Registry Error: ${err.message}</td></tr>`;
  }
}

async function renderAccountsView() {
  const tbody = document.getElementById('user-registry-tbody');
  if (!tbody) return;
  
  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;">Loading users...</td></tr>';
    const res = await apiRequest('/users');
    const users = res.users || [];
    
    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="font-weight:600">${u.username || 'User'}</td>
        <td>${u.email}</td>
        <td><a href="tel:${String(u.phone || '').replace(/\s/g, '')}" style="font-weight:700;color:var(--admin-primary);text-decoration:none;white-space:nowrap;">${u.phone || '—'}</a></td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
           <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="font-size:16px; color:var(--admin-primary)">${u.device === 'mobile' ? 'smartphone' : 'desktop_windows'}</span>
              <span style="font-size:12px;">${u.browser || 'Chrome'}</span>
           </div>
        </td>
        <td><span class="lms-status-badge" style="background:rgba(16,185,129,0.1);color:#10b981;">Active</span></td>
        <td style="text-align: right;">
           <button class="btn-icon-sm" data-action="delete-user" data-id="${u.id}"><span class="material-symbols-rounded" style="color:#ef4444">delete</span></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;padding:40px;">No accounts found.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#ef4444">Registry Error: ${err.message}</td></tr>`;
  }
}

function renderManageCoursesView() {
  renderCoursesTable('manage-course-tbody', adminData.courses);
}

async function renderLogsView() {
  const container = document.getElementById('logs-container');
  if (!container) return;

  try {
    container.innerHTML = '<p style="text-align:center;padding:40px;">Loading...</p>';
    const res = await apiRequest('/logs');
    const logs = res.logs || [];

    if (logs.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">No logs found.</p>';
      return;
    }

    container.innerHTML = logs.map(log => {
      const level = log.level || 'info';
      const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
      const color = level === 'error' ? '#ef4444' : '#10b981';

      return `
        <div style="background:var(--bg-card);padding:12px;border-radius:6px;margin-bottom:8px;font-family:monospace;font-size:12px;border-left:4px solid ${color}">
          <strong style="color:var(--text-muted)">${time}</strong> - 
          <span style="color:${color}">[${level.toUpperCase()}]</span> 
          ${log.message || ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;text-align:center;padding:20px;">Failed to load logs: ${err.message}</p>`;
  }
}

async function renderBackupsView() {
  const tbody = document.getElementById('backups-tbody');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;">Loading backups...</td></tr>';
    const res = await apiRequest('/backups');
    const backups = res.backups || [];

    tbody.innerHTML = backups.length ?
      backups.map(b => {
        const tables = b.summary ? Object.keys(b.summary.tables).join(', ') : 'N/A';
        return `
          <tr>
            <td style="font-family:monospace;font-size:12px;">${b.id}</td>
            <td>${tables}</td>
            <td><span class="lms-status-badge" style="background:rgba(16,185,129,0.1);color:#10b981;">Encrypted 🔒</span></td>
            <td>
              <div class="action-btns">
                <button class="btn-icon-sm" title="Download ZIP" style="color: #6366f1;" data-action="download-backup" data-id="${b.id}">
                  <span class="material-symbols-rounded">download</span>
                </button>
                <button class="btn btn-primary" style="padding:4px 12px;font-size:13px;" data-action="restore-backup" data-id="${b.id}">Restore</button>
                <button class="btn-icon-sm" title="Delete Permanent" style="color: #ef4444;" data-action="delete-backup" data-id="${b.id}">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('') :
      '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">No backups found</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:#ef4444;">Failed to load: ${err.message}</td></tr>`;
  }
}

window.handleLogout = () => {
  confirmAction('Logout?', () => {
    window.location.href = '/logout';
  }, 'Logout');
};

// Global modal helpers
window.openModal = (id) => {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
};

window.closeModal = (id) => {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
  }
};

window.openAddModal = () => {
  const modal = document.getElementById('courseModal');
  if (!modal) return;
  
  adminData.isEditingCourse = false;
  document.getElementById('course-modal-title').textContent = 'Add New Course';
  document.getElementById('edit-course-id').value = '';
  document.getElementById('course-name').value = '';
  document.getElementById('add-course-tag').value = '';
  document.getElementById('add-course-weeks').value = '';
  document.getElementById('add-course-img').value = '';
  document.getElementById('course-description').value = '';
  document.getElementById('course-link').value = '';
  document.getElementById('course-status').value = 'pending';
  
  const ratingInput = document.getElementById('add-course-rating');
  if (ratingInput) ratingInput.value = '4.8';
  
  modal.classList.add('active');
};

window.closeAddModal = () => {
  window.closeModal('courseModal');
};

// Event delegation for data-action buttons
document.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const actionType = action.dataset.action;
  const id = action.dataset.id;

  switch (actionType) {
    case 'toggle-menu':
      const collapse = document.getElementById('adminSidebarCollapse');
      const toggleBtn = document.querySelector('.admin-mobile-toggle');
      const overlay = document.getElementById('sidebarOverlay');
      collapse?.classList.toggle('active');
      toggleBtn?.classList.toggle('active');
      overlay?.classList.toggle('active');
      break;
    case 'switch-view':
      const viewId = action.dataset.view;
      const triggerItem = action;
      window.switchAdminView(viewId, triggerItem);
      // Ensure all mobile elements close
      document.getElementById('adminSidebarCollapse')?.classList.remove('active');
      document.querySelector('.admin-mobile-toggle')?.classList.remove('active');
      document.getElementById('sidebarOverlay')?.classList.remove('active');
      break;
    case 'open-modal':
      const targetModalId = action.dataset.target || 'courseModal';
      if (targetModalId === 'courseModal' && !id) {
        window.openAddModal();
      } else {
        window.openModal(targetModalId);
      }
      break;
    case 'close-modal':
      window.closeModal(action.dataset.target || 'courseModal');
      break;
    case 'save-course-final':
      await window.saveCourseFinal();
      break;
    case 'save-user-update':
      await window.saveUserUpdate();
      break;
    case 'edit-user':
      await window.openEditUserModal(id);
      break;
    case 'approve-enrollment':
      await window.approveEnrollmentLead(id, action.dataset.userId, action.dataset.courseId);
      break;
    case 'reject-enrollment':
      await window.rejectEnrollmentLead(id);
      break;
    case 'delete-user':
      await window.deleteUser(id);
      break;
    case 'edit-course':
      await window.openEditCourseModal(id);
      break;
    case 'approve-course':
      await window.approveCourse(id);
      break;
    case 'reject-course':
      await window.rejectCourse(id);
      break;
    case 'close-message-modal':
      document.getElementById('messageModal')?.classList.remove('active');
      break;
    case 'logout':
      window.handleLogout();
      break;
    case 'delete-course':
      await window.deleteCourse(id);
      break;
    case 'open-message':
      window.openMessageModal(action.dataset.email);
      break;
    case 'open-message-student':
      window.openMessageModal({
        email: action.dataset.email,
        name: action.dataset.name,
        userId: action.dataset.userId,
        courseId: action.dataset.courseId,
      });
      break;
    case 'send-course-notification':
      await window.sendCourseNotification();
      break;
    case 'send-direct-message':
      await window.sendDirectMessage();
      break;
    case 'restore-backup': {
      const backupId = action.dataset.id;
      confirmAction(
        `Restore backup "${backupId}"? This will overwrite existing data with the same IDs.`,
        async () => {
          try {
            showToast('Restoring backup, please wait...', 'info');
            await apiRequest(`/backups/restore/${backupId}`, { method: 'POST' });
            showToast('Restore completed successfully!', 'success');
            setTimeout(() => window.location.reload(), 1000);
          } catch (err) {
            showToast('Restore failed: ' + err.message, 'error');
          }
        },
        'Restore backup',
      );
      break;
    }
    case 'download-backup':
      const dlId = action.dataset.id;
      window.location.href = `/api/admin/backups/download/${dlId}`;
      break;
    case 'delete-backup': {
      const delId = action.dataset.id;
      confirmAction(`Delete backup "${delId}" permanently?`, async () => {
        try {
          await apiRequest(`/backups/${delId}`, { method: 'DELETE' });
          showToast('Backup deleted permanently', 'info');
          renderBackupsView();
        } catch (err) {
          showToast('Delete failed: ' + err.message, 'error');
        }
      });
      break;
    }
    case 'coming-soon':
      showToast('Action is coming soon!', 'info');
      break;
  }
});
// ── Modals & Actions ───────────────────────────────────────────

window.openEditUserModal = async (id) => {
  try {
    const res = await apiRequest(`/users/${id}`);
    const user = res.user;
    if (user) {
      document.getElementById('edit-user-id').value = user.id;
      document.getElementById('edit-user-name').value = user.username || '';
      document.getElementById('edit-user-email').value = user.email || '';
      document.getElementById('edit-user-role').value = user.role || 'user';
      window.openModal('userEditModal');
    }
  } catch (err) {
    showToast('Failed to load user: ' + err.message, 'error');
  }
};

window.saveUserUpdate = async () => {
  const id = document.getElementById('edit-user-id').value;
  const username = document.getElementById('edit-user-name').value;
  const email = document.getElementById('edit-user-email').value;
  const role = document.getElementById('edit-user-role').value;

  try {
    showToast('Saving user updates...', 'info');
    await apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ username, email, role })
    });
    showToast('User updated successfully', 'success');
    window.closeModal('userEditModal');
    await renderEnrollmentsView();
    await renderAccountsView();
  } catch (err) {
    showToast('Update failed: ' + err.message, 'error');
  }
};

window.approveEnrollmentLead = async (enrollmentId, userId, courseId) => {
  try {
    showToast('Approving enrollment...', 'info');
    await apiRequest(`/enrollments/${enrollmentId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ userId, courseId }),
    });
    showToast('Student approved — listed under Students & Messages', 'success');
    await renderEnrollmentsView();
    await renderEnrolledStudentsOverview();

    const cid = courseId ? String(courseId) : '';
    if (cid) {
      const filter = document.getElementById('course-students-filter');
      const notifySelect = document.getElementById('notify-course-id');
      if (filter) filter.value = cid;
      if (notifySelect) notifySelect.value = cid;
      await loadCourseStudentsTable(cid);
    }
  } catch (err) {
    showToast('Approval failed: ' + err.message, 'error');
  }
};

window.rejectEnrollmentLead = async (enrollmentId) => {
  confirmAction('Are you sure you want to reject this enrollment request?', async () => {
    try {
      showToast('Rejecting enrollment request...', 'info');
      await apiRequest(`/enrollments/${enrollmentId}/reject`, {
        method: 'POST'
      });
      showToast('Enrollment request rejected successfully', 'success');
      await renderEnrollmentsView();
    } catch (err) {
      showToast('Rejection failed: ' + err.message, 'error');
    }
  }, 'Reject Enrollment');
};

window.deleteUser = async (id) => {
  confirmAction('Are you sure you want to delete this user? This action cannot be undone.', async () => {
  // Optimistically remove user rows from tables if visible
  const leadRow = document.querySelector(`#enrollment-leads-tbody tr button[data-id="${id}"]`)?.closest('tr');
  const userRow = document.querySelector(`#user-registry-tbody tr button[data-id="${id}"]`)?.closest('tr');
  
  if (leadRow) {
    leadRow.style.transition = 'all 0.3s ease';
    leadRow.style.opacity = '0';
    leadRow.style.transform = 'translateX(20px)';
    setTimeout(() => leadRow.remove(), 300);
  }
  if (userRow) {
    userRow.style.transition = 'all 0.3s ease';
    userRow.style.opacity = '0';
    userRow.style.transform = 'translateX(20px)';
    setTimeout(() => userRow.remove(), 300);
  }

  showToast('Deleting user...', 'info');

  try {
    await apiRequest(`/users/${id}`, { method: 'DELETE' });
    showToast('User deleted successfully', 'success');
    await loadAdminData();
    renderDashboardOverview();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
    await renderEnrollmentsView();
    await renderAccountsView();
  }
  });
};

window.openEditCourseModal = async (id) => {
  try {
    const res = await apiRequest(`/courses/${id}`);
    const course = res.course;
    if (course) {
      adminData.isEditingCourse = true;
      document.getElementById('course-modal-title').textContent = 'Edit Course';
      document.getElementById('edit-course-id').value = course.id;
      document.getElementById('course-name').value = course.name || '';
      document.getElementById('add-course-tag').value = course.tagStr || '';
      document.getElementById('add-course-weeks').value = course.weeks || '';
      document.getElementById('add-course-img').value = course.img || '';
      document.getElementById('course-description').value = course.description || '';
      document.getElementById('course-link').value = course.link || '';
      document.getElementById('course-status').value = course.status || 'pending';
      
      const ratingInput = document.getElementById('add-course-rating');
      if (ratingInput) ratingInput.value = course.rating || '4.8';
      
      window.openModal('courseModal');
    }
  } catch (err) {
    showToast('Failed to load course: ' + err.message, 'error');
  }
};

window.saveCourseFinal = async () => {
  const id = document.getElementById('edit-course-id').value;
  const name = document.getElementById('course-name').value;
  const description = document.getElementById('course-description').value;
  const link = document.getElementById('course-link').value;
  const status = document.getElementById('course-status').value || 'pending';
  const tag = document.getElementById('add-course-tag')?.value || '';
  const weeks = document.getElementById('add-course-weeks')?.value || '';
  const img = document.getElementById('add-course-img')?.value || '';
  const rating = document.getElementById('add-course-rating')?.value || '4.8';

  if (!name) return showToast('Course name is required', 'error');

  let finalStatus = status;
  // Ensure new courses are approved by default
  if (!id) {
    finalStatus = 'approved';
  }
  const payload = { 
    name: name.trim(), 
    description: description.trim(), 
    link: link.trim(), 
    status: finalStatus,
    tagStr: tag.trim(),
    weeks: weeks ? parseInt(weeks, 10) : null,
    img: img.trim(),
    rating: rating.trim()
  };

  // Close modal instantly
  window.closeModal('courseModal');
  showToast(id ? 'Updating course details...' : 'Adding new course...', 'info');

  const prevCourses = [...adminData.courses];

  if (id) {
    // Optimistic Update
    adminData.courses = adminData.courses.map(c => {
      if (c.id == id) {
        return { ...c, ...payload };
      }
      return c;
    });
    renderDashboardOverview();
    renderManageCoursesView();

    try {
      await apiRequest(`/courses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      showToast('Course updated successfully!', 'success');
      await loadAdminData();
      renderDashboardOverview();
      renderManageCoursesView();
    } catch (err) {
      // Revert on error
      adminData.courses = prevCourses;
      renderDashboardOverview();
      renderManageCoursesView();
      showToast(`Failed to update course: ${err.message}`, 'error');
    }
  } else {
    // Optimistic Insert
    const tempId = 'temp-' + Date.now();
    const tempCourse = { id: tempId, ...payload };
    adminData.courses = [tempCourse, ...adminData.courses];
    
    renderDashboardOverview();
    renderManageCoursesView();

    try {
      await apiRequest('/courses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('Course created successfully!', 'success');
      await loadAdminData();
      renderDashboardOverview();
      renderManageCoursesView();
      // If user is on the public courses page, reload it to reflect new data
      if (window.location.pathname.startsWith('/courses')) {
        window.location.reload();
      }
    } catch (err) {
      // Revert on error
      adminData.courses = prevCourses;
      renderDashboardOverview();
      renderManageCoursesView();
      showToast(`Failed to create course: ${err.message}`, 'error');
    }
  }
};

window.deleteCourse = async (id) => {
  confirmAction('Are you sure you want to delete this course permanently?', async () => {
  const prevCourses = [...adminData.courses];

  adminData.courses = adminData.courses.filter(c => c.id != id);
  renderDashboardOverview();
  renderManageCoursesView();
  showToast('Deleting course...', 'info');

  try {
    await apiRequest(`/courses/${id}`, { method: 'DELETE' });
    showToast('Course deleted successfully!', 'success');
  } catch (err) {
    // Revert state if api fails
    adminData.courses = prevCourses;
    renderDashboardOverview();
    renderManageCoursesView();
    showToast(`Failed to delete course: ${err.message}`, 'error');
  }
  });
};

window.approveCourse = async (id) => {
  const prevCourses = [...adminData.courses];

  // Optimistically approve
  adminData.courses = adminData.courses.map(c => {
    if (c.id == id) {
      return { ...c, status: 'approved' };
    }
    return c;
  });
  renderDashboardOverview();
  renderManageCoursesView();
  showToast('Approving course...', 'info');

  try {
    await apiRequest(`/approve/${id}`, { method: 'POST' });
    showToast('Course approved & published!', 'success');
  } catch (err) {
    adminData.courses = prevCourses;
    renderDashboardOverview();
    renderManageCoursesView();
    showToast(`Failed to approve course: ${err.message}`, 'error');
  }
};

window.rejectCourse = async (id) => {
  const prevCourses = [...adminData.courses];

  // Optimistically reject
  adminData.courses = adminData.courses.map(c => {
    if (c.id == id) {
      return { ...c, status: 'rejected' };
    }
    return c;
  });
  renderDashboardOverview();
  renderManageCoursesView();
  showToast('Rejecting course...', 'info');

  try {
    await apiRequest(`/reject/${id}`, { method: 'POST' });
    showToast('Course marked as rejected', 'info');
  } catch (err) {
    adminData.courses = prevCourses;
    renderDashboardOverview();
    renderManageCoursesView();
    showToast(`Failed to reject course: ${err.message}`, 'error');
  }
};

window.openMessageModal = (target) => {
  const modal = document.getElementById('messageModal');
  const toInput = document.getElementById('message-to');
  const userIdInput = document.getElementById('message-user-id');
  const courseSelect = document.getElementById('message-course-select');
  const titleInput = document.getElementById('message-title');
  const bodyInput = document.getElementById('message-body');

  if (!modal || !toInput) return;

  const opts =
    typeof target === "string"
      ? { email: target }
      : target || {};

  toInput.value = opts.name
    ? `${opts.name} <${opts.email || ""}>`
    : opts.email || "";
  if (userIdInput) userIdInput.value = opts.userId || "";
  fillCourseSelectOptions(courseSelect, "Select course…");
  if (courseSelect && opts.courseId) {
    courseSelect.value = String(opts.courseId);
  }
  if (titleInput) titleInput.value = "";
  if (bodyInput) bodyInput.value = "";

  modal.classList.add('active');
};

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  initAdmin();

  // Bind create backup button
  const createBackupBtn = document.getElementById('btn-create-backup');
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', async () => {
      try {
        createBackupBtn.disabled = true;
        createBackupBtn.innerHTML = '<span class="material-symbols-rounded spinning">sync</span> Creating...';
        showToast('Creating standard system backup...', 'info');
        await apiRequest('/backups/create', { method: 'POST' });
        showToast('System backup created successfully!', 'success');
        renderBackupsView();
      } catch (err) {
        showToast('Backup failed: ' + err.message, 'error');
      } finally {
        createBackupBtn.disabled = false;
        createBackupBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;">add_to_photos</span> Create Backup';
      }
    });
  }

  const courseFilter = document.getElementById('course-students-filter');
  if (courseFilter) {
    courseFilter.addEventListener('change', async () => {
      const cid = courseFilter.value;
      const notifySelect = document.getElementById('notify-course-id');
      if (notifySelect && cid) notifySelect.value = cid;
      await loadCourseStudentsTable(cid);
    });
  }

  const selectAll = document.getElementById('course-students-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      document.querySelectorAll('.course-student-cb').forEach((cb) => {
        if (!cb.disabled) cb.checked = selectAll.checked;
      });
      const audience = document.getElementById('notify-audience');
      if (audience && selectAll.checked) audience.value = 'selected';
    });
  }

  const notifyCourse = document.getElementById('notify-course-id');
  if (notifyCourse) {
    notifyCourse.addEventListener('change', () => {
      if (courseFilter && notifyCourse.value) {
        courseFilter.value = notifyCourse.value;
        loadCourseStudentsTable(notifyCourse.value);
      }
    });
  }

  // Bind quick launch pad backup card
  const quickBackupCard = document.getElementById('btn-quick-backup');
  if (quickBackupCard) {
    quickBackupCard.addEventListener('click', async () => {
      try {
        showToast('Triggering system backup...', 'info');
        await apiRequest('/backups/create', { method: 'POST' });
        showToast('Backup completed successfully!', 'success');
      } catch (err) {
        showToast('Quick backup failed: ' + err.message, 'error');
      }
    });
  }
});

