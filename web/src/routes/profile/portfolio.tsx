// File: web/src/routes/profile/portfolio.tsx
/**
 * Sprint 10 — Portfolio & Skill Videos page (artisan, web)
 *
 * Tabbed interface:
 *   📸 Photos — existing portfolio photo grid
 *   🎬 Videos — skill verification videos with presigned upload, status badges,
 *                playback modal, and view counts
 *
 * Upload flow (video):
 *   1. Browser picks an mp4/mov file (max 50 MB, advised ≤60 s)
 *   2. POST /uploads/presign → get upload_url + public_url
 *   3. PUT binary video directly to Supabase (XMLHttpRequest for progress)
 *   4. POST /artisans/me/skill-videos with metadata
 */
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import {
  Camera,
  Trash2,
  Plus,
  Loader2,
  X,
  Video,
  Play,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Upload,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile/portfolio")({
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: "/" });
    // Portfolio management is artisan-only
    if (user?.role !== "artisan") throw redirect({ to: "/" });
  },
  component: PortfolioManagement,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface PortfolioPhoto {
  id: string;
  image_url: string;
  job_type?: string;
  description?: string;
  created_at: string;
}

interface SkillVideo {
  id: string;
  artisan_id: string;
  category_id?: string;
  category_name?: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  duration_seconds?: number;
  is_approved: boolean;
  rejection_reason?: string;
  view_count: number;
  created_at: string;
}

interface Category {
  id: string;
  name_en: string;
  icon_emoji?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(s?: number) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatViews(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Upload a file directly to a presigned URL with XHR for progress reporting */
async function putToStorage(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Storage upload network error"));
    xhr.send(file);
  });
}

// ── Status badge ───────────────────────────────────────────────────────────────

