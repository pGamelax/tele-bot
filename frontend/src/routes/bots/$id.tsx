import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { useApi } from "@/hooks/use-api";

export const Route = createFileRoute("/bots/$id")({
  component: () => (
    <ProtectedRoute>
      <DashboardLayout>
        <EditBotPage />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

interface PaymentButton {
  text: string;
  value: string;
}

function EditBotPage() {
  const { id } = Route.useParams();
  const [name, setName] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [syncpayApiKey, setSyncpayApiKey] = useState("");
  const [syncpayApiSecret, setSyncpayApiSecret] = useState("");
  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [facebookAccessToken, setFacebookAccessToken] = useState("");
  const [paymentConfirmedMessage, setPaymentConfirmedMessage] = useState("");
  const [startImage, setStartImage] = useState("");
  const [startCaption, setStartCaption] = useState("");
  const [resendImage, setResendImage] = useState("");
  const [resendCaption, setResendCaption] = useState("");
  const [resendFirstDelay, setResendFirstDelay] = useState(20);
  const [resendInterval, setResendInterval] = useState(10);
  const [isActive, setIsActive] = useState(true);
  const [paymentButtons, setPaymentButtons] = useState<PaymentButton[]>([]);
  const [resendPaymentButtons, setResendPaymentButtons] = useState<PaymentButton[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fetchWithAuth } = useApi();

  useEffect(() => {
    loadBot();
  }, [id]);

  const loadBot = async () => {
    try {
      const response = await fetchWithAuth(`/api/bots/${id}`);
      const data = await response.json();

      if (response.ok && data.bot) {
        const bot = data.bot;
        setName(bot.name);
        setTelegramToken(bot.telegramToken);
        setSyncpayApiKey(bot.syncpayApiKey);
        setSyncpayApiSecret(bot.syncpayApiSecret);
        setFacebookPixelId(bot.facebookPixelId || "");
        setFacebookAccessToken(bot.facebookAccessToken || "");
        setPaymentConfirmedMessage(bot.paymentConfirmedMessage || "");
        setStartImage(bot.startImage || "");
        setStartCaption(bot.startCaption || "");
        setResendImage(bot.resendImage || "");
        setResendCaption(bot.resendCaption || "");
        setResendFirstDelay(bot.resendFirstDelay || 20);
        setResendInterval(bot.resendInterval || 10);
        setIsActive(bot.isActive);
        const startButtons = bot.paymentButtons.filter((btn: any) => btn.type === "start" || !btn.type);
        const resendButtons = bot.paymentButtons.filter((btn: any) => btn.type === "resend");
        
        setPaymentButtons(
          startButtons.length > 0
            ? startButtons.map((btn: any) => ({
                text: btn.text,
                value: (btn.value / 100).toFixed(2).replace(".", ","),
              }))
            : [{ text: "", value: "" }]
        );
        
        setResendPaymentButtons(
          resendButtons.length > 0
            ? resendButtons.map((btn: any) => ({
                text: btn.text,
                value: (btn.value / 100).toFixed(2).replace(".", ","),
              }))
            : [{ text: "", value: "" }]
        );
      } else {
        throw new Error("Bot não encontrado");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      navigate({ to: "/bots" });
    } finally {
      setIsLoadingData(false);
    }
  };

  const addPaymentButton = () => {
    setPaymentButtons([...paymentButtons, { text: "", value: "" }]);
  };

  const removePaymentButton = (index: number) => {
    setPaymentButtons(paymentButtons.filter((_, i) => i !== index));
  };

  const updatePaymentButton = (index: number, field: keyof PaymentButton, value: string) => {
    const updated = [...paymentButtons];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentButtons(updated);
  };

  const addResendPaymentButton = () => {
    setResendPaymentButtons([...resendPaymentButtons, { text: "", value: "" }]);
  };

  const removeResendPaymentButton = (index: number) => {
    setResendPaymentButtons(resendPaymentButtons.filter((_, i) => i !== index));
  };

  const updateResendPaymentButton = (index: number, field: keyof PaymentButton, value: string) => {
    const updated = [...resendPaymentButtons];
    updated[index] = { ...updated[index], [field]: value };
    setResendPaymentButtons(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const buttons = paymentButtons
        .filter((btn) => btn.text && btn.value)
        .map((btn) => ({
          text: btn.text,
          value: Math.round(parseFloat(btn.value.replace(",", ".")) * 100),
        }));
      
      const resendButtons = resendPaymentButtons
        .filter((btn) => btn.text && btn.value)
        .map((btn) => ({
          text: btn.text,
          value: Math.round(parseFloat(btn.value.replace(",", ".")) * 100),
        }));

      const response = await fetchWithAuth(`/api/bots/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          telegramToken,
          syncpayApiKey,
          syncpayApiSecret,
          startImage: startImage.trim() || null,
          startCaption: startCaption.trim() || null,
          resendImage: resendImage.trim() || null,
          resendCaption: resendCaption.trim() || null,
          resendFirstDelay,
          resendInterval,
          isActive,
          paymentButtons: buttons,
          resendPaymentButtons: resendButtons,
          facebookPixelId: facebookPixelId || undefined,
          facebookAccessToken: facebookAccessToken || undefined,
          paymentConfirmedMessage: paymentConfirmedMessage || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao atualizar bot");
      }

      toast({
        title: "Sucesso!",
        description: "Bot atualizado com sucesso",
      });
      navigate({ to: "/bots" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Editar Bot</h1>
        <p className="text-sm sm:text-base text-gray-600">Atualize as configurações do seu bot</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Informações Básicas */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Informações Básicas</CardTitle>
            <CardDescription className="text-gray-600">Configure as credenciais e informações principais do bot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-900">Nome do Bot</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegramToken" className="text-gray-900">Token do Telegram</Label>
                <Input
                  id="telegramToken"
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  required
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="syncpayApiKey" className="text-gray-900">API Key do SyncPay</Label>
                <Input
                  id="syncpayApiKey"
                  type="text"
                  value={syncpayApiKey}
                  onChange={(e) => setSyncpayApiKey(e.target.value)}
                  required
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="syncpayApiSecret" className="text-gray-900">API Secret do SyncPay</Label>
                <Input
                  id="syncpayApiSecret"
                  type="text"
                  value={syncpayApiSecret}
                  onChange={(e) => setSyncpayApiSecret(e.target.value)}
                  required
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebookPixelId" className="text-gray-900">Facebook Pixel ID (opcional)</Label>
              <Input
                id="facebookPixelId"
                type="text"
                value={facebookPixelId}
                onChange={(e) => setFacebookPixelId(e.target.value)}
                placeholder="123456789012345"
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                ID do seu Facebook Pixel para rastreamento de conversões. Encontre em: Facebook Events Manager
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebookAccessToken" className="text-gray-900">Facebook Access Token (opcional)</Label>
              <Input
                id="facebookAccessToken"
                type="password"
                value={facebookAccessToken}
                onChange={(e) => setFacebookAccessToken(e.target.value)}
                placeholder="EAAxxxxxxxxxxxxx"
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Access Token do Facebook para Conversions API. Necessário para enviar eventos de compra. Gere em: Facebook Business Settings → System Users
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentConfirmedMessage" className="text-gray-900">Mensagem após Confirmação de Pagamento (opcional)</Label>
              <Textarea
                id="paymentConfirmedMessage"
                value={paymentConfirmedMessage}
                onChange={(e) => setPaymentConfirmedMessage(e.target.value)}
                placeholder="✅ Pagamento confirmado! Obrigado pela compra de R$ {amount}."
                rows={4}
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Mensagem enviada ao usuário após confirmação do pagamento. Use {"{amount}"} para incluir o valor pago.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mr-2"
                />
                Bot Ativo
              </Label>
            </div>

          </CardContent>
        </Card>

        {/* Mensagem de Boas-vindas */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Mensagem de Boas-vindas (/start)</CardTitle>
            <CardDescription className="text-gray-600">Configure a mensagem inicial que será enviada quando o usuário usar /start</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              
              <ImageUpload
                value={startImage}
                onChange={setStartImage}
                label="Imagem ou Vídeo para /start (opcional)"
              />

              <div className="space-y-2 mt-4">
                <Label htmlFor="startCaption" className="text-gray-900">Caption da Imagem (opcional)</Label>
                <Textarea
                  id="startCaption"
                  value={startCaption}
                  onChange={(e) => setStartCaption(e.target.value)}
                  rows={4}
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 resize-none"
                />
              </div>
            
          </CardContent>
        </Card>

        {/* Configurações de Reenvio */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Configurações de Reenvio</CardTitle>
            <CardDescription className="text-gray-600">Configure mensagens automáticas de reenvio para aumentar conversões</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              
              <ImageUpload
                value={resendImage}
                onChange={setResendImage}
                label="Imagem ou Vídeo para Reenvio (opcional - usa mídia do /start se não configurado)"
              />

              <div className="space-y-2 mt-4">
                <Label htmlFor="resendCaption" className="text-gray-900">Caption para Reenvio (opcional - usa caption do /start se não configurado)</Label>
                <Textarea
                  id="resendCaption"
                  value={resendCaption}
                  onChange={(e) => setResendCaption(e.target.value)}
                  rows={4}
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="resendFirstDelay" className="text-gray-900">Primeiro Reenvio (minutos)</Label>
                  <Input
                    id="resendFirstDelay"
                    type="number"
                    min="1"
                    value={resendFirstDelay}
                    onChange={(e) => setResendFirstDelay(parseInt(e.target.value) || 20)}
                    required
                    className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resendInterval" className="text-gray-900">Intervalo entre Reenvios (minutos)</Label>
                  <Input
                    id="resendInterval"
                    type="number"
                    min="1"
                    value={resendInterval}
                    onChange={(e) => setResendInterval(parseInt(e.target.value) || 10)}
                    required
                    className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  />
                
                </div>
              </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Botões de Pagamento para Reenvio</h3>
                  <p className="text-sm text-gray-600 mt-1">Configure os valores que aparecerão nas mensagens de reenvio (opcional - usa botões do /start se não configurado)</p>
                </div>
                <Button 
                  type="button" 
                  onClick={addResendPaymentButton} 
                  variant="outline" 
                  size="sm"
                  className="border-gray-300 hover:bg-gray-50 text-gray-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Botão
                </Button>
              </div>

                <div className="space-y-3">
                  {resendPaymentButtons.map((btn, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-2">
                        <Label className="text-gray-900 text-sm">Texto do Botão</Label>
                        <Input
                          placeholder="Ex: Plano Básico"
                          value={btn.text}
                          onChange={(e) =>
                            updateResendPaymentButton(index, "text", e.target.value)
                          }
                          className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label className="text-gray-900 text-sm">Valor (R$)</Label>
                        <Input
                          placeholder="Ex: 12,90"
                          value={btn.value}
                          onChange={(e) =>
                            updateResendPaymentButton(index, "value", e.target.value)
                          }
                          className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      {resendPaymentButtons.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeResendPaymentButton(index)}
                          className="text-gray-600 hover:bg-red-50 hover:text-red-600 mb-0.5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            

          </CardContent>
        </Card>

        {/* Botões de Pagamento */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Botões de Pagamento para /start</CardTitle>
                <CardDescription className="text-gray-600 mt-1">Configure os valores que o bot oferecerá na mensagem inicial</CardDescription>
              </div>
              <Button 
                type="button" 
                onClick={addPaymentButton} 
                variant="outline" 
                size="sm"
                className="border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Botão
              </Button>
            </div>
          </CardHeader>
          <CardContent>

              <div className="space-y-3">
                {paymentButtons.map((btn, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1 space-y-2">
                      <Label className="text-gray-900 text-sm">Texto do Botão</Label>
                      <Input
                        placeholder="Ex: Plano Básico"
                        value={btn.text}
                        onChange={(e) =>
                          updatePaymentButton(index, "text", e.target.value)
                        }
                        className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label className="text-gray-900 text-sm">Valor (R$)</Label>
                      <Input
                        placeholder="Ex: 12,90"
                        value={btn.value}
                        onChange={(e) =>
                          updatePaymentButton(index, "value", e.target.value)
                        }
                        className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    {paymentButtons.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaymentButton(index)}
                        className="text-gray-600 hover:bg-red-50 hover:text-red-600 mb-0.5"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            

          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex gap-4 pt-4">
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            {isLoading ? "Salvando..." : "Salvar Alterações"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/bots" })}
            className="border-gray-300 hover:bg-gray-50 text-gray-700"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
