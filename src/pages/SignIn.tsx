import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";

type Status = "idle" | "sending" | "sent" | "error";

export default function SignIn() {
  const { requestMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setMessage(null);
    try {
      await requestMagicLink(email);
      setStatus("sent");
      setMessage("Check your email for a sign-in link.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <section className="sign-in">
      <h1>Sign in</h1>
      <p>
        Enter the email address associated with your Ipswich News account.
        We'll send you a link to sign in.
      </p>
      <form onSubmit={onSubmit} className="sign-in-form">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "sending"}
        />
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {message && (
        <p className={status === "error" ? "status error" : "status"}>{message}</p>
      )}
    </section>
  );
}
