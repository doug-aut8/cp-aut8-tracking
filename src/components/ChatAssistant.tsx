import React, { useState, useEffect, useRef } from "react";
import { useSessionId } from "@/hooks/useSessionId";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { Bot, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatAssistant = ({ isOpen, onClose }: ChatAssistantProps) => {
  const sessionId = useSessionId();
  const { currentUser } = useAuth();
  const { settings } = useLayoutSettings();
  const [messages, setMessages] = useState<
    { from: "user" | "assistant" | "system"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [corCabecalho, setCorCabecalho] = useState("#ff4400");
  const [corFonteCabecalho, setCorFonteCabecalho] = useState("#ffffff");
  const [corFonteBaloes, setCorFonteBaloes] = useState("#050200");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const configLoaded = useRef(false);

  // Load config from supabase
  useEffect(() => {
    if (configLoaded.current) return;
    configLoaded.current = true;
    
    const loadConfig = async () => {
      const { data } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", [
          "webhook_chatassistant",
          "mensagem_atendimento",
          "cor_chat_cabecalho",
          "cor_chat_fonte_cabecalho",
          "cor_chat_fonte_baloes",
        ]);

      if (data) {
        data.forEach((row) => {
          if (row.chave === "webhook_chatassistant" && row.valor) setWebhookUrl(row.valor);
          if (row.chave === "mensagem_atendimento" && row.valor) setWelcomeMessage(row.valor);
          if (row.chave === "cor_chat_cabecalho" && row.valor) setCorCabecalho(row.valor);
          if (row.chave === "cor_chat_fonte_cabecalho" && row.valor) setCorFonteCabecalho(row.valor);
          if (row.chave === "cor_chat_fonte_baloes" && row.valor) setCorFonteBaloes(row.valor);
        });
      }
    };
    loadConfig();
  }, []);

  // Scroll automático
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Mensagem inicial automática
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const defaultMsg = "Olá 👋! Sou o atendente virtual! Posso te ajudar com informações ou acompanhar seu pedido 😊";
      setMessages([
        {
          from: "assistant",
          text: welcomeMessage || defaultMsg,
        },
      ]);
    }
  }, [isOpen, welcomeMessage]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { from: "user" as const, text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const url = webhookUrl || "https://n8n-n8n-start.yh11mi.easypanel.host/webhook/chatassistant";

    const payload = {
      message: input,
      sessionId,
      user: currentUser
        ? {
            uid: currentUser.uid,
            name: currentUser.displayName || "Usuário",
            email: currentUser.email || "sem-email",
          }
        : {
            uid: "anon-" + sessionId.slice(0, 8),
            name: "Visitante",
            email: null,
          },
    };

    try {
      const { withComunicacaoMeta } = await import("@/utils/webhookPayload");
      const enriched = await withComunicacaoMeta(payload);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enriched),
      });

      const data = await response.json();
      const output = Array.isArray(data)
        ? data[0]?.output || data[0]?.reply
        : data.output || data.reply;

      if (output) {
        setMessages((prev) => [...prev, { from: "assistant", text: output }]);
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (err) {
      console.error("⚠️ Erro:", err);
      setMessages((prev) => [
        ...prev,
        { from: "system", text: "Erro ao conectar. Tente novamente." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 h-96 bg-white border rounded-lg shadow-lg flex flex-col">
        {/* Cabeçalho */}
        <div
          className="p-3 flex justify-between items-center rounded-t-lg"
          style={{ backgroundColor: corCabecalho, color: corFonteCabecalho }}
        >
          <span className="flex items-center gap-2">
            <Bot size={18} />
            <span>Assistente Virtual</span>
          </span>
          <button onClick={onClose} className="hover:opacity-80" style={{ color: corFonteCabecalho }}>
            <X size={18} />
          </button>
        </div>

        {/* Mensagens */}
        <div
          ref={messagesEndRef}
          className="flex-1 p-3 overflow-y-auto space-y-2 text-sm scroll-smooth"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded-md max-w-[80%] ${
                msg.from === "user"
                  ? "self-end ml-auto"
                  : msg.from === "assistant"
                  ? "bg-gray-100 self-start"
                  : "bg-red-100 text-red-700 text-center w-full"
              }`}
              style={
                msg.from === "user"
                  ? { backgroundColor: corCabecalho, color: corFonteCabecalho }
                  : msg.from === "assistant"
                  ? { color: corFonteBaloes }
                  : undefined
              }
            >
              {msg.text}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-2 text-gray-500 text-xs mt-2">
              <div className="flex space-x-1">
                <span className="animate-bounce delay-[0ms]">●</span>
                <span className="animate-bounce delay-[150ms]">●</span>
                <span className="animate-bounce delay-[300ms]">●</span>
              </div>
              <span>Digitando...</span>
            </div>
          )}
        </div>

        {/* Campo de entrada */}
        <div className="p-2 border-t flex">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 border rounded-l-md px-2 py-1 text-sm focus:outline-none"
            placeholder="Digite sua mensagem..."
            style={{ color: settings.cor_fonte_caixa_texto_chat }}
          />
          <button
            onClick={handleSend}
            disabled={isTyping}
            className={`px-3 rounded-r-md flex items-center justify-center ${
              isTyping ? "bg-gray-400 cursor-not-allowed" : "hover:opacity-90"
            }`}
            style={
              isTyping
                ? undefined
                : { backgroundColor: corCabecalho, color: corFonteCabecalho }
            }
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
