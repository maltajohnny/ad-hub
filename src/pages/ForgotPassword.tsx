import { useState } from "react";
import { Link } from "react-router-dom";
import { adHubForgotPassword } from "@/lib/adhubAuthApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 3 && email.includes("@");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const r = await adHubForgotPassword(email.trim());
      if (r.ok) {
        toast.success(r.message ?? "Se o e-mail existir na conta, receberá instruções em breve.");
        setEmail("");
      } else {
        toast.error(r.error ?? "Não foi possível enviar.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display text-xl font-bold text-foreground">Esqueceu a senha?</h1>
          <p className="text-sm text-muted-foreground">
            Indique o <strong>e-mail</strong> da sua conta. Se existir no sistema, enviaremos um link para redefinir a
            senha (validade limitada).
          </p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card space-y-4 rounded-xl p-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="forgot-email">
              E-mail
            </label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com"
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <Button
            type="submit"
            className="w-full gradient-brand text-primary-foreground"
            disabled={!canSubmit || loading}
          >
            <Mail className="mr-2 h-4 w-4" />
            {loading ? "A enviar…" : "Enviar link"}
          </Button>
        </form>
        <Button variant="ghost" className="w-full gap-2" asChild>
          <Link to="/login">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </Button>
      </div>
    </div>
  );
}
