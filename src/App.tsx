import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import PostPage from "./pages/Post";
import SignIn from "./pages/SignIn";
import SubscribersOnly from "./pages/SubscribersOnly";

export default function App() {
  useDeepLinkAuth();
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Gated />} />
    </Routes>
  );
}

function useDeepLinkAuth() {
  const navigate = useNavigate();
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const handle = (urls: string[] | null | undefined) => {
      if (!urls) return;
      for (const raw of urls) {
        try {
          const url = new URL(raw);
          if (url.protocol !== "ipswich-app:") continue;
          const token = url.searchParams.get("token");
          if (token) {
            navigate(`/auth/callback?token=${encodeURIComponent(token)}`, { replace: true });
          }
        } catch {
          // Ignore malformed URLs.
        }
      }
    };

    (async () => {
      try {
        const initial = await getCurrent();
        if (!cancelled) handle(initial);
        unlisten = await onOpenUrl((urls) => handle(urls));
      } catch {
        // Not running inside Tauri (e.g. `npm run dev` in a browser).
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);
}

function Gated() {
  const { member, isPaid, loading } = useAuth();

  // Initial auth check (no cached member yet) — keep the screen empty
  // briefly rather than flashing the sign-in form.
  if (loading && !member) {
    return <div className="unauth-shell" aria-busy="true" />;
  }

  if (!member) return <SignIn />;
  if (!isPaid) return <SubscribersOnly />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/p/:slug" element={<PostPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
