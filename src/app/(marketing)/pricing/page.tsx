import { LinkButton } from "@/components/ui/LinkButton";
import {
  Check,
  ShieldCheck,
  Lock,
  Clock3,
  Star,
  Users,
  GraduationCap,
} from "lucide-react";

type Tier = {
  name: string;
  price: string;
  caption: string;
  badge?: string;
  accent?: "gold" | "light";
  ctaLabel: string;
  ctaHref: string;
  features: string[];
  footnote?: string;
};

export default function PricingPage() {
  const tiers: Tier[] = [
    {
      name: "Student — Free",
      price: "$0",
      caption: "Start requesting and tracking letters immediately.",
      badge: "Most popular",
      accent: "gold",
      ctaLabel: "Start as a Student →",
      ctaHref: "/signup?role=student",
      features: [
        "Create and send structured requests",
        "Deadline + status tracking",
        "Secure document access controls",
        "Central request history (so you’re not starting from scratch)",
        "Privacy-first design (consent-based sharing)",
      ],
      footnote: "No credit card required.",
    },
    {
      name: "Faculty — Always Free",
      price: "$0",
      caption: "Because faculty shouldn’t pay to help students.",
      accent: "light",
      ctaLabel: "Join as Faculty →",
      ctaHref: "/signup?role=faculty",
      features: [
        "Centralized request inbox",
        "Draft/upload letters in one place",
        "Approval & consent controls",
        "Deadline visibility (reduce reminder loops)",
        "Secure archive (no more lost drafts)",
      ],
      footnote: "Free forever for faculty.",
    },
    {
      name: "Teams / Institutions",
      price: "Coming soon",
      caption: "For departments and schools that need verification + compliance.",
      accent: "light",
      ctaLabel: "Contact Sales",
      ctaHref: "/contact",
      features: [
        "Identity verification workflows",
        "Audit logs & compliance controls",
        "Institution-level policy settings",
        "Fraud detection & integrity safeguards",
        "Admin dashboard & analytics",
      ],
      footnote: "Early access available — reach out.",
    },
  ];

  return (
    <main className="bg-[#fbfbf8]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0b1553]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_55%)]" />
        <div className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(rgba(255,255,255,0.35)_1px,transparent_1px)] bg-size-[44px_44px]" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-20 text-center">
          <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 border border-white/15">
            Pricing
          </div>

          <h1 className="mt-6 font-serif text-4xl md:text-5xl font-semibold tracking-tight text-white">
            Simple pricing that respects{" "}
            <span className="italic text-amber-400">trust</span>.
          </h1>

          <p className="mt-5 mx-auto max-w-3xl text-sm md:text-base leading-relaxed text-white/70">
            Students can start free. Faculty are always free. Institutional plans are
            coming soon for compliance and verification needs.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <LinkButton
              href="/signup?role=student"
              variant="gold"
              size="lg"
              className="rounded-xl min-w-56 justify-center"
            >
              Start for Free →
            </LinkButton>

            <LinkButton
              href="/contact"
              variant="secondary"
              size="lg"
              className="rounded-xl min-w-56 justify-center bg-white/10 text-white hover:bg-white/15 border border-white/20"
            >
              Questions? Contact us
            </LinkButton>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-white/60">
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-300" />
              Encryption by design
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              Consent-based access
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-300" />
              Deadline tracking
            </span>
          </div>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <TierCard key={t.name} tier={t} />
          ))}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="bg-white/40 border-y border-black/5">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="text-center">
            <div className="inline-flex items-center rounded-full bg-[#e9e9ef] px-4 py-2 text-xs font-semibold text-[#101c5a]">
              Quick comparison
            </div>
            <h2 className="mt-6 font-serif text-3xl md:text-4xl font-semibold text-[#0a154a]">
              What you get at a glance
            </h2>
            <p className="mt-4 mx-auto max-w-3xl text-sm md:text-base leading-relaxed text-[#56608b]">
              We keep the essentials free so students and faculty can adopt the platform
              without friction.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="grid grid-cols-4 bg-[#fbfbf8] border-b border-black/5 text-sm font-semibold text-[#0a154a]">
              <div className="px-6 py-4">Feature</div>
              <div className="px-6 py-4">Student</div>
              <div className="px-6 py-4">Faculty</div>
              <div className="px-6 py-4">Institution</div>
            </div>

            <CompareRow feature="Structured requests + deadlines" a b c />
            <CompareRow feature="Status tracking" a b c />
            <CompareRow feature="Secure storage + encryption" a b c />
            <CompareRow feature="Consent-based sharing controls" a b c />
            <CompareRow feature="Faculty request inbox" a={false} b c />
            <CompareRow feature="Institution verification + audit logs" a={false} b={false} c />
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <LinkButton
              href="/signup?role=student"
              variant="gold"
              size="lg"
              className="rounded-xl min-w-56 justify-center"
            >
              Start as a Student →
            </LinkButton>
            <LinkButton
              href="/signup?role=faculty"
              variant="secondary"
              size="lg"
              className="rounded-xl min-w-56 justify-center"
            >
              Join as Faculty
            </LinkButton>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="text-center">
          <div className="inline-flex items-center rounded-full bg-[#e9e9ef] px-4 py-2 text-xs font-semibold text-[#101c5a]">
            FAQ
          </div>
          <h2 className="mt-6 font-serif text-3xl md:text-4xl font-semibold text-[#0a154a]">
            Common questions
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <FaqCard
            q="Why is faculty always free?"
            a="Faculty already donate their time and expertise. ReadMyStudent is built to reduce workload, not add a paywall."
          />
          <FaqCard
            q="Do students get access to letters?"
            a="Letters remain confidential by default. Sharing is consent-based and designed to preserve integrity and trust."
          />
          <FaqCard
            q="When will institutional plans launch?"
            a="Soon. If you’re a department or school interested in verification + compliance workflows, contact us for early access."
          />
          <FaqCard
            q="Is my data secure?"
            a="We design for encryption, access control, and consent-based sharing. Sensitive academic documents deserve strong defaults."
          />
        </div>
      </section>
    </main>
  );
}

