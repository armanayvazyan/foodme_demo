import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { foodmeApi } from "@/api/foodme";
import { ChefDetails } from "@/components/sections/chef-details";
import { ChefDishes } from "@/components/sections/chef-dishes";
import { DishModal } from "@/components/sections/dish-modal";
import { UserCart } from "@/components/sections/user-cart";
import { Button } from "@/components/ui/button";
import { addDishToCart, useCart } from "@/hooks/useCart";
import type { DishDto } from "@/types";

export default function Chef() {
  const { id } = useParams<{ id: string }>();
  const chefId = Number(id);
  const [activeDish, setActiveDish] = useState<DishDto | null>(null);
  const [pendingAdd, setPendingAdd] = useState<{ dish: DishDto; quantity: number } | null>(null);
  const { totalCount: allCartCount } = useCart();
  const { items: chefItems } = useCart(Number.isNaN(chefId) ? undefined : chefId);
  const hasForeignItems = allCartCount > 0 && chefItems.length === 0;

  const chefQuery = useQuery({
    queryKey: ["chef", chefId],
    queryFn: () => foodmeApi.getChefById(chefId),
    enabled: !Number.isNaN(chefId),
  });

  const dishesQuery = useQuery({
    queryKey: ["dishes", chefId],
    queryFn: () => foodmeApi.getActiveDishes(chefId, 0, 200),
    enabled: !Number.isNaN(chefId),
  });

  const tagsQuery = useQuery({
    queryKey: ["dish-tags", chefId],
    queryFn: () => foodmeApi.getDishTags(chefId),
    enabled: !Number.isNaN(chefId),
  });

  const [prevChefId, setPrevChefId] = useState(chefId);
  if (prevChefId !== chefId) {
    setPrevChefId(chefId);
    setActiveDish(null);
    setPendingAdd(null);
  }

  const onChefMismatch = (dish: DishDto, quantity: number) => {
    setActiveDish(null);
    setPendingAdd({ dish, quantity });
  };

  const confirmSwitch = async () => {
    if (!pendingAdd) return;
    await addDishToCart(pendingAdd.dish, pendingAdd.quantity, { replaceOtherChef: true });
    setPendingAdd(null);
  };

  if (chefQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="h-52 animate-pulse rounded-[2rem] bg-zinc-100 md:h-72" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-[1.5rem] bg-zinc-100" />
            <div className="h-40 animate-pulse rounded-[1.5rem] bg-zinc-100" />
          </div>
          <div className="h-64 animate-pulse rounded-[1.5rem] bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (chefQuery.isError || !chefQuery.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="font-display text-xl font-bold text-zinc-900">Chef not found</p>
        <p className="mt-2 text-sm text-zinc-500">This kitchen may be offline or the link is outdated.</p>
      </div>
    );
  }

  const chef = chefQuery.data;

  return (
    <div className="cp_wrap pb-28 lg:pb-16">
      <ChefDetails chef={chef} />
      <div className="mx-auto mt-6 flex max-w-7xl flex-col gap-6 px-4 md:px-8 lg:mt-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1 animate-fade-up">
          <ChefDishes
            tags={tagsQuery.data ?? []}
            dishes={dishesQuery.data?.dishDtoList ?? chef.dishes ?? []}
            isLoading={dishesQuery.isLoading}
            isError={dishesQuery.isError}
            onRetry={() => void dishesQuery.refetch()}
            onOpenDish={setActiveDish}
            onChefMismatch={onChefMismatch}
          />
        </div>
        <UserCart
          chefId={chefId}
          deliveryPrice={chef.deliveryPrice}
          freeDeliveryFrom={chef.freeDeliveryFrom}
          includeDelivery={chef.deliveryMethods?.includes("DELIVERY") ?? true}
          hasForeignItems={hasForeignItems}
        />
      </div>
      <DishModal
        dish={activeDish}
        onOpenChange={(open) => !open && setActiveDish(null)}
        onChefMismatch={onChefMismatch}
      />
      {pendingAdd && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white px-6 py-8 text-center shadow-diffuse-lg">
            <p className="font-display text-xl font-bold text-zinc-900">Switch kitchens?</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Your cart has items from another chef. Adding this dish clears that order.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => void confirmSwitch()} className="w-full rounded-full font-semibold">
                Clear & continue
              </Button>
              <Button
                variant="outline"
                onClick={() => setPendingAdd(null)}
                className="w-full rounded-full font-semibold"
              >
                Keep cart & browse
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
