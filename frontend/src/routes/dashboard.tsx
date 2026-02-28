import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { useApi } from "@/hooks/use-api";
import { 
  DollarSign, 
  Users, 
  QrCode, 
  Bot as BotIcon,
  TrendingUp,
  TrendingDown,
  Calendar
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <ProtectedRoute>
      <DashboardLayout>
        <DashboardPage />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

interface Stats {
  totalBots: number;
  activeBots: number;
  totalUsers: number;
  usersWhoPurchased: number;
  totalPixGenerated: number;
  totalRevenue: number;
  totalRevenueCents: number;
  todayRevenue: number;
  conversionRate: number;
  revenueGrowth: number;
  revenueByDay: Array<{ date: string; revenue: number }>;
  accountHealth: string;
  accountHealthPercentage: number;
}

function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { fetchWithAuth } = useApi();

  useEffect(() => {
    loadStats();
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetchWithAuth(`/api/bots/stats`);
      const data = await response.json();

      if (response.ok && data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar estatísticas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Nenhuma estatística disponível</div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "Excelente":
        return "text-green-600";
      case "Bom":
        return "text-blue-600";
      case "Regular":
        return "text-yellow-600";
      default:
        return "text-red-600";
    }
  };

  const getHealthBgColor = (health: string) => {
    switch (health) {
      case "Excelente":
        return "bg-green-500";
      case "Bom":
        return "bg-blue-500";
      case "Regular":
        return "bg-yellow-500";
      default:
        return "bg-red-500";
    }
  };

  // Calcular máximo para o gráfico
  const maxRevenue = Math.max(...stats.revenueByDay.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Início</h1>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vendas</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.totalRevenue)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {stats.revenueGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs ${stats.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.revenueGrowth >= 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}% vs mês anterior
                  </span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalUsers > 0 
                    ? formatCurrency(stats.totalRevenue / stats.totalUsers)
                    : formatCurrency(0)
                  }
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-gray-500">0% vs mês anterior</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pix Pagos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalPixGenerated}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-gray-500">0% vs mês anterior</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <QrCode className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vendas Hoje</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.todayRevenue || 0)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-gray-500">Hoje</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health and Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Saúde da conta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${getHealthColor(stats.accountHealth)}`}>
                  {stats.accountHealth}
                </span>
                <span className="text-sm text-gray-600">{stats.accountHealthPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`${getHealthBgColor(stats.accountHealth)} h-2 rounded-full transition-all duration-500`} 
                  style={{ width: `${Math.min(stats.accountHealthPercentage, 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Total de Bots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalBots}</p>
                <p className="text-sm text-gray-500 mt-1">{stats.activeBots} ativos</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <BotIcon className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Total de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-sm text-gray-500 mt-1">{stats.usersWhoPurchased} compraram</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900">Receita</CardTitle>
            <span className="text-xs text-gray-500">Atualização em tempo real</span>
          </div>
        </CardHeader>
        <CardContent>
          {stats.revenueByDay.length > 0 ? (
            <div className="h-48 sm:h-64 flex flex-col overflow-x-auto">
              <div className="flex-1 flex items-end gap-1 sm:gap-2 mb-4 min-w-max">
                {stats.revenueByDay.map((day, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1 sm:gap-2 min-w-[60px]">
                    <div className="w-full flex items-end justify-center" style={{ height: '150px' }}>
                      <div
                        className="w-full bg-blue-600 rounded-t transition-all duration-500 hover:bg-blue-700 relative group"
                        style={{ 
                          height: `${(day.revenue / maxRevenue) * 100}%`,
                          minHeight: day.revenue > 0 ? '4px' : '0'
                        }}
                      >
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                          {formatCurrency(day.revenue)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(day.date)}</span>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-600">Total da semana: {formatCurrency(stats.revenueByDay.reduce((sum, d) => sum + d.revenue, 0))}</p>
                <p className="text-xs text-gray-500">Média diária: {formatCurrency(stats.revenueByDay.reduce((sum, d) => sum + d.revenue, 0) / 7)}</p>
              </div>
            </div>
          ) : (
            <div className="h-48 sm:h-64 flex items-center justify-center">
              <div className="text-center px-4">
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs sm:text-sm text-gray-500">Nenhum dado disponível para o período selecionado</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversion Rate and Rewards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Taxa de conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-40 sm:h-48">
              <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                  <svg className="transform -rotate-90 w-24 h-24 sm:w-32 sm:h-32">
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${(stats.conversionRate / 100) * 263.9} ${263.9}`}
                      className="text-blue-600 transition-all duration-500"
                    />
                  </svg>
                  <svg className="transform -rotate-90 w-32 h-32 hidden sm:block">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(stats.conversionRate / 100) * 351.86} ${351.86}`}
                      className="text-blue-600 transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.conversionRate.toFixed(1)}%</p>
                      <p className="text-xs sm:text-sm text-gray-500">PIX</p>
                    </div>
                  </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Progresso de recompensas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Progresso atual</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 break-words">
                  {formatCurrency(stats.totalRevenue)} / R$ 10.000,00
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min((stats.totalRevenue / 10000) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">
                {((stats.totalRevenue / 10000) * 100).toFixed(1)}% completo
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
