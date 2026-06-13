// File: web/src/routes/messages.tsx
import { createFileRoute, useNavigate, useSearch, redirect } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { ReviewDialog } from "@/components/ReviewDialog";
import {
  Send,
  Loader2,
  MessageCircle,
  ArrowLeft,
  Phone,
  CheckCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Mic,
  Play,
  Pause,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMessageSocket } from "@/hooks/useMessageSocket";

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): { booking?: string } => ({
    booking: typeof search.booking === "string" ? search.booking : undefined,
  }),
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: "/" });
    }
    if (user?.role === "admin") {
      throw redirect({ to: "/admin/verification" });
    }
  },
  component: MessagesPage,
});

interface Conversation {
  booking_id: string;
  other_user: { id: string; full_name: string; avatar_url?: string };
  last_message: { content: string | null; is_voice?: boolean; created_at: string } | null;
  unread_count: number;
  booking_status: string;
}

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  voice_note_url?: string | null;
  voice_note_duration_secs?: number | null;
  is_voice_only?: boolean;
  is_read: boolean;
  created_at: string;
  translated_content?: string | null;
}

// ── Web Payment Panel ─────────────────────────────────────────────────────────
type PaymentMethod = "mtn_momo" | "airtel_money";

interface PaymentInstructions {
  payment_id: string;
  reference_code: string;
  amount: number;
  method_label: string;
  receiver_phone: string;
  instructions: string[];
  note: string;
  status: string;
}

function PaymentPanel({ bookingId, amount }: { bookingId: string; amount: number }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"select" | "instructions" | "proof" | "pending">("select");
  const [method, setMethod] = useState<PaymentMethod>("mtn_momo");
  const [instr, setInstr] = useState<PaymentInstructions | null>(null);
  const [txId, setTxId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get(`/payments/booking/${bookingId}`)
      .then((r) => {
        if (r.data.status === "pending_verification" || r.data.status === "approved") {
          setInstr(r.data);
          setStep("pending");
        } else if (r.data.status && r.data.status !== "not_initiated") {
          setInstr(r.data);
          setStep("instructions");
        }
      })
      .catch(() => {});
  }, [bookingId]);

  const initiate = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/payments/initiate/${bookingId}`, { method });
      setInstr(res.data);
      setStep("instructions");
    } catch {
      toast.error("Could not initiate payment.");
    } finally {
      setLoading(false);
    }
  };

  const submitProof = async () => {
    if (txId.trim().length < 3) {
      toast.error("Enter your transaction ID");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/payments/${instr!.payment_id}/submit-proof`, {
        client_transaction_id: txId.trim(),
      });
      setStep("pending");
      qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
      toast.success("Proof submitted! We'll verify within 5 minutes.");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  if (step === "pending") {
    return (
      <div className="flex items-center gap-3 text-sm text-amber-700 py-1">
        <span className="text-lg">⏳</span>
        <span>Payment proof submitted — verifying (usually under 5 min). You'll be notified.</span>
      </div>
    );
  }

  if (step === "instructions" && instr) {
    return (
      <div className="space-y-3 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => copy(instr.receiver_phone, "Phone")}
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              📋 Send to: <strong>{instr.receiver_phone}</strong>
            </button>
            <button
              onClick={() => copy(instr.reference_code, "Reference")}
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              📋 Ref: <strong>{instr.reference_code}</strong>
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRWF(instr.amount)} RWF via {instr.method_label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            placeholder="Transaction ID from MoMo SMS (e.g. MP250601.1234.X12345)"
            className="flex-1 min-w-[220px] rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button
            size="sm"
            onClick={submitProof}
            disabled={loading || txId.trim().length < 3}
            className="bg-primary text-white"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit Proof →"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap py-1">
      <span className="text-sm font-semibold text-amber-700">
        💰 Payment due: {formatRWF(amount)} RWF
      </span>
      <div className="flex gap-2">
        {(["mtn_momo", "airtel_money"] as PaymentMethod[]).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              method === m
                ? "bg-primary border-primary text-white"
                : "border-border text-foreground hover:border-primary"
            }`}
          >
            {m === "mtn_momo" ? "📱 MTN MoMo" : "💳 Airtel"}
          </button>
        ))}
        <Button
          size="sm"
          onClick={initiate}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pay Now →"}
        </Button>
      </div>
    </div>
  );
}

// ── Web Voice Message Bubble ──────────────────────────────────────────────────

const WAVEFORM_BARS = [6, 10, 14, 18, 22, 16, 10, 14, 20, 24, 18, 12, 16, 22, 14, 10, 8, 12];

function formatAudioDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function WebVoiceBubble({
  url,
  durationSecs,
  isMine,
  timestamp,
}: {
  url: string;
  durationSecs: number | null;
  isMine: boolean;
  timestamp: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(
    durationSecs != null ? durationSecs * 1000 : null,
  );

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const handlePlayPause = () => {
    if (!audioRef.current) {
      setIsLoading(true);
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        setDurationMs(audio.duration * 1000);
        setIsLoading(false);
      });
      audio.addEventListener("timeupdate", () => {
        setPositionMs(audio.currentTime * 1000);
      });
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setPositionMs(0);
      });
      audio.addEventListener("error", () => {
        setIsLoading(false);
        setIsPlaying(false);
      });
      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const totalMs = durationMs ?? (durationSecs != null ? durationSecs * 1000 : null);
  const progress = totalMs && totalMs > 0 ? Math.min(positionMs / totalMs, 1) : 0;

  const baseClass = isMine
    ? "bg-primary text-primary-foreground rounded-br-sm"
    : "bg-muted text-foreground rounded-bl-sm";

  const activeBarColor = isMine ? "rgba(255,255,255,0.95)" : "#1B5E3B";
  const inactiveBarColor = isMine ? "rgba(255,255,255,0.3)" : "rgba(27,94,59,0.25)";
  const btnBg = isMine ? "rgba(255,255,255,0.2)" : "rgba(27,94,59,0.1)";
  const iconColor = isMine ? "#fff" : "#1B5E3B";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl min-w-[200px] max-w-[320px] ${baseClass}`}
    >
      {/* Play/Pause */}
      <button
        onClick={handlePlayPause}
        style={{ background: btnBg }}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: iconColor }} />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" style={{ color: iconColor }} />
        ) : (
          <Play className="w-4 h-4" style={{ color: iconColor }} />
        )}
      </button>

      {/* Waveform */}
      <div className="flex items-center gap-[2px] flex-1 h-7">
        {WAVEFORM_BARS.map((h, i) => {
          const fraction = i / WAVEFORM_BARS.length;
          const isPast = fraction <= progress;
          return (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 2,
                backgroundColor: isPast ? activeBarColor : inactiveBarColor,
                transition: "background-color 0.1s",
              }}
            />
          );
        })}
      </div>

      {/* Duration + timestamp */}
      <div className="flex flex-col items-end shrink-0 min-w-[36px]">
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color: isMine ? "#fff" : "#1B5E3B" }}
        >
          {isPlaying || positionMs > 0
            ? formatAudioDuration(positionMs)
            : totalMs != null
              ? formatAudioDuration(totalMs)
              : "0:00"}
        </span>
        <span
          className="text-[9px] mt-0.5"
          style={{ color: isMine ? "rgba(255,255,255,0.6)" : "#9CA3AF" }}
        >
          {timestamp}
        </span>
      </div>
    </div>
  );
}

function MessagesPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { booking: selectedBookingId } = useSearch({ from: "/messages" });
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);

  // ── Socket.IO real-time messages ─────────────────────────────────────────
  const { connected: wsConnected } = useMessageSocket(selectedBookingId);

  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messages/conversations").then((r) => r.data),
    // Poll as fallback but Socket.IO keeps this fresh in real-time
    refetchInterval: wsConnected ? false : 15_000,
    enabled: isAuthenticated,
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["messages", selectedBookingId],
    queryFn: () =>
      selectedBookingId ? api.get(`/messages/${selectedBookingId}`).then((r) => r.data) : [],
    enabled: !!selectedBookingId,
    // Disable polling when Socket.IO is connected
    refetchInterval: wsConnected ? false : 8_000,
  });

  const { data: bookingDetail } = useQuery({
    queryKey: ["booking-detail", selectedBookingId],
    queryFn: () =>
      selectedBookingId ? api.get(`/bookings/${selectedBookingId}`).then((r) => r.data) : null,
    enabled: !!selectedBookingId,
  });

  const msgCount = (messages as Message[]).length;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgCount]);

  const sendMsg = useMutation({
    mutationFn: (content: string) =>
      api.post(`/messages/${selectedBookingId}`, { content }).then((r) => r.data),
    onSuccess: () => {
      setText("");
      // Server already broadcast via Socket.IO; invalidate to sync read status
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
      if (bookingDetail?.is_client) setReviewOpen(true);
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
    <div className="min-h-dvh flex flex-col bg-background">
      <Header />
      {reviewOpen && selectedBookingId && bookingDetail && (
        <ReviewDialog
          bookingId={selectedBookingId}
          artisanName={bookingDetail.artisan?.full_name ?? "the artisan"}
          onClose={() => setReviewOpen(false)}
        />
      )}
      {/* Full-height flex row: sidebar + chat panel.
          On mobile we show EITHER the sidebar OR the chat, not both.
          On sm+ we show both side by side. */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100dvh - 64px)" }}>
        {/* Sidebar: conversation list */}
        <aside
          className={`
            flex-col border-r border-border bg-card
            ${selectedBookingId ? "hidden sm:flex sm:w-80 lg:w-96" : "flex w-full sm:w-80 lg:w-96"}
          `}
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
                      <p className="text-sm text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                        {c.last_message?.is_voice ? (
                          <>
                            <Mic className="w-3 h-3 shrink-0" />
                            <span className="italic">Voice message</span>
                          </>
                        ) : (
                          (c.last_message?.content ?? "No messages yet")
                        )}
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
          <main className="flex flex-1 flex-col min-w-0 overflow-hidden bg-background">
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
              {/* Real-time connection indicator */}
              <div
                title={wsConnected ? "Real-time connected" : "Connecting…"}
                className="flex items-center"
              >
                {wsConnected ? (
                  <Wifi className="h-3.5 w-3.5 text-success" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
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
                  <PaymentPanel
                    bookingId={selectedBookingId!}
                    amount={bookingDetail.agreed_price}
                  />
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
              ) : (messages as Message[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mb-2" />
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                (messages as Message[]).map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  const timestamp = msg.created_at
                    ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })
                    : "";

                  // Voice message bubble
                  if (msg.voice_note_url || msg.is_voice_only) {
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <WebVoiceBubble
                          url={msg.voice_note_url!}
                          durationSecs={msg.voice_note_duration_secs ?? null}
                          isMine={isMine}
                          timestamp={timestamp}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        {msg.translated_content && msg.translated_content !== msg.content && (
                          <p
                            className={`text-[10px] mt-1 italic ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}
                          >
                            {msg.translated_content}
                          </p>
                        )}
                        <p
                          className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {timestamp}
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
          <main className="hidden sm:flex flex-1 items-center justify-center text-center text-muted-foreground bg-muted/20">
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
