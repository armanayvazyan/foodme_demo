import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/layout/logo";
import { MapPin, Search, ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/providers/auth-context";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { totalCount } = useCart();
  const { isAuthenticated, customer } = useAuth();
  const authNext =
    location.pathname.startsWith("/login") || location.pathname.startsWith("/register")
      ? "/orders"
      : `${location.pathname}${location.search}`;
  const customerInitial = (customer?.fullName?.trim()?.[0] ?? "A").toUpperCase();
  const activeQuery =
    location.pathname === "/explore" ? new URLSearchParams(location.search).get("q") ?? "" : "";

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget as HTMLFormElement).get("q") ?? "").trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  };

  return (
    <header className="hdr_wrap sticky top-0 z-50 border-b border-zinc-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:gap-4 md:px-8">
        <Link
          to="/"
          aria-label="FoodMe home"
          className="flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          <Logo className="h-7 w-auto" />
        </Link>

        {/* Uber-style delivery address pill */}
        <div
          className="hidden max-w-[220px] items-center gap-1.5 truncate rounded-full bg-zinc-100 px-4 py-2.5 text-left text-sm font-semibold text-zinc-900 sm:flex"
        >
          <MapPin size={15} className="shrink-0" strokeWidth={2.25} />
          <span className="truncate">Yerevan · Now</span>
        </div>

        <form
          key={`${location.pathname}:${location.search}`}
          onSubmit={onSearch}
          className="order-last w-full flex-1 basis-full md:order-none md:w-auto md:basis-0"
        >
          <label className="relative block">
            <span className="sr-only">Search FoodMe</span>
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              strokeWidth={2.25}
            />
            <input
              name="q"
              type="search"
              defaultValue={activeQuery}
              placeholder="Search FoodMe"
              className="h-11 w-full rounded-full border-0 bg-zinc-100 pl-11 pr-4 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-500 focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </label>
        </form>

        <nav className="ml-auto flex items-center gap-2 sm:ml-0">
          <Link
            to="/explore"
            className={[
              "hidden rounded-full px-4 py-2.5 text-sm font-semibold transition-colors sm:inline-flex",
              location.pathname === "/explore"
                ? "bg-zinc-900 text-white"
                : "text-zinc-900 hover:bg-zinc-100",
            ].join(" ")}
          >
            Explore chefs
          </Link>

          {isAuthenticated ? (
            <Link
              to="/orders"
              className={[
                "hidden rounded-full px-4 py-2.5 text-sm font-semibold transition-colors sm:inline-flex",
                location.pathname === "/orders"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-900 hover:bg-zinc-100",
              ].join(" ")}
            >
              Orders
            </Link>
          ) : (
            <Link
              to={`/login?next=${encodeURIComponent(authNext)}`}
              className="rounded-full px-3 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 sm:px-4"
            >
              Sign in
            </Link>
          )}

          <Link
            to="/checkout"
            aria-label={totalCount > 0 ? `Cart, ${totalCount} items` : "Cart"}
            className="relative flex h-11 items-center gap-2 rounded-full bg-[#06C167] px-4 text-sm font-bold text-white hover:bg-[#05a85a]"
          >
            <ShoppingCart size={16} strokeWidth={2.5} />
            <span className="tabular-nums">{totalCount}</span>
          </Link>

          {isAuthenticated ? (
            <Link
              to="/orders"
              aria-label={customer?.fullName ? `Account, ${customer.fullName}` : "Your orders"}
              title={customer?.fullName ? `Signed in as ${customer.fullName}` : "Your orders"}
              className={[
                "flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white hover:bg-zinc-800",
                location.pathname === "/orders" ? "ring-2 ring-zinc-900 ring-offset-2" : "",
              ].join(" ")}
            >
              {customerInitial}
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
