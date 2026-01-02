import React, { useId } from "react";

export default function FeaturedRunningOutline() {
  const gid = useId();

  const d =
    "M 18 2 H 82 Q 98 2 98 18 V 82 Q 98 98 82 98 H 18 Q 2 98 2 82 V 18 Q 2 2 18 2 Z";

  return (
    <svg
      className="featured-outline"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Gold → pale gold → light green → gold */}
        <linearGradient id={`${gid}-run`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="34%" stopColor="#fde68a" />
          <stop offset="66%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* faint base border */}
      <path
        d={d}
        fill="none"
        stroke="rgba(245,158,11,0.22)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        pathLength={1000}
      />

      {/* soft glow runner */}
      <path
        className="glow"
        d={d}
        fill="none"
        stroke={`url(#${gid}-run)`}
        strokeWidth="7"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1000}
      />

      {/* main runner */}
      <path
        className="runner"
        d={d}
        fill="none"
        stroke={`url(#${gid}-run)`}
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1000}
      />

      {/* second runner for “Google-ish” continuity */}
      <path
        className="runner2"
        d={d}
        fill="none"
        stroke={`url(#${gid}-run)`}
        strokeWidth="2.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1000}
      />
    </svg>
  );
}
