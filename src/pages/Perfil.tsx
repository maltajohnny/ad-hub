import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { UserCircle, Save } from "lucide-react";

const Perfil = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [doc, setDoc] = useState(user?.document || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleSave = () => {
    updateProfile({ name, phone, document: doc, email });
    toast.success("Perfil atualizado com sucesso!");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações pessoais</p>
      </div>

      <Card className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border/50">
          <div className="w-16 h-16 rounded-full gradient-brand flex items-center justify-center">
            <UserCircle size={32} className="text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg">{user?.name}</h2>
            <span className="text-sm text-muted-foreground capitalize">{user?.role === "admin" ? "Administrador" : "Usuário"}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border/50" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">E-mail</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary/50 border-border/50" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Telefone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-secondary/50 border-border/50" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">RG / CPF</label>
            <Input value={doc} onChange={(e) => setDoc(e.target.value)} className="bg-secondary/50 border-border/50" />
          </div>
        </div>

        <Button onClick={handleSave} className="mt-6 gradient-brand text-primary-foreground font-semibold hover:opacity-90">
          <Save size={16} className="mr-2" />
          Salvar Alterações
        </Button>
      </Card>
    </div>
  );
};

export default Perfil;
