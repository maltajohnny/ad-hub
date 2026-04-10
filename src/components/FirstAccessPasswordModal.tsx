import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock } from "lucide-react";
import {
  CONFIRM_PASSWORD_MISMATCH_HINT,
  isStrongPassword,
  PASSWORD_FIELD_INLINE_ALERT_CLASS,
  PASSWORD_INPUT_ERROR_GLOW_CLASS,
  STRONG_PASSWORD_HINT,
} from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const FirstAccessPasswordModal = () => {
  const { user, completeFirstPasswordChange } = useAuth();
  const open = Boolean(user?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewPasswordError(false);
    setConfirmPasswordError(false);
  };

  const handleNewPasswordBlur = () => {
    const p = newPassword.trim();
    if (p.length === 0) {
      setNewPasswordError(false);
      return;
    }
    if (!isStrongPassword(p)) {
      setNewPasswordError(true);
    } else {
      setNewPasswordError(false);
    }
  };

  const handleConfirmPasswordBlur = () => {
    const c = confirmPassword.trim();
    if (c.length === 0) {
      setConfirmPasswordError(false);
      return;
    }
    const n = newPassword.trim();
    if (n.length === 0) return;
    if (c !== n) {
      setConfirmPasswordError(true);
    } else {
      setConfirmPasswordError(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError(true);
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setNewPasswordError(true);
      return;
    }
    setSubmitting(true);
    const res = await completeFirstPasswordChange(currentPassword, newPassword);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível alterar a senha.");
      return;
    }
    toast.success("Senha definida. Bem-vindo!");
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Primeiro acesso — definir nova senha
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            Introduza a <strong>senha inicial</strong> que recebeu e defina a <strong>nova senha</strong> para continuar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Senha atual (inicial)</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-secondary/50 border-border/50 pr-10"
                required
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowCurrent((s) => !s)}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Nova senha</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewPassword(v);
                  if (v.trim() === "" || isStrongPassword(v)) setNewPasswordError(false);
                }}
                onBlur={handleNewPasswordBlur}
                autoComplete="new-password"
                className={cn(
                  "relative z-10 border-border/50 pr-10",
                  newPasswordError ? "bg-secondary" : "bg-secondary/50",
                  newPasswordError && PASSWORD_INPUT_ERROR_GLOW_CLASS,
                )}
                required
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowNew((s) => !s)}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPasswordError && (
              <p role="alert" className={PASSWORD_FIELD_INLINE_ALERT_CLASS}>
                {STRONG_PASSWORD_HINT}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Repetir nova senha</label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  const v = e.target.value;
                  setConfirmPassword(v);
                  if (v.trim() === "" || v === newPassword) setConfirmPasswordError(false);
                }}
                onBlur={handleConfirmPasswordBlur}
                autoComplete="new-password"
                className={cn(
                  "relative z-10 border-border/50 pr-10",
                  confirmPasswordError ? "bg-secondary" : "bg-secondary/50",
                  confirmPasswordError && PASSWORD_INPUT_ERROR_GLOW_CLASS,
                )}
                required
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowConfirm((s) => !s)}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPasswordError && (
              <p role="alert" className={PASSWORD_FIELD_INLINE_ALERT_CLASS}>
                {CONFIRM_PASSWORD_MISMATCH_HINT}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full gradient-brand text-primary-foreground" disabled={submitting}>
              {submitting ? "A guardar…" : "Confirmar e continuar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
