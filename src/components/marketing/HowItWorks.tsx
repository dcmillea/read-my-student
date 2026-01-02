"use client";

import { useMemo, useState } from "react";
import {
  Mail,
  Send,
  Clock3,
  Share2,
  GraduationCap,
  FileText,
  ShieldCheck,
  Link2,
} from "lucide-react";

type Audience = "students" | "faculty";

type Step = {
  title: string;
  body: string;
  icon: React.ReactNode;
};

export default function HowItWorks() {
  const [audience, setAudience] = useState<Audience>("students");

  const stepsByAudience = useMemo<Record<Audience, Step[]>>(
    () => ({
      students: [
        {
          title: "Sign Up & Verify",
          body: "Create your account using your academic email (.edu, .ac.uk, etc.). Verify your email and build your profile.",
          icon: <Mail className="h-6 w-6" />,
        },
        {
          title: "Request Recommendations",
          body: "Add faculty by email, specify the purpose (job, MS, PhD, scholarship), target organization, and deadline.",
          icon: <Send className="h-6 w-6" />,
        },
        {
          title: "Track Your Requests",
          body: "See the status of each request (Requested, In Progress, Completed) on your dashboard.",
          icon: <Clock3 className="h-6 w-6" />,
        },
        {
          title: "Share with Consent",
          body: "Generate secure links with optional expiration dates and view limits. Track where each letter has been shared.",
          icon: <Share2 className="h-6 w-6" />,
        },
      ],
      faculty: [
        {
          title: "Create Faculty Profile",
          body: "Sign up with your institutional email, verify your identity, and set your default letter preferences.",
          icon: <GraduationCap className="h-6 w-6" />,
        },
        {
          title: "Receive Structured Requests",
          body: "Students provide context, deadlines, and targets so you can write faster with fewer back-and-forth emails.",
          icon: <FileText className="h-6 w-6" />,
        },
        {
          title: "Write & Manage Securely",
          body: "Draft, upload, and store letters with encrypted access controls—keeping sensitive content protected.",
          icon: <ShieldCheck className="h-6 w-6" />,
        },
        {
          title: "Approve Sharing with Control",
          body: "Consent-based sharing links, optional expirations, and audit visibility—so you stay in control.",
          icon: <Link2 className="h-6 w-6" />,
        },
      ],
    }),
    []
  );

  const steps = stepsByAudience[audience];

  return (
    <section className="bg-[#fbfbf8]">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        {/* Top badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center rounded-full bg-[#e9e9ef] px-4 py-2 text-xs font-semibold text-[#247037]">
            How It Works
          </span>
        </div>

        {/* Title + subtitle */}
        <div className="mx-auto mt-6 max-w-3xl text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-[#0b4726]">
            Simple Steps for{" "}
            <span className="italic text-amber-500">Everyone</span>
          </h2>
          <p className="mt-4 text-sm md:text-base leading-relaxed text-[#0b4726]">
            Whether you&apos;re a student building your academic portfolio or faculty managing
            recommendations, we&apos;ve made the process warm, trustworthy, and professional.
          </p>
        </div>

        {/* Audience toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-xl bg-[#f1f0ea] p-1 shadow-sm border border-black/5">
            <ToggleButton
              active={audience === "students"}
              onClick={() => setAudience("students")}
              label="For Students"
              icon={<GraduationCap className="h-4 w-4" />}
            />
            <ToggleButton
              active={audience === "faculty"}
              onClick={() => setAudience("faculty")}
              label="For Faculty"
              icon={<ShieldCheck className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Cards */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <StepCard key={s.title} stepNumber={i + 1} title={s.title} body={s.body} icon={s.icon} />
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <span className="h-px w-24 bg-amber-400/50" />
          <span className="text-xs font-semibold text-amber-500">Automated &amp; Secure</span>
          <span className="h-px w-24 bg-amber-400/50" />
        </div>
      </div>
    </section>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition cursor-pointer",
        active
          ? "bg-[#0b4726] text-white shadow"
          : "text-[#0b4726] hover:text-[#0b1553]",
      ].join(" ")}
    >
      <span className={active ? "text-white" : "text-[#0b4726]"}>{icon}</span>
      {label}
    </button>
  );
}

function StepCard({
  stepNumber,
  title,
  body,
  icon,
}: {
  stepNumber: number;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  const cardClassName = [
    "group relative rounded-2xl border border-black/10 bg-white px-6 py-7",
    "transition-all duration-300 ease-out",
    "hover:border-amber-400",
    "hover:shadow-[0_20px_50px_rgba(245,197,66,0.25)]",
    "motion-reduce:transition-none",
  ].join(" ");

  const bubbleClassName = [
    "h-8 w-8 rounded-full bg-amber-400 text-[#0b1553]",
    "text-xs font-extrabold grid place-items-center shadow-sm",
    "transition-transform duration-300",
  ].join(" ");

  const iconTileClassName = [
    "h-14 w-14 rounded-2xl bg-[#0b4726] text-amber-400",
    "grid place-items-center shadow-inner border border-black/5",
    "transition-colors duration-300 group-hover:bg-amber-50",
  ].join(" ");

  return (
    <div className={cardClassName}>
      {/* number bubble */}
      <div className="absolute -top-3 right-6">
        <div className={bubbleClassName}>{stepNumber}</div>
      </div>

      {/* icon tile */}
      <div className={iconTileClassName}>{icon}</div>

      <h3 className="mt-6 font-serif text-xl font-semibold text-[#0b4726]">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-relaxed text-[#0b4726]">{body}</p>
    </div>
  );
}