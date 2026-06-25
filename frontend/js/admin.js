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
  requestAnimationFrame(async () => {
    document.querySelectorAll(".admin-view").forEach(v => v.style.display = "none");
    const view = document.getElementById(viewId);
    if (view) view.style.display = "block";

    document.querySelectorAll(".admin-nav-item").forEach(item => item.classList.remove("active"));
    triggerItem?.classList.add("active");

    // Close mobile menu
    const collapse = document.getElementById("adminSidebarCollapse");
    collapse?.classList.remove("active");
    document.querySelector(".admin-mobile-toggle")?.classList.remove("active");
    document.getElementById('sidebarOverlay')?.classList.remove('active');

    // Load view-specific data
    if (viewId === "view-students") {
      await renderEnrollmentsView();
    } else if (viewId === "view-approved-students") {
      await renderApprovedStudentsView();
    } else if (viewId === "view-content-management") {
      await renderContentManagementView();
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
  });
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
          <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
            <button class="btn btn-outline btn-sm" data-action="toggle-details" data-id="${s.id}">Details</button>
            ${
              canMessage
                ? `<button class="btn btn-outline btn-sm" data-action="open-message-student"
                    data-email="${s.email}" data-name="${s.name}"
                    data-user-id="${s.userId}" data-course-id="${s.courseId}">Message</button>`
                : '<span style="font-size:12px;color:var(--text-muted);">Approve first</span>'
            }
          </div>
        </td>
      </tr>
      <tr class="lead-details-row" id="details-${s.id}" style="display:none; background: rgba(255,255,255,0.015);">
        <td colspan="6" style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; font-size: 13px; text-align: left;">
            <div><strong style="color:var(--admin-primary)">Status:</strong> ${s.formData?.education_status || '—'}</div>
            <div><strong style="color:var(--admin-primary)">College:</strong> ${s.formData?.college || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Department:</strong> ${s.formData?.department || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Level:</strong> ${s.formData?.level || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Prior Experience:</strong> ${s.formData?.experience || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Age:</strong> ${s.formData?.age || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Gender:</strong> ${s.formData?.gender || '—'}</div>
          </div>
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
          </button>
          ${s.status === 'active' ? `<button class="btn btn-outline btn-sm" style="color:#ef4444; border-color:#ef4444; background: transparent; padding: 4px 8px; font-size: 13px;" data-action="revoke-course-access" data-id="${s.enrollmentId}">Revoke</button>` : ''}
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
           <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;align-items:center;">
             <button class="btn btn-outline btn-sm" data-action="toggle-details" data-id="${lead.id}">Details</button>
             <button class="btn btn-primary btn-sm" data-action="approve-enrollment" data-id="${lead.id}" data-user-id="${lead.userId || ''}" data-course-id="${lead.courseId || ''}">Approve</button>
             <button class="btn btn-outline btn-sm" data-action="reject-enrollment" data-id="${lead.id}" style="color:#ef4444;border-color:#ef4444;background:transparent;">Reject</button>
           </div>
        </td>
      </tr>
      <tr class="lead-details-row" id="details-${lead.id}" style="display:none; background: rgba(255,255,255,0.015);">
        <td colspan="6" style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; font-size: 13px; text-align: left;">
            <div><strong style="color:var(--admin-primary)">Status:</strong> ${lead.formData?.education_status || '—'}</div>
            <div><strong style="color:var(--admin-primary)">College:</strong> ${lead.formData?.college || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Department:</strong> ${lead.formData?.department || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Level:</strong> ${lead.formData?.level || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Prior Experience:</strong> ${lead.formData?.experience || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Age:</strong> ${lead.formData?.age || '—'}</div>
            <div><strong style="color:var(--admin-primary)">Gender:</strong> ${lead.formData?.gender || '—'}</div>
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
    case 'toggle-details': {
      const detailsRow = document.getElementById(`details-${id}`);
      if (detailsRow) {
        detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
      }
      break;
    }
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
      } else if (targetModalId === 'enrollmentModal') {
        await window.openEnrollmentModal();
      } else {
        window.openModal(targetModalId);
      }
      break;
    case 'save-enrollment-manual':
      await window.saveEnrollmentManual();
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
    case 'revoke-course-access':
      await window.revokeCourseAccess(id);
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

window.openEnrollmentModal = async () => {
  const modal = document.getElementById('enrollmentModal');
  if (!modal) return;

  const studentSelect = document.getElementById('enroll-student-select');
  const courseSelect = document.getElementById('enroll-course-select');
  
  if (studentSelect) {
    studentSelect.innerHTML = '<option value="">Loading students...</option>';
    try {
      const res = await apiRequest('/users');
      const users = (res.users || []).filter(u => u.role === 'user');
      studentSelect.innerHTML = '<option value="">Choose student...</option>' + 
        users.map(u => `<option value="${u.id}">${u.username || 'User'} (${u.email})</option>`).join('');
    } catch (err) {
      studentSelect.innerHTML = '<option value="">Error loading students</option>';
    }
  }

  if (courseSelect) {
    courseSelect.innerHTML = '<option value="">Loading courses...</option>';
    try {
      const res = await apiRequest('/courses');
      const approved = (res.courses || []).filter(c => c.status === 'approved');
      courseSelect.innerHTML = '<option value="">Choose course...</option>' + 
        approved.map(c => `<option value="${c.id}">${c.name || c.title}</option>`).join('');
    } catch (err) {
      courseSelect.innerHTML = '<option value="">Error loading courses</option>';
    }
  }

  modal.classList.add('active');
};

window.saveEnrollmentManual = async () => {
  const userId = document.getElementById('enroll-student-select')?.value;
  const courseId = document.getElementById('enroll-course-select')?.value;
  const phone = document.getElementById('enroll-phone')?.value || '';
  const status = document.getElementById('enroll-status')?.value || 'active';

  if (!userId || !courseId) {
    showToast('Please select a student and a course', 'error');
    return;
  }

  try {
    showToast('Creating enrollment...', 'info');
    await apiRequest('/enrollments/create', {
      method: 'POST',
      body: JSON.stringify({ userId, courseId, phone, status })
    });
    showToast('Enrollment created successfully!', 'success');
    window.closeModal('enrollmentModal');
    await renderEnrollmentsView();
    await renderEnrolledStudentsOverview();
  } catch (err) {
    showToast('Failed to create enrollment: ' + err.message, 'error');
  }
};

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
  let img = document.getElementById('add-course-img')?.value || '';
  const imgUpload = document.getElementById('add-course-img-upload');
  const rating = document.getElementById('add-course-rating')?.value || '4.8';

  if (!name) return showToast('Course name is required', 'error');

  // Handle image upload reading if a file is selected
  if (imgUpload && imgUpload.files && imgUpload.files[0]) {
    try {
      const file = imgUpload.files[0];
      if (file.size > 2 * 1024 * 1024) {
        return showToast('Image file is too large. Max 2MB allowed.', 'error');
      }
      const base64Str = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
      img = base64Str;
    } catch (e) {
      console.error('Error reading image file:', e);
      return showToast('Failed to read image file', 'error');
    }
  }

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

window.revokeCourseAccess = async (enrollmentId) => {
  confirmAction('Are you sure you want to revoke this student\'s access to the course files? They will no longer be able to open the classroom.', async () => {
    try {
      showToast('Revoking access...', 'info');
      const res = await apiRequest(`/enrollments/${enrollmentId}/revoke`, { method: 'POST' });
      showToast(res.message || 'Access revoked', 'success');
      const filter = document.getElementById("course-students-filter");
      if (filter && filter.value) {
        await loadCourseStudentsTable(filter.value);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, 'Revoke Access');
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

// ─── Students Registry Logic ───
let studentsRegistryData = [];

window.renderApprovedStudentsView = async () => {
  const tbody = document.getElementById('students-registry-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;"><span class="material-symbols-rounded spinning">sync</span> Loading students registry...</td></tr>';
  }
  try {
    const res = await apiRequest('/enrolled-students');
    studentsRegistryData = res.students || [];

    // Hydrate course filter options if empty
    const courseFilter = document.getElementById('students-course-filter');
    if (courseFilter && courseFilter.options.length <= 1) {
      const courses = adminData.courses || [];
      courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name || c.title;
        courseFilter.appendChild(opt);
      });
    }

    applyStudentsRegistryFilters();
  } catch (err) {
    showToast('Failed to load students registry: ' + err.message, 'error');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:red;">Error loading registry</td></tr>';
  }
};

function applyStudentsRegistryFilters() {
  const searchVal = document.getElementById('students-search')?.value.trim().toLowerCase() || '';
  const courseVal = document.getElementById('students-course-filter')?.value || '';
  const statusVal = document.getElementById('students-status-filter')?.value || '';
  const sortVal = document.getElementById('students-sort')?.value || 'date-desc';

  let filtered = studentsRegistryData.filter(s => {
    const nameMatch = s.name?.toLowerCase().includes(searchVal) || false;
    const emailMatch = s.email?.toLowerCase().includes(searchVal) || false;
    const searchMatch = !searchVal || nameMatch || emailMatch;

    const courseMatch = !courseVal || String(s.courseId) === String(courseVal);
    
    // Normalize statuses for uniform comparisons
    const sStatus = String(s.status || '').trim().toLowerCase();
    let statusMatch = true;
    if (statusVal === 'active') {
      statusMatch = (sStatus === 'active' || sStatus === 'approved');
    } else if (statusVal === 'pending') {
      statusMatch = (sStatus === 'pending');
    } else if (statusVal === 'rejected') {
      statusMatch = (sStatus === 'rejected' || sStatus === 'cancelled');
    }

    return searchMatch && courseMatch && statusMatch;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortVal === 'date-desc') {
      return new Date(b.enrolledAt) - new Date(a.enrolledAt);
    } else if (sortVal === 'date-asc') {
      return new Date(a.enrolledAt) - new Date(b.enrolledAt);
    } else if (sortVal === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else if (sortVal === 'name-desc') {
      return b.name.localeCompare(a.name);
    }
    return 0;
  });

  renderApprovedStudentsTable(filtered);
}

function renderApprovedStudentsTable(students) {
  const tbody = document.getElementById('students-registry-tbody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">No matching students found</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(s => {
    const dateStr = s.enrolledAt ? new Date(s.enrolledAt).toLocaleDateString() : '—';
    const statusClass = (s.status === 'active' || s.status === 'approved') ? 'status-approved' : (s.status === 'rejected' || s.status === 'cancelled') ? 'status-rejected' : 'status-pending';
    const statusText = (s.status === 'active' || s.status === 'approved') ? 'Active' : (s.status === 'rejected' || s.status === 'cancelled') ? 'Rejected' : 'Pending';

    // Form details
    const education = s.formData?.education_status || '—';
    const college = s.formData?.college || '—';
    const department = s.formData?.department || '—';
    const level = s.formData?.level || '—';
    const age = s.formData?.age || '—';
    const gender = s.formData?.gender || '—';

    return `
      <tr>
        <td>
          <div style="font-weight: 600;">${s.name}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${s.email}</div>
        </td>
        <td>${s.courseTitle}</td>
        <td><span class="badge" style="background: rgba(99,102,241,0.1); color: #6366f1;">${education}</span></td>
        <td>
          <div>${college}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${department}</div>
        </td>
        <td>${level}</td>
        <td>${age} / ${gender}</td>
        <td>${dateStr}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end; gap: 8px;">
            <button class="btn btn-outline btn-xs" data-action="view-student-details" data-id="${s.id}" title="View Profile Details">
              <span class="material-symbols-rounded" style="font-size: 16px;">visibility</span> Details
            </button>
            ${(s.status !== 'active' && s.status !== 'approved') ? `
              <button class="btn-icon-sm" style="color: #10b981;" data-action="change-enrollment-status" data-id="${s.id}" data-status="active" title="Approve Student">
                <span class="material-symbols-rounded">check_circle</span>
              </button>
            ` : ''}
            ${s.status !== 'pending' ? `
              <button class="btn-icon-sm" style="color: #f59e0b;" data-action="change-enrollment-status" data-id="${s.id}" data-status="pending" title="Mark Pending/Wait">
                <span class="material-symbols-rounded">pause_circle</span>
              </button>
            ` : ''}
            ${(s.status !== 'rejected' && s.status !== 'cancelled') ? `
              <button class="btn-icon-sm" style="color: #ef4444;" data-action="change-enrollment-status" data-id="${s.id}" data-status="rejected" title="Reject Student">
                <span class="material-symbols-rounded">cancel</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.openStudentDetailsModal = (enrollmentId) => {
  const modal = document.getElementById('studentDetailsModal');
  const body = document.getElementById('student-details-body');
  if (!modal || !body) return;

  const student = studentsRegistryData.find(s => String(s.id) === String(enrollmentId));
  if (!student) return showToast('Student details not found', 'error');

  const dateStr = student.enrolledAt ? new Date(student.enrolledAt).toLocaleString() : '—';
  const statusClass = (student.status === 'active' || student.status === 'approved') ? 'status-approved' : (student.status === 'rejected' || student.status === 'cancelled') ? 'status-rejected' : 'status-pending';
  const statusText = (student.status === 'active' || student.status === 'approved') ? 'Active / Approved' : (student.status === 'rejected' || student.status === 'cancelled') ? 'Rejected' : 'Pending Approval';

  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Profile Header -->
      <div style="display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--glass-border);">
        <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700;">
          ${student.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h4 style="margin: 0; font-size: 18px; color: var(--text-color);">${student.name}</h4>
          <p style="margin: 4px 0 0; font-size: 14px; color: var(--text-muted);">${student.email}</p>
        </div>
      </div>

      <div class="admin-grid-cols-2" style="gap: 16px;">
        <!-- Account Info -->
        <div class="admin-card" style="padding: 12px; background: rgba(255,255,255,0.02);">
          <h5 style="margin: 0 0 10px; color: var(--primary); font-size: 13px;">ACCOUNT INFO</h5>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Phone:</strong> ${student.phone || '—'}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>User ID:</strong> ${student.userId || '—'}</p>
        </div>

        <!-- Registration Info -->
        <div class="admin-card" style="padding: 12px; background: rgba(255,255,255,0.02);">
          <h5 style="margin: 0 0 10px; color: var(--primary); font-size: 13px;">REGISTRATION INFO</h5>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Course:</strong> ${student.courseTitle}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Enrolled At:</strong> ${dateStr}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> <span class="badge ${statusClass}">${statusText}</span></p>
        </div>

        <!-- Educational Details -->
        <div class="admin-card" style="padding: 12px; background: rgba(255,255,255,0.02);">
          <h5 style="margin: 0 0 10px; color: var(--primary); font-size: 13px;">EDUCATIONAL DATA</h5>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> ${student.formData?.education_status || '—'}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>College:</strong> ${student.formData?.college || '—'}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Department:</strong> ${student.formData?.department || '—'}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Level:</strong> ${student.formData?.level || '—'}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Prior Experience:</strong> ${student.formData?.experience || '—'}</p>
        </div>

        <!-- Personal Info -->
        <div class="admin-card" style="padding: 12px; background: rgba(255,255,255,0.02);">
          <h5 style="margin: 0 0 10px; color: var(--primary); font-size: 13px;">PERSONAL DATA</h5>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Age:</strong> ${student.formData?.age || '—'}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Gender:</strong> ${student.formData?.gender || '—'}</p>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
};

async function changeStudentEnrollmentStatus(enrollmentId, newStatus) {
  showToast('Updating student status...', 'info');
  try {
    const res = await apiRequest(`/enrollments/${enrollmentId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus })
    });
    
    // Update local cache
    studentsRegistryData = studentsRegistryData.map(s => {
      if (String(s.id) === String(enrollmentId)) {
        return { ...s, status: newStatus };
      }
      return s;
    });

    applyStudentsRegistryFilters();
    showToast(`Student status successfully updated to ${newStatus}`, 'success');
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'error');
  }
}

// ─── Content Management (CMS) Logic ───
let activeCmsCourseId = null;
let activeCmsSyllabus = { modules: [] };

window.renderContentManagementView = async () => {
  const select = document.getElementById('cms-course-select');
  if (select && select.options.length <= 1) {
    const courses = adminData.courses || [];
    select.innerHTML = '<option value="">Select a course…</option>' +
      courses.map(c => `<option value="${c.id}">${c.name || c.title}</option>`).join('');
  }
};

async function loadCmsSyllabus(courseId) {
  activeCmsCourseId = courseId;
  const wrapper = document.getElementById('cms-syllabus-wrapper');
  const emptyState = document.getElementById('cms-empty-state');
  const title = document.getElementById('cms-course-title');

  if (!courseId) {
    if (wrapper) wrapper.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (wrapper) wrapper.style.display = 'block';

  const selectedCourse = adminData.courses.find(c => String(c.id) === String(courseId));
  if (title && selectedCourse) {
    title.textContent = `${selectedCourse.name || selectedCourse.title} Syllabus`;
  }

  const listEl = document.getElementById('cms-modules-list');
  if (listEl) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;"><span class="material-symbols-rounded spinning">sync</span> Loading syllabus...</div>';
  }

  try {
    const res = await apiRequest(`/courses/${courseId}/syllabus`);
    activeCmsSyllabus = res.syllabus || { modules: [] };
    if (!activeCmsSyllabus.modules) activeCmsSyllabus.modules = [];
    renderCmsSyllabus();
  } catch (err) {
    showToast('Failed to load syllabus: ' + err.message, 'error');
  }
}

function renderCmsSyllabus() {
  const listEl = document.getElementById('cms-modules-list');
  if (!listEl) return;

  if (activeCmsSyllabus.modules.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">This course has no modules yet. Click "Add Module" to start.</div>';
    return;
  }

  listEl.innerHTML = activeCmsSyllabus.modules.map((mod, modIdx) => {
    const lessons = mod.lessons || [];

    const lessonsHtml = lessons.map((les, lesIdx) => {
      const typeIcon = les.type === 'quiz' ? 'quiz' : les.type === 'project' ? 'task' : les.type === 'pdf' ? 'picture_as_pdf' : les.type === 'code' ? 'code' : les.type === 'link' ? 'link' : 'play_circle';
      const visibleIcon = les.visible !== false ? 'visibility' : 'visibility_off';
      const visibleColor = les.visible !== false ? 'var(--primary)' : 'var(--text-muted)';
      const publishIcon = les.published !== false ? 'cloud_done' : 'cloud_off';
      const publishColor = les.published !== false ? '#10b981' : 'var(--text-muted)';

      return `
        <div class="cms-lesson-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.015); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <span class="material-symbols-rounded" style="color: var(--primary);">${typeIcon}</span>
            <div>
              <div style="font-weight: 500; font-size: 14px;">${les.title} <span style="color: var(--text-muted); font-size: 11px;">/ ${les.titleAr || les.title}</span></div>
              <div style="font-size: 12px; color: var(--text-muted);">${les.duration || '—'} | Type: ${les.type}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn-icon-sm" style="color: ${publishColor};" data-action="cms-toggle-publish" data-module-index="${modIdx}" data-index="${lesIdx}" title="Toggle Published State">
              <span class="material-symbols-rounded" style="font-size: 18px;">${publishIcon}</span>
            </button>
            <button class="btn-icon-sm" style="color: ${visibleColor};" data-action="cms-toggle-visible" data-module-index="${modIdx}" data-index="${lesIdx}" title="Toggle Student Visibility">
              <span class="material-symbols-rounded" style="font-size: 18px;">${visibleIcon}</span>
            </button>
            <button class="btn-icon-sm" style="color: var(--text-muted);" data-action="cms-move-lesson" data-module-index="${modIdx}" data-index="${lesIdx}" data-dir="up" title="Move Up" ${lesIdx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
              <span class="material-symbols-rounded" style="font-size: 18px;">arrow_upward</span>
            </button>
            <button class="btn-icon-sm" style="color: var(--text-muted);" data-action="cms-move-lesson" data-module-index="${modIdx}" data-index="${lesIdx}" data-dir="down" title="Move Down" ${lesIdx === lessons.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
              <span class="material-symbols-rounded" style="font-size: 18px;">arrow_downward</span>
            </button>
            <button class="btn-icon-sm" style="color: var(--primary);" data-action="cms-edit-lesson" data-module-index="${modIdx}" data-index="${lesIdx}" title="Edit Lesson">
              <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
            </button>
            <button class="btn-icon-sm" style="color: #ef4444;" data-action="cms-delete-lesson" data-module-index="${modIdx}" data-index="${lesIdx}" title="Delete Lesson">
              <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="cms-module-card" style="border: 1px solid var(--glass-border); border-radius: var(--radius-md); background: rgba(255,255,255,0.01); overflow: hidden;">
        <div class="cms-module-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--glass-border); gap: 16px; flex-wrap: wrap;">
          <div style="flex: 1;">
            <h3 style="margin: 0; font-size: 16px; color: var(--text-color);">${mod.title}</h3>
            <span style="color: var(--text-muted); font-size: 12px;">${mod.titleAr || mod.title} | ${mod.time || 'No duration info'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn btn-outline btn-xs" data-action="cms-add-lesson" data-module-index="${modIdx}">
              <span class="material-symbols-rounded" style="font-size: 16px;">add</span> Add Lesson
            </button>
            <button class="btn-icon-sm" style="color: var(--text-muted);" data-action="cms-move-module" data-index="${modIdx}" data-dir="up" title="Move Module Up" ${modIdx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
              <span class="material-symbols-rounded" style="font-size: 18px;">arrow_upward</span>
            </button>
            <button class="btn-icon-sm" style="color: var(--text-muted);" data-action="cms-move-module" data-index="${modIdx}" data-dir="down" title="Move Module Down" ${modIdx === activeCmsSyllabus.modules.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
              <span class="material-symbols-rounded" style="font-size: 18px;">arrow_downward</span>
            </button>
            <button class="btn-icon-sm" style="color: var(--primary);" data-action="cms-edit-module" data-index="${modIdx}" title="Edit Module">
              <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
            </button>
            <button class="btn-icon-sm" style="color: #ef4444;" data-action="cms-delete-module" data-index="${modIdx}" title="Delete Module">
              <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
            </button>
          </div>
        </div>
        <div class="cms-module-body" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
          ${lessonsHtml || '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px;">No lessons in this module.</div>'}
        </div>
      </div>
    `;
  }).join('');
}

// Module CRUD Modals
window.openCmsModuleModal = (index = '') => {
  const modal = document.getElementById('cmsModuleModal');
  const titleEl = document.getElementById('cms-module-modal-title');
  const indexInput = document.getElementById('cms-module-index');
  const titleEnInput = document.getElementById('cms-module-title-en');
  const titleArInput = document.getElementById('cms-module-title-ar');
  const timeInput = document.getElementById('cms-module-time');

  if (!modal) return;

  indexInput.value = index;

  if (index !== '') {
    titleEl.textContent = 'Edit Syllabus Module';
    const mod = activeCmsSyllabus.modules[index];
    titleEnInput.value = mod.title || '';
    titleArInput.value = mod.titleAr || '';
    timeInput.value = mod.time || '';
  } else {
    titleEl.textContent = 'Add Syllabus Module';
    titleEnInput.value = '';
    titleArInput.value = '';
    timeInput.value = '';
  }

  modal.classList.add('active');
};

async function saveCmsModule() {
  const index = document.getElementById('cms-module-index').value;
  const titleEn = document.getElementById('cms-module-title-en').value.trim();
  const titleAr = document.getElementById('cms-module-title-ar').value.trim();
  const time = document.getElementById('cms-module-time').value.trim();

  if (!titleEn || !titleAr) return showToast('Please enter both English and Arabic module titles', 'error');

  const modData = {
    id: index !== '' ? activeCmsSyllabus.modules[index].id : 'm' + (activeCmsSyllabus.modules.length + 1),
    title: titleEn,
    titleAr: titleAr,
    time: time || '45 Min',
    lessons: index !== '' ? activeCmsSyllabus.modules[index].lessons : []
  };

  if (index !== '') {
    activeCmsSyllabus.modules[index] = modData;
  } else {
    activeCmsSyllabus.modules.push(modData);
  }

  window.closeModal('cmsModuleModal');
  renderCmsSyllabus();
  await saveCmsSyllabusToServer();
}

async function deleteCmsModule(index) {
  confirmAction('Are you sure you want to delete this module and all its lessons?', async () => {
    activeCmsSyllabus.modules.splice(index, 1);
    renderCmsSyllabus();
    await saveCmsSyllabusToServer();
  });
}

// Lesson CRUD Modals
window.openCmsLessonModal = (moduleIndex, lessonIndex = '') => {
  const modal = document.getElementById('cmsLessonModal');
  const titleEl = document.getElementById('cms-lesson-modal-title');
  const modIdxInput = document.getElementById('cms-lesson-module-index');
  const lessonIdxInput = document.getElementById('cms-lesson-index');

  const titleEnInput = document.getElementById('cms-lesson-title-en');
  const titleArInput = document.getElementById('cms-lesson-title-ar');
  const typeSelect = document.getElementById('cms-lesson-type');
  const durationInput = document.getElementById('cms-lesson-duration');
  const videoInput = document.getElementById('cms-lesson-video-url');
  const attachmentInput = document.getElementById('cms-lesson-attachment');
  const publishedCb = document.getElementById('cms-lesson-published');
  const visibleCb = document.getElementById('cms-lesson-visible');

  if (!modal) return;

  modIdxInput.value = moduleIndex;
  lessonIdxInput.value = lessonIndex;

  if (lessonIndex !== '') {
    titleEl.textContent = 'Edit Lesson';
    const les = activeCmsSyllabus.modules[moduleIndex].lessons[lessonIndex];
    titleEnInput.value = les.title || '';
    titleArInput.value = les.titleAr || '';
    typeSelect.value = les.type || 'video';
    durationInput.value = les.duration || '';
    videoInput.value = les.embedUrl || '';
    attachmentInput.value = les.attachment || '';
    publishedCb.checked = les.published !== false;
    visibleCb.checked = les.visible !== false;
  } else {
    titleEl.textContent = 'Add Lesson';
    titleEnInput.value = '';
    titleArInput.value = '';
    typeSelect.value = 'video';
    durationInput.value = '';
    videoInput.value = '';
    attachmentInput.value = '';
    publishedCb.checked = true;
    visibleCb.checked = true;
  }

  modal.classList.add('active');
};

async function saveCmsLesson() {
  const modIdx = document.getElementById('cms-lesson-module-index').value;
  const lesIdx = document.getElementById('cms-lesson-index').value;

  const titleEn = document.getElementById('cms-lesson-title-en').value.trim();
  const titleAr = document.getElementById('cms-lesson-title-ar').value.trim();
  const type = document.getElementById('cms-lesson-type').value;
  const duration = document.getElementById('cms-lesson-duration').value.trim();
  const embedUrl = document.getElementById('cms-lesson-video-url').value.trim();
  const attachment = document.getElementById('cms-lesson-attachment').value.trim();
  const published = document.getElementById('cms-lesson-published').checked;
  const visible = document.getElementById('cms-lesson-visible').checked;

  if (!titleEn || !titleAr) return showToast('Please enter both English and Arabic titles', 'error');

  const lesData = {
    id: lesIdx !== '' ? activeCmsSyllabus.modules[modIdx].lessons[lesIdx].id : 'l' + (activeCmsSyllabus.modules[modIdx].lessons.length + 1),
    title: titleEn,
    titleAr: titleAr,
    type: type,
    duration: duration || '10m',
    embedUrl: embedUrl,
    attachment: attachment,
    published: published,
    visible: visible,
    completed: false
  };

  if (lesIdx !== '') {
    activeCmsSyllabus.modules[modIdx].lessons[lesIdx] = lesData;
  } else {
    if (!activeCmsSyllabus.modules[modIdx].lessons) activeCmsSyllabus.modules[modIdx].lessons = [];
    activeCmsSyllabus.modules[modIdx].lessons.push(lesData);
  }

  window.closeModal('cmsLessonModal');
  renderCmsSyllabus();
  await saveCmsSyllabusToServer();
}

async function deleteCmsLesson(modIdx, lesIdx) {
  confirmAction('Are you sure you want to delete this lesson?', async () => {
    activeCmsSyllabus.modules[modIdx].lessons.splice(lesIdx, 1);
    renderCmsSyllabus();
    await saveCmsSyllabusToServer();
  });
}

// Reordering / publish state logic
async function moveCmsModule(index, direction) {
  const list = activeCmsSyllabus.modules;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= list.length) return;

  const temp = list[index];
  list[index] = list[targetIndex];
  list[targetIndex] = temp;

  renderCmsSyllabus();
  await saveCmsSyllabusToServer();
}

async function moveCmsLesson(modIdx, index, direction) {
  const list = activeCmsSyllabus.modules[modIdx].lessons;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= list.length) return;

  const temp = list[index];
  list[index] = list[targetIndex];
  list[targetIndex] = temp;

  renderCmsSyllabus();
  await saveCmsSyllabusToServer();
}

async function toggleCmsLessonPublish(modIdx, lesIdx) {
  const les = activeCmsSyllabus.modules[modIdx].lessons[lesIdx];
  les.published = les.published === false;
  renderCmsSyllabus();
  await saveCmsSyllabusToServer();
}

async function toggleCmsLessonVisible(modIdx, lesIdx) {
  const les = activeCmsSyllabus.modules[modIdx].lessons[lesIdx];
  les.visible = les.visible === false;
  renderCmsSyllabus();
  await saveCmsSyllabusToServer();
}

async function saveCmsSyllabusToServer() {
  showToast('Saving syllabus changes...', 'info');
  try {
    await apiRequest(`/courses/${activeCmsCourseId}/syllabus`, {
      method: 'POST',
      body: JSON.stringify({ syllabus: activeCmsSyllabus })
    });
    showToast('Syllabus saved successfully!', 'success');
  } catch (err) {
    showToast('Failed to save syllabus: ' + err.message, 'error');
  }
}

// Extra Custom Event delegation and UI Bindings
document.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const act = action.dataset.action;
  const id = action.dataset.id;
  const modIdx = action.dataset.moduleIndex;
  const idx = action.dataset.index;
  const status = action.dataset.status;
  const dir = action.dataset.dir;

  switch (act) {
    case 'view-student-details':
      window.openStudentDetailsModal(id);
      break;
    case 'change-enrollment-status':
      await changeStudentEnrollmentStatus(id, status);
      break;
    case 'cms-edit-module':
      window.openCmsModuleModal(idx);
      break;
    case 'cms-delete-module':
      await deleteCmsModule(idx);
      break;
    case 'cms-move-module':
      await moveCmsModule(Number(idx), dir);
      break;
    case 'cms-add-lesson':
      window.openCmsLessonModal(modIdx);
      break;
    case 'cms-edit-lesson':
      window.openCmsLessonModal(modIdx, idx);
      break;
    case 'cms-delete-lesson':
      await deleteCmsLesson(modIdx, idx);
      break;
    case 'cms-move-lesson':
      await moveCmsLesson(Number(modIdx), Number(idx), dir);
      break;
    case 'cms-toggle-publish':
      await toggleCmsLessonPublish(modIdx, idx);
      break;
    case 'cms-toggle-visible':
      await toggleCmsLessonVisible(modIdx, idx);
      break;
  }
});

// Setup dynamic bindings for Student Filters & CMS Course dropdown changes
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('students-search');
  if (searchInput) searchInput.addEventListener('input', applyStudentsRegistryFilters);

  const courseFilter = document.getElementById('students-course-filter');
  if (courseFilter) courseFilter.addEventListener('change', applyStudentsRegistryFilters);

  const statusFilter = document.getElementById('students-status-filter');
  if (statusFilter) statusFilter.addEventListener('change', applyStudentsRegistryFilters);

  const sortSelect = document.getElementById('students-sort');
  if (sortSelect) sortSelect.addEventListener('change', applyStudentsRegistryFilters);

  const cmsCourseSelect = document.getElementById('cms-course-select');
  if (cmsCourseSelect) {
    cmsCourseSelect.addEventListener('change', () => {
      loadCmsSyllabus(cmsCourseSelect.value);
    });
  }

  const addModuleBtn = document.getElementById('btn-cms-add-module');
  if (addModuleBtn) {
    addModuleBtn.addEventListener('click', () => {
      window.openCmsModuleModal();
    });
  }

  const saveModuleBtn = document.getElementById('btn-cms-save-module');
  if (saveModuleBtn) {
    saveModuleBtn.addEventListener('click', saveCmsModule);
  }

  const saveLessonBtn = document.getElementById('btn-cms-save-lesson');
  if (saveLessonBtn) {
    saveLessonBtn.addEventListener('click', saveCmsLesson);
  }
});

