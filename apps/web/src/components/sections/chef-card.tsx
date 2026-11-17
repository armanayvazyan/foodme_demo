import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { formatAmd, sameLabel, translate } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";
import type { ExploreChefResponseDto } from "@/types";

interface ChefCardProps {
  chef: ExploreChefResponseDto;
}

export function ChefCard({ chef }: ChefCardProps) {
  const name = translate(chef.name);
  const kitchen = translate(chef.kitchen);
  const metadata =
    sameLabel(kitchen, name)
      ? "25–40 min"
      : `${kitchen} · 25–40 min`;

  return (
    <Link to={`/chef/${chef.id}`} className="cc_card group block">
      {/* Uber Eats feed card: photo, then name + gray rating bubble */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-zinc-100">
        <SafeImage
          src={chef.avatarUrl}
          alt={`${name} avatar`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-900 shadow-sm">
          {chef.deliveryPrice === 0 ? "Free delivery" : `${formatAmd(chef.deliveryPrice)} delivery`}
        </span>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-snug text-zinc-900">{name}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-500">{metadata}</p>
        </div>
        <span className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-zinc-100 px-2.5 text-xs font-bold text-zinc-900">
          {chef.rating == null ? (
            "No ratings yet"
          ) : (
            <>
              <Star size={12} className="text-amber-500" fill="currentColor" />
              {chef.rating.toFixed(1)}
            </>
          )}
        </span>
      </div>
    </Link>
  );
}