/* ---------------- Components ---------------- */

function TierCard({ tier }: { tier: Tier }) {
  const isGold = tier.accent === "gold";

  const shell = [
    "relative rounded-3xl border bg-white px-8 py-8",
    "shadow-[0_10px_30px_rgba(15,23,42,0.04)]",
    "transition-colors duration-300",
    "hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-[0_18px_45px_rgba(245,197,66,0.20)]",
    isGold ? "border-amber-200" : "border-black/10",
  ].join(" ");

  return (
    <div className={shell}>
      {tier.badge ? (
        <div className="absolute -top-3 left-6 inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-[#0b1553] shadow-sm">
          <Star className="h-3.5 w-3.5" />
          {tier.badge}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-serif text-2xl font-semibold text-[#0a154a]">
            {tier.name}
          </div>
          <div className="mt-1 text-sm text-[#56608b]">{tier.caption}</div>
        </div>

        <div className="text-right">
          <div className="font-serif text-3xl font-semibold text-[#0a154a]">
            {tier.price}
          </div>
        </div>
      </div>

      <div className="mt-6 h-px bg-black/5" />

      <ul className="mt-6 space-y-3 text-sm text-[#56608b]">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span className="mt-0.5 text-amber-500">
              <Check className="h-4 w-4" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <LinkButton
          href={tier.ctaHref}
          variant={isGold ? "gold" : "secondary"}
          size="lg"
          className={[
            "rounded-xl w-full justify-center",
            isGold ? "" : "bg-[#0b1553] text-white hover:opacity-90",
          ].join(" ")}
        >
          {tier.ctaLabel}
        </LinkButton>
      </div>

      {tier.footnote ? (
        <div className="mt-4 text-xs font-semibold text-[#7b84a7]">
          {tier.footnote}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-6 bottom-6 opacity-[0.10] text-[#0b1553]">
        {tier.name.includes("Student") ? (
          <GraduationCap className="h-16 w-16" />
        ) : tier.name.includes("Faculty") ? (
          <Users className="h-16 w-16" />
        ) : (
          <ShieldCheck className="h-16 w-16" />
        )}
      </div>
    </div>
  );
}

/** ✅ Moved OUTSIDE CompareRow to avoid "created during render" */
function CompareCell({ ok }: { ok?: boolean }) {
  return (
    <div className="px-6 py-4 text-sm text-[#56608b]">
      {ok ? (
        <span className="inline-flex items-center gap-2 font-semibold text-[#0a154a]">
          <span className="text-amber-500">
            <Check className="h-4 w-4" />
          </span>
          Included
        </span>
      ) : (
        <span className="text-[#9aa3c2]">—</span>
      )}
    </div>
  );
}

function CompareRow({
  feature,
  a,
  b,
  c,
}: {
  feature: string;
  a?: boolean;
  b?: boolean;
  c?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 border-t border-black/5">
      <div className="px-6 py-4 text-sm font-semibold text-[#0a154a]">
        {feature}
      </div>
      <CompareCell ok={a} />
      <CompareCell ok={b} />
      <CompareCell ok={c} />
    </div>
  );
}

function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white px-8 py-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-colors duration-300 hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-[0_18px_45px_rgba(245,197,66,0.20)]">
      <div className="font-serif text-xl font-semibold text-[#0a154a]">{q}</div>
      <p className="mt-3 text-sm leading-relaxed text-[#56608b]">{a}</p>
    </div>
  );
}
