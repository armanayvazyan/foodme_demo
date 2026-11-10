import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Package } from "lucide-react";
import { ApiRequestError } from "@/api/client";
import { foodmeApi } from "@/api/foodme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/providers/auth-provider";
import { formatAmd } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  NEW: "Received",
  ACCEPTED: "Preparing",
  DELIVERED: "Delivered",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
};

function statusClass(status: string) {
  if (status === "DELIVERED") return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (status === "REJECTED") return "bg-red-50 text-red-700 ring-red-100";
  if (status === "ACCEPTED") return "bg-amber-50 text-amber-800 ring-amber-100";
  // FOODQA-2: neutral/muted, deliberately not the red "Declined" style.
  if (status === "CANCELLED") return "bg-zinc-50 text-zinc-500 ring-zinc-200";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
}

// FOODQA-2: only orders the kitchen hasn't accepted yet can be cancelled.
function isCancellable(status: string) {
  return status === "NEW";
}

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Orders() {
  const { isAuthenticated, customer, logout } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-orders", customer?.id],
    queryFn: () => foodmeApi.getMyOrders(),
    enabled: isAuthenticated,
  });

  const queryClient = useQueryClient();
  const [pendingCancelNumber, setPendingCancelNumber] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (number: string) => foodmeApi.cancelMyOrder(number),
    onSuccess: (_order, number) => {
      setPendingCancelNumber(null);
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order", number] });
    },
    onError: (error) => {
      // The backend decides: e.g. the kitchen accepted the order in the meantime.
      setCancelError(
        error instanceof ApiRequestError ? error.message : "Couldn’t cancel this order. Try again.",
      );
      setPendingCancelNumber(null);
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
  });

  if (!isAuthenticated) {
    return <Navigate to="/login?next=/orders" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 animate-fade-up">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-900 md:text-4xl">
          Your orders
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Signed in as <span className="font-semibold text-zinc-800">{customer?.email}</span>
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={logout}>
          Sign out
        </Button>
      </div>

      {isLoading && (
        <div aria-label="Loading orders" aria-live="polite" className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[1.5rem] bg-zinc-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-6 text-sm text-red-700" role="alert">
          <p>Couldn’t load your order history.</p>
          <Button variant="outline" size="sm" className="mt-3 border-red-200 bg-white" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && data.list.length === 0 && (
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-zinc-50 ring-1 ring-zinc-100">
            <Package size={26} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <h2 className="font-display text-2xl font-bold text-zinc-900">No orders yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            When you check out, every order lands here so you can track it later.
          </p>
          <Button asChild className="mt-6 rounded-full" size="lg">
            <Link to="/explore">Browse chefs</Link>
          </Button>
        </div>
      )}

      {cancelError && (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700" role="alert">
          {cancelError}
        </div>
      )}

      {data && data.list.length > 0 && (
        <ul className="space-y-3">
          {data.list.map((order) => (
            <li key={order.number} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                to={`/tracking/${order.number}`}
                className="bezel-outer shadow-diffuse block min-w-0 flex-1 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px active:scale-[0.99]"
              >
                <div className="bezel-inner flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-bold text-zinc-900">
                        {order.number}
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusClass(order.status)}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {order.chefName}
                      {order.createdAt ? ` · ${formatOrderDate(order.createdAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold tabular-nums text-zinc-900">
                      {formatAmd(order.totalPrice)}
                    </span>
                    <ChevronRight size={16} strokeWidth={2} className="text-zinc-400" />
                  </div>
                </div>
              </Link>
              {isCancellable(order.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-end sm:self-auto"
                  aria-label={`Cancel order ${order.number}`}
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    setCancelError(null);
                    setPendingCancelNumber(order.number);
                  }}
                >
                  Cancel order
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={pendingCancelNumber !== null}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) setPendingCancelNumber(null);
        }}
      >
        <DialogContent className="p-6">
          <DialogTitle className="pr-10 font-display text-xl font-bold text-zinc-900">
            Cancel this order?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-zinc-500">
            {"This can't be undone."}
          </DialogDescription>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={cancelMutation.isPending}>
                Keep order
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (pendingCancelNumber) cancelMutation.mutate(pendingCancelNumber);
              }}
            >
              Cancel order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
