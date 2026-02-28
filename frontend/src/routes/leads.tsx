import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { useApi } from "@/hooks/use-api";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Trash2, 
  Filter,
  Search,
  Bot as BotIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leads")({
  component: () => (
    <ProtectedRoute>
      <DashboardLayout>
        <LeadsPage />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

interface Lead {
  id: string;
  botId: string;
  telegramChatId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  isNew: boolean;
  notes?: string;
  contactedAt?: string;
  convertedAt?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  ref?: string;
  createdAt: string;
  bot: {
    id: string;
    name: string;
  };
}

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterNew, setFilterNew] = useState<boolean | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const { fetchWithAuth } = useApi();

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, filterNew, searchTerm]);

  const loadLeads = async () => {
    try {
      const response = await fetchWithAuth(`/api/leads`);
      const data = await response.json();

      if (response.ok) {
        setLeads(data.leads || []);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar leads",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (filterNew !== undefined) {
      filtered = filtered.filter(lead => lead.isNew === filterNew);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.telegramUsername?.toLowerCase().includes(term) ||
        lead.firstName?.toLowerCase().includes(term) ||
        lead.lastName?.toLowerCase().includes(term) ||
        lead.telegramChatId.includes(term) ||
        lead.bot.name.toLowerCase().includes(term)
      );
    }

    setFilteredLeads(filtered);
  };

  const handleToggleNew = async (leadId: string, currentStatus: boolean) => {
    try {
      const response = await fetchWithAuth(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isNew: !currentStatus,
        }),
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: `Lead marcado como ${!currentStatus ? 'novo' : 'antigo'}`,
        });
        loadLeads();
      } else {
        throw new Error("Erro ao atualizar lead");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar lead",
        variant: "destructive",
      });
    }
  };

  const handleSaveNotes = async (leadId: string) => {
    try {
      const response = await fetchWithAuth(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
        }),
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Notas salvas com sucesso",
        });
        setEditingLead(null);
        setNotes("");
        loadLeads();
      } else {
        throw new Error("Erro ao salvar notas");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar notas",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm("Tem certeza que deseja deletar este lead?")) return;

    try {
      const response = await fetchWithAuth(`/api/leads/${leadId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Lead deletado com sucesso",
        });
        loadLeads();
      } else {
        throw new Error("Erro ao deletar lead");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao deletar lead",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (lead: Lead) => {
    setEditingLead(lead);
    setNotes(lead.notes || "");
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie seus novos clientes e leads</p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, username, chat ID ou bot..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant={filterNew === undefined ? "default" : "outline"}
                onClick={() => setFilterNew(undefined)}
                className={cn(
                  filterNew === undefined ? "bg-blue-600 hover:bg-blue-700 text-white" : "",
                  "flex-1 sm:flex-none text-xs sm:text-sm"
                )}
              >
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Todos
              </Button>
              <Button
                variant={filterNew === true ? "default" : "outline"}
                onClick={() => setFilterNew(true)}
                className={cn(
                  filterNew === true ? "bg-green-600 hover:bg-green-700 text-white" : "",
                  "flex-1 sm:flex-none text-xs sm:text-sm"
                )}
              >
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Novos
              </Button>
              <Button
                variant={filterNew === false ? "default" : "outline"}
                onClick={() => setFilterNew(false)}
                className={cn(
                  filterNew === false ? "bg-gray-600 hover:bg-gray-700 text-white" : "",
                  "flex-1 sm:flex-none text-xs sm:text-sm"
                )}
              >
                <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Antigos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Leads */}
      {filteredLeads.length === 0 ? (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum lead encontrado</h3>
            <p className="text-gray-600 text-center max-w-md">
              {leads.length === 0 
                ? "Ainda não há leads cadastrados. Os leads são criados automaticamente quando usuários interagem com seus bots."
                : "Nenhum lead corresponde aos filtros selecionados."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredLeads.map((lead) => (
            <Card key={lead.id} className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {lead.isNew && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Novo
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        <BotIcon className="h-3 w-3" />
                        {lead.bot.name}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {lead.firstName && lead.lastName 
                        ? `${lead.firstName} ${lead.lastName}`
                        : lead.telegramUsername 
                        ? `@${lead.telegramUsername}`
                        : `Chat ${lead.telegramChatId.slice(-6)}`}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {lead.telegramUsername && (
                        <span className="text-gray-600">@{lead.telegramUsername}</span>
                      )}
                      {lead.telegramUsername && lead.telegramChatId && " • "}
                      {lead.telegramChatId && (
                        <span className="text-gray-500 text-xs">ID: {lead.telegramChatId}</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(lead)}
                      className="h-8 w-8 hover:bg-blue-50"
                      title="Editar notas"
                    >
                      <Edit className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(lead.id)}
                      className="h-8 w-8 hover:bg-red-50"
                      title="Deletar lead"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {lead.notes && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{lead.notes}</p>
                    </div>
                  )}

                  {/* Dados de Rastreamento */}
                  {(lead.utmSource || lead.utmCampaign || lead.fbclid || lead.gclid || lead.ref) && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs font-semibold text-blue-900 mb-2">Rastreamento</p>
                      <div className="space-y-1 text-xs">
                        {lead.utmSource && (
                          <div className="flex justify-between">
                            <span className="text-blue-700">Fonte:</span>
                            <span className="text-blue-900 font-medium">{lead.utmSource}</span>
                          </div>
                        )}
                        {lead.utmCampaign && (
                          <div className="flex justify-between">
                            <span className="text-blue-700">Campanha:</span>
                            <span className="text-blue-900 font-medium truncate ml-2">{lead.utmCampaign}</span>
                          </div>
                        )}
                        {lead.utmMedium && (
                          <div className="flex justify-between">
                            <span className="text-blue-700">Mídia:</span>
                            <span className="text-blue-900 font-medium">{lead.utmMedium}</span>
                          </div>
                        )}
                        {lead.fbclid && (
                          <div className="flex justify-between">
                            <span className="text-blue-700">FB Click ID:</span>
                            <span className="text-blue-900 font-medium text-[10px] truncate ml-2">{lead.fbclid.slice(0, 20)}...</span>
                          </div>
                        )}
                        {lead.ref && (
                          <div className="flex justify-between">
                            <span className="text-blue-700">Ref:</span>
                            <span className="text-blue-900 font-medium">{lead.ref}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      Criado em {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleNew(lead.id, lead.isNew)}
                      className={lead.isNew 
                        ? "border-gray-300 hover:bg-gray-50 text-gray-700" 
                        : "border-green-300 hover:bg-green-50 text-green-700"}
                    >
                      {lead.isNew ? (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Marcar como antigo
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Marcar como novo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Edição de Notas */}
      {editingLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="bg-white border-gray-200 shadow-xl max-w-md w-full my-auto">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Editar Notas</CardTitle>
              <CardDescription>
                Adicione ou edite notas sobre este lead
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-gray-900">Notas</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 resize-none"
                  placeholder="Adicione notas sobre este lead..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingLead(null);
                    setNotes("");
                  }}
                  className="border-gray-300 hover:bg-gray-50 text-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleSaveNotes(editingLead.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
