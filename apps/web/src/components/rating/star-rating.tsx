import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Star } from "lucide-react";
import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function starLabel(value: number) {
  return `${value} ${value === 1 ? "star" : "stars"}`;
}

/** Read-only stars, e.g. "★★★★☆". Announced to screen readers as "Rated 4 out of 5". */
export function StarDisplay({ stars, size = 16, className }: { stars: number; size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Rated ${stars} out of 5`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {STAR_VALUES.map((value) => (
        <Star
          key={value}
          size={size}
          strokeWidth={1.75}
          aria-hidden="true"
          className={value <= stars ? "fill-amber-400 text-amber-400" : "fill-transparent text-zinc-300"}
        />
      ))}
    </span>
  );
}

/**
 * Star picker built on the shared Radix RadioGroup (components/ui/radio-group), so it gets the
 * kit's roving focus and keyboard handling (Tab into the group, arrow keys to change), and screen
 * readers announce each star as a radio ("3 stars, 3 of 5").
 */
export function StarInput({
  value,
  onChange,
  disabled,
  label = "Your rating",
}: {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value > 0 ? String(value) : ""}
      onValueChange={(next) => onChange(Number(next))}
      disabled={disabled}
      className="flex items-center gap-1"
    >
      {STAR_VALUES.map((star) => (
        <RadioGroupPrimitive.Item
          key={star}
          value={String(star)}
          aria-label={starLabel(star)}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full transition-transform",
            "hover:scale-110 active:scale-95",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
          )}
        >
          <Star
            size={30}
            strokeWidth={1.5}
            aria-hidden="true"
            className={star <= value ? "fill-amber-400 text-amber-400" : "fill-transparent text-zinc-300"}
          />
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroup>
  );
}
