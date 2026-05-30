/** Shared auth helpers (CSRF) — used by classroom, dashboard, forgot-password, register. */

function apiUrl(endpoint) {
  if (!endpoint) return window.location.origin;
  if (endpoint.startsWith("http")) return endpoint;
  return `${window.location.origin}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

export async function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')?.content;
  if (meta) return meta;

  try {
    const response = await fetch(apiUrl("/api/csrf-token"), {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("CSRF failed");
    const data = await response.json();
    return data.csrfToken;
  } catch {
    return null;
  }
}

export async function apiPost(endpoint, bodyObj) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const token = await getCsrfToken();
  if (token) headers["X-CSRF-Token"] = token;

  let response;
  try {
    response = await fetch(apiUrl(endpoint), {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(bodyObj),
    });
  } catch (err) {
    throw new Error(
      err.message === "Failed to fetch"
        ? "Cannot reach server. Check your connection or restart the app."
        : err.message,
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
