// File: web/src/routes/legal/privacy.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";

export const Route = createFileRoute("/legal/privacy")({
  component: PrivacyPage,
});

interface LegalSection {
  heading: string;
  body: string;
}

interface PrivacyData {
  title: string;
  version: string;
  last_updated: string;
  sections: LegalSection[];
}

function PrivacyPage() {
  const { data, isLoading } = useQuery<PrivacyData>({
    queryKey: ["privacy"],
    queryFn: () => api.get("/legal/privacy").then((r) => r.data as PrivacyData),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{data?.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Version {data?.version} · Last updated {data?.last_updated}
        </p>
      </div>

      <div className="space-y-6">
        {(data?.sections ?? []).map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 text-lg font-semibold">{section.heading}</h2>
            <p className="leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
