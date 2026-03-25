"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getStudentLetterPreview,
  type StudentLetterPreview,
} from "@/app/actions/letters";
import type { RecommenderForm } from "@/lib/faculty-profile";
import { Eye, EyeOff } from "lucide-react";

// ─── Letter render (inline styles only — no Tailwind — so html2canvas works) ───
// html2canvas cannot parse oklch(), which Tailwind v4 uses for all colors.
// Every style here must use plain hex / rgb values.

function LetterRender({ preview }: { preview: StudentLetterPreview }) {
  const snap = preview.recommenderSnapshot as RecommenderForm | null;

  // 5×8 grid of watermark stamps
  const stamps = Array.from({ length: 40 });

  return (
    <div style={{ position: "relative", backgroundColor: "#ffffff", fontFamily: "Georgia, serif", color: "#1f2937" }}>

      {/* Watermark overlay */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          zIndex: 10,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
        }}
      >
        {stamps.map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-35deg)" }}>
            <span style={{ userSelect: "none", whiteSpace: "nowrap", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(0,0,0,0.07)" }}>
              PREVIEW ONLY
            </span>
          </div>
        ))}
      </div>

      {/* Simplified letterhead — no logo, address, or phone */}
      <div style={{ borderBottom: "1px dashed rgba(0,0,0,0.1)", paddingBottom: "16px", marginBottom: "4px" }}>
        <p style={{ fontSize: "14px", fontWeight: "600", color: "#14532d", margin: "0 0 2px" }}>
          {[snap?.prefix, snap?.firstName, snap?.lastName].filter(Boolean).join(" ")}
        </p>
        {snap?.title && <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 2px" }}>{snap.title}</p>}
        {snap?.organization && <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 2px" }}>{snap.organization}</p>}
        {snap?.department && <p style={{ fontSize: "12px", color: "#6b7280", margin: "0" }}>{snap.department}</p>}
      </div>

      {/* Body */}
      {preview.html ? (
        <div
          style={{ marginTop: "24px", fontSize: "14px", lineHeight: "1.7", color: "#374151" }}
          dangerouslySetInnerHTML={{ __html: preview.html }}
        />
      ) : (
        <p style={{ marginTop: "24px", fontSize: "14px", color: "#9ca3af" }}>No letter content.</p>
      )}

      {/* Sign-off + signature placeholder */}
      <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <p style={{ fontSize: "14px", color: "#4b5563", margin: "0" }}>{snap?.signOff ?? "Sincerely,"}</p>
        <p style={{ fontSize: "12px", fontStyle: "italic", color: "#9ca3af", margin: "0" }}>[ Signature on file ]</p>
        <p style={{ fontSize: "12px", fontWeight: "600", color: "#374151", margin: "0" }}>
          {[snap?.prefix, snap?.firstName, snap?.lastName].filter(Boolean).join(" ")}
        </p>
        {snap?.title && <p style={{ fontSize: "11px", color: "#6b7280", margin: "0" }}>{snap.title}</p>}
      </div>

    </div>
  );
}

// ─── Dialog ────────────────────────────────────────────────────────────────────

export function LetterPreviewDialog({
  letterId,
  facultyName,
  previewEnabled,
}: {
  letterId: string;
  facultyName: string;
  previewEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<StudentLetterPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string | null>(null);

  // Offscreen div used only during html2canvas capture
  const offscreenRef = useRef<HTMLDivElement>(null);

  // Once preview data arrives, render offscreen and capture to canvas
  useEffect(() => {
    if (!preview) return;
    // Defer one tick to let React finish rendering the offscreen div
    const id = setTimeout(() => {
      if (!offscreenRef.current) return;
      setRendering(true);
      html2canvas(offscreenRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        windowWidth: 760,
        onclone: (clonedDoc) => {
          // html2canvas can't parse oklch() (used by Tailwind v4 in all
          // stylesheets). Remove every stylesheet from the clone — LetterRender
          // uses only inline styles so the output is unaffected.
          clonedDoc
            .querySelectorAll('style, link[rel="stylesheet"]')
            .forEach((el) => el.remove());
        },
      })
        .then((canvas) => {
          setCanvasDataUrl(canvas.toDataURL("image/png"));
        })
        .finally(() => setRendering(false));
    }, 0);
    return () => clearTimeout(id);
  }, [preview]);

  const handleOpen = useCallback(
    async (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen || preview) return;
      setLoading(true);
      setError(null);
      const result = await getStudentLetterPreview(letterId);
      if (result) {
        setPreview(result);
      } else {
        setError("Preview is unavailable. The professor may have disabled it.");
      }
      setLoading(false);
    },
    [letterId, preview],
  );

  if (!previewEnabled) {
    return (
      <Button
        size='sm'
        variant='outline'
        disabled
        title={`${facultyName} has not enabled preview for this letter.`}
        className='rounded-lg border-black/10 text-black/30'
      >
        <EyeOff className='mr-1.5 h-3.5 w-3.5' />
        Preview
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => void handleOpen(o)}>
      <DialogTrigger asChild>
        <Button
          size='sm'
          variant='outline'
          className='rounded-lg border-green-900/30 text-green-900 hover:bg-green-900/5'
        >
          <Eye className='mr-1.5 h-3.5 w-3.5' />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className='flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl sm:max-w-[760px]'>
        <DialogHeader className='shrink-0'>
          <DialogTitle className='font-serif text-green-900'>
            Letter Preview — {facultyName}
          </DialogTitle>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto p-1'>
          {(loading || rendering) && (
            <div className='flex items-center justify-center py-20 text-sm text-gray-400'>
              {loading ? "Loading preview…" : "Rendering preview…"}
            </div>
          )}
          {error && (
            <div className='rounded-xl bg-red-50 p-4 text-sm text-red-700'>
              ❌ {error}
            </div>
          )}

          {/* Offscreen render target — captured by html2canvas then hidden */}
          {preview && !canvasDataUrl && (
            <div
              ref={offscreenRef}
              aria-hidden
              style={{
                position: "fixed",
                left: "-9999px",
                top: 0,
                width: "700px",
                pointerEvents: "none",
              }}
            >
              <div style={{ backgroundColor: "#ffffff", padding: "32px" }}>
                <LetterRender preview={preview} />
              </div>
            </div>
          )}

          {/* Canvas image — no selectable text, no raw HTML exposed in the DOM */}
          {canvasDataUrl && (
            <div className='flex flex-col gap-3'>
              <div
                className='rounded-xl border border-black/5 shadow-sm overflow-hidden mx-2 mt-2'
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={canvasDataUrl}
                  alt='Letter preview'
                  className='w-full'
                  style={{ userSelect: "none", pointerEvents: "none" }}
                  draggable={false}
                />
              </div>
              <div className='mx-2 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800'>
                <span className='font-semibold'>Preview only.</span> This is a
                watermarked copy for your reference. The official letter is
                sealed and will be delivered to institutions by your professor
                via ReadMyStudent.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
