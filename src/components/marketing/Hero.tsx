"use client";

import { LinkButton } from "../ui/LinkButton";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0b5315]">
      {/* Soft gradient + texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_55%)]" />
      <div className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(rgba(255,255,255,0.35)_1px,transparent_1px)] bg-size-[32px_32px]" />

      {/* Subtle bottom shadow band */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-black/20 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-10 sm:py-16 md:py-40">
        {/* Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            The Trusted Platform for Academic Recommendations
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-6 sm:mt-10 text-center font-serif font-semibold tracking-tight text-white text-3xl sm:text-4xl md:text-7xl">
          Secure, Respectful{" "}
          <span className="block">
            <span className="italic text-amber-400">Recommendation</span>
          </span>
          <span className="block italic text-amber-400">Letters</span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-center text-base md:text-lg text-white/70 leading-relaxed">
          A warm, trustworthy platform where students request and share recommendation letters,
          and faculty write and manage them—all with consent-based access and bank-grade encryption.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <LinkButton
            href="/signup?role=student"
            variant="gold"
            size="lg"
            className="min-w-56 justify-center rounded-xl"
          >
            I&apos;m a Student
          </LinkButton>

          <LinkButton
            href="/signup?role=faculty"
            variant="secondary"
            size="lg"
            className="min-w-56 justify-center rounded-xl bg-white/10 text-white hover:bg-white/15 border border-white/20"
          >
            I&apos;m a Faculty
          </LinkButton>
        </div>

        <TrustMarquee />
      </div>
    </section>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 whitespace-nowrap">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/15">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      </span>
      {label}
    </div>
  );
}

import { useLayoutEffect, useMemo, useRef, useState } from "react";

function TrustMarquee() {
  const items = useMemo(
    () => [
      "Data Encrypted",
      "Access Controlled",
      "Consent Built-in",
      "FERPA-aware Design",
      "Audit Trails",
      "Role-Based Access",
      "Secure Sharing Links",
      "Faculty-Friendly Workflow",
      "Student-Owned Requests",
      "Private by Default",
      "Verification Codes",
      "Encryption at Rest",
    ],
    []
  );

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  // Measure after layout so widths are correct
  useLayoutEffect(() => {
    function measure() {
      const el = trackRef.current;
      if (!el) return;

      // The track contains two identical groups.
      // We want to move exactly the width of the first group = half total scrollWidth.
      const total = el.scrollWidth;
      const half = total / 2;

      el.style.setProperty("--marquee-distance", `${half}px`);

      // Duration proportional to distance -> consistent speed across screen sizes
      // tweak 60 to change speed (pixels/sec)
      const pxPerSecond = 60;
      const duration = Math.max(12, Math.round(half / pxPerSecond));
      el.style.setProperty("--marquee-duration", `${duration}s`);

      setReady(true);
    }

    measure();

    // Re-measure on resize
    const ro = new ResizeObserver(() => measure());
    if (trackRef.current) ro.observe(trackRef.current);

    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="mt-12 overflow-hidden">
      <div className="relative">
        {/* fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-[#0b5315] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-[#0b5315] to-transparent z-10" />

        <div
          ref={trackRef}
          className={`marquee-track pointer-events-none select-none ${ready ? "opacity-100" : "opacity-0"}`}
        >
          {/* group A */}
          <div className="flex items-center gap-3 pr-3">
            {items.map((label, i) => (
              <Chip key={`a-${i}`} label={label} />
            ))}
          </div>

          {/* group B (duplicate for seamless loop) */}
          <div className="flex items-center gap-3 pr-3">
            {items.map((label, i) => (
              <Chip key={`b-${i}`} label={label} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
