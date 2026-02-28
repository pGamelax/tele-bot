import { useAuth } from "@/contexts/auth-context";
import { authFetch } from "@/lib/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useApi() {
  const { user } = useAuth();

  const fetchWithAuth = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    // Se a URL não começar com http, adicionar o base URL da API
    const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
    
    return fetch(fullUrl, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  };

  return { fetchWithAuth, user };
}
