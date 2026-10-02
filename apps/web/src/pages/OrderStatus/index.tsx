import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-context";

interface OrderStatusProps {
  type: "success" | "failure";
}

export default function OrderStatus({ type }: OrderStatusProps) {
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const number = searchParams.get("number");
  const isSuccess = type === "success";

  return (
    <div className="os_wrap mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center md:py-28">
      <div
        className={[
          "bezel-outer shadow-diffuse-lg animate-fade-up",
          "w-full",
        ].join(" ")}
      >
        <div className="bezel-inner flex flex-col items-center px-8 py-12">
          <div
            className={[
              "flex h-16 w-16 items-center justify-center rounded-full",
              "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              isSuccess
                ? "bg-emerald-50 text-emerald-700 ring-4 ring-emerald-50/80"
                : "bg-red-50 text-red-600 ring-4 ring-red-50/80",
            ].join(" ")}
          >
            {isSuccess ? (
              <Check size={28} strokeWidth={2.25} />
            ) : (
              <X size={28} strokeWidth={2.25} />
            )}
          </div>

          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
            {isSuccess ? "Order placed!" : "Order failed"}
          </h1>

          {isSuccess && number ? (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-500">
              Your order number is{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{number}</span>.
              We’ll keep you posted as the kitchen gets to work.
            </p>
          ) : null}

          {!isSuccess && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-500">
              Something went wrong while placing your order. Your cart is still available — try
              again in a moment.
            </p>
          )}

          <div className="mt-8 flex w-full min-w-0 flex-col gap-2.5">
            {isSuccess && number && (
              <Button asChild size="lg" className="group w-full justify-between rounded-full pl-5 pr-2 font-semibold">
                <Link to={`/tracking/${number}`}>
                  <span>Track order</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
                    <ArrowUpRight size={15} strokeWidth={2} />
                  </span>
                </Link>
              </Button>
            )}
            {!isSuccess && (
              <Button asChild size="lg" className="w-full rounded-full font-semibold">
                <Link to="/checkout">Try checkout again</Link>
              </Button>
            )}
            {isSuccess && isAuthenticated && (
              <Button asChild size="lg" variant="outline" className="w-full rounded-full font-semibold">
                <Link to="/orders">View my orders</Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline" className="w-full rounded-full font-semibold">
              <Link to="/explore">Back to explore</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
