import {
  Lock,
  Shield,
  Users,
  Clock3,
  Eye,
  FileX2,
  Download,
  TriangleAlert,
} from "lucide-react";

type TrustCard = {
  title: string;
  body: string;
  icon: React.ReactNode;
  iconBg: string; // tailwind class
  iconColor: string; // tailwind class
};

export default function TrustSection() {
  const cards: TrustCard[] = [
    {
      title: "Data Encrypted",
      body: "All data is encrypted at rest and in transit. Server-side encryption for all uploaded PDFs and sensitive fields.",
      icon: <Lock className="h-5 w-5" />,
      iconBg: "bg-[#eef0f8]",
      iconColor: "text-[#0b1553]",
    },
    {
      title: "Access Controlled",
      body: "Role-based access ensures students, faculty, and admins only see what they're authorized to see.",
      icon: <Shield className="h-5 w-5" />,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      title: "Consent Built-in",
      body: "Every shareable link is tied to a student consent record. Nothing is shared without explicit permission.",
      icon: <Users className="h-5 w-5" />,
      iconBg: "bg-[#eef0f8]",
      iconColor: "text-[#0b1553]",
    },
    {
      title: "Time-Bound Sharing",
      body: "Share links automatically expire after your chosen duration. Set expiration dates and max view counts.",
      icon: <Clock3 className="h-5 w-5" />,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      title: "View Tracking & Audit",
      body: "Every link view is logged (IP, timestamp, user agent). See exactly where and when your letters were accessed.",
      icon: <Eye className="h-5 w-5" />,
      iconBg: "bg-[#eef0f8]",
      iconColor: "text-[#0b1553]",
    },
    {
      title: "Revoke Anytime",
      body: "Faculty can withdraw an RL anytime. Students can revoke shared links instantly if needed.",
      icon: <FileX2 className="h-5 w-5" />,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <section className="bg-[#dcd9d34c]">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        {/* badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
            Trust &amp; Security
          </span>
        </div>

        {/* heading */}
        <div className="mx-auto mt-6 max-w-3xl text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-[#0b4726]">
            Built for <span className="italic text-amber-500">Privacy First</span>
          </h2>
          <p className="mt-4 text-sm md:text-base leading-relaxed text-[#0b4726]">
            Security and compliance aren&apos;t afterthoughts—they&apos;re first-class requirements baked
            into every feature.
          </p>
        </div>

        {/* cards */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-black/10 bg-white px-7 py-8 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-300 ease-out hover:border-amber-300 hover:shadow-[0_20px_50px_rgba(245,197,66,0.18)]"
            >
              {/* icon tile */}
              <div
                className={[
                  "h-12 w-12 rounded-2xl grid place-items-center border border-black/5",
                  c.iconBg,
                  c.iconColor,
                ].join(" ")}
              >
                {c.icon}
              </div>

              <h3 className="mt-6 font-serif text-xl font-semibold text-[#0a154a]">
                {c.title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-[#5f6a93]">
                {c.body}
              </p>
            </div>
          ))}
        </div>

        {/* bottom compliance bar */}
        <div className="mt-12">
          <div className="rounded-2xl bg-[#0b1553] px-6 py-5 shadow-[0_20px_60px_rgba(11,21,83,0.25)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="font-serif text-lg font-semibold text-white/95">
                Privacy &amp; Compliance:
              </div>

              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm font-semibold text-white/85">
                <span className="inline-flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  GDPR Ready
                </span>

                <span className="inline-flex items-center gap-2">
                  <Download className="h-4 w-4 text-amber-400" />
                  Download Your Data
                </span>

                <span className="inline-flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-amber-400" />
                  Delete Account Anytime
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
