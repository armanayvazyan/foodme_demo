import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-black text-white hover:bg-zinc-800 active:bg-zinc-700",
        destructive: "bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]",
        outline:
          "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 active:scale-[0.98]",
        secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:scale-[0.98]",
        muted: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:scale-[0.98]",
        ghost: "hover:bg-zinc-100 text-zinc-900 active:scale-[0.98]",
        ghost2: "bg-transparent active:scale-[0.98]",
        link: "text-zinc-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 rounded-full px-4 py-2",
        sm: "h-8 rounded-full px-3 text-xs font-semibold",
        lg: "h-12 rounded-full px-6 text-base font-bold",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
