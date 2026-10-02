import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { foodmeApi } from "@/api/foodme";
import { ChefCard } from "@/components/sections/chef-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { translate, sameLabel } from "@/lib/utils";

const PAGE_SIZE = 12;

export default function Explore() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [kitchenFilter, setKitchenFilter] = useState<string | null>(null);

  const urlQuery = searchParams.get("q") ?? "";
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setQuery(urlQuery);
    setPage(0);
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["chefs", "active", page],
    queryFn: () => foodmeApi.getActiveChefs(page, PAGE_SIZE),
  });

  const kitchens = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(
        data.exploreChefResponseDtoList
          .map((c) => {
            const kitchen = translate(c.kitchen);
            const name = translate(c.name);
            if (!kitchen || sameLabel(kitchen, name)) return "";
            return kitchen;
          })
          .filter(Boolean),
      ),
    ).sort();
  }, [data]);

  const chefs = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.exploreChefResponseDtoList.filter((chef) => {
      const name = translate(chef.name).toLowerCase();
      const kitchen = translate(chef.kitchen);
      if (kitchenFilter && kitchen !== kitchenFilter) return false;
      if (!q) return true;
      return name.includes(q) || kitchen.toLowerCase().includes(q);
    });
  }, [data, query, kitchenFilter]);

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;

  return (
    <div className="ep_wrap mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-zinc-900 md:text-3xl">
          Explore chefs
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {data ? (
            <span className="tabular-nums">{data.count} chefs cooking near you</span>
          ) : (
            "Browse independent local chefs, each with their own kitchen and unique menu."
          )}
        </p>
      </div>

      {kitchens.length > 0 && (
      <div className="sticky top-[124px] z-20 -mx-4 mb-5 space-y-3 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur-md md:top-[68px] md:-mx-8 md:px-8">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            aria-pressed={!kitchenFilter}
            onClick={() => {
              setKitchenFilter(null);
              setPage(0);
            }}
            className={["eda-chip", !kitchenFilter ? "eda-chip-active" : ""].join(" ")}
          >
            All
          </button>
          {kitchens.map((kitchen) => (
            <button
              key={kitchen}
              type="button"
              aria-pressed={kitchenFilter === kitchen}
              onClick={() => {
                setKitchenFilter((k) => (k === kitchen ? null : kitchen));
                setPage(0);
              }}
              className={[
                "eda-chip",
                kitchenFilter === kitchen ? "eda-chip-active" : "",
              ].join(" ")}
            >
              {kitchen}
            </button>
          ))}
        </div>
      </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
              <div className="aspect-[16/10] skeleton-shimmer" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div
          className="flex flex-col items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>Could not load chefs. Check your connection and try again.</span>
          <Button size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && chefs.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-semibold text-zinc-800">No chefs match</p>
          <p className="mt-1 text-sm text-zinc-500">Try another filter or clear search.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setKitchenFilter(null);
              setPage(0);
              if (searchParams.get("q")) navigate("/explore");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {chefs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chefs.map((chef) => (
            <ChefCard key={chef.id} chef={chef} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="ep_pagination mt-8 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => {
              setPage((p) => p - 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <ChevronLeft size={14} />
            Previous
          </Button>
          <span className="text-sm tabular-nums text-zinc-500">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => {
              setPage((p) => p + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
