import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/providers/auth-context";
import { loginSchema, registerSchema, type LoginFormValues, type RegisterFormValues } from "@/schemas/auth-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/sections/phone-input";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

interface AuthPanelProps {
  initialMode?: AuthMode;
  onAuthenticated?: () => void;
  compact?: boolean;
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

export function AuthPanel({ initialMode = "login", onAuthenticated, compact = false }: AuthPanelProps) {
  const { login, register: registerAccount } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", phoneNumber: "", password: "" },
  });

  const finish = () => {
    onAuthenticated?.();
  };

  const onLogin = async (values: LoginFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await login(values);
      finish();
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Could not sign in. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onRegister = async (values: RegisterFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await registerAccount(values);
      finish();
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Could not create account. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth_panel">
      <div
        role="tablist"
        aria-label="Account"
        className="mb-4 grid grid-cols-2 rounded-full bg-zinc-100 p-1"
      >
        {(["login", "register"] as const).map((value) => {
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "h-10 rounded-full text-sm font-semibold transition-colors",
                selected ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900",
              )}
              onClick={() => {
                setMode(value);
                setSubmitError(null);
              }}
            >
              {value === "login" ? "Sign in" : "Create account"}
            </button>
          );
        })}
      </div>

      {mode === "login" ? (
        <form
          aria-label="Sign in"
          className="space-y-4"
          onSubmit={loginForm.handleSubmit(onLogin)}
        >
          <FieldGroup>
            <Label htmlFor="auth-login-email">Email</Label>
            <Input
              id="auth-login-email"
              type="email"
              autoComplete="email"
              placeholder="ara@example.com"
              aria-invalid={!!loginForm.formState.errors.email}
              {...loginForm.register("email")}
            />
            {loginForm.formState.errors.email && (
              <p className="text-xs text-red-600">{loginForm.formState.errors.email.message}</p>
            )}
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="auth-login-password">Password</Label>
            <Input
              id="auth-login-password"
              type="password"
              autoComplete="current-password"
              placeholder="At least 8 characters"
              aria-invalid={!!loginForm.formState.errors.password}
              {...loginForm.register("password")}
            />
            {loginForm.formState.errors.password && (
              <p className="text-xs text-red-600">{loginForm.formState.errors.password.message}</p>
            )}
          </FieldGroup>
          {submitError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100" role="alert">
              {submitError}
            </p>
          )}
          <Button type="submit" size={compact ? "default" : "lg"} className="w-full rounded-full font-semibold" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      ) : (
        <form
          aria-label="Create account"
          className="space-y-4"
          onSubmit={registerForm.handleSubmit(onRegister)}
        >
          <FieldGroup>
            <Label htmlFor="auth-register-name">Full name</Label>
            <Input
              id="auth-register-name"
              autoComplete="name"
              placeholder="Ara Petrosyan"
              aria-invalid={!!registerForm.formState.errors.fullName}
              {...registerForm.register("fullName")}
            />
            {registerForm.formState.errors.fullName && (
              <p className="text-xs text-red-600">{registerForm.formState.errors.fullName.message}</p>
            )}
          </FieldGroup>
          <div className={cn("grid gap-4", compact ? "" : "sm:grid-cols-2")}>
            <FieldGroup>
              <Label htmlFor="auth-register-email">Email</Label>
              <Input
                id="auth-register-email"
                type="email"
                autoComplete="email"
                placeholder="ara@example.com"
                aria-invalid={!!registerForm.formState.errors.email}
                {...registerForm.register("email")}
              />
              {registerForm.formState.errors.email && (
                <p className="text-xs text-red-600">{registerForm.formState.errors.email.message}</p>
              )}
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="auth-register-phone">Phone</Label>
              <PhoneInput
                id="auth-register-phone"
                autoComplete="tel"
                aria-invalid={!!registerForm.formState.errors.phoneNumber}
                {...registerForm.register("phoneNumber")}
              />
              {registerForm.formState.errors.phoneNumber && (
                <p className="text-xs text-red-600">{registerForm.formState.errors.phoneNumber.message}</p>
              )}
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label htmlFor="auth-register-password">Password</Label>
            <Input
              id="auth-register-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-invalid={!!registerForm.formState.errors.password}
              {...registerForm.register("password")}
            />
            {registerForm.formState.errors.password && (
              <p className="text-xs text-red-600">{registerForm.formState.errors.password.message}</p>
            )}
          </FieldGroup>
          {submitError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100" role="alert">
              {submitError}
            </p>
          )}
          <Button type="submit" size={compact ? "default" : "lg"} className="w-full rounded-full font-semibold" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
      )}
    </div>
  );
}
