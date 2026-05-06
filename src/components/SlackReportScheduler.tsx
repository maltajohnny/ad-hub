import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { runScheduledReportChecks } from "@/services/slackReportService";

/** Envia relatórios agendados enquanto há sessão — precisa da app aberta (localStorage no browser). */
export function SlackReportScheduler() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.mustChangePassword) return;

    const tick = () => void runScheduledReportChecks();

    const id = window.setInterval(tick, 15_000);
    tick();

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [user]);

  return null;
}
