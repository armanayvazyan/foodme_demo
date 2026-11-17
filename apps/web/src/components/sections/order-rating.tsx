import { useState } from "react";
import { Star } from "lucide-react";
import type { OrderRatingDto } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
}

export function RatingStars({ value, onChange }: RatingStarsProps) {
  if (!onChange) {
    return (
      <span role="img" aria-label={`${value} out of 5 stars`} className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            size={16}
            className={star <= value ? "fill-amber-400 text-amber-500" : "text-zinc-300"}
          />
        ))}
      </span>
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">Rate your order</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer rounded p-1 focus-within:ring-2 focus-within:ring-zinc-900">
            <input
              className="peer sr-only"
              type="radio"
              name="order-rating"
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
            />
            <Star
              aria-hidden="true"
              size={28}
              className={star <= value ? "fill-amber-400 text-amber-500" : "text-zinc-300"}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function OrderReview({
  review,
  showDate = false,
}: {
  review: OrderRatingDto;
  showDate?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <RatingStars value={review.rating} />
      {review.comment && <p className="break-words text-sm text-zinc-700">{review.comment}</p>}
      {showDate && (
        <time dateTime={review.createdAt} className="text-xs text-zinc-500">
          {new Date(review.createdAt).toLocaleDateString()}
        </time>
      )}
    </div>
  );
}

export function OrderRatingDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: number, comment: string) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-sm p-5 sm:p-6">
        <DialogTitle className="font-display text-xl font-bold text-zinc-900">Rate order</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-zinc-500">
          How was your order?
        </DialogDescription>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (rating > 0) onSubmit(rating, comment);
          }}
        >
          <RatingStars value={rating} onChange={setRating} />
          <div>
            <label htmlFor="order-rating-comment" className="mb-1.5 block text-sm font-medium text-zinc-800">
              Comment (optional)
            </label>
            <textarea
              id="order-rating-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder="Tell us about your order"
              rows={4}
              className="w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" disabled={rating === 0 || isPending} className="w-full">
            {isPending ? "Saving…" : "Submit review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
