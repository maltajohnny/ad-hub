import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adHubResetPassword } from "@/lib/adhubAuthApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import {
  isStrongPassword,
  PASSWORD_FIELD_INLINE_ALERT_CLASS,
  PASSWORD_INPUT_ERROR_GLOW_CLASS,
  STRONG_PASSWORD_HINT,
} from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pwErr, setPwErr] = useState(false);

  const canSubmit = useMemo(() => {
    if (!token.trim()) return false;
    if (!isStrongPassword(pw) || pw !== pw2) return false;
    return true;
  }, [token, pw, pw2]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const r = await adHubResetPassword(token, pw);
      if (r.ok) {
        toast.success("Senha atualizada. Inicie sessão com a nova senha.");
        navigate("/login", { replace: true });
      } else {
        toast.error(r.error ?? "Não foi possível redefinir.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display text-xl font-bold text-foreground flex items-center justify-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            Nova senha
          </h1>
          <p className="text-sm text-muted-foreground">
            {token ? "Defina uma nova senha forte para a sua conta." : "Link inválido ou em falta — peça um novo e-mail de recuperação."}
          </p>
        </div>
        {token ? (
          <form onSubmit={handleSubmit} className="glass-card space-y-4 rounded-xl p-6">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Nova senha</label>
              <div className="relative">
                <Input
                  type={show1 ? "text" : "password"}
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPw(v);
                    if (v === "" || isStrongPassword(v)) setPwErr(false);
                  }}
                  onBlur={() => setPwErr(pw.trim() !== "" && !isStrongPassword(pw))}
                  className={cn(
                    "pr-10 bg-secondary/50 border-border/50",
                    pwErr && PASSWORD_INPUT_ERROR_GLOW_CLASS,
                  )}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShow1((s) => !s)}
                >
                  {show1 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwErr ? <p className={PASSWORD_FIELD_INLINE_ALERT_CLASS}>{STRONG_PASSWORD_HINT}</p> : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Repetir nova senha</label>
              <div className="relative">
                <Input
                  type={show2 ? "text" : "password"}
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="pr-10 bg-secondary/50 border-border/50"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShow2((s) => !s)}
                >
                  {show2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pw && pw2 && pw !== pw2 ? (
                <p className="text-xs text-destructive">As senhas não coincidem.</p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="w-full gradient-brand text-primary-foreground"
              disabled={!canSubmit || loading}
            >
              {loading ? "A salvar…" : "Salvar nova senha"}
            </Button>
          </form>
        ) : null}
        <Button variant="ghost" className="w-full" asChild>
          <Link to="/login">Voltar ao login</Link>
        </Button>
      </div>
    </div>
  );
}
