import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Copy, Link2, Loader2, RefreshCw } from "lucide-react";
import { schedulingGet, schedulingPost } from "@/services/growthHubApi";

type DayAv = { weekday: number; enabled: boolean; start: string; end: string };

export default function SchedulingPage() {
  const [loading, setLoading] = useState(true);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [displayName, setDisplayName] = useState("");
  const [availability, setAvailability] = useState<DayAv[]>([]);
  const [publicPath, setPublicPath] = useState("");
  const [bookings, setBookings] = useState<
    { id: string; start: string; guestName: string; guestEmail: string }[]
  >([]);
  const [gcal, setGcal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await schedulingGet()) as {
        ok?: boolean;
        profile?: {
          slotMinutes: number;
          availability: DayAv[];
          displayName: string;
          publicPath: string;
          googleCalendarConnected: boolean;
        };
        bookings?: { id: string; start: string; guestName: string; guestEmail: string }[];
      };
      if (data.profile) {
        setSlotMinutes(data.profile.slotMinutes);
        setAvailability(data.profile.availability);
        setDisplayName(data.profile.displayName);
        setPublicPath(data.profile.publicPath);
        setGcal(data.profile.googleCalendarConnected);
      }
      setBookings(data.bookings ?? []);
    } catch {
      toast.error("Não foi possível carregar o agendamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    try {
      const out = (await schedulingPost({
        action: "saveAvailability",
        slotMinutes,
        displayName,
        availability,
      })) as { ok?: boolean; error?: string };
      if (out.ok) toast.success("Disponibilidade guardada.");
      else toast.error(out.error ?? "Erro ao guardar.");
    } catch {
      toast.error("Erro de rede.");
    }
  };

  const rotate = async () => {
    try {
      const out = (await schedulingPost({ action: "rotateLink" })) as { ok?: boolean; publicPath?: string };
      if (out.publicPath) {
        setPublicPath(out.publicPath);
        toast.success("Novo link gerado.");
      }
    } catch {
      toast.error("Erro ao gerar link.");
    }
  };

  const connectGoogle = async () => {
    try {
      await schedulingPost({ action: "connectGoogle" });
      setGcal(true);
      toast.success("Integração Google (demo) ativada.");
    } catch {
      toast.error("Falha ao ativar.");
    }
  };

  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Calendar className="h-7 w-7 text-primary" />
          Agendamento
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Link público estilo Calendly, disponibilidade semanal e integração Google Calendar (bandeiras demo até OAuth
          completo).
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="p-5 border-border/60 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Link público
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input readOnly value={fullUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  void navigator.clipboard.writeText(fullUrl).then(() => toast.success("Copiado."));
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Button>
              <Button type="button" variant="outline" className="shrink-0" onClick={() => void rotate()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Novo link
              </Button>
            </div>
          </Card>

          <Card className="p-5 border-border/60 space-y-4">
            <Label>Nome exibido na página pública</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="O seu nome" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Duração do slot (minutos)</Label>
                <Input
                  type="number"
                  min={15}
                  max={120}
                  step={15}
                  value={slotMinutes}
                  onChange={(e) => setSlotMinutes(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" className="w-full" variant={gcal ? "secondary" : "default"} onClick={() => void connectGoogle()}>
                  {gcal ? "Google Calendar (ativo — demo)" : "Ligar Google Calendar (demo)"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Disponibilidade (dias úteis)</Label>
              {availability.map((row, i) => (
                <div key={row.weekday} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-28 text-muted-foreground">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][row.weekday]}
                  </span>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => {
                      const next = [...availability];
                      next[i] = { ...row, enabled: e.target.checked };
                      setAvailability(next);
                    }}
                  />
                  <Input
                    className="w-24 h-8"
                    value={row.start}
                    onChange={(e) => {
                      const next = [...availability];
                      next[i] = { ...row, start: e.target.value };
                      setAvailability(next);
                    }}
                  />
                  <span>—</span>
                  <Input
                    className="w-24 h-8"
                    value={row.end}
                    onChange={(e) => {
                      const next = [...availability];
                      next[i] = { ...row, end: e.target.value };
                      setAvailability(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <Button type="button" onClick={() => void save()}>
              Guardar disponibilidade
            </Button>
          </Card>

          <Card className="p-5 border-border/60">
            <h3 className="font-medium mb-3">Reservas recentes</h3>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem reservas.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bookings.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2 border-b border-border/40 pb-2">
                    <span>{new Date(b.start).toLocaleString("pt-BR")}</span>
                    <span className="text-muted-foreground truncate">
                      {b.guestName} · {b.guestEmail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Notificações por e-mail (Sendgrid/SMTP) e WhatsApp (Twilio/Meta) são preparadas no backend; configure as
              chaves na Vercel para envio real.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
