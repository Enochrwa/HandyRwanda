// File: web/src/components/ReviewDialog.tsx
/**
 * Post-completion review modal for web.
 * Opened automatically after a client marks a job complete.
 */
import { useState } from "react";
import { Star } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";

const LABELS = ["Terrible", "Poor", "Okay", "Good", "Excellent"];
const QUICK_TAGS = [
  "On time",
  "Professional",
  "Great quality",
  "Good communication",
  "Exceeded expectations",
  "Fair price",
  "Would hire again",
];

interface Props {
  bookingId: string;
  artisanName: string;
  onClose: () => void;
}

export function ReviewDialog({ bookingId, artisanName, onClose }: Props) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4)));

  const submit = useMutation({
    mutationFn: () =>
      api.post(`/reviews/${bookingId}`, {
        rating,
        comment: [tags.join(", "), comment.trim()].filter(Boolean).join(". ") || undefined,
      }),
    onSuccess: () => {
      toast.success("Review submitted! Thank you 🙏");
      qc.invalidateQueries({ queryKey: ["artisan-reviews"] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Could not submit review.");
    },
  });

  const display = hovered || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <p className="text-2xl mb-1">🎉</p>
            <h2 className="text-xl font-extrabold">Job Complete!</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Rate your experience with{" "}
              <span className="font-semibold text-foreground">{artisanName.split(" ")[0]}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Stars */}
        <div className="flex gap-1 justify-center mb-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(s)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={36}
                className="transition-colors"
                fill={s <= display ? "#FBBF24" : "transparent"}
                color={s <= display ? "#FBBF24" : "#D1D5DB"}
              />
            </button>
          ))}
        </div>
        {display > 0 && (
          <p className="text-center text-sm text-muted-foreground mb-4">{LABELS[display - 1]}</p>
        )}

        {/* Quick tags */}
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
          What stood out? <span className="font-normal">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                tags.includes(tag)
                  ? "bg-primary border-primary text-white"
                  : "bg-muted/40 border-border text-foreground hover:border-primary"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell others about your experience… (optional)"
          rows={3}
          maxLength={500}
          className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground resize-none outline-none focus:ring-2 focus:ring-primary/40 mb-1"
        />
        <p className="text-[10px] text-muted-foreground text-right mb-4">{comment.length}/500</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => submit.mutate()}
            disabled={rating === 0 || submit.isPending}
            className="flex-2 flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {submit.isPending ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
