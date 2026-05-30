import { apiPost } from "./auth-shared.js";
import { showToast } from "./toast.js";

const state = { channel: "sms", contact: "" };

function showInlineError(msg) {
  const el = document.getElementById("forgot-inline-error");
  const ok = document.getElementById("forgot-inline-success");
  if (ok) ok.classList.add("hidden");
  if (!el) return showToast(msg, "error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function showInlineSuccess(msg) {
  const el = document.getElementById("forgot-inline-success");
  const err = document.getElementById("forgot-inline-error");
  if (err) err.classList.add("hidden");
  if (!el) return showToast(msg, "success");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function setStep(step) {
  document.getElementById("forgot-step-method")?.classList.toggle("hidden", step !== 1);
  document.getElementById("forgot-step-code")?.classList.toggle("hidden", step !== 2);
  document.getElementById("forgot-step-newpass")?.classList.toggle("hidden", step !== 3);
}

function updateContactField() {
  const channel = document.querySelector('input[name="channel"]:checked')?.value || "sms";
  state.channel = channel;

  const label = document.getElementById("forgot-contact-label");
  const hint = document.getElementById("forgot-contact-hint");
  const icon = document.getElementById("forgot-contact-icon");
  const input = document.getElementById("forgot-contact");

  if (channel === "email") {
    if (label) label.textContent = "Email address";
    if (hint) hint.textContent = "Enter your email to receive a verification code.";
    if (icon) icon.textContent = "mail";
    if (input) {
      input.type = "email";
      input.placeholder = "you@example.com";
      input.autocomplete = "email";
    }
  } else {
    if (label) label.textContent = "Phone number";
    if (hint) hint.textContent = "Enter your phone number to receive a verification code via SMS.";
    if (icon) icon.textContent = "phone";
    if (input) {
      input.type = "tel";
      input.placeholder = "+20 1XX XXX XXXX";
      input.autocomplete = "tel";
    }
  }
}

function initMethodCards() {
  document.querySelectorAll(".recovery-method-card input").forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".recovery-method-card").forEach((card) => {
        card.classList.toggle("selected", card.querySelector("input")?.checked);
      });
      updateContactField();
    });
  });
  document.querySelectorAll(".recovery-method-card").forEach((card) => {
    card.classList.toggle("selected", card.querySelector("input")?.checked);
  });
}

async function sendCode() {
  const contact = document.getElementById("forgot-contact")?.value.trim() || "";
  state.contact = contact;
  const body =
    state.channel === "email"
      ? { channel: "email", email: contact }
      : { channel: state.channel, phone: contact };

  const data = await apiPost("/api/auth/forgot-password", body);
  if (data.sent) {
    const viaEmail = data.fallbackChannel === "email" || state.channel === "email";
    showInlineSuccess(
      viaEmail
        ? "Verification code sent to your email. Check inbox and spam."
        : "Verification code sent to your phone.",
    );
    if (data.devCode) {
      showToast(`Your code: ${data.devCode}`, "info");
    }
  } else if (data.devCode) {
    showInlineSuccess(`Your verification code: ${data.devCode}`);
    showToast(
      data.deliveryError ||
        "SMS/Email is not configured on the server yet. Use the code above.",
      "error",
    );
  } else {
    showInlineSuccess(data.message || "Request accepted.");
  }
  if (data.devCode) {
    const codeInput = document.getElementById("reset-code");
    if (codeInput) codeInput.value = String(data.devCode);
    sessionStorage.setItem("resetCode", String(data.devCode));
  }
  setStep(2);
}

async function init() {
  initMethodCards();
  updateContactField();

  const params = new URLSearchParams(window.location.search);
  if (params.get("step") === "code" && params.get("contact")) {
    state.channel = params.get("channel") || "sms";
    state.contact = params.get("contact");
    setStep(2);
  }

  document.getElementById("forgot-step-method")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await sendCode();
    } catch (err) {
      showInlineError(err.message);
    }
  });

  document.getElementById("forgot-resend")?.addEventListener("click", async () => {
    try {
      await sendCode();
      showToast("Code resent", "success");
    } catch (err) {
      showInlineError(err.message);
    }
  });

  document.getElementById("forgot-step-code")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = document.getElementById("reset-code")?.value.trim();
    if (!code || code.length < 6) {
      showInlineError("Enter the 6-digit verification code.");
      return;
    }
    sessionStorage.setItem("resetCode", code);
    setStep(3);
  });

  document.getElementById("forgot-step-newpass")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = document.getElementById("reset-new-pass")?.value || "";
    const confirm = document.getElementById("reset-confirm-pass")?.value || "";
    if (pass !== confirm) {
      showInlineError("Passwords do not match.");
      return;
    }
    const code = sessionStorage.getItem("resetCode") || document.getElementById("reset-code")?.value;
    const body =
      state.channel === "email"
        ? { channel: "email", email: state.contact, code, newPassword: pass }
        : { channel: state.channel, phone: state.contact, code, newPassword: pass };

    try {
      await apiPost("/api/auth/reset-password", body);
      sessionStorage.removeItem("resetCode");
      showToast("Password updated successfully", "success");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (err) {
      showInlineError(err.message);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
