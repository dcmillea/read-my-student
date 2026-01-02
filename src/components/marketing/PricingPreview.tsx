import React from "react";
import {
  Sparkles,
  Crown,
  Building2,
  Briefcase,
  Check,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { LinkButton } from "../ui/LinkButton";
import FeaturedRunningOutline from "../ui/FeatureRunningOutline";

type Plan = {
  tag: string;
  tagTone: "neutral" | "gold";
  icon: React.ReactNode;
  name: string;
  description: string;
  price: string;
  priceSuffix?: string;
  bullets: string[];
  // eslint-disable-next-line
  cta: { label: string; href: string; variant?: any };
  featured?: boolean;
};

export default function PricingSection() {
  const studentPlans: Plan[] = [
    {
      tag: "Free to start",
      tagTone: "neutral",
      icon: <Sparkles className="h-5 w-5" />,
      name: "Free Tier",
      description: "Create an account and send your first requests at no cost.",
      price: "$0",
      bullets: [
        "Free signup for everyone",
        "First 3 recommendation links included",
        "Each link is single-use and expires after submission",
        "Consent-based sharing (student controls access)",
        "Audit trail for when links are accessed",
      ],
      cta: { label: "Start Free", href: "/signup?role=student" },
    },
    {
      tag: "Flexible & simple",
      tagTone: "neutral",
      icon: <Link2 className="h-5 w-5" />,
      name: "Pay-As-You-Go",
      description: "Only pay when you need more application submissions.",
      price: "$5",
      priceSuffix: "/ link",
      bullets: [
        "Starts after your first 3 free links",
        "Every link is fresh, unique, and single-use",
        "Once submitted → link expires automatically",
        "Stops link sharing and unauthorized reuse",
        "Perfect for small application cycles",
      ],
      cta: { label: "Buy Links", href: "/signup?role=student" },
    },
    {
      tag: "Best value for heavy applications",
      tagTone: "gold",
      icon: <Crown className="h-5 w-5" />,
      name: "Application Sprint",
      description:
        "Premium plan for application season — built to be abuse-resistant and admissions-grade.",
      price: "$399",
      priceSuffix: "/ month",
      bullets: [
        "Up to 100 single-use recommendation links",
        "Ends when 100 links are generated OR 30 days pass",
        "Every submission burns one link credit (no replays)",
        "No forwarding, reuse, or duplicate submissions",
        "Best for grad, med, law, PhD, or multi-school cycles",
      ],
      cta: {
        label: "Start Sprint",
        href: "/signup?role=student&plan=sprint",
      },
      featured: true,
    },
  ];

  const viewerPlans: Plan[] = [
    {
      tag: "For verified institutions",
      tagTone: "neutral",
      icon: <Building2 className="h-5 w-5" />,
      name: "University Access",
      description:
        "Secure, read-only access to student-approved recommendation letters.",
      price: "Free",
      bullets: [
        "Free access for verified university domains",
        "View only after student consent",
        "No PDFs or email attachments",
        "Audit trail for access events",
        "Simple, frictionless viewer UI",
      ],
      cta: { label: "Verify University Email", href: "/signup?role=university" },
    },
    {
      tag: "For recruiters & hiring managers",
      tagTone: "neutral",
      icon: <Briefcase className="h-5 w-5" />,
      name: "Employer Access",
      description: "Fast, secure preview of student-approved recommendations.",
      price: "Free",
      bullets: [
        "Free access for verified company emails",
        "Secure links shared by candidates",
        "Minimal data retention",
        "Compliance-friendly audit trail",
        "Instant viewer UI",
      ],
      cta: { label: "Verify Work Email", href: "/signup?role=employer" },
    },
  ];

  return (
    <section id="pricing" className="bg-[#fbfbf8]">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        {/* Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-[#0a2e1c]">
            Simple Pricing for{" "}
            <span className="italic text-amber-500">Single-Use</span>{" "}
            Recommendation Links
          </h2>

          <p className="mt-4 text-[#5f7f6f]">
            Start free. Pay per link when needed. Sprint when applying everywhere.
          </p>

          {/* Core rule */}
          <div className="mt-6 rounded-2xl border border-[#0b4726]/15 bg-[#eaf3ee] px-5 py-4 text-left">
            <div className="flex gap-3">
              <span className="h-9 w-9 rounded-xl bg-[#0b4726]/10 grid place-items-center text-[#0b4726]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold text-[#0a2e1c] text-sm">
                  Core Rule: every recommendation requires a new one-time-use link
                </div>
                <div className="text-sm text-[#5f7f6f] mt-1">
                  Links expire immediately after submission — no reuse, no
                  forwarding, no ambiguity.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student plans */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {studentPlans.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>

        {/* Viewer plans */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
          {viewerPlans.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isFeatured = !!plan.featured;

  if (isFeatured) {
    return (
      <div className="relative">
        {/* BORDER ZONE LAYER (behind the panel) */}
        <div className="absolute -inset-[3px] rounded-2xl overflow-hidden">
          <FeaturedRunningOutline />
        </div>

        {/* INNER PANEL (content) */}
        <div className="relative z-10 rounded-2xl bg-[#0b4726] text-white px-7 py-8 flex flex-col shadow-xl">
          <div className="text-xs font-bold mb-4 text-amber-300">{plan.tag}</div>

          <div className="h-12 w-12 rounded-2xl grid place-items-center bg-white/10 text-amber-200 mb-4">
            {plan.icon}
          </div>

          <div className="font-serif text-xl font-semibold">{plan.name}</div>
          <p className="mt-2 text-sm text-white/80">{plan.description}</p>

          <div className="mt-6 font-serif text-3xl font-semibold">
            {plan.price}
            {plan.priceSuffix && (
              <span className="text-sm ml-1 text-white/70">{plan.priceSuffix}</span>
            )}
          </div>

          <ul className="mt-6 space-y-3 text-sm text-white/90">
            {plan.bullets.map((b) => (
              <li key={b} className="flex gap-3">
                <Check className="h-4 w-4 text-amber-300 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <LinkButton
              href={plan.cta.href}
              variant="gold"
              className="w-full justify-center rounded-xl bg-amber-500 text-[#0b4726] hover:bg-amber-400"
            >
              {plan.cta.label}
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  // non-featured stays simple
  return (
    <div className="rounded-2xl bg-white border border-[#0b4726]/10 px-7 py-8 flex flex-col transition-all duration-300 hover:scale-[1.02]">
      <div className="text-xs font-bold mb-4 text-[#0b4726]">{plan.tag}</div>

      <div className="h-12 w-12 rounded-2xl grid place-items-center bg-[#eaf3ee] text-[#0b4726] mb-4">
        {plan.icon}
      </div>

      <div className="font-serif text-xl font-semibold text-[#0a2e1c]">{plan.name}</div>
      <p className="mt-2 text-sm text-[#5f7f6f]">{plan.description}</p>

      <div className="mt-6 font-serif text-3xl font-semibold text-[#0b4726]">
        {plan.price}
        {plan.priceSuffix && (
          <span className="text-sm ml-1 font-semibold text-[#5f7f6f]">{plan.priceSuffix}</span>
        )}
      </div>

      <ul className="mt-6 space-y-3 text-sm text-[#5f7f6f]">
        {plan.bullets.map((b) => (
          <li key={b} className="flex gap-3">
            <Check className="h-4 w-4 text-amber-500 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <LinkButton
          href={plan.cta.href}
          variant="primary"
          className="w-full justify-center rounded-xl bg-[#0b4726] text-white hover:opacity-95"
        >
          {plan.cta.label}
        </LinkButton>
      </div>
    </div>
  );
}
