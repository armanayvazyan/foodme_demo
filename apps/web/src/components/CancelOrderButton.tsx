import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { foodmeApi } from "@/api/foodme";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CancelOrderButtonProps = {
  number: string;
  status: string;
  className?: string;
};

function failureMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 400) {
    return "This order can no longer be cancelled.";
  }
  if (error instanceof ApiRequestError && error.status === 404) {
    return "This order can’t be cancelled from your account.";
  }
  return "Couldn’t cancel the order. Please try again.";
}

/**
 * Lets the customer cancel an order the kitchen hasn't accepted yet (status NEW).
 *
 * Render it whatever the status: it shows the button only for NEW orders, but keeps showing its
 * error after a refused cancel even though the refreshed status (e.g. ACCEPTED) hides the button.
 */
export function CancelOrderButton({
  number,
  status,
  className,
}: CancelOrderButtonProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const refreshOrder = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["order", number] }),
    ]);

  const cancel = useMutation({
    mutationFn: () => foodmeApi.cancelMyOrder(number),
    onMutate: () => setError(null),
    onSuccess: refreshOrder,
    onError: (err) => {
      setError(failureMessage(err));
      // The status probably changed under us: show the current one.
      return refreshOrder();
    },
  });

  const canCancel = status === "NEW";
  if (!canCancel && !error) return null;

  return (
    <div className={cn("flex flex-col items-end gap-1.5", className)}>
      {canCancel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate()}
        >
          {cancel.isPending ? "Cancelling…" : "Cancel order"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
