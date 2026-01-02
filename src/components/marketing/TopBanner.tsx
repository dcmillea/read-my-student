"use client";

import Link from "next/link";
import Image from "next/image";
import LogoOfficial from "../../../public/green_yellow_logo_sized.png";

// ✅ Import your ticker component (adjust the path to wherever you saved it)
import ScrollingProofTicker from "@/components/marketing/ScrollingProofTicker";

export default function TopBanner() {
  // ✅ Ticker items (bullets → check when centered)
  const tickerItems = [
    { id: "faculty", text: "Faculty-friendly workflow — no portal chaos." },
    { id: "secure", text: "Secure access, consent-based sharing." },
    { id: "fast", text: "One request. One place. Always ready." },
    { id: "lasting", text: "Letters that don’t vanish after graduation." },
    { id: "organized", text: "Deadlines tracked. Follow-ups reduced." },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#d9dbe3]">
      <div className="px-2 md:px-8 py-2 md:py-4">
        <div className="flex items-center justify-center md:justify-start gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src={LogoOfficial}
              alt="ReadMyStudent logo"
              width={450}
              height={400}
              priority
              className="h-24 sm:h-36 lg:h-40 xl:h-48 w-auto"
            />
          </Link>

          {/* Desktop Content Only */}
          <div className="min-w-0 w-full hidden md:block">
            {/* Big tagline */}
            <div className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-[#0b4726] leading-tight">
              Your Recommendation Letter: Just One Click Away
            </div>

            {/* Ticker */}
            <div className="mt-5 max-w-6xl">
              <ScrollingProofTicker
                items={tickerItems}
                speedSeconds={34}   // slower = bigger number
                centerZonePx={90}   // bigger = easier to trigger check mark
              />
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-black/10" />
    </header>
  );
}
