import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  User,
  Accessibility,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function resolveRedirectAfterAuth(
  returnTo,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth } = {}) {
  const { t } = useI18n();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleGoogleCredential = async (credential) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(data.error || "Google sign-in failed."));
        setIsLoading(false);
        return;
      }
      const profileRes = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        localStorage.setItem("accessai_user", JSON.stringify(profile.user));
      } else {
        localStorage.setItem("accessai_user", JSON.stringify(data.user));
      }
      localStorage.setItem("accessai_token", data.token);
      navigate(redirect);
    } catch {
      setError(t("Cannot connect to server. Make sure the backend is running on port 5000."));
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("Password must be at least 6 characters."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("Passwords do not match."));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(data.error || "Registration failed."));
        setIsLoading(false);
        return;
      }
      // Store token and reload to pick up auth state
      // Fetch full profile
      const profileRes = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        localStorage.setItem("accessai_user", JSON.stringify(profile.user));
      } else {
        localStorage.setItem("accessai_user", JSON.stringify(data.user));
      }
      localStorage.setItem("accessai_token", data.token);
      navigate(redirect);
    } catch {
      setError(t("Cannot connect to server. Make sure the backend is running on port 5000."));
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(data.error || "Login failed."));
        setIsLoading(false);
        return;
      }
      // Fetch full profile
      const profileRes = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        localStorage.setItem("accessai_user", JSON.stringify(profile.user));
      } else {
        localStorage.setItem("accessai_user", JSON.stringify(data.user));
      }
      localStorage.setItem("accessai_token", data.token);
      navigate(redirect);
    } catch {
      setError(t("Cannot connect to server. Make sure the backend is running on port 5000."));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 cursor-pointer"
            aria-label={t("Go to homepage")}
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Accessibility className="size-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">{t("AccessAI")}</span>
          </button>
          <LanguageSwitcher className="w-40" />
        </div>
      </header>

      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-[420px] border-border/60 shadow-lg">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-3">
              <img
                src={logo}
                alt={t("AccessAI Logo")}
                width={48}
                height={48}
                className="rounded-xl"
              />
            </div>
            <CardTitle className="text-xl">
              {mode === "login" ? t("Welcome back") : t("Create your account")}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? t("Sign in to access your accessibility tools")
                : t("Join AccessAI to get started")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <div className="mb-5 space-y-4">
                <GoogleSignInButton
                  text={mode === "login" ? "signin_with" : "signup_with"}
                  disabled={isLoading}
                  onCredential={handleGoogleCredential}
                  onError={setError}
                />
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("or continue with email")}</span>
                  </div>
                </div>
              </div>
            )}
            {mode === "register" ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-xs font-medium">{t("Full name")}</Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="name"
                      placeholder={t("Jane Doe")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reg-email" className="text-xs font-medium">{t("Email address")}</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="reg-email"
                      placeholder={t("you@example.com")}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reg-password" className="text-xs font-medium">{t("Password")}</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="reg-password"
                      placeholder={t("At least 6 characters")}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-9"
                      disabled={isLoading}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={showPassword ? t("Hide password") : t("Show password")}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="text-xs font-medium">{t("Confirm password")}</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="confirm-password"
                      placeholder={t("Re-enter password")}
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 pr-9"
                      disabled={isLoading}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">{error}</p>
                )}

                <Button type="submit" className="w-full cursor-pointer gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>{t("Create account")}{" "}<ArrowRight className="size-4" /></>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-xs font-medium">{t("Email address")}</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="login-email"
                      placeholder={t("you@example.com")}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="login-password" className="text-xs font-medium">{t("Password")}</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="login-password"
                      placeholder={t("Enter your password")}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-9"
                      disabled={isLoading}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={showPassword ? t("Hide password") : t("Show password")}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">{error}</p>
                )}

                <Button type="submit" className="w-full cursor-pointer gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>{t("Sign in")}{" "}<ArrowRight className="size-4" /></>
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pb-6">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {mode === "login" ? t("Don't have an account?") : t("Already have an account?")}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
                setEmail("");
                setPassword("");
                setConfirmPassword("");
                setName("");
              }}
            >
              {mode === "login" ? t("Create an account") : t("Sign in instead")}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <p>{t("Secured by")}{" "}<a
            href="https://freebuff.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >{t("freebuff.com")}</a>
        </p>
      </footer>
    </div>
  );
}

export default function AuthPage(props) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
