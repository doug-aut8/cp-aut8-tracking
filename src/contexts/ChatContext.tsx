import React, { createContext, useContext, useState } from "react";
import ChatAssistant from "@/components/ChatAssistant";

interface ChatContextValue {
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <ChatContext.Provider
      value={{
        isChatOpen,
        openChat: () => setIsChatOpen(true),
        closeChat: () => setIsChatOpen(false),
      }}
    >
      {children}
      <ChatAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </ChatContext.Provider>
  );
};

export default ChatProvider;
