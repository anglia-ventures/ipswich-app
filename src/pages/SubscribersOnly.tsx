import { useState } from "react";
import { GHOST_URL } from "../config";
import { useAuth } from "../auth/AuthContext";

/**
 * Shown when the signed-in member doesn't have a paid subscription.
 *
 * Apple's "Reader" rule (App Store guideline 3.1.3(a)) lets news apps
 * keep content behind an external subscription, but the app may not
 * link to a sign-up page. On Apple platforms we therefore show plain
 * text instructing the user to subscribe on the website; elsewhere we
 * include a link.
 */
export default function SubscribersOnly() {
  const { member, refresh, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isApple =
    typeof navigator !== "undefined" &&
    /(iPad|iPhone|iPod|Mac)/.test(navigator.userAgent);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="unauth-shell">
      <div className="unauth-card">
        <h1 className="brand">Ipswich News</h1>
        <h2>Subscribers only</h2>
        <p>
          You're signed in as <strong>{member?.email}</strong>, but this app is
          for Ipswich News subscribers.
        </p>
        {isApple ? (
          <p className="muted">
            To subscribe, visit <strong>ipswich.co.uk</strong> in your browser.
            Once subscribed, tap <em>I've subscribed</em> below.
          </p>
        ) : (
          <p>
            <a href={`${GHOST_URL}/#/portal/signup`} target="_blank" rel="noreferrer">
              Subscribe on ipswich.co.uk
            </a>
          </p>
        )}
        <div className="unauth-actions">
          <button type="button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Checking…" : "I've subscribed"}
          </button>
          <button type="button" className="link-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
