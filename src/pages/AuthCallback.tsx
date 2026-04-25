import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Handles `/auth/callback?token=...`. Reached either via:
 *  - a magic-link redirect when the app is opened in a browser, or
 *  - a Tauri deep-link handler (e.g. ipswich-app://auth/callback?token=...)
 *    forwarding the token into the SPA.
 */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeSignIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing token");
      return;
    }
    completeSignIn(token)
      .then(() => navigate("/", { replace: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Sign-in failed"));
  }, [params, completeSignIn, navigate]);

  if (error) return <p className="status error">Sign-in failed: {error}</p>;
  return <p className="status">Signing you in…</p>;
}
