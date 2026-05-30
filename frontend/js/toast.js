/** Shared toast notifications — no browser alerts. */
export function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-notification ${type}`;
  const icon = type === "success" ? "check_circle" : type === "error" ? "error" : "info";

  toast.innerHTML = `
    <span class="material-symbols-rounded toast-icon">${icon}</span>
    <div class="toast-message"></div>
    <button type="button" class="toast-close" aria-label="Close">
      <span class="material-symbols-rounded">close</span>
    </button>`;
  toast.querySelector(".toast-message").textContent = message;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("active"));

  const close = () => {
    toast.classList.remove("active");
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector(".toast-close").addEventListener("click", close);
  setTimeout(close, 4500);
}

if (typeof window !== "undefined") {
  window.showToast = showToast;
}
