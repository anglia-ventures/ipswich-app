import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import PostPage from "./pages/Post";
import SignIn from "./pages/SignIn";
import SubscribersOnly from "./pages/SubscribersOnly";

export default function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Gated />} />
    </Routes>
  );
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
