// File: web/src/routes/legal/terms.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/legal/terms")({
  component: TermsPage,
});

function TermsPage() {
  const { isAuthenticated } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["terms"],
    queryFn: () => api.get("/legal/terms").then((r) => r.data),
    staleTime: Infinity,
  });

  const accept = useMutation({
    mutationFn: () => api.post("/legal/accept"),
    onSuccess: () => toast.success("Terms accepted!"),
    onError: () => toast.error("Failed to accept terms. Please try again."),
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{data?.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Version {data?.version} · Last updated {data?.last_updated}</p>
      </div>
      <div className="space-y-6">
        {(data?.sections ?? []).map((section: { heading: string; body: string }) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold mb-2">{section.heading}</h2>
            <p className="text-muted-foreground leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>
      {isAuthenticated && (
        <div className="mt-10 rounded-xl border border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">By clicking below, you confirm you have read and agree to these Terms of Service.</p>
          <Button onClick={() => accept.mutate()} disabled={accept.isPending}>{accept.isPending ? "Saving..." : "I Accept These Terms"}</Button>
        </div>
      )}
    </main>
  );
}
