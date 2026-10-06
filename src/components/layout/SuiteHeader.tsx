import { ArrowLeftRight, BarChart3, BookOpenCheck, GraduationCap, History } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import logo from "@/assets/logo-rg360.png";
import { SUITE_HOME_URL } from "@/lib/suite";

// Payroll, activities and stats are tabs of the home page (?tab=…); the rest are routes.
const items = [
  { to: "/", tab: "payroll", label: "Nòmines", icon: BookOpenCheck },
  { to: "/?tab=activities", tab: "activities", label: "Activitats / Escoles", icon: GraduationCap },
  { to: "/?tab=stats", tab: "stats", label: "Estadístiques", icon: BarChart3 },
  { to: "/history", label: "Historial", icon: History },
  { to: "/import-export", label: "Importar / Exportar", icon: ArrowLeftRight },
];

/**
 * Suite header (same design as the RG360 landing), shown on every page.
 * Account, language, theme and sign-out live in the landing, not here.
 */
export function SuiteHeader() {
  const { pathname, search } = useLocation();
  const currentTab = new URLSearchParams(search).get("tab") ?? "payroll";
  const isActive = (item: (typeof items)[number]) =>
    item.tab ? pathname === "/" && currentTab === item.tab : pathname === item.to;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap lg:px-8">
        <a
          href={SUITE_HOME_URL}
          className="flex shrink-0 items-center p-1 hover:bg-slate-100"
          aria-label="Aplicacions RG360"
          title="Aplicacions RG360"
        >
          <img src={logo} alt="RG360" className="h-7 w-auto" />
        </a>
        <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <Link to="/" className="shrink-0 text-sm font-bold tracking-tight hover:text-violet-700">
          Nòmines
        </Link>

        <nav
          aria-label="Seccions principals"
          className="order-3 flex w-full items-stretch gap-1 overflow-x-auto border-t border-slate-200 pt-2 lg:order-none lg:ml-auto lg:w-auto lg:border-0 lg:pt-0"
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-sm font-semibold transition hover:bg-slate-100 ${isActive(item) ? "text-violet-700" : "text-slate-500 hover:text-slate-900"}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

      </div>
    </header>
  );
}
