// Global Custom Alert UI utility
window.uiAlert = function (message, title = "E-Tracks", type = "info") {
  createUiModal(message, title, type, false, null);
};

window.uiConfirm = function (message, onConfirm, title = "Confirm") {
  createUiModal(message, title, "confirm", true, onConfirm);
};

function createUiModal(message, title, type, isConfirm, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "custom-alert-overlay";

  // Icon based on type
  let iconHtml =
    '<span class="material-symbols-rounded alert-icon info-icon">info</span>';
  if (type === "success") {
    iconHtml =
      '<span class="material-symbols-rounded alert-icon success-icon" style="color:#10b981;">task_alt</span>';
  } else if (type === "error") {
    iconHtml =
      '<span class="material-symbols-rounded alert-icon error-icon" style="color:#ef4444;">error</span>';
  } else if (type === "confirm") {
    iconHtml =
      '<span class="material-symbols-rounded alert-icon confirm-icon" style="color:#f59e0b;">help</span>';
  } else {
    iconHtml =
      '<span class="material-symbols-rounded alert-icon info-icon" style="color:var(--primary);">info</span>';
  }

  const box = document.createElement("div");
  box.className = "custom-alert-box scale-in-fast";

  let buttonsHtml = "";
  const isRtl = document.documentElement.dir === "rtl";

  if (isConfirm) {
    const yesText = isRtl ? "نعم، متأكد" : "Yes, Sure";
    const noText = isRtl ? "إلغاء" : "Cancel";
    buttonsHtml = `
      <button class="btn btn-secondary cancel-btn" style="flex:1;">${noText}</button>
      <button class="btn btn-primary confirm-btn" style="flex:1;">${yesText}</button>
    `;
  } else {
    const okText = isRtl ? "حسناً" : "OK";
    buttonsHtml = `
      <button class="btn btn-primary primary-btn w-100">${okText}</button>
    `;
  }

  box.innerHTML = `
    <div class="custom-alert-header">
      ${iconHtml}
      <h3 style="margin:0; font-size: 18px; color: var(--text-main); font-weight: 700;">${title}</h3>
    </div>
    <div class="custom-alert-body" style="padding: 15px 0; color: var(--text-muted); font-size: 15px; line-height: 1.5; text-align: center;">
      <p style="margin:0;">${message}</p>
    </div>
    <div class="custom-alert-actions" style="display:flex; gap: 10px; margin-top: 15px;">
      ${buttonsHtml}
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Animate in
  setTimeout(() => overlay.classList.add("active"), 10);

  // Disable body scroll
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const closeAlert = () => {
    overlay.classList.remove("active");
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      // Only restore scroll if no other custom alerts or dashboard modals are active
      const otherModals = document.querySelectorAll(
        '.custom-alert-overlay.active, .admin-modal-overlay.active, .courses-maintenance-overlay:not([style*="display: none"])',
      );
      if (otherModals.length === 0) {
        document.body.style.overflow = "";
      }
    }, 300);
  };

  if (isConfirm) {
    box.querySelector(".cancel-btn").addEventListener("click", closeAlert);
    box.querySelector(".confirm-btn").addEventListener("click", () => {
      closeAlert();
      if (onConfirm) onConfirm();
    });
  } else {
    box.querySelector(".primary-btn").addEventListener("click", closeAlert);
  }
}
