import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

export default function Layout({ children }: { children: ReactNode }) {
  const { member, isPaid, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Ipswich News
        </Link>
        <nav className="app-nav">
          {member ? (
            <>
              <span className="member-badge">
                {member.name || member.email}
                {isPaid ? " · Subscriber" : ""}
              </span>
              <button type="button" className="link-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <Link to="/sign-in">Sign in</Link>
          )}
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <small>© Ipswich News. Powered by Ghost.</small>
      </footer>
    </div>
  );
}
