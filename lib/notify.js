/**
 * Password reset delivery — SMS / WhatsApp (Twilio) and email (SMTP / Gmail).
 */

function formatE164(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    return `+${raw.replace(/\D/g, "")}`;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("20")) return `+${digits}`;
  if (digits.startsWith("0")) return `+20${digits.slice(1)}`;
  return `+${digits}`;
}

function loadTwilio() {
  try {
    return require("twilio");
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.error("[notify] Twilio SDK missing. Run: npm install twilio");
    }
    return null;
  }
}

function loadNodemailer() {
  try {
    return require("nodemailer");
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.error("[notify] nodemailer missing. Run: npm install nodemailer");
    }
    return null;
  }
}

/** Build SMTP transport from GMAIL_* or SMTP_* env vars. */
function createMailTransport() {
  const nodemailer = loadNodemailer();
  if (!nodemailer) return null;

  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (gmailUser && gmailPass) {
    const isGmail =
      process.env.GMAIL_USER ||
      (process.env.SMTP_HOST || "").includes("gmail") ||
      !process.env.SMTP_HOST;

    if (isGmail || process.env.GMAIL_USER) {
      return {
        transport: nodemailer.createTransport({
          service: "gmail",
          auth: { user: gmailUser, pass: gmailPass },
        }),
        from: process.env.SMTP_FROM || process.env.GMAIL_FROM || gmailUser,
      };
    }
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user) return null;

  return {
    transport: nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass: pass || "" },
    }),
    from: process.env.SMTP_FROM || user,
  };
}

async function sendResetMessage({ phone, channel, code, resetLink }) {
  const message =
    channel === "whatsapp"
      ? `E-Tracks: Your password reset code is ${code}. Or open: ${resetLink}`
      : `E-Tracks: Your password reset code is ${code}`;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    console.warn("[notify] Twilio not configured — SMS/WhatsApp skipped");
    return {
      sent: false,
      provider: "unconfigured",
      error: "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env",
    };
  }

  const twilioFactory = loadTwilio();
  if (!twilioFactory) {
    return { sent: false, provider: "unconfigured", error: "Twilio package not installed" };
  }

  try {
    const client = twilioFactory(twilioSid, twilioToken);
    const e164 = formatE164(phone);
    if (!e164 || e164.length < 10) {
      throw new Error("Invalid phone number for SMS");
    }

    const to = channel === "whatsapp" ? `whatsapp:${e164}` : e164;
    const from = channel === "whatsapp" && whatsappFrom ? whatsappFrom : twilioFrom;

    await client.messages.create({ body: message, from, to });
    return { sent: true, provider: "twilio" };
  } catch (err) {
    console.error("[notify] Twilio failed:", err.message);
    return { sent: false, provider: "twilio-error", error: err.message };
  }
}

async function sendResetEmail({ email, code, resetLink }) {
  const subject = "E-Tracks — Password reset code";
  const text = `Your verification code is: ${code}\n\nOr open: ${resetLink}\n\nThis code expires in 15 minutes.`;
  const html = `<p>Your E-Tracks verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p><a href="${resetLink}">Reset password</a></p><p>This code expires in 15 minutes.</p>`;

  const mail = createMailTransport();
  if (!mail) {
    console.warn("[notify] Email not configured — set GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_* in .env");
    return {
      sent: false,
      provider: "unconfigured",
      error: "Email not configured (GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_HOST + SMTP_USER)",
    };
  }

  try {
    await mail.transport.sendMail({
      from: mail.from,
      to: email,
      subject,
      text,
      html,
    });
    return { sent: true, provider: mail.from.includes("gmail") ? "gmail" : "smtp" };
  } catch (err) {
    console.error("[notify] Email failed:", err.message);
    return { sent: false, provider: "smtp-error", error: err.message };
  }
}

module.exports = { sendResetMessage, sendResetEmail, formatE164 };