function VideoStatusBadge({ video }: { video: SkillVideo }) {
  if (video.is_approved) {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Live
      </Badge>
    );
  }
  if (video.rejection_reason) {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px] px-1.5">
        <XCircle className="h-2.5 w-2.5" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-400 text-amber-700 bg-amber-50 text-[10px] px-1.5"
    >
      <Clock className="h-2.5 w-2.5" />
      Under Review
    </Badge>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function PortfolioManagement() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Tab
  const [activeTab, setActiveTab] = useState<"photos" | "videos">("photos");

  // Photo state
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoFileRef = useRef<HTMLInputElement>(null);

  // Video state
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isDeletingVideo, setIsDeletingVideo] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoCategoryId, setVideoCategoryId] = useState<string>("");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoProgressLabel, setVideoProgressLabel] = useState("");
  const [playingVideo, setPlayingVideo] = useState<SkillVideo | null>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: "/" });
  }, [isAuthenticated, navigate]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: photos, isLoading: photosLoading } = useQuery<PortfolioPhoto[]>({
    queryKey: ["portfolio-me"],
    queryFn: () => api.get("/artisans/portfolio/me").then((r) => r.data),
    enabled: isAuthenticated && user?.role === "artisan",
  });

  const { data: myVideos, isLoading: videosLoading } = useQuery<SkillVideo[]>({
    queryKey: ["my-skill-videos"],
    queryFn: () => api.get("/artisans/me/skill-videos").then((r) => r.data),
    enabled: isAuthenticated && user?.role === "artisan",
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/artisans/categories").then((r) => r.data),
  });

  // ── Photo mutations ───────────────────────────────────────────────────────────

  const deletePhotoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/artisans/portfolio/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-me"] });
      toast.success("Photo removed");
      setIsDeletingPhoto(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e?.response?.data?.detail ?? "Failed to delete photo");
    },
  });

  // ── Video mutations ───────────────────────────────────────────────────────────

  const deleteVideoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/artisans/me/skill-videos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-skill-videos"] });
      toast.success("Video removed");
      setIsDeletingVideo(null);
    },
    onError: () => toast.error("Failed to delete video"),
  });

  // ── Photo handlers ────────────────────────────────────────────────────────────

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(photoFile);
      });
      await api.post("/artisans/portfolio", {
        photo_base64: base64,
        description: photoCaption,
        job_type: "Portfolio",
      });
      queryClient.invalidateQueries({ queryKey: ["portfolio-me"] });
      toast.success("Photo added to portfolio!");
      setIsPhotoOpen(false);
      resetPhoto();
    } catch (error: unknown) {
      const e = error as { response?: { data?: { detail?: string } } };
      toast.error(e.response?.data?.detail ?? "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const resetPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoCaption("");
    if (photoFileRef.current) photoFileRef.current.value = "";
  };

  // ── Video handlers ────────────────────────────────────────────────────────────

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 50 MB client-side gate
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video too large. Maximum size is 50 MB.");
      return;
    }
    setVideoFile(file);
  };

  const handleVideoUpload = async () => {
    if (!videoFile || !videoTitle.trim()) return;

    const contentType = videoFile.name.toLowerCase().endsWith(".mov")
      ? "video/quicktime"
      : "video/mp4";

    setVideoUploading(true);
    setVideoProgress(0);
    try {
      // Step 1: Get presigned URL
      setVideoProgressLabel("Preparing upload…");
      const { data: presign } = await api.post("/uploads/presign", {
        upload_type: "skill_video",
        content_type: contentType,
        filename: videoFile.name,
      });

      // Step 2: Upload directly to Supabase
      setVideoProgressLabel("Uploading video…");
      await putToStorage(presign.upload_url, videoFile, contentType, (pct) => {
        setVideoProgress(pct);
      });
      setVideoProgress(100);

      // Step 3: Register with backend
      setVideoProgressLabel("Saving video details…");
      await api.post("/artisans/me/skill-videos", {
        video_url: presign.public_url,
        title: videoTitle.trim().slice(0, 100),
        description: videoDescription.trim().slice(0, 300) || undefined,
        category_id: videoCategoryId || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["my-skill-videos"] });
      toast.success("🎬 Video submitted for review!", {
        description: "Admin review usually takes less than 24 hours.",
      });
      setIsVideoOpen(false);
      resetVideo();
    } catch (error: unknown) {
      const e = error as { response?: { data?: { detail?: string } }; message?: string };
      toast.error(e?.response?.data?.detail ?? e?.message ?? "Video upload failed");
    } finally {
      setVideoUploading(false);
      setVideoProgress(0);
      setVideoProgressLabel("");
    }
  };

  const resetVideo = () => {
    setVideoFile(null);
    setVideoTitle("");
    setVideoDescription("");
    setVideoCategoryId("");
    if (videoFileRef.current) videoFileRef.current.value = "";
  };

  // ── View count tracking ───────────────────────────────────────────────────────

  const handleVideoPlay = async (video: SkillVideo) => {
    setPlayingVideo(video);
    try {
      await api.post(`/artisans/skill-videos/${video.id}/view`);
      // Optimistically update local data
      queryClient.setQueryData<SkillVideo[]>(["my-skill-videos"], (prev) =>
        prev?.map((v) => (v.id === video.id ? { ...v, view_count: v.view_count + 1 } : v)),
      );
    } catch {
      // fire-and-forget
    }
  };

  if (!isAuthenticated || user?.role !== "artisan") return null;

  const videoSlots = 5 - (myVideos?.length ?? 0);
  const approvedCount = myVideos?.filter((v) => v.is_approved).length ?? 0;
  const pendingCount = myVideos?.filter((v) => !v.is_approved && !v.rejection_reason).length ?? 0;

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-12">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Portfolio</h1>
            <p className="text-muted-foreground mt-1">
              Showcase your photos and skill videos to attract more clients.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-3 mb-8">
          {(["photos", "videos"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border-2 transition-all",
                activeTab === tab
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              {tab === "photos" ? (
                <>
                  <Camera className="h-4 w-4" />
                  Photos
                  {photos && (
                    <span
                      className={cn(
                        "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                        activeTab === tab
                          ? "bg-white/20 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {photos.length}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Skill Videos
                  {myVideos && myVideos.length > 0 && (
                    <span
                      className={cn(
                        "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                        activeTab === tab
                          ? "bg-white/20 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {myVideos.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* ── PHOTOS TAB ──────────────────────────────────────────────────── */}
        {activeTab === "photos" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <button
                onClick={() => setIsPhotoOpen(true)}
                className="aspect-square flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card text-primary hover:border-primary transition-colors"
              >
                <Plus className="h-10 w-10 mb-2" />
                <span className="font-bold">Add Photo</span>
              </button>

              {photosLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-3xl animate-pulse bg-muted" />
                  ))
                : photos?.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-3xl overflow-hidden bg-muted border border-border"
                    >
                      <img
                        src={photo.image_url}
                        alt="Portfolio work"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => setIsDeletingPhoto(photo.id)}
                          className="p-3 rounded-full bg-red-600 text-white hover:scale-110 transition-transform"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                      {photo.description && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs font-medium truncate">
                            {photo.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
            </div>

            {!photosLoading && (!photos || photos.length === 0) && (
              <div className="mt-12 text-center border-2 border-dashed border-border rounded-3xl p-16">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-semibold text-lg">No photos yet</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Add photos to show clients the quality of your work.
                </p>
                <Button className="mt-6" onClick={() => setIsPhotoOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first photo
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── VIDEOS TAB ──────────────────────────────────────────────────── */}
        {activeTab === "videos" && (
          <>
            {/* Stats */}
            {myVideos && myVideos.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Live", count: approvedCount, color: "emerald" },
                  { label: "Under Review", count: pendingCount, color: "amber" },
                  { label: "Slots left", count: videoSlots, color: "slate" },
                ].map(({ label, count, color }) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-2xl border p-4 text-center",
                      color === "emerald" && "border-emerald-100 bg-emerald-50",
                      color === "amber" && "border-amber-100 bg-amber-50",
                      color === "slate" && "border-border bg-card",
                    )}
                  >
                    <p
                      className={cn(
                        "text-3xl font-extrabold",
                        color === "emerald" && "text-emerald-700",
                        color === "amber" && "text-amber-700",
                        color === "slate" && "text-foreground",
                      )}
                    >
                      {count}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Trust banner */}
            {(!myVideos || myVideos.length === 0) && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
                <h3 className="font-bold text-primary mb-1">🎬 Why add skill videos?</h3>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  Artisans with approved skill videos receive{" "}
                  <strong className="text-primary">3× more profile views</strong>. Clients trust
                  what they can see. A 60-second clip of you solving a real problem builds more
                  trust than any text description.
                </p>
              </div>
            )}

            {/* Add video button */}
            <Button
              onClick={() => setIsVideoOpen(true)}
              disabled={videoSlots <= 0}
              variant={videoSlots > 0 ? "default" : "outline"}
              className="mb-6 gap-2"
            >
              {videoSlots > 0 ? (
                <>
                  <Video className="h-4 w-4" />
                  Add Skill Video
                  <span className="text-xs opacity-75 ml-1">({videoSlots} slots left)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  Maximum 5 videos reached
                </>
              )}
            </Button>

            {/* Video grid */}
            {videosLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-muted animate-pulse h-72" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {myVideos?.map((video) => (
                  <div
                    key={video.id}
                    className="bg-card border border-border rounded-2xl overflow-hidden group"
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-video bg-muted cursor-pointer"
                      onClick={() => handleVideoPlay(video)}
                    >
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Video className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className="h-7 w-7 text-primary fill-primary ml-1" />
                        </div>
                      </div>
                      {/* Always-visible play icon */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center group-hover:opacity-0 transition-opacity">
                          <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                      {/* Status badge */}
                      <div className="absolute top-2 left-2">
                        <VideoStatusBadge video={video} />
                      </div>
                      {/* Duration */}
                      {video.duration_seconds && (
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-mono px-1.5 py-0.5 rounded">
                          {formatDuration(video.duration_seconds)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{video.title}</p>
                          {video.category_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {video.category_name}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setIsDeletingVideo(video.id)}
                          className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* View count (approved) */}
                      {video.is_approved && (
                        <div className="flex items-center gap-1 mt-2">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatViews(video.view_count)} views
                          </span>
                        </div>
                      )}

                      {/* Rejection reason */}
                      {video.rejection_reason && (
                        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
                          <p className="text-xs font-bold text-red-700 mb-1">Admin feedback:</p>
                          <p className="text-xs text-red-600">{video.rejection_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!videosLoading && (!myVideos || myVideos.length === 0) && (
              <div className="mt-8 text-center border-2 border-dashed border-border rounded-3xl p-16">
                <Video className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-semibold text-lg">No skill videos yet</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Record a 60-second clip demonstrating your craft.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Photo Upload Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={isPhotoOpen}
        onOpenChange={(o) => {
          if (!o) resetPhoto();
          setIsPhotoOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Portfolio Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!photoPreview ? (
              <div
                onClick={() => photoFileRef.current?.click()}
                className="aspect-video w-full flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              >
                <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-muted-foreground">
                  Click to upload photo
                </span>
                <input
                  type="file"
                  ref={photoFileRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                />
              </div>
            ) : (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border">
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  onClick={resetPhoto}
                  className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div>
              <label className="text-sm font-bold block mb-1">Caption (optional)</label>
              <Textarea
                placeholder="Describe this project…"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                maxLength={120}
                className="resize-none h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPhotoOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePhotoUpload} disabled={!photoFile || photoUploading}>
              {photoUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Video Upload Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={isVideoOpen}
        onOpenChange={(o) => {
          if (!o && !videoUploading) resetVideo();
          if (!videoUploading) setIsVideoOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Add Skill Video
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File picker */}
            <div
              onClick={() => !videoUploading && videoFileRef.current?.click()}
              className={cn(
                "w-full h-36 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-colors",
                videoFile
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/50 hover:bg-muted cursor-pointer",
              )}
            >
              {videoFile ? (
                <div className="text-center">
                  <Play className="h-8 w-8 text-primary mx-auto mb-2 fill-primary/20" />
                  <p className="text-sm font-semibold text-primary">{videoFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  {!videoUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetVideo();
                      }}
                      className="mt-2 text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Click to pick a video
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    MP4 or MOV · max 50 MB · recommend ≤60 seconds
                  </span>
                </>
              )}
              <input
                type="file"
                ref={videoFileRef}
                className="hidden"
                accept="video/mp4,video/quicktime,.mp4,.mov"
                onChange={handleVideoFileChange}
              />
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-bold block mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Fixing a leaking pipe in 5 steps"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                maxLength={100}
                disabled={videoUploading}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-bold block mb-1">Description (optional)</label>
              <Textarea
                placeholder="Briefly describe the skill or task shown…"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                maxLength={300}
                className="resize-none h-20"
                disabled={videoUploading}
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-bold block mb-1">Skill Category</label>
              <Select
                value={videoCategoryId}
                onValueChange={setVideoCategoryId}
                disabled={videoUploading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon_emoji} {cat.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload progress */}
            {videoUploading && (
              <div className="rounded-xl bg-primary/10 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                  <span className="text-sm text-primary font-medium">{videoProgressLabel}</span>
                </div>
                <div className="w-full bg-primary/20 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-right">{videoProgress}%</p>
              </div>
            )}

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
              <p className="font-bold text-blue-800">📋 Approval tips</p>
              <p>• Clearly show the skill or task being performed</p>
              <p>• Good lighting and steady camera improves approval rate</p>
              <p>• Admin review usually takes less than 24 hours</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsVideoOpen(false)}
              disabled={videoUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVideoUpload}
              disabled={!videoFile || !videoTitle.trim() || videoUploading}
              className="gap-2"
            >
              {videoUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Submit for Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Video Playback Modal ──────────────────────────────────────────── */}
      <Dialog open={!!playingVideo} onOpenChange={(o) => !o && setPlayingVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0">
          <div className="relative">
            {/* Close button */}
            <button
              onClick={() => setPlayingVideo(null)}
              className="absolute top-3 right-3 z-10 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Video player */}
            {playingVideo && (
              <video
                ref={videoPlayerRef}
                key={playingVideo.id}
                src={playingVideo.video_url}
                controls
                autoPlay
                className="w-full max-h-[70vh] bg-black"
              />
            )}
          </div>
          {/* Info bar */}
          {playingVideo && (
            <div className="bg-zinc-900 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-bold">{playingVideo.title}</p>
                  {playingVideo.category_name && (
                    <p className="text-zinc-400 text-sm mt-0.5">{playingVideo.category_name}</p>
                  )}
                  {playingVideo.description && (
                    <p className="text-zinc-300 text-sm mt-2 leading-relaxed">
                      {playingVideo.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-zinc-400 text-sm flex-shrink-0">
                  <Eye className="h-4 w-4" />
                  <span>{formatViews(playingVideo.view_count)} views</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Photo Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={!!isDeletingPhoto} onOpenChange={(o) => !o && setIsDeletingPhoto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => isDeletingPhoto && deletePhotoMutation.mutate(isDeletingPhoto)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Video Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={!!isDeletingVideo} onOpenChange={(o) => !o && setIsDeletingVideo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the skill video from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => isDeletingVideo && deleteVideoMutation.mutate(isDeletingVideo)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
