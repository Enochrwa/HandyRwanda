// File: web/src/routes/legal/privacy.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";

export const Route = createFileRoute("/legal/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["privacy"],
    queryFn: () => api.get("/legal/privacy").then((r) => r.data),
    staleTime: Infinity,
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
    </main>
  );
}
