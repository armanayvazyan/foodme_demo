import { Link } from "react-router-dom";
import { useAuth } from "@/providers/auth-context";

export function Footer() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="mt-auto bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="max-w-sm">
          <p className="text-xl font-extrabold tracking-tight">
            Food<span className="text-[#06C167]">Me</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            A demo food-ordering platform. Chefs, dishes and orders on this site are fictional.
          </p>
        </div>
        <nav className="flex flex-wrap gap-5 text-sm font-semibold text-zinc-300">
          <Link
            to="/explore"
            className="rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Explore
          </Link>
          <Link
            to="/orders"
            className="rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Orders
          </Link>
          {!isAuthenticated && (
            <Link
              to="/login?next=/orders"
              className="rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Sign in
            </Link>
          )}
          <span>Cash on delivery</span>
          <span>Yerevan</span>
        </nav>
      </div>
      <div className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-zinc-500 md:px-8">
          <span>© 2026 FoodMe</span>
          <span>Built with care</span>
        </div>
      </div>
    </footer>
  );
}
