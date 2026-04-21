import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { publicBookingGet, publicBookingPost } from "@/services/growthHubApi";

export default function PublicBooking() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<{ start: string; label: string }[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [done, setDone] = useState(false);

  const t = token ?? "";

  const loadSlots = useCallback(async () => {
    if (!t) return;
    setLoading(true);
    try {
      const data = (await publicBookingGet(t, date)) as {
        ok?: boolean;
        error?: string;
        displayName?: string;
        slots?: { start: string; label: string }[];
      };
      if (!data.ok) {
        toast.error(data.error ?? "Link inválido.");
        setSlots([]);
        return;
      }
      if (data.displayName) setDisplayName(data.displayName);
      setSlots(data.slots ?? []);
    } finally {
      setLoading(false);
    }
  }, [t, date]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const confirm = async () => {
    if (!picked || !guestName.trim() || !guestEmail.trim()) {
      toast.error("Preencha nome, e-mail e horário.");
      return;
    }
    try {
      const data = (await publicBookingPost({
        token: t,
        start: picked,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
      })) as { ok?: boolean; error?: string };
      if (data.ok) {
        setDone(true);
        toast.success("Reserva criada.");
      } else toast.error(data.error ?? "Erro.");
    } catch {
      toast.error("Erro de rede.");
    }
  };

  if (!t) return <p className="p-8 text-center text-muted-foreground">Token em falta.</p>;

  if (done) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full p-8 text-center space-y-2">
          <h1 className="text-xl font-display font-bold">Reserva confirmada</h1>
          <p className="text-sm text-muted-foreground">Receberá confirmação por e-mail quando o envio estiver configurado.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/40">
      <Card className="w-full max-w-lg p-6 space-y-5 border-border/60 shadow-lg">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Agendar com</p>
          <h1 className="text-2xl font-display font-bold">{displayName || "…"}</h1>
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Horários disponíveis</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {slots.map((s) => (
                <Button
                  key={s.start}
                  type="button"
                  variant={picked === s.start ? "default" : "secondary"}
                  className="h-auto py-2 text-xs"
                  onClick={() => setPicked(s.start)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            {slots.length === 0 ? <p className="text-sm text-muted-foreground">Sem horários neste dia.</p> : null}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nome</Label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="mt-1" />
          </div>
        </div>
        <Button type="button" className="w-full" onClick={() => void confirm()} disabled={!picked}>
          Confirmar reserva
        </Button>
      </Card>
    </div>
  );
}
