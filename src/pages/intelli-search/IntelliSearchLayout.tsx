import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { IntelliSearchNewBadge } from "@/components/IntelliSearchNewBadge";

type NavLeaf = { to: string; label: string };
type NavGroup = { title: string; items: NavLeaf[] };

const GROUPS: NavGroup[] = [
  {
    title: "Health Analysis",
    items: [
      { to: "/intelli-search/health/complete", label: "Complete Analysis" },
      { to: "/intelli-search/health/manual", label: "Manual Analysis" },
    ],
  },
  {
    title: "Extensão & análises",
    items: [
      { to: "/intelli-search/pre-analysis", label: "Pre Analysis" },
      { to: "/intelli-search/reviews-analysis", label: "Reviews Analysis" },
      { to: "/intelli-search/posts-analysis", label: "Posts Analysis" },
      { to: "/intelli-search/categories-analysis", label: "Categories Analysis" },
    ],
  },
  {
    title: "Ranking",
    items: [
      { to: "/intelli-search/ranking/analysis", label: "Ranking Analysis" },
      { to: "/intelli-search/ranking/history", label: "Analysis History" },
    ],
  },
  {
    title: "Prospecção",
    items: [{ to: "/intelli-search/prospecting/lead-finder", label: "Lead Finder" }],
  },
  {
    title: "Métricas",
    items: [
      { to: "/intelli-search/metrics/profile-insights", label: "Profile Insights" },
      { to: "/intelli-search/metrics/keywords", label: "Keywords" },
      { to: "/intelli-search/metrics/evolution", label: "Analysis Evolution" },
    ],
  },
  {
    title: "Gestor",
    items: [
      { to: "/intelli-search/manager/reviews", label: "Reviews Manager" },
      { to: "/intelli-search/manager/qa", label: "Q&A Manager" },
      { to: "/intelli-search/manager/posts", label: "Posts Manager" },
    ],
  },
  {
    title: "Ferramentas",
    items: [{ to: "/intelli-search/tools/performance-report", label: "Performance Report" }],
  },
];

export default function IntelliSearchLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:gap-4 lg:items-start">
      <nav
        aria-label="IntelliSearch"
        className="shrink-0 lg:w-[200px] lg:min-w-[180px] lg:max-w-[220px] space-y-5 rounded-xl border border-border/50 bg-card/30 p-3"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
          <div>
            <p className="font-display text-sm font-semibold tracking-tight">IntelliSearch</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">Google Business Profile</p>
          </div>
          <IntelliSearchNewBadge className="scale-90 shrink-0" />
        </div>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary/15 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )
                    }
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                    <span className="min-w-0 leading-snug">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
