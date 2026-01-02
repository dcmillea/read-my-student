"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkButton } from "../ui/LinkButton";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "How it Works", href: "/how-it-works" },
  { label: "For Students", href: "/for-students" },
  { label: "For Faculty", href: "/for-faculty" },
  { label: "Pricing", href: "/pricing" },
];

const BANNER_H = 220;
const SIDENAV_W = 260;
const NAV_INSET_Y = 48;

export default function SideNavbar() {
  const pathname = usePathname();

  return (
    <aside
      className={[
        "hidden xl:flex fixed left-6 z-40",
        "rounded-3xl border border-black/10",
        "bg-white/70 backdrop-blur",
        "shadow-xl shadow-black/10",
      ].join(" ")}
      style={{
        top: BANNER_H + NAV_INSET_Y,
        width: SIDENAV_W,
        height: `calc(100vh - ${BANNER_H + NAV_INSET_Y * 2}px)`,
      }}
    >
      <div className="flex h-full w-full flex-col p-6">
        {/* Top label */}
        <div className="mb-4">
          <div className="text-xs font-semibold tracking-wide text-black/50">
            NAVIGATION
          </div>
          <div className="mt-1 text-sm font-semibold text-[#0b4726]">
            ReadMyStudent
          </div>
        </div>

        <div className="h-px bg-black/10 mb-4" />

        {/* Nav links */}
        <nav className="flex flex-col gap-1">
          {navLinks.map((l) => {
            const isActive = pathname === l.href;

            return (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  "group relative flex items-center",
                  "rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-[#0b4726]/10 text-[#0b4726]"
                    : "text-[#247037] hover:bg-black/10 hover:text-[#0b4726]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute left-2 top-1/2 -translate-y-1/2",
                    "h-5 w-1 rounded-full bg-[#0b4726]",
                    isActive ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                />
                <span className="pl-3">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom CTA section */}
        <div className="mt-auto pt-6">
          <div className="h-px bg-black/10 mb-4" />

          <div className="text-xs font-semibold tracking-wide text-black/50 mb-3">
            ACCOUNT
          </div>

          <div className="flex flex-col gap-3">
            <LinkButton
              href="/signup"
              variant="green"
              size="md"
              className="rounded-2xl px-6 w-full justify-center shadow-sm shadow-black/10 hover:shadow-md transition"
            >
              Sign In
            </LinkButton>

            <LinkButton
              href="/signup"
              variant="gold"
              size="md"
              className="rounded-2xl px-6 w-full justify-center shadow-sm shadow-black/10 hover:shadow-md transition"
            >
              Get Started
            </LinkButton>

            <div className="pt-2 text-xs text-black/45 leading-snug">
              Built for faculty speed and student clarity.
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
