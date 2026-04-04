import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { runScheduledReportChecks } from "@/services/slackReportService";

/** Envia relatórios agendados (1×/min) enquanto o utilizador tem sessão e a app está aberta. */
export function SlackReportScheduler() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const id = window.setInterval(() => {
      void runScheduledReportChecks();
    }, 60_000);
    void runScheduledReportChecks();
    return () => clearInterval(id);
  }, [user]);

  return null;
}
