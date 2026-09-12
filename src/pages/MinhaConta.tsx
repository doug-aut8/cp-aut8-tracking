import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";

const MinhaConta: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logOut } = useAuth();
  const { settings } = useLayoutSettings();

  const handleLogout = async () => {
    await logOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: settings.cor_background }}>
      <div
        className="sticky top-0 z-10 border-b"
        style={{ backgroundColor: settings.cor_background_header }}
      >
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 max-w-[600px]">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" style={{ color: settings.cor_fonte }} />
          </Button>
          <h1 className="text-lg font-bold" style={{ color: settings.cor_fonte }}>
            Minha Conta
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-[600px]">
        {currentUser ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Dados da conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{currentUser.displayName || "Nome não informado"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{currentUser.email || "E-mail não informado"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{currentUser.phoneNumber || "Telefone não informado"}</span>
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" /> Sair da conta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center space-y-4">
              <p className="text-muted-foreground">
                Você não está logado. Entre para ver seus dados.
              </p>
              <Button onClick={() => navigate("/login")}>
                <LogIn className="h-4 w-4 mr-2" /> Entrar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MinhaConta;
