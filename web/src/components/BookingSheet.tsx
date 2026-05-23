import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, X, Loader2, Check } from "lucide-react";
import { formatRWF } from "@/services/artisanService";
import type { Artisan } from "@/types/artisan";

export function BookingSheet({
  a,
  open,
  onClose,
}: {
  a: Artisan;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [job, setJob] = useState("");
  const [when, setWhen] = useState("Tomorrow");
  const [time, setTime] = useState("Morning");
  const [budget, setBudget] = useState("");
  const [provider, setProvider] = useState<"MTN" | "Airtel">("MTN");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setPaying(false);
        setDone(false);
        setJob("");
        setBudget("");
      }, 200);
    }
  }, [open]);

  useEffect(() => {
    if (step !== 3) return;
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 1000);
    return () => clearTimeout(t);
  }, [step]);

  const confirm = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setDone(true);
    }, 2200);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-8 rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 animate-pop">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h3 className="mt-4 text-xl font-bold">Booking confirmed!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {a.name.split(" ")[0]} has been notified. Your money is held safely until the job is
              done.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        ) : paying ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 text-lg font-bold">Waiting for your MoMo confirmation…</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Check your phone and enter your {provider} MoMo PIN.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <img src={a.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {step} of 3
                </div>
                <h2 className="text-lg font-bold leading-tight">Book {a.name.split(" ")[0]}</h2>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold">Describe your job briefly</span>
                  <textarea
                    value={job}
                    onChange={(e) => setJob(e.target.value)}
                    rows={3}
                    placeholder="e.g. Kitchen sink is leaking under the basin"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-sm font-semibold">When</span>
                    <select
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold"
                    >
                      <option>Today</option>
                      <option>Tomorrow</option>
                      <option>This week</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-sm font-semibold">Time</span>
                    <select
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold"
                    >
                      <option>Morning</option>
                      <option>Afternoon</option>
                      <option>Evening</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold">
                    Your budget{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-background px-3">
                    <span className="text-sm font-semibold text-muted-foreground">RWF</span>
                    <input
                      inputMode="numeric"
                      value={budget}
                      onChange={(e) =>
                        setBudget(
                          e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                        )
                      }
                      placeholder="10,000"
                      className="w-full bg-transparent py-2.5 text-sm font-semibold outline-none"
                    />
                  </div>
                </label>
                <button
                  disabled={!job.trim()}
                  onClick={() => setStep(2)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-bold text-accent-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-3">
                    <img src={a.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.category} · {a.district}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div>
                      <span className="text-muted-foreground">Job:</span>{" "}
                      <span className="font-medium">{job}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">When:</span>{" "}
                      <span className="font-medium">
                        {when} · {time}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm">
                  <div className="font-semibold">
                    Typical price for {a.category.toLowerCase()} in Kigali
                  </div>
                  <div className="text-muted-foreground">
                    5,000 – 15,000 RWF — set fairly with your artisan.
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-input px-4 py-3 font-semibold hover:bg-muted"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-bold text-accent-foreground hover:brightness-95"
                  >
                    Confirm details <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Amount
                  </div>
                  <div className="mt-1 text-3xl font-extrabold">
                    {formatRWF(a.startingPrice)}{" "}
                    <span className="text-lg font-semibold text-muted-foreground">RWF</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Pay with</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["MTN", "Airtel"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setProvider(p)}
                        className={[
                          "rounded-xl border-2 px-3 py-3 text-sm font-bold transition",
                          provider === p
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-input bg-background text-foreground hover:bg-muted",
                        ].join(" ")}
                      >
                        {p} Money
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold">Your MoMo number</span>
                  <input
                    defaultValue="+250 78 234 5678"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <p>
                    <span className="font-semibold text-foreground">
                      Your payment is held safely until the job is done.
                    </span>{" "}
                    <span className="text-muted-foreground">
                      If anything goes wrong, we step in to help.
                    </span>
                  </p>
                </div>
                <button
                  disabled={!armed}
                  onClick={confirm}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-bold text-accent-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {armed ? (
                    <>
                      Confirm &amp; Pay <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    "Please wait…"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
