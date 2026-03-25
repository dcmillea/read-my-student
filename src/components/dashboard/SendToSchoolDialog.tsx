"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { School } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

const LS_KEY = "rms_recent_schools";
const MAX_RECENT = 5;

type RecentSchool = { name: string; email: string };

function loadRecentSchools(): RecentSchool[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecentSchool[]).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentSchool(school: RecentSchool): void {
  try {
    const existing = loadRecentSchools();
    const filtered = existing.filter(
      (s) => s.email.toLowerCase() !== school.email.toLowerCase(),
    );
    const updated = [school, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch {
    /* ignore localStorage errors */
  }
}

export function SendToSchoolDialog({ letterId }: { letterId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"details" | "payment">("details");
  const [schoolName, setSchoolName] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSchools, setRecentSchools] = useState<RecentSchool[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setRecentSchools(loadRecentSchools());
  }, [isOpen]);

  const handleClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSchoolName("");
      setSchoolEmail("");
      setError(null);
      setStep("details");
      setClientSecret(null);
    }
  };

  const isValid =
    schoolName.trim().length > 0 && schoolEmail.trim().includes("@");

  const handleProceedToPayment = async () => {
    if (!isValid) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/letters/${letterId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, schoolEmail }),
      });

      const data = (await res.json()) as {
        clientSecret?: string;
        error?: string;
      };

      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setIsLoading(false);
        return;
      }

      saveRecentSchool({ name: schoolName.trim(), email: schoolEmail.trim() });
      setClientSecret(data.clientSecret);
      setStep("payment");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Passed to EmbeddedCheckoutProvider — recreates the session if needed
  const fetchClientSecret = useCallback(
    () => Promise.resolve(clientSecret ?? ""),
    [clientSecret],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button
          size='sm'
          className='rounded-lg bg-amber-400 text-green-900 hover:bg-yellow-500 font-semibold'
        >
          <School className='mr-2 h-4 w-4' /> Send to School
        </Button>
      </DialogTrigger>

      {step === "details" ? (
        <DialogContent className='sm:max-w-[425px] rounded-2xl'>
          <DialogHeader>
            <DialogTitle className='font-serif text-green-900'>
              Send Recommendation
            </DialogTitle>
            <DialogDescription>
              Enter the destination for the admissions office. A secure
              one-time view link will be generated after faculty approval and
              payment.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            {recentSchools.length > 0 && (
              <div className='grid gap-1'>
                <p className='text-xs text-gray-400 font-medium'>
                  Previously sent to:
                </p>
                <div className='flex flex-wrap gap-1'>
                  {recentSchools.map((s) => (
                    <button
                      key={s.email}
                      type='button'
                      onClick={() => {
                        setSchoolName(s.name);
                        setSchoolEmail(s.email);
                      }}
                      disabled={isLoading}
                      className='rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-xs text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-green-900 transition-colors disabled:opacity-50'
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className='grid gap-2'>
              <Label htmlFor='school-name'>Institution Name</Label>
              <Input
                id='school-name'
                placeholder='e.g. Harvard Medical School'
                className='rounded-xl'
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='school-email'>Admissions Email</Label>
              <Input
                id='school-email'
                type='email'
                placeholder='admissions@harvard.edu'
                className='rounded-xl'
                value={schoolEmail}
                onChange={(e) => setSchoolEmail(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isValid) void handleProceedToPayment();
                }}
              />
            </div>

            {error && (
              <p className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700'>
                ❌ {error}
              </p>
            )}

            <div className='rounded-lg bg-slate-50 p-3 text-xs text-gray-500'>
              <span className='font-bold text-green-900'>
                $5.00 per delivery.
              </span>{" "}
              After payment, your professor approves the release. Once
              approved, the school receives a secure 48-hour link.
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              className='w-full rounded-xl bg-green-900 hover:bg-[#093820] disabled:opacity-60'
              disabled={!isValid || isLoading}
              onClick={() => void handleProceedToPayment()}
            >
              {isLoading ? "Preparing payment…" : "Pay & Send ($5.00)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent className='sm:max-w-[520px] rounded-2xl'>
          <DialogHeader>
            <DialogTitle className='font-serif text-green-900'>
              Complete Payment
            </DialogTitle>
            <DialogDescription>
              Paying to deliver your letter to{" "}
              <span className='font-medium text-gray-700'>{schoolName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className='py-2'>
            {clientSecret && (
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>

          <div className='pt-1'>
            <button
              type='button'
              className='text-xs text-gray-400 hover:text-gray-600 underline'
              onClick={() => {
                setStep("details");
                setClientSecret(null);
              }}
            >
              ← Back to school details
            </button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
