"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkButton } from "../ui/LinkButton";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "How it Works", href: "/how-it-works" },
  { label: "For Students", href: "/for-students" },
  { label: "For Faculty", href: "/for-faculty" },
  { label: "Pricing", href: "/pricing" },
];

export default function MobileNavDrawer() {
  const pathname = usePathname(); // used for active styling only
  const [open, setOpen] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Mobile-only: menu button */}
      <div className="xl:hidden fixed left-4 top-4 z-60">
        {!open && (<button
          onClick={() => setOpen(true)}
          className="rounded-2xl bg-[#0b4726] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          aria-label="Open menu"
        >
          Menu
        </button>)}
      </div>

      {/* Overlay */}
      <div
        className={[
          "xl:hidden fixed inset-0 z-50 transition",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!open}
      >
        {/* Dimmed background */}
        <div
          onClick={() => setOpen(false)}
          className={[
            "absolute inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        {/* Drawer panel */}
        <aside
          className={[
            "absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white/90 backdrop-blur",
            "border-l border-black/10 shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full flex-col p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-[#0b4726]">Menu</div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-black/70 hover:bg-black/5"
                aria-label="Close menu"
              >
                Close
              </button>
            </div>

            {/* Links */}
            <nav className="mt-4 flex flex-col gap-2 text-sm font-semibold text-[#247037]">
              {navLinks.map((l) => {
                const isActive = pathname === l.href;

                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "rounded-xl px-3 py-3 transition",
                      "hover:bg-black/10 hover:text-[#0b4726]",
                      isActive ? "bg-black/10 text-[#0b4726]" : "",
                    ].join(" ")}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            {/* CTA buttons */}
            <div className="mt-auto pt-6 flex flex-col gap-3">
              <LinkButton
                href="/signup"
                variant="green"
                size="md"
                className="rounded-xl px-6 hover:opacity-95 w-full justify-center"
                onClick={() => setOpen(false)}
              >
                Sign In
              </LinkButton>

              <LinkButton
                href="/signup"
                variant="gold"
                size="md"
                className="rounded-xl px-6 hover:opacity-95 w-full justify-center"
                onClick={() => setOpen(false)}
              >
                Get Started
              </LinkButton>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
