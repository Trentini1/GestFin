import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDateForInput } from "@/const";
import { 
  TrendingUp, 
  DollarSign, 
  Wallet,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Primeiro dia do mês
    return formatDateForInput(date);
  });
  const [endDate, setEndDate] = useState(() => formatDateForInput(new Date()));

  const { data: stats, isLoading, refetch } = trpc.dashboard.stats.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate + 'T23:59:59'),
  });

  const handleFilter = () => {
    refetch();
    toast.success("Filtros aplicados!");
  };

  // Animação de contagem
  const [displayValues, setDisplayValues] = useState({
    giroTotal: 0,
    comissoesTotal: 0,
    variaveisTotal: 0,
    totalAReceber: 0,
  });

  useEffect(() => {
    if (stats) {
      const duration = 1000; // 1 segundo
      const steps = 60;
      const stepDuration = duration / steps;

      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;

        setDisplayValues({
          giroTotal: Math.round(stats.giroTotal * progress),
          comissoesTotal: Math.round(stats.comissoesTotal * progress),
          variaveisTotal: Math.round(stats.variaveisTotal * progress),
          totalAReceber: Math.round(stats.totalAReceber * progress),
        });

        if (currentStep >= steps) {
          clearInterval(interval);
          setDisplayValues({
            giroTotal: stats.giroTotal,
            comissoesTotal: stats.comissoesTotal,
            variaveisTotal: stats.variaveisTotal,
            totalAReceber: stats.totalAReceber,
          });
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }
  }, [stats]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral das suas finanças
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="startDate" className="text-sm">De:</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="endDate" className="text-sm">Até:</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button onClick={handleFilter}>
              Filtrar
            </Button>
          </div>
        </div>

        {/* Cards de Métricas */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-8 w-8 bg-muted rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-32 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-20"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Giro Total */}
            <Card className="card-hover animate-slide-up">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Giro Total
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold animate-count-up">
                  {formatCurrency(displayValues.giroTotal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.lancamentosCount || 0} lançamentos
                </p>
              </CardContent>
            </Card>

            {/* Comissões Faturadas */}
            <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Comissões Faturadas
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold animate-count-up">
                  {formatCurrency(displayValues.comissoesTotal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Valores faturados
                </p>
              </CardContent>
            </Card>

            {/* Variáveis */}
            <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Variáveis
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold animate-count-up">
                  {formatCurrency(displayValues.variaveisTotal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.variaveisCount || 0} variáveis
                </p>
              </CardContent>
            </Card>

            {/* Total a Receber */}
            <Card className="card-hover animate-slide-up bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20" style={{ animationDelay: '0.3s' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total a Receber
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary animate-count-up">
                  {formatCurrency(displayValues.totalAReceber)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Comissões + Variáveis
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Faturamento Mensal</CardTitle>
              <CardDescription>
                Últimos 6 meses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Gráfico em desenvolvimento</p>
                  <p className="text-sm mt-2">
                    Será implementado com Chart.js
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <CardTitle>Distribuição</CardTitle>
              <CardDescription>
                Com NF vs Sem NF
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Gráfico em desenvolvimento</p>
                  <p className="text-sm mt-2">
                    Será implementado com Chart.js
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Ícones temporários para os gráficos
function BarChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01M8 8h.01M12 8h.01M16 8h.01" />
    </svg>
  );
}

function PieChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v10l7.07 7.07" />
    </svg>
  );
}
