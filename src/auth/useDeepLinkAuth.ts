import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Magic-link URLs arriving via the OS look like
// `ipswich-app://auth/callback?token=...`. Forward the token to the
// existing /auth/callback route, which calls completeSignIn.
export function useDeepLinkAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauri) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    function handleUrl(url: string) {
      try {
        const token = new URL(url).searchParams.get("token");
        if (token) {
          navigate(`/auth/callback?token=${encodeURIComponent(token)}`, {
            replace: true,
          });
        }
      } catch {
        // Ignore malformed URLs.
      }
    }

    void (async () => {
      const { getCurrent, onOpenUrl } = await import(
        "@tauri-apps/plugin-deep-link"
      );

      const initial = await getCurrent();
      if (!cancelled && initial) initial.forEach(handleUrl);

      const off = await onOpenUrl((urls) => urls.forEach(handleUrl));
      if (cancelled) off();
      else unlisten = off;
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);
}
