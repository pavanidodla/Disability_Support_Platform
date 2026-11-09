import { useEffect, useRef } from "react";
import { tr, useI18n } from "@/i18n";

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise = null;

function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gsiPromise = null;
        reject(new Error("Failed to load Google sign-in"));
      };
      document.head.appendChild(script);
    });
  }
  return gsiPromise;
}

/**
 * Renders the official "Sign in with Google" button.
 * onCredential(idToken) is called with the Google ID token (JWT) on success.
 */
export function GoogleSignInButton({
  onCredential,
  onError,
  text = "signin_with",
  disabled = false,
}) {
  const { t } = useI18n();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) onCredentialRef.current?.(response.credential);
          },
        });
        containerRef.current.innerHTML = "";
        const width = Math.min(
          400,
          Math.max(200, Math.floor(containerRef.current.offsetWidth || 340)),
        );
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          logo_alignment: "left",
          text,
          width,
        });
      })
      .catch(() => onErrorRef.current?.(tr("Could not load Google sign-in. Check your connection.")));
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) return null;

  return (
    <div
      ref={containerRef}
      className={`flex w-full justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}
      aria-label={t("Sign in with Google")}
    />
  );
}
