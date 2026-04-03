import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, LogIn } from "lucide-react";
import norterLogo from "@/assets/norterlogo.png";

const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!login(username, password)) {
      setError("Credenciais inválidas");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full gradient-brand opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full gradient-brand opacity-5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <img src={norterLogo} alt="Norter" className="w-40 h-40 object-contain" />
          <span className="text-foreground/20 font-display text-[10px] tracking-[0.3em] uppercase -mt-3">
            Aceleradora
          </span>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-8 space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Usuário</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              className="bg-secondary/50 border-border/50 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Senha</label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="bg-secondary/50 border-border/50 focus:border-primary pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-destructive text-sm text-center">{error}</p>}

          <Button type="submit" className="w-full gradient-brand text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
            <LogIn size={16} className="mr-2" />
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
