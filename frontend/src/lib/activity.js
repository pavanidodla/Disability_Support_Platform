const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Record something the user did so it shows up on the Dashboard and History pages.
 * Fire-and-forget: never throws and never blocks the UI. Does nothing when signed out.
 *
 * logActivity({ feature, action, title, summary, count, details })
 * feature: "object-detection" | "read-aloud" | "sign-language" |
 *          "accessibility-scanner" | "voice-command" | "head-control"
 */
export function logActivity({ feature, action = "use", title, summary, count = 1, details }) {
  try {
    const token = localStorage.getItem("accessai_token");
    if (!token) return;
    fetch(`${API_URL}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ feature, action, title, summary, count, details }),
      keepalive: true, // still sent if the page is closing
    }).catch(() => {});
  } catch {
    // ignore
  }
}