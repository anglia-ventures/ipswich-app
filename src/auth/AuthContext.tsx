import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  completeSignIn as apiCompleteSignIn,
  fetchMember,
  hasPaidAccess,
  sendMagicLink,
  SignedOutError,
  signOut as apiSignOut,
} from "../api/ghost";
import type { Member } from "../api/types";

interface AuthState {
  member: Member | null;
  loading: boolean;
  error: string | null;
  isPaid: boolean;
  requestMagicLink: (email: string) => Promise<void>;
  completeSignIn: (token: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const CACHE_KEY = "ipswich.member";

function readCache(): Member | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Member) : null;
  } catch {
    return null;
  }
}

function writeCache(member: Member | null) {
  try {
    if (member) localStorage.setItem(CACHE_KEY, JSON.stringify(member));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(() => readCache());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMember();
      setMember(m);
      writeCache(m);
    } catch (e) {
      if (e instanceof SignedOutError) {
        setMember(null);
        writeCache(null);
      } else {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestMagicLink = useCallback(async (email: string) => {
    setError(null);
    await sendMagicLink(email);
  }, []);

  const completeSignIn = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const m = await apiCompleteSignIn(token);
      setMember(m);
      writeCache(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setMember(null);
    writeCache(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      member,
      loading,
      error,
      isPaid: hasPaidAccess(member),
      requestMagicLink,
      completeSignIn,
      refresh,
      signOut,
    }),
    [member, loading, error, requestMagicLink, completeSignIn, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
