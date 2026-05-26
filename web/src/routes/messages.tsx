import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { Send, Loader2, User, MessageCircle, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): { booking?: string } => {
    return {
      booking: typeof search.booking === "string" ? search.booking : undefined,
    };
  },
  component: MessagesPage,
});

interface Conversation {
  booking_id: string;
  other_user: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  last_message: {
    content: string;
    created_at: string;
  };
  unread_count: number;
  booking_status: string;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function MessagesPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { booking: selectedBookingId } = useSearch({ from: "/messages" });
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  const { data: conversations, isLoading: isLoadingConvs } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messages/conversations").then((res) => res.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: messages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ["messages", selectedBookingId],
    queryFn: () => api.get(`/messages/${selectedBookingId}`).then((res) => res.data),
    enabled: !!selectedBookingId && isAuthenticated,
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/messages/${selectedBookingId}`, { content }).then((res) => res.data),
    onSuccess: (newMessage) => {
      setMessageText("");
      queryClient.setQueryData(["messages", selectedBookingId], (old: Message[] | undefined) =>
        old ? [...old, newMessage] : [newMessage],
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail ?? "Failed to send message");
    },
  });

  const activeConversation = useMemo(
    () => conversations?.find((c) => c.booking_id === selectedBookingId),
    [conversations, selectedBookingId],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(messageText.trim());
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Header />
      <main className="flex-1 overflow-hidden flex max-w-6xl mx-auto w-full border-x border-border">
        {/* Left Panel: Conversations */}
        <div
          className={`w-full md:w-80 flex-shrink-0 flex flex-col border-r border-border bg-card ${selectedBookingId ? "hidden md:flex" : "flex"}`}
        >
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-extrabold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Messages
            </h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingConvs ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 border-b border-border/50 animate-pulse flex gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : conversations?.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-sm font-medium text-muted-foreground">
                  No messages yet. Book an artisan to start chatting.
                </p>
              </div>
            ) : (
              conversations?.map((conv) => (
                <button
                  key={conv.booking_id}
                  onClick={() =>
                    navigate({ to: "/messages", search: { booking: conv.booking_id } })
                  }
                  className={`w-full p-4 flex gap-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 relative ${selectedBookingId === conv.booking_id ? "bg-muted/80" : ""}`}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={conv.other_user.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {conv.other_user.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-bold text-sm truncate">
                        {conv.other_user.full_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.last_message.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate pr-4">
                      {conv.last_message.content}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 py-0 px-1 uppercase tracking-tighter"
                      >
                        {conv.booking_status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-accent" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Chat Thread */}
        <div
          className={`flex-1 flex flex-col bg-background ${!selectedBookingId ? "hidden md:flex" : "flex"}`}
        >
          {selectedBookingId ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3">
                <button
                  onClick={() => navigate({ to: "/messages", search: { booking: undefined } })}
                  className="p-2 -ml-1 rounded-full hover:bg-muted md:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={activeConversation?.other_user.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                    {activeConversation?.other_user.full_name.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-bold text-sm leading-tight">
                    {activeConversation?.other_user.full_name}
                  </h2>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    {activeConversation?.booking_status.replace("_", " ")} · Ref:{" "}
                    {selectedBookingId.slice(0, 8)}
                  </p>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-20" />
                  </div>
                ) : (
                  messages?.map((msg, i) => {
                    const isOwn = msg.sender_id === user?.id;
                    const prevMsg = messages[i - 1];
                    const showAvatar = !isOwn && (!prevMsg || prevMsg.sender_id !== msg.sender_id);

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"} items-end gap-2`}
                      >
                        {!isOwn && (
                          <div className="w-8 flex-shrink-0">
                            {showAvatar && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={activeConversation?.other_user.avatar_url} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                                  {activeConversation?.other_user.full_name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}
                        <div className="max-w-[80%] flex flex-col">
                          <div
                            className={`px-4 py-2 rounded-2xl text-sm ${
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span
                            className={`text-[9px] text-muted-foreground mt-1 ${isOwn ? "text-right" : "text-left"}`}
                          >
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSend} className="p-4 bg-card border-t border-border flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl h-11"
                  disabled={sendMutation.isPending}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 rounded-xl"
                  disabled={!messageText.trim() || sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="h-10 w-10 opacity-20" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Your Conversations</h2>
              <p className="max-w-xs mt-1">
                Select a conversation from the left to start messaging.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
