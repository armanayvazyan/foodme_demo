import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { foodmeApi } from "@/api/foodme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { reviewSchema } from "@/schemas/review-schema";
import { cn } from "@/lib/utils";

interface RateOrderDialogProps {
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={i <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300"}
        />
      ))}
    </span>
  );
}

export function RateOrderDialog({ orderNumber, open, onOpenChange }: RateOrderDialogProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => foodmeApi.reviewOrder(orderNumber, { rating, comment: comment || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  function submit() {
    const parsed = reviewSchema.safeParse({ rating, comment });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your rating");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  const shown = hovered || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <DialogTitle className="font-display text-xl font-bold text-zinc-900">Rate order {orderNumber}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-zinc-500">
          How was your food? Your rating helps other customers pick great chefs.
        </DialogDescription>

        <div className="mt-5 flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <span key={value} onClick={() => setRating(value)} onMouseEnter={() => setHovered(value)}>
              <Star
                size={32}
                strokeWidth={1.5}
                className={cn("cursor-pointer", value <= shown ? "fill-amber-400 text-amber-400" : "text-zinc-300")}
              />
            </span>
          ))}
        </div>

        <Label htmlFor="review-comment" className="mt-5 block text-sm font-semibold text-zinc-800">
          Comment (optional)
        </Label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us about your order"
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <Button className="mt-5 w-full" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Sending…" : "Submit rating"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
