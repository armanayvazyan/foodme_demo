import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { DishDto } from "@/types";
import {
  addDishToCart,
  clearCart,
  decrementCartItem,
  getCartChefId,
  incrementCartItem,
  removeCartItem,
} from "./useCart";

function makeDish(overrides: Partial<DishDto> = {}): DishDto {
  return {
    id: 1,
    nameEn: "Dolma",
    nameHy: "Տոլմա",
    nameRu: "Долма",
    descriptionEn: "",
    price: 2000,
    url: "/img/dish/1.jpg",
    portionEn: "",
    portionHy: "",
    portionRu: "",
    status: "ACTIVE",
    minimumOrderCount: 1,
    priorityIndex: 0,
    chefId: 10,
    dishTagDto: { id: 1, nameEn: "Main", nameHy: "", nameRu: "" },
    additions: [],
    ...overrides,
  };
}

const uidOf = (dish: DishDto) =>
  `${dish.chefId}-${dish.id}-${(dish.additions ?? [])
    .map((a) => a.id)
    .sort()
    .join(",")}`;

beforeEach(async () => {
  await clearCart();
});

describe("addDishToCart", () => {
  it("adds a new line with the dish price", async () => {
    const dish = makeDish();
    await expect(addDishToCart(dish)).resolves.toBe("ok");

    const item = await db.products.get(uidOf(dish));
    expect(item).toMatchObject({ id: 1, chefId: 10, quantity: 1, price: 2000 });
  });

  it("includes addition prices in the line price", async () => {
    const dish = makeDish({
      additions: [
        { id: 7, nameEn: "Cheese", nameHy: "", nameRu: "", price: 300 },
        { id: 3, nameEn: "Herbs", nameHy: "", nameRu: "", price: 200 },
      ],
    });
    await addDishToCart(dish);

    const item = await db.products.get("10-1-3,7");
    expect(item?.price).toBe(2500);
  });

  it("starts at the dish minimum order count", async () => {
    const dish = makeDish({ minimumOrderCount: 3 });
    await addDishToCart(dish);

    const item = await db.products.get(uidOf(dish));
    expect(item?.quantity).toBe(3);
    expect(item?.limitations?.minQuantity).toBe(3);
  });

  it("increases quantity when the same dish is added again", async () => {
    const dish = makeDish();
    await addDishToCart(dish);
    await addDishToCart(dish, 2);

    expect((await db.products.get(uidOf(dish)))?.quantity).toBe(3);
  });

  it("refuses a dish from another chef unless replacement is requested", async () => {
    await addDishToCart(makeDish({ chefId: 10 }));

    await expect(addDishToCart(makeDish({ id: 2, chefId: 20 }))).resolves.toBe("mismatch");
    expect(await getCartChefId()).toBe(10);

    await expect(
      addDishToCart(makeDish({ id: 2, chefId: 20 }), 1, { replaceOtherChef: true }),
    ).resolves.toBe("ok");
    expect(await getCartChefId()).toBe(20);
    expect(await db.products.count()).toBe(1);
  });
});

describe("quantity changes", () => {
  it("increments by one", async () => {
    const dish = makeDish();
    await addDishToCart(dish);
    await incrementCartItem(uidOf(dish));

    expect((await db.products.get(uidOf(dish)))?.quantity).toBe(2);
  });

  it("removes the line when decrementing at the minimum quantity", async () => {
    const dish = makeDish();
    await addDishToCart(dish);
    await decrementCartItem(uidOf(dish));

    expect(await db.products.get(uidOf(dish))).toBeUndefined();
  });

  // Known defect: SCRUM-7 / FM-BUG-07 — decrementing from min+1 deletes the line
  // instead of reducing it to the minimum. `it.fails` keeps the suite green while the
  // bug exists and turns RED once it is fixed: then change `it.fails` back to `it`.
  it.fails("decrements from 2 to 1 instead of removing the line (SCRUM-7)", async () => {
    const dish = makeDish();
    await addDishToCart(dish, 2);
    await decrementCartItem(uidOf(dish));

    expect((await db.products.get(uidOf(dish)))?.quantity).toBe(1);
  });

  it("ignores unknown items", async () => {
    await expect(decrementCartItem("missing")).resolves.toBeUndefined();
    await expect(incrementCartItem("missing")).resolves.toBeUndefined();
  });

  it("removes a line explicitly", async () => {
    const dish = makeDish();
    await addDishToCart(dish, 4);
    await removeCartItem(uidOf(dish));

    expect(await db.products.count()).toBe(0);
  });
});
