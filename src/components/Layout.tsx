import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Header/footer chrome shown once the user is signed in and has a paid
 * subscription. Unauthenticated and unpaid states render their own
 * full-screen layouts (SignIn / SubscribersOnly).
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { member, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Ipswich News
        </Link>
        <nav className="app-nav">
          {member && (
            <span className="member-badge">{member.name || member.email}</span>
          )}
          <button type="button" className="link-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <small>© Ipswich News. Powered by Ghost.</small>
      </footer>
    </div>
  );
}
