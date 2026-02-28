import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { signUp } from "@/lib/auth";
import { Mail, Lock, User as UserIcon } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        throw new Error(result.error.message || "Erro ao criar conta");
      }
      
      toast({
        title: "Conta criada!",
        description: "Redirecionando para login...",
      });
      navigate({ to: "/sign-in" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar conta",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
      
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-6 md:gap-8 relative z-10">
        {/* Welcome Panel */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 flex flex-col justify-center relative overflow-hidden order-1">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400 rounded-full mix-blend-overlay filter blur-2xl opacity-50"></div>
          
          <div className="relative z-10 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 uppercase">
              WELCOME!
            </h2>
            <p className="text-blue-100 text-base sm:text-lg md:text-xl mb-6 sm:mb-8">
              Enter your details and start journey with us
            </p>
            <Button
              type="button"
              onClick={() => navigate({ to: "/sign-in" })}
              className="bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-lg font-semibold text-base uppercase"
            >
              LOGIN
            </Button>
          </div>
        </div>

        {/* Signup Panel */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 flex flex-col justify-center order-2">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center underline decoration-blue-500 decoration-2 underline-offset-4">
            Signup please
          </h1>
          
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-2">
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Input your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 h-12 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Input your user ID or Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 h-12 rounded-lg"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Input your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 h-12 rounded-lg"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-lg font-semibold text-base uppercase flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <UserIcon className="h-5 w-5" />
              {isLoading ? "Criando..." : "SIGNUP"}
            </Button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}
