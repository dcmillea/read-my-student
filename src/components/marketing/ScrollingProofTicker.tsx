"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: string; text: string };

function CheckIcon({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "h-5 w-5 rounded-full",
        "transition-all duration-700 ease-out",
        active
          ? "bg-[#0b5315] scale-100 opacity-100"
          : "bg-transparent scale-75 opacity-0",
      ].join(" ")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white">
        <path
          fill="currentColor"
          d="M9.0 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
        />
      </svg>
    </span>
  );
}

// ✅ Amber bullet inside a soft white/gray ring
function BulletIcon({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "h-5 w-5 rounded-full",
        "transition-all duration-300",
        active
          ? "scale-75 opacity-0"
          : "scale-100 opacity-100 border border-black/20 bg-white/70",
      ].join(" ")}
      aria-hidden="true"
    >
      <span
        className={[
          "block h-2.5 w-2.5 rounded-full",
          "transition-all duration-300",
          active ? "opacity-0 scale-75" : "opacity-100 scale-100 bg-amber-400",
        ].join(" ")}
      />
    </span>
  );
}

export default function ScrollingProofTicker({
  items,
  speedSeconds = 28,
  centerZonePx = 80,
}: {
  items: Item[];
  speedSeconds?: number;
  centerZonePx?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);

  // ✅ Sticky activation per duplicated instance
  const [activated, setActivated] = useState<Set<string>>(new Set());

  // Duplicate list so the marquee loops seamlessly
  const doubled = useMemo(() => [...items, ...items], [items]);

  // ✅ Set marquee distance based on actual rendered width (half of doubled content)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const setDistance = () => {
      const halfWidth = track.scrollWidth / 2;
      track.style.setProperty("--marquee-distance", `${halfWidth}px`);
    };

    setDistance();

    // Recompute on resize (responsive fonts, etc.)
    const onResize = () => setDistance();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [doubled]);

  // ✅ Sticky activate when passing center; reset when fully exits left
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;

    const loop = () => {
      const cRect = container.getBoundingClientRect();
      const centerX = cRect.left + cRect.width / 2;

      const toActivate: string[] = [];
      const toReset: string[] = [];

      for (let i = 0; i < doubled.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;

        const r = el.getBoundingClientRect();
        const key = `${doubled[i].id}:${i}`;
        const itemCenterX = r.left + r.width / 2;

        // Activate when in center zone (sticky)
        if (Math.abs(itemCenterX - centerX) <= centerZonePx) {
          toActivate.push(key);
        }

        // Reset only after fully leaving the container to the left
        if (r.right < cRect.left - 20) {
          toReset.push(key);
        }
      }

      if (toActivate.length || toReset.length) {
        setActivated((prev) => {
          let changed = false;
          const next = new Set(prev);

          for (const k of toReset) {
            if (next.delete(k)) changed = true;
          }
          for (const k of toActivate) {
            if (!next.has(k)) {
              next.add(k);
              changed = true;
            }
          }

          return changed ? next : prev;
        });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [doubled, centerZonePx]);

  return (
    <div className="relative">
      {/* Center highlight zone (optional subtle) */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[220px] rounded-2xl bg-white/20 blur-[0.5px]" />

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/30 backdrop-blur px-4 py-3"
      >
        {/* Track uses your global CSS: .marquee-track + CSS vars */}
        <div
          ref={trackRef}
          className="marquee-track items-center gap-10"
          style={
            {// eslint-disable-next-line
              ["--marquee-duration" as any]: `${speedSeconds}s`,
            } as React.CSSProperties
          }
        >
          {doubled.map((it, i) => {
            const key = `${it.id}:${i}`;
            const isActive = activated.has(key);

            return (
              <span
                key={key}
                ref={(node) => {
                  itemRefs.current[i] = node;
                }}
                className="inline-flex items-center gap-3 whitespace-nowrap text-sm md:text-base font-semibold text-[#0b4726]"
              >
                <span className="relative inline-flex items-center justify-center w-5">
                  <BulletIcon active={isActive} />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <CheckIcon active={isActive} />
                  </span>
                </span>

                <span className="opacity-90">{it.text}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
