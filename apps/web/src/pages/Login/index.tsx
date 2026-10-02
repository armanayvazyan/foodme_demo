import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthPanel } from "@/components/sections/auth-panel";
import { useAuth } from "@/providers/auth-context";
import { safeAuthNext } from "@/lib/auth-next";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeAuthNext(params.get("next"));

  if (isAuthenticated) {
    return <Navigate to={next} replace />;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-16">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-900">
          Sign in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Use your FoodMe account to place orders and keep a history you can track later.
        </p>
      </div>
      <div className="bezel-outer shadow-diffuse">
        <div className="bezel-inner p-5">
          <AuthPanel initialMode="login" onAuthenticated={() => navigate(next, { replace: true })} />
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-zinc-500">
        New here?{" "}
        <Link to={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-zinc-900 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
