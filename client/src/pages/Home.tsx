import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { 
  BarChart3, 
  FileText, 
  Users, 
  TrendingUp, 
  Receipt,
  Settings,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-bounce">{APP_LOGO}</div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16 animate-fade-in">
            <div className="text-8xl mb-6">{APP_LOGO}</div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {APP_TITLE}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Sistema completo de gestão financeira com análise inteligente de notas fiscais,
              controle de lançamentos e relatórios avançados.
            </p>
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Entrar no Sistema
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="card-hover animate-slide-up">
              <CardHeader>
                <BarChart3 className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Dashboard Inteligente</CardTitle>
                <CardDescription>
                  Visualize métricas em tempo real com gráficos interativos e animações suaves
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <FileText className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Análise com IA</CardTitle>
                <CardDescription>
                  Extraia dados automaticamente de notas fiscais usando inteligência artificial
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <Receipt className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Gestão de Lançamentos</CardTitle>
                <CardDescription>
                  Controle completo de lançamentos financeiros com cálculo automático de comissões
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <Users className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Gestão de Clientes</CardTitle>
                <CardDescription>
                  Cadastro completo de clientes com histórico de transações
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Variáveis Financeiras</CardTitle>
                <CardDescription>
                  Controle de valores adicionais e variáveis do período
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <Settings className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Relatórios Avançados</CardTitle>
                <CardDescription>
                  Exporte dados em PDF, CSV e faça backup completo do sistema
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Footer */}
          <div className="text-center mt-16 text-muted-foreground">
            <p>© 2024 {APP_TITLE}. Sistema profissional de gestão financeira.</p>
          </div>
        </div>
      </div>
    );
  }

  // Usuário autenticado - redirecionar para dashboard
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bem-vindo, {user?.name}!</h1>
            <p className="text-muted-foreground mt-1">
              Acesse as funcionalidades do sistema pelo menu lateral
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard">
            <Card className="card-hover cursor-pointer">
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Dashboard</CardTitle>
                <CardDescription>
                  Visualize métricas e gráficos
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/lancamentos">
            <Card className="card-hover cursor-pointer">
              <CardHeader>
                <Receipt className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Lançamentos</CardTitle>
                <CardDescription>
                  Gerencie lançamentos financeiros
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/clientes">
            <Card className="card-hover cursor-pointer">
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Clientes</CardTitle>
                <CardDescription>
                  Cadastro de clientes
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
