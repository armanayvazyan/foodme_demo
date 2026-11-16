import { Star, Clock, Phone, Truck, ShoppingBag } from "lucide-react";
import { formatAmd, sameLabel, translate } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";
import type { ExploreChefResponseDto } from "@/types";

interface ChefDetailsProps {
  chef: ExploreChefResponseDto;
}

export function ChefDetails({ chef }: ChefDetailsProps) {
  const name = translate(chef.name);
  const kitchen = translate(chef.kitchen);
  const showKitchen = kitchen && !sameLabel(kitchen, name);
  const heroSrc = chef.bannerUrl || chef.avatarUrl;
  const supportsDelivery = chef.deliveryMethods?.includes("DELIVERY");
  const supportsTakeaway = chef.deliveryMethods?.includes("TAKEAWAY");

  return (
    <section className="cd_hero bg-white">
      <div className="relative h-44 w-full overflow-hidden bg-zinc-200 md:h-56">
        {chef.bannerUrl ? (
          <SafeImage src={heroSrc} alt="" className="h-full w-full object-cover" />
        ) : heroSrc ? (
          <>
            <SafeImage
              src={heroSrc}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
            />
            <div className="absolute inset-0 bg-white/25" aria-hidden="true" />
            <SafeImage
              src={heroSrc}
              alt=""
              className="relative mx-auto h-full w-full max-w-2xl object-contain px-10 py-5"
            />
          </>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-wrap items-end gap-4 pb-5">
          <SafeImage
            src={chef.avatarUrl}
            alt={name}
            className="-mt-10 h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-[0_6px_18px_rgba(0,0,0,0.14)] md:-mt-12 md:h-24 md:w-24"
          />
          <div className="min-w-0 flex-1 pb-1 pt-4">
            <h1 className="font-display text-2xl font-extrabold text-zinc-900 md:text-3xl">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {showKitchen && <span className="text-zinc-500">{kitchen}</span>}
              {showKitchen && <span className="text-zinc-300">·</span>}
              {chef.rating == null ? (
                <span className="font-semibold text-zinc-500">No ratings yet</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star size={14} className="text-amber-500" fill="currentColor" />
                  {chef.rating.toFixed(1)}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <Clock size={13} />
                25–40 min
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
              {supportsDelivery && (
                <span className="inline-flex items-center gap-1">
                  <Truck size={14} strokeWidth={2} />
                  {chef.deliveryPrice === 0
                    ? "Free delivery"
                    : `${formatAmd(chef.deliveryPrice)} delivery`}
                  {chef.freeDeliveryFrom > 0 && chef.deliveryPrice > 0
                    ? ` · free from ${formatAmd(chef.freeDeliveryFrom)}`
                    : ""}
                </span>
              )}
              {supportsTakeaway && (
                <span className="inline-flex items-center gap-1">
                  <ShoppingBag size={14} strokeWidth={2} />
                  Takeaway
                </span>
              )}
              {chef.phoneNumber && (
                <a
                  href={`tel:${chef.phoneNumber}`}
                  className="inline-flex items-center gap-1 hover:text-zinc-900"
                >
                  <Phone size={14} strokeWidth={2} />
                  {chef.phoneNumber}
                </a>
              )}
            </div>
          </div>
        </div>
        {chef.description && (
          <p className="max-w-2xl pb-5 text-sm leading-relaxed text-zinc-500">
            {translate(chef.description)}
          </p>
        )}
      </div>
    </section>
  );
}
