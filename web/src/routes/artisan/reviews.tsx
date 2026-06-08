// File: web/src/routes/artisan/reviews.tsx
/**
 * Sprint 2 — Artisan Review Reply (Web Dashboard)
 *
 * Artisans see all their reviews, reply to them inline,
 * and track their response rate. Optimistic UI updates.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import {
  Star,
  MessageCircle,
  Send,
  ChevronLeft,
  Filter,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/artisan/reviews")({
  head: () => ({
    meta: [{ title: "My Reviews — HandyRwanda" }],
  }),
  component: ArtisanReviewsDashboard,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  artisan_reply: string | null;
  client_name: string;
  client_avatar: string | null;
  created_at: string;
}

type FilterKey = "all" | "pending" | "replied";

// ── Star display ──────────────────────────────────────────────────────────────

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i < rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground"
          }
        />
      ))}
    </div>
  );
}

// ── Metrics summary ───────────────────────────────────────────────────────────

function MetricsSummary({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return null;
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const replied = reviews.filter((r) => r.artisan_reply).length;
  const replyRate = Math.round((replied / reviews.length) * 100);
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
    pct: Math.round((reviews.filter((r) => r.rating === n).length / reviews.length) * 100),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
      {/* Average rating */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-end gap-3">
            <div className="text-5xl font-black text-foreground tabular-nums">{avg.toFixed(1)}</div>
            <div className="pb-1">
              <StarDisplay rating={Math.round(avg)} />
              <p className="text-xs text-muted-foreground mt-1">
                {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {/* Distribution */}
          <div className="mt-4 space-y-1.5">
            {dist.map(({ n, count, pct }) => (
              <div key={n} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right">{n}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-6">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reply rate */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-primary mb-2">
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Reply Rate</span>
          </div>
          <div>
            <div className="text-4xl font-black text-foreground">{replyRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {replied} of {reviews.length} reviews answered
            </p>
          </div>
          {/* Progress ring stand-in */}
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${replyRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {replyRate >= 80
              ? "🏆 Excellent — you stand out to clients"
              : replyRate >= 50
                ? "💪 Good — keep up the engagement"
                : "💡 Tip: Reply to more reviews to build trust"}
          </p>
        </CardContent>
      </Card>

      {/* Pending replies */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-semibold">Awaiting Reply</span>
          </div>
          <div>
            <div className="text-4xl font-black text-foreground">{reviews.length - replied}</div>
            <p className="text-xs text-muted-foreground mt-1">reviews without response</p>
          </div>
          <div className="mt-4">
            {reviews.length - replied === 0 ? (
              <div className="flex items-center gap-1.5 text-success text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All caught up — great work!
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Scroll down to reply to pending reviews.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Reply form (inline) ────────────────────────────────────────────────────────

interface ReplyFormProps {
  reviewId: string;
  onSubmit: (reviewId: string, reply: string) => void;
  isSubmitting: boolean;
  onCancel: () => void;
}

function ReplyForm({ reviewId, onSubmit, isSubmitting, onCancel }: ReplyFormProps) {
  const [text, setText] = useState("");
  const MAX = 300;

  return (
    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" /> Write your reply
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder="Thank the client, address their feedback, or share more context about your work…"
        rows={3}
        className="rounded-xl border-primary/20 bg-white/70 text-sm resize-none focus:ring-primary"
        autoFocus
      />
      <div className="flex items-center justify-between mt-2">
        <span
          className={`text-xs ${
            MAX - text.length < 30 ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {MAX - text.length} characters left
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-xl h-9 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSubmit(reviewId, text.trim())}
            disabled={isSubmitting || text.trim().length < 10}
            className="rounded-xl h-9 text-xs gap-1.5 bg-primary"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Post Reply
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        💡 Professional, courteous replies increase your booking conversion by up to 30%.
      </p>
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

interface ReviewCardProps {
  review: Review;
  onReply: (reviewId: string, reply: string) => void;
  isSubmitting: boolean;
  optimisticReply: string | null;
}

function ReviewCard({ review, onReply, isSubmitting, optimisticReply }: ReviewCardProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const reply = optimisticReply ?? review.artisan_reply;
  const hasReply = Boolean(reply);

  const handleSubmit = (reviewId: string, text: string) => {
    onReply(reviewId, text);
    setReplyOpen(false);
  };

  const timeAgo = review.created_at
    ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true })
    : "";

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Client header */}
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-foreground text-sm overflow-hidden">
          {review.client_avatar ? (
            <img src={review.client_avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            (review.client_name?.[0] ?? "?").toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-semibold text-foreground">{review.client_name}</p>
            <div className="flex items-center gap-2">
              {hasReply ? (
                <Badge className="bg-success/10 text-success border-success/20 rounded-full text-[10px] gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Replied
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-amber-600 border-amber-200 bg-amber-50 rounded-full text-[10px] gap-1"
                >
                  <Clock className="h-2.5 w-2.5" /> Awaiting reply
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
          <StarDisplay rating={review.rating} size={13} />
        </div>
      </div>

      {/* Comment */}
      <div className="mt-3">
        {review.comment ? (
          <p className="text-[15px] text-foreground leading-relaxed">{review.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No written comment</p>
        )}
      </div>

      {/* Existing reply */}
      {hasReply ? (
        <div className="mt-4 rounded-xl border-l-4 border-primary bg-primary/5 p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            Your response
            {optimisticReply && (
              <span className="ml-auto text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                Just posted
              </span>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed">{reply}</p>
        </div>
      ) : replyOpen ? (
        <ReplyForm
          reviewId={review.id}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onCancel={() => setReplyOpen(false)}
        />
      ) : (
        <div className="mt-4">
          <button
            onClick={() => setReplyOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Reply to this review
          </button>
        </div>
      )}
    </article>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

function ArtisanReviewsDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  // { reviewId: optimisticReplyText }
  const [optimisticReplies, setOptimisticReplies] = useState<Record<string, string>>({});

  const {
    data: reviews = [],
    isLoading,
    refetch,
  } = useQuery<Review[]>({
    queryKey: ["artisan-reviews-mine"],
    queryFn: () => api.get("/reviews/mine").then((r) => r.data),
    enabled: !!user?.id,
  });

  const replyMutation = useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) =>
      api.patch(`/reviews/${reviewId}/reply`, { reply }),
    onMutate: ({ reviewId, reply }) => {
      setOptimisticReplies((prev) => ({ ...prev, [reviewId]: reply }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artisan-reviews-mine"] });
      toast.success("Reply posted! Clients can now see your response.");
    },
    onError: (_err, { reviewId }) => {
      setOptimisticReplies((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
      toast.error("Failed to post reply. Please try again.");
    },
  });

  const handleReply = useCallback(
    (reviewId: string, reply: string) => {
      replyMutation.mutate({ reviewId, reply });
    },
    [replyMutation],
  );

  const pending = reviews.filter((r) => !optimisticReplies[r.id] && !r.artisan_reply).length;

  const filteredReviews = reviews.filter((r) => {
    const hasReply = Boolean(optimisticReplies[r.id] ?? r.artisan_reply);
    if (filter === "pending") return !hasReply;
    if (filter === "replied") return hasReply;
    return true;
  });

  return (
    <div className="min-h-dvh bg-muted/30 pb-16">
      {/* Top nav */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            to="/artisan/earnings"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold text-foreground">Reviews</span>
          {pending > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">
              <AlertCircle className="h-3 w-3" />
              {pending} pending
            </span>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-foreground">My Reviews</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your reputation — reply to client feedback to build trust.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card py-20 text-center">
            <Star className="h-12 w-12 text-muted-foreground mb-3" />
            <h2 className="text-lg font-bold text-foreground">No reviews yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Complete jobs and your clients&apos; reviews will appear here.
            </p>
          </div>
        ) : (
          <>
            <MetricsSummary reviews={reviews} />

            {/* Filter tabs */}
            <div className="flex gap-2 mb-5">
              {(
                [
                  ["all", `All (${reviews.length})`],
                  ["pending", `Pending (${pending})`],
                  ["replied", `Replied (${reviews.length - pending})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold border-2 transition-all ${
                    filter === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Review list */}
            <div className="space-y-4">
              {filteredReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                  <p className="font-semibold text-foreground">
                    {filter === "pending" ? "All caught up!" : "No reviews in this filter"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filter === "pending"
                      ? "You've replied to every review. Excellent work! 🎉"
                      : "Try a different filter above."}
                  </p>
                </div>
              ) : (
                filteredReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onReply={handleReply}
                    isSubmitting={replyMutation.isPending}
                    optimisticReply={optimisticReplies[review.id] ?? null}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
