import { createFileRoute, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Bot, Trash2, Edit, Power, PowerOff, Settings, DollarSign } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { useApi } from "@/hooks/use-api";

export const Route = createFileRoute("/bots")({
  component: () => (
    <ProtectedRoute>
      <DashboardLayout>
        <BotsLayout />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

function BotsLayout() {
  const location = useLocation();
  
  // Se estiver em uma rota filha (/bots/new ou /bots/:id), renderizar apenas o Outlet
  if (location.pathname !== "/bots") {
    return <Outlet />;
  }
  
  // Se estiver na rota exata /bots, renderizar a lista de bots
  return <BotsPage />;
}

interface Bot {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  paymentButtons: Array<{ text: string; value: number }>;
}

function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fetchWithAuth } = useApi();

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const response = await fetchWithAuth(`/api/bots`);
      const data = await response.json();

      if (response.ok) {
        setBots(data.bots || []);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar bots",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (botId: string, botName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o bot "${botName}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const response = await fetchWithAuth(`/api/bots/${botId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Bot deletado com sucesso",
        });
        loadBots();
      } else {
        throw new Error("Erro ao deletar bot");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao deletar bot",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (botId: string, currentStatus: boolean) => {
    try {
      const bot = bots.find(b => b.id === botId);
      if (!bot) return;

      const response = await fetchWithAuth(`/api/bots/${botId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: `Bot ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`,
        });
        loadBots();
      } else {
        throw new Error("Erro ao atualizar bot");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do bot",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bots</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie seus bots do Telegram</p>
        </div>
        <Button 
          onClick={() => navigate({ to: "/bots/new" })}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Bot
        </Button>
      </div>

      {bots.length === 0 ? (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum bot criado</h3>
            <p className="text-gray-600 mb-6 text-center max-w-md">
              Comece criando seu primeiro bot para gerenciar vendas e pagamentos via Telegram
            </p>
            <Button 
              onClick={() => navigate({ to: "/bots/new" })}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Bot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => {
            const totalValue = bot.paymentButtons.reduce((sum, btn) => sum + btn.value, 0);
            const avgValue = bot.paymentButtons.length > 0 
              ? totalValue / bot.paymentButtons.length 
              : 0;

            return (
              <Card key={bot.id} className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-1 truncate">
                        {bot.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {bot.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse"></div>
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <div className="h-1.5 w-1.5 rounded-full bg-gray-400"></div>
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(bot.id, bot.isActive)}
                        className="h-8 w-8 hover:bg-gray-100"
                        title={bot.isActive ? "Desativar bot" : "Ativar bot"}
                      >
                        {bot.isActive ? (
                          <Power className="h-4 w-4 text-green-600" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate({ to: `/bots/${bot.id}` })}
                        className="h-8 w-8 hover:bg-blue-50"
                        title="Editar bot"
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bot.id, bot.name)}
                        className="h-8 w-8 hover:bg-red-50"
                        title="Deletar bot"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Botões de pagamento</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{bot.paymentButtons.length}</span>
                    </div>
                    
                    {bot.paymentButtons.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Valor médio: R$ {(avgValue / 100).toFixed(2).replace('.', ',')}
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Criado em</span>
                        <span className="font-medium text-gray-700">
                          {new Date(bot.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full mt-4 border-gray-300 hover:bg-gray-50"
                      onClick={() => navigate({ to: `/bots/${bot.id}` })}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
