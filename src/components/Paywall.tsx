import { Link } from "react-router-dom";
import { GHOST_URL } from "../config";
import { useAuth } from "../auth/AuthContext";

interface Props {
  visibility: "members" | "paid" | "tiers";
}

/**
 * Paywall block shown when the current member can't read a post.
 *
 * Apple's "Reader" rule (App Store guideline 3.1.3(a)) lets news apps gate
 * content behind an external subscription, but the app cannot link to a
 * sign-up page. We therefore show sign-in inside the app and only direct
 * users to the website to manage/subscribe on platforms where it's allowed.
 */
export default function Paywall({ visibility }: Props) {
  const { member } = useAuth();
  const isApple =
    typeof navigator !== "undefined" &&
    /(iPad|iPhone|iPod|Mac)/.test(navigator.userAgent);

  const heading =
    visibility === "members"
      ? "Sign in to keep reading"
      : "This story is for subscribers";

  return (
    <section className="paywall">
      <h2>{heading}</h2>
      {member ? (
        <p>
          You're signed in as <strong>{member.email}</strong>, but this article
          requires an active subscription.
        </p>
      ) : (
        <p>
          <Link to="/sign-in">Sign in</Link> with your Ipswich News account to
          continue.
        </p>
      )}
      {!isApple && visibility !== "members" && (
        <p className="paywall-cta">
          Don't have a subscription?{" "}
          <a href={`${GHOST_URL}/#/portal/signup`} target="_blank" rel="noreferrer">
            Subscribe on ipswich.co.uk
          </a>
        </p>
      )}
    </section>
  );
}
