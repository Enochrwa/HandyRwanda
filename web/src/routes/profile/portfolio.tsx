import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Camera, Trash2, Plus, Loader2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState, useRef } from "react";
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

export const Route = createFileRoute("/profile/portfolio")({
  component: PortfolioManagement,
});

interface PortfolioPhoto {
  id: string;
  image_url: string;
  job_type?: string;
  description?: string;
  created_at: string;
}

function PortfolioManagement() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  const { data: photos, isLoading } = useQuery<PortfolioPhoto[]>({
    queryKey: ["portfolio-me"],
    queryFn: () => api.get("/artisans/portfolio/me").then((res) => res.data),
    enabled: isAuthenticated && user?.role === "artisan",
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/artisans/portfolio/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-me"] });
      toast.success("Photo removed");
      setIsDeleting(null);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail ?? "Failed to delete photo");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      await api.post("/artisans/portfolio", {
        photo_base64: base64,
        description: caption,
        job_type: "Portfolio",
      });
      queryClient.invalidateQueries({ queryKey: ["portfolio-me"] });
      toast.success("Photo added!");
      setIsUploadOpen(false);
      resetUpload();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isAuthenticated || user?.role !== "artisan") return null;

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-12">
        <h1 className="text-3xl font-extrabold">Your Portfolio</h1>
        <p className="text-muted-foreground mt-2">
          Showcase your best work to attract more clients.
        </p>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-6">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="aspect-square flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card text-primary hover:border-primary transition-colors"
          >
            <Plus className="h-10 w-10 mb-2" />
            <span className="font-bold">Add Project</span>
          </button>

          {isLoading
            ? Array.from({ length: 2 }).map((_, i) => (
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
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button
                      onClick={() => setIsDeleting(photo.id)}
                      className="p-3 rounded-full bg-destructive text-destructive-foreground hover:scale-110 transition-transform"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="h-6 w-6" />
                    </button>
                  </div>
                  {!!photo.description && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs font-medium truncate">{photo.description}</p>
                    </div>
                  )}
                </div>
              ))}
        </div>
      </main>

      {/* Upload Dialog */}
      <Dialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          if (!open) resetUpload();
          setIsUploadOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add to Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!previewUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video w-full flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              >
                <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-muted-foreground">
                  Click to upload photo
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    className="h-full w-full object-cover"
                    alt="Upload preview"
                  />
                ) : null}
                <button
                  onClick={resetUpload}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold">Caption (optional)</label>
              <Textarea
                placeholder="Describe this project..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={120}
                className="resize-none h-24"
              />
              <p className="text-[10px] text-right text-muted-foreground">{caption.length}/120</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!isDeleting} onOpenChange={(open) => !open && setIsDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This photo will be permanently removed from your
              portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => isDeleting && deleteMutation.mutate(isDeleting)}
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
