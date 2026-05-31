// File: web/src/routes/messages.tsx
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import {
  Send,
  Loader2,
  MessageCircle,
  ArrowLeft,
  Phone,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): { booking?: string } => ({
    booking: typeof search.booking === "string" ? search.booking : undefined,
  }),
  component: MessagesPage,
});

interface Conversation {
  booking_id: string;
  other_user: { id: string; full_name: string; avatar_url?: string };
  last_message: { content: string; created_at: string };
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
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const qc = useQueryClient();
  const [wsMessages, setWsMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messages/conversations").then((r) => r.data),
    refetchInterval: 15000,
    enabled: isAuthenticated,
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["messages", selectedBookingId],
    queryFn: () =>
      selectedBookingId ? api.get(`/messages/${selectedBookingId}`).then((r) => r.data) : [],
    enabled: !!selectedBookingId,
    refetchInterval: false,
  });

  const { data: bookingDetail } = useQuery({
    queryKey: ["booking-detail", selectedBookingId],
    queryFn: () =>
      selectedBookingId ? api.get(`/bookings/${selectedBookingId}`).then((r) => r.data) : null,
    enabled: !!selectedBookingId,
  });

  // WebSocket for real-time messages
  useEffect(() => {
    if (!selectedBookingId) {
      wsRef.current?.close();
      return;
    }
    setWsMessages([]);

    const wsUrl =
      (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/^http/, "ws") +
      `/ws/messages/${selectedBookingId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as Message;
        setWsMessages((prev) => [...prev, msg]);
        qc.invalidateQueries({ queryKey: ["conversations"] });
      } catch {
        // silently ignore parse errors
      }
    };
    ws.onerror = () => {}; // silent — fallback to polling
    return () => ws.close();
  }, [selectedBookingId, qc]);

  // Combine API messages with WebSocket messages
  const allMessages = [
    ...messages,
    ...wsMessages.filter((wm) => !messages.find((m: Message) => m.id === wm.id)),
  ];
  allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const sendMsg = useMutation({
    mutationFn: (content: string) =>
      api.post(`/messages/${selectedBookingId}`, { content }).then((r) => r.data),
    onSuccess: (msg) => {
      setText("");
      // Broadcast via WebSocket for real-time
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
      qc.invalidateQueries({ queryKey: ["messages", selectedBookingId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast.error("Failed to send message."),
  });

  const confirmPayment = useMutation({
    mutationFn: () => api.post(`/bookings/${selectedBookingId}/confirm-payment`),
    onSuccess: () => {
      toast.success("Payment confirmed!");
      qc.invalidateQueries({ queryKey: ["booking-detail", selectedBookingId] });
    },
  });

  const confirmComplete = useMutation({
    mutationFn: () => api.post(`/bookings/${selectedBookingId}/complete`),
    onSuccess: () => {
      toast.success("Job marked as complete!");
      qc.invalidateQueries({ queryKey: ["booking-detail", selectedBookingId] });
    },
  });

  const raiseDispute = useMutation({
    mutationFn: () =>
      api.post(`/bookings/${selectedBookingId}/dispute`, { reason: "Issue with job quality" }),
    onSuccess: () => {
      toast.info("Dispute raised. Admin will review.");
      qc.invalidateQueries({ queryKey: ["booking-detail", selectedBookingId] });
    },
  });

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t || !selectedBookingId) return;
    sendMsg.mutate(t);
  }, [text, selectedBookingId, sendMsg]);

  const statusColor: Record<string, string> = {
    pending_payment: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    in_progress: "bg-green-100 text-green-700",
    completed: "bg-success/10 text-success",
    cancelled: "bg-muted text-muted-foreground",
    disputed: "bg-destructive/10 text-destructive",
  };

  const selectedConv = conversations.find((c: Conversation) => c.booking_id === selectedBookingId);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden max-h-[calc(100dvh-64px)]">
        {/* Sidebar: conversation list */}
        <aside
          className={`w-full sm:w-80 border-r border-border flex flex-col ${selectedBookingId ? "hidden sm:flex" : "flex"}`}
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-bold text-lg">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-6">
                <MessageCircle className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-semibold">No conversations yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Book an artisan to start chatting.
                </p>
              </div>
            ) : (
              conversations.map((c: Conversation) => (
                <button
                  key={c.booking_id}
                  onClick={() => navigate({ to: "/messages", search: { booking: c.booking_id } })}
                  className={`w-full text-left px-4 py-4 border-b border-border hover:bg-muted/30 transition-colors ${selectedBookingId === c.booking_id ? "bg-primary/5 border-l-4 border-l-primary" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={c.other_user.avatar_url} />
                      <AvatarFallback>{c.other_user.full_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold truncate">{c.other_user.full_name}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {c.last_message?.created_at
                            ? formatDistanceToNow(new Date(c.last_message.created_at), {
                                addSuffix: false,
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {c.last_message?.content ?? "No messages yet"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusColor[c.booking_status] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {c.booking_status?.replace("_", " ")}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main chat area */}
        {selectedBookingId ? (
          <main className="flex flex-1 flex-col">
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button
                onClick={() => navigate({ to: "/messages" })}
                className="sm:hidden p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar className="h-9 w-9">
                <AvatarImage src={selectedConv?.other_user.avatar_url} />
                <AvatarFallback>{selectedConv?.other_user.full_name[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{selectedConv?.other_user.full_name ?? "Loading…"}</p>
                {bookingDetail && (
                  <span
                    className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${statusColor[bookingDetail.status] ?? "bg-muted"}`}
                  >
                    {bookingDetail.status?.replace("_", " ")}
                  </span>
                )}
              </div>
              {bookingDetail?.artisan?.phone_number && (
                <a
                  href={`tel:${bookingDetail.artisan.phone_number}`}
                  className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Booking action banner */}
            {bookingDetail && (
              <div className="border-b border-border bg-muted/30 px-4 py-2">
                {bookingDetail.status === "pending_payment" && bookingDetail.is_client && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm text-amber-700">
                      <Clock className="h-4 w-4" />
                      <span>
                        Send <strong>{formatRWF(bookingDetail.agreed_price)} RWF</strong> to{" "}
                        {bookingDetail.artisan?.phone_number} via MoMo
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => confirmPayment.mutate()}
                      disabled={confirmPayment.isPending}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {confirmPayment.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      I've sent payment
                    </Button>
                  </div>
                )}
                {bookingDetail.status === "in_progress" && bookingDetail.is_client && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      Job in progress — tap to confirm completion
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmComplete.mutate()}
                      disabled={confirmComplete.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Mark Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => raiseDispute.mutate()}
                      disabled={raiseDispute.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" /> Dispute
                    </Button>
                  </div>
                )}
                {bookingDetail.status === "completed" && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle className="h-4 w-4" /> Job completed
                    {bookingDetail.is_client && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/artisan/${bookingDetail.artisan?.id}`}>Leave a review</a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : allMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mb-2" />
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                allMessages.map((msg: Message) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {msg.created_at
                            ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })
                            : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Message input */}
            {bookingDetail?.status !== "completed" && bookingDetail?.status !== "cancelled" && (
              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message…"
                    className="flex-1 rounded-2xl"
                    disabled={sendMsg.isPending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!text.trim() || sendMsg.isPending}
                    className="rounded-2xl px-4"
                  >
                    {sendMsg.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </main>
        ) : (
          <main className="hidden sm:flex flex-1 items-center justify-center text-center text-muted-foreground">
            <div>
              <MessageCircle className="mx-auto h-16 w-16 mb-4" />
              <p className="text-lg font-semibold">Select a conversation</p>
              <p className="text-sm mt-1">Choose a conversation from the left to start chatting.</p>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

function formatRWF(n: number) {
  return new Intl.NumberFormat("rw-RW").format(n);
}
