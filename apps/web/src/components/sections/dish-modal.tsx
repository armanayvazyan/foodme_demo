import { useState, useMemo, useEffect, useRef } from "react";
import { Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ItemQuantityButtonGroup } from "@/components/sections/item-quantity-button-group";
import { SafeImage } from "@/components/ui/safe-image";
import { addDishToCart } from "@/hooks/useCart";
import { formatAmd } from "@/lib/utils";
import type { DishDto } from "@/types";

interface DishModalProps {
  dish: DishDto | null;
  onOpenChange: (open: boolean) => void;
  onChefMismatch?: (dish: DishDto, quantity: number) => void;
}

export function DishModal({ dish, onOpenChange, onChefMismatch }: DishModalProps) {
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedAdditions, setSelectedAdditions] = useState<number[]>([]);
  const [justAdded, setJustAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const minQuantity = Math.max(dish?.minimumOrderCount ?? 1, 1);

  const [prevDish, setPrevDish] = useState(dish);
  if (prevDish !== dish) {
    setPrevDish(dish);
    if (dish) {
      setQuantity(minQuantity);
      setSelectedAdditions([]);
      setJustAdded(false);
      setAddError(null);
    }
  }

  useEffect(() => {
    return () => window.clearTimeout(closeTimer.current);
  }, []);

  const unitPrice = useMemo(() => {
    if (!dish) return 0;
    let t = dish.price;
    if (dish.additions) {
      t += dish.additions
        .filter((a) => selectedAdditions.includes(a.id))
        .reduce((sum, a) => sum + a.price, 0);
    }
    return t;
  }, [dish, selectedAdditions]);

  const totalPrice = unitPrice * quantity;

  if (!dish) return null;

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);
    try {
      const prepared = {
        ...dish,
        additions: dish.additions?.filter((a) => selectedAdditions.includes(a.id)),
      };
      const result = await addDishToCart(prepared, quantity);
      if (result === "mismatch") {
        onChefMismatch?.(prepared, quantity);
        setAdding(false);
        return;
      }
      setJustAdded(true);
      closeTimer.current = window.setTimeout(() => {
        onOpenChange(false);
        setSelectedAdditions([]);
        setQuantity(minQuantity);
        setJustAdded(false);
      }, 350);
    } catch {
      setAddError("Could not add this dish. Try again.");
    } finally {
      setAdding(false);
    }
  };

  const toggleAddition = (id: number) => {
    setSelectedAdditions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Dialog
      open={!!dish}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          window.clearTimeout(closeTimer.current);
          setSelectedAdditions([]);
          setQuantity(minQuantity);
          setJustAdded(false);
          setAddError(null);
        }
      }}
    >
      <DialogContent
        aria-describedby="dish-description"
        className="dm_content flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] flex-col overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-lg !rounded-[1.25rem]"
      >
        <SafeImage
          src={dish.url}
          alt={dish.nameEn}
          className="h-48 w-full shrink-0 object-cover md:h-56"
        />

        <div className="fm-scrollbar min-h-0 flex-auto overflow-y-auto px-5 pb-3 pt-4">
          <DialogTitle className="text-xl font-extrabold text-zinc-900">
            {dish.nameEn}
          </DialogTitle>
          <DialogDescription
            id="dish-description"
            className={
              dish.descriptionEn
                ? "mt-2 text-sm leading-relaxed text-zinc-500"
                : "sr-only"
            }
          >
            {dish.descriptionEn || "Choose additions and quantity before adding this dish."}
          </DialogDescription>
          {dish.portionEn && dish.portionEn.trim() && dish.portionEn.trim() !== "1" && (
            <p className="mt-1 text-xs font-medium text-zinc-400">Portion · {dish.portionEn}</p>
          )}

          {dish.additions && dish.additions.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-bold text-zinc-900">Additions</h3>
              <div className="divide-y divide-zinc-100 border-y border-zinc-100">
                {dish.additions.map((addition) => {
                  const checked = selectedAdditions.includes(addition.id);
                  return (
                    <label
                      key={addition.id}
                      htmlFor={`addition-${addition.id}`}
                      className={[
                        "relative flex min-h-[52px] cursor-pointer items-center gap-3 px-1 py-3",
                        "transition-colors",
                        checked
                          ? "bg-[hsl(var(--brand-muted))]"
                          : "bg-white hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        id={`addition-${addition.id}`}
                        className="peer absolute left-1 top-1/2 z-10 h-[22px] w-[22px] -translate-y-1/2 cursor-pointer opacity-0"
                        checked={checked}
                        onChange={() => toggleAddition(addition.id)}
                      />
                      <span
                        className={[
                          "pointer-events-none flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-none",
                          "transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2",
                          checked
                            ? "bg-[#06C167] text-white"
                            : "border border-black bg-white",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <Check size={13} strokeWidth={3} className={checked ? "" : "opacity-0"} />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-zinc-800">
                        {addition.nameEn}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-500">
                        +{formatAmd(addition.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-zinc-600">Quantity</span>
            <ItemQuantityButtonGroup
              quantity={quantity}
              min={minQuantity}
              onIncrement={() => setQuantity((q) => q + 1)}
              onDecrement={() => setQuantity((q) => Math.max(minQuantity, q - 1))}
            />
          </div>
          {addError && (
            <p className="mb-3 text-sm text-red-600" role="alert">
              {addError}
            </p>
          )}
          <Button
            onClick={() => void handleAdd()}
            disabled={adding || justAdded}
            size="lg"
            className="w-full font-bold"
          >
            {justAdded ? "Added" : adding ? "Adding..." : "Add to cart"}
            {!justAdded && !adding && (
              <span className="font-bold tabular-nums">· {formatAmd(totalPrice)}</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
