"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { LinkButton } from "../ui/LinkButton";
import LogoOfficial from "../../../public/image (1)-Picsart-BackgroundRemover.png";

const navLinks = [
  { label: "How it Works", href: "/how-it-works" },
  { label: "For Students", href: "/for-students" },
  { label: "For Faculty", href: "/for-faculty" },
  { label: "Pricing", href: "/pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#d9dbe3]">
      <div className="w-full mx-auto flex justify-center items-center lg:block"> { /* max-w-7xl mx-auto px-6 */}
        <div className="h-40 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-3 pt-2">
            <Image
              src={LogoOfficial}
              alt="ReadMyStudent logo"
              width={450}
              height={400}
              priority
            />
            {/* <span className={`${satisfy.className} text-3xl font-semibold scale-x-[1.16] text-[#0b1553]`}>
              ReadMyStudent
            </span> */}
          </Link>

          {/* Center: Nav links */}
          {/* <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#5a6487]">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-[#0b1553] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav> */}

          {/* Right: Actions */}
          {/* <div className="hidden md:flex items-center gap-6">
            <Link
              href="/signin"
              className="text-sm font-semibold text-[#0b1553]/80 hover:text-[#0b1553] transition-colors"
            >
              Sign In
            </Link>

            <LinkButton
              href="/signup"
              variant="primary"
              size="md"
              className="rounded-xl px-6 bg-[#0b1553] hover:opacity-95"
            >
              Get Started
            </LinkButton>
          </div> */}

          {/* Mobile menu button */}
          {/* <button
            type="button"
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl border border-black/10 bg-white/40 text-[#0b1553]"
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
          >
            <div className="flex flex-col gap-1.5">
              <span className="h-0.5 w-5 bg-[#0b1553]" />
              <span className="h-0.5 w-5 bg-[#0b1553]" />
              <span className="h-0.5 w-5 bg-[#0b1553]" />
            </div>
          </button> */}
        </div>

        {/* Mobile dropdown */}
        {/* {open ? (
          <div className="md:hidden pb-5">
            <div className="mt-2 rounded-2xl bg-white/50 border border-black/10 backdrop-blur px-4 py-4">
              <nav className="flex flex-col gap-3 text-sm font-semibold text-[#5a6487]">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="py-2 hover:text-[#0b1553] transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-4 flex items-center gap-3">
                <Link
                  href="/signin"
                  onClick={() => setOpen(false)}
                  className="text-sm font-semibold text-[#0b1553]/80 hover:text-[#0b1553] transition-colors"
                >
                  Sign In
                </Link>

                <LinkButton
                  href="/signup"
                  variant="primary"
                  size="md"
                  className="rounded-xl px-6 bg-[#0b1553] hover:opacity-95"
                >
                  Get Started
                </LinkButton>
              </div>
            </div>
          </div>
        ) : null} */}
      </div>

      {/* subtle bottom divider like the screenshot */}
      <div className="h-px bg-black/10" />
    </header>
  );
}
