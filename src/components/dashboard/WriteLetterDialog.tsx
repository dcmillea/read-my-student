"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type RecommenderProfile,
  type RecommenderForm,
  EMPTY_RECOMMENDER_FORM,
  buildRecommenderForm,
} from "@/lib/faculty-profile";
import { LetterEditor } from "@/components/dashboard/LetterEditor";
import {
  saveDraft,
  loadDraft,
  finalizeLetter,
  setStudentPreviewEnabled as setPreviewEnabledAction,
} from "@/app/actions/letters";
import { uploadFacultyAsset, getSignedAssetUrl } from "@/app/actions/faculty";
import { Check, Ellipsis, X } from "lucide-react";

export function WriteLetterDialog({
  studentName,
  requestId,
  savedProfile,
  savedSignatureUrl,
  savedLogoUrl,
  onSaveProfile,
  onDraftSaved,
  onFinalized,
}: {
  studentName: string;
  /** The letter_requests row ID. When provided, drafts go to Supabase.
   *  When absent (mock data), falls back to localStorage. */
  requestId?: string;
  savedProfile?: RecommenderProfile;
  savedSignatureUrl?: string | null;
  savedLogoUrl?: string | null;
  onSaveProfile?: (
    form: RecommenderForm,
  ) => Promise<{ success: boolean; error?: string }>;
  onDraftSaved?: () => void;
  onFinalized?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  console.log("[WriteLetterDialog] isOpen:", isOpen, "requestId:", requestId);
  const [step, setStep] = useState<
    "details" | "letterhead" | "letter" | "preview"
  >("details");
  const [recommenderForm, setRecommenderForm] = useState<RecommenderForm>(() =>
    buildRecommenderForm(savedProfile),
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  // Persisted asset URLs loaded from Supabase Storage (autofill from saved profile)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(
    savedSignatureUrl ?? null,
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(
    savedLogoUrl ?? null,
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(
    null,
  );
  const [letterHtml, setLetterHtml] = useState<string>("");
  const [letterPlainText, setLetterPlainText] = useState<string>("");
  const [letterEditorState, setLetterEditorState] = useState<string | null>(
    null,
  );
  const [signatureHasTransparency, setSignatureHasTransparency] = useState<
    boolean | null
  >(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [letterDbId, setLetterDbId] = useState<string | null>(null);
  const [studentPreviewEnabled, setStudentPreviewEnabled] = useState(false);

  // Upload state
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [signatureUploadError, setSignatureUploadError] = useState<
    string | null
  >(null);
  // Raw storage paths (distinct from signed display URLs stored in logoDataUrl/signatureDataUrl)
  const [logoStoragePath, setLogoStoragePath] = useState<string | null>(null);
  const [signatureStoragePath, setSignatureStoragePath] = useState<
    string | null
  >(null);

  // Draft save / autosave state
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [lastAutosaved, setLastAutosaved] = useState<Date | null>(null);

  // Finalization state
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  // Unsaved-change guard
  const [isDirty, setIsDirty] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);

  const finalizeConfirmRef = useRef<HTMLDivElement | null>(null);

  // Timer ref for debounced autosave
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always points at the latest handleSaveDraft to avoid stale closures
  const handleSaveDraftRef = useRef<(silent?: boolean) => Promise<void>>(
    async () => {},
  );

  const handleRecommenderChange = (
    field: keyof RecommenderForm,
    value: string,
  ) => {
    setProfileSaved(false);
    setDraftSaved(false);
    setIsDirty(true);
    setRecommenderForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleStudentPreview = async () => {
    const next = !studentPreviewEnabled;
    setStudentPreviewEnabled(next);
    if (letterDbId) {
      await setPreviewEnabledAction(letterDbId, next);
    }
    // If no letterId yet the value will be saved with the next draft save.
  };

  const draftStorageKey = `letterDraft:${studentName}`;

  const handleLogoSelect = async (file: File | null) => {
    setIsDirty(true);
    setLogoFile(file);
    setLogoUploadError(null);
    if (!file) {
      setLogoStoragePath(null);
      return;
    }
    setIsUploadingLogo(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadFacultyAsset(fd, "logo");
    setIsUploadingLogo(false);
    if (result.success && result.storagePath) {
      setLogoStoragePath(result.storagePath);
      if (result.signedUrl) setLogoDataUrl(result.signedUrl);
    } else {
      setLogoUploadError(result.error ?? "Logo upload failed.");
    }
  };

  const handleSignatureSelect = (file: File | null) => {
    setIsDirty(true);
    setSignatureFile(file);
    setSignatureUploadError(null);
    // Upload is triggered from the transparency-check effect once the PNG passes
    if (!file) setSignatureStoragePath(null);
  };

  const handleSaveDraft = async (silent = false) => {
    setDraftSaveError(null);
    if (!silent) setIsSavingDraft(true);
    if (requestId) {
      // Persist to Supabase.
      const result = await saveDraft(requestId, {
        recommenderForm,
        letterHtml,
        letterPlainText,
        letterEditorState,
        // Use uploaded storage paths; fall back to the currently loaded saved URLs
        logoStoragePath:
          logoStoragePath ?? (logoFile ? null : (logoDataUrl ?? null)),
        signatureStoragePath:
          signatureStoragePath ??
          (signatureFile ? null : (signatureDataUrl ?? null)),
      });
      if (!silent) setIsSavingDraft(false);
      if (!result.success) {
        setDraftSaveError(result.error ?? "Failed to save draft.");
        return;
      }
      if (result.letterId) setLetterDbId(result.letterId);
    } else {
      // Fallback: no real request ID yet (mock data)
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          recommenderForm,
          letterHtml,
          letterPlainText,
          letterEditorState,
        }),
      );
      if (!silent) setIsSavingDraft(false);
    }
    setDraftSaved(true);
    setIsDirty(false);
    if (silent) setLastAutosaved(new Date());
    onDraftSaved?.();
  };

  // Keep ref current so the autosave timer always calls the latest version
  handleSaveDraftRef.current = handleSaveDraft;

  const handleFinalize = async () => {
    if (!requestId) return;
    setIsFinalizing(true);
    setFinalizeError(null);
    // Persist any unsaved changes before sealing
    await handleSaveDraft(true);
    const result = await finalizeLetter(requestId);
    setIsFinalizing(false);
    if (!result.success) {
      setFinalizeError(result.error ?? "Failed to finalize letter.");
      return;
    }
    setShowFinalizeConfirm(false);
    setIsDirty(false);
    setIsOpen(false);
    setStep("details");
    onFinalized?.();
  };

  // Load draft from localStorage — only used as fallback when there is no requestId.
  // When requestId is present, loading happens in onOpenChange via the DB action.
  useEffect(() => {
    if (showFinalizeConfirm)
      finalizeConfirmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showFinalizeConfirm]);

  useEffect(() => {
    if (requestId) return;
    const storedDraft = localStorage.getItem(draftStorageKey);
    if (!storedDraft) return;
    try {
      const parsed = JSON.parse(storedDraft) as {
        recommenderForm: RecommenderForm;
        letterHtml: string;
        letterPlainText: string;
        letterEditorState: string | null;
      };
      setRecommenderForm(parsed.recommenderForm ?? EMPTY_RECOMMENDER_FORM);
      setLetterHtml(parsed.letterHtml ?? "");
      setLetterPlainText(parsed.letterPlainText ?? "");
      setLetterEditorState(parsed.letterEditorState ?? null);
    } catch {
      localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, requestId]);

  // Debounced autosave — 30 s after the last content change while the dialog is open.
  // Only activates when there are unsaved changes to avoid spurious saves on draft load.
  useEffect(() => {
    if (!isOpen || !requestId || !isDirty || isLoadingDraft) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void handleSaveDraftRef.current(true);
    }, 30_000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // recommenderForm and letterEditorState are the debounce triggers;
    // handleSaveDraftRef is a stable ref so it does not need to be listed.
  }, [
    recommenderForm,
    letterEditorState,
    isOpen,
    requestId,
    isDirty,
    isLoadingDraft,
  ]);

  // Logo object URL lifecycle
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  // Signature object URL lifecycle + transparency check
  useEffect(() => {
    const previewSource = signatureFile
      ? URL.createObjectURL(signatureFile)
      : null;

    if (!previewSource) {
      setSignaturePreviewUrl(null);
      setSignatureHasTransparency(null);
      setSignatureError(null);
      return;
    }

    setSignaturePreviewUrl(previewSource);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        setSignatureHasTransparency(null);
        setSignatureError("Unable to validate transparency.");
        return;
      }
      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let hasTransparency = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          hasTransparency = true;
          break;
        }
      }
      setSignatureHasTransparency(hasTransparency);
      setSignatureError(
        hasTransparency ? null : "Signature needs a transparent background.",
      );
      // Auto-upload as soon as transparency is confirmed
      if (hasTransparency && signatureFile) {
        setIsUploadingSignature(true);
        setSignatureUploadError(null);
        const fd = new FormData();
        fd.append("file", signatureFile);
        void uploadFacultyAsset(fd, "signature").then((res) => {
          setIsUploadingSignature(false);
          if (res.success && res.storagePath) {
            setSignatureStoragePath(res.storagePath);
            if (res.signedUrl) setSignatureDataUrl(res.signedUrl);
          } else {
            setSignatureUploadError(res.error ?? "Signature upload failed.");
          }
        });
      }
    };
    image.onerror = () => {
      setSignatureHasTransparency(null);
      setSignatureError("Unable to read the signature image.");
    };
    image.src = previewSource;

    return () => {
      if (signatureFile) URL.revokeObjectURL(previewSource);
    };
  }, [signatureFile]);

  const requiredDetailsFields: Array<keyof RecommenderForm> = [
    "firstName",
    "lastName",
    "organization",
    "title",
    "relationship",
    "email",
    "country",
    "street",
    "city",
    "state",
    "postalCode",
  ];

  const missingDetailFields = useMemo(
    () =>
      requiredDetailsFields.filter((field) => !recommenderForm[field].trim()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recommenderForm],
  );

  const isDetailsComplete = missingDetailFields.length === 0;
  const isLetterheadComplete =
    (Boolean(signatureFile) &&
      signatureHasTransparency !== false &&
      !isUploadingSignature) ||
    (Boolean(signatureDataUrl) && !signatureFile && !isUploadingSignature);
  // Block continuing while logo is uploading (logo is optional, but if chosen it must finish)
  const isLetterheadReady = isLetterheadComplete && !isUploadingLogo;
  const isLetterComplete = letterPlainText.trim().length > 0;

  const missingDetailsHint = missingDetailFields.length
    ? `Missing: ${missingDetailFields
        .map((f) =>
          f.replace(/([A-Z])/g, " $1").replace(/\b\w/g, (c) => c.toUpperCase()),
        )
        .join(", ")}`
    : null;

  const footerHint =
    step === "details"
      ? missingDetailsHint
      : step === "letterhead"
        ? (signatureError ??
          (isUploadingSignature
            ? "Uploading signature..."
            : isUploadingLogo
              ? "Uploading logo..."
              : signatureFile || signatureDataUrl
                ? null
                : "Upload a transparent PNG signature."))
        : step === "letter"
          ? isLetterComplete
            ? null
            : "Add letter content to continue."
          : null;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={async (open) => {
          console.log("[WriteLetterDialog] onOpenChange attempt:", open);
          if (!open && isDirty) {
            setShowCloseWarning(true);
            return;
          }
          setIsOpen(open);
          if (open) {
            setIsDirty(false);
            setDraftSaveError(null);
            setFinalizeError(null);
            setShowFinalizeConfirm(false);
            setLastAutosaved(null);
            // Apply saved profile as baseline
            if (savedProfile)
              setRecommenderForm(buildRecommenderForm(savedProfile));
            setSignatureDataUrl(savedSignatureUrl ?? null);
            setLogoDataUrl(savedLogoUrl ?? null);

            // Load draft from DB (overrides profile baseline if a draft exists)
            if (requestId) {
              setIsLoadingDraft(true);
              const draft = await loadDraft(requestId);
              setIsLoadingDraft(false);
              if (draft) {
                if (draft.recommender_snapshot)
                  setRecommenderForm(draft.recommender_snapshot);
                setLetterHtml(draft.letter_body_html ?? "");
                setLetterPlainText(draft.letter_plain_text ?? "");
                setLetterEditorState(draft.letter_editor_state);
                if (draft.letterhead_logo_storage_path) {
                  setLogoStoragePath(draft.letterhead_logo_storage_path);
                  getSignedAssetUrl(draft.letterhead_logo_storage_path, "logo").then(
                    (url) => { if (url) setLogoDataUrl(url); }
                  );
                }
                if (draft.signature_image_storage_path) {
                  setSignatureStoragePath(draft.signature_image_storage_path);
                  getSignedAssetUrl(draft.signature_image_storage_path, "signature").then(
                    (url) => { if (url) setSignatureDataUrl(url); }
                  );
                }
                setLetterDbId(draft.id);
                setStudentPreviewEnabled(draft.student_preview_enabled);
                setDraftSaved(true);
              }
            }
          } else {
            setStep("details");
            setIsDirty(false);
            setLastAutosaved(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            size='sm'
            className='rounded-lg bg-green-900 text-white hover:bg-[#093820]'
          >
            Write Letter
          </Button>
        </DialogTrigger>
        <DialogContent className='flex max-h-[90vh] w-[95vw] flex-col rounded-2xl sm:max-w-[860px] bg-white ring-1 ring-black/5 p-0 overflow-hidden p-4'>
          {isLoadingDraft && (
            <div className='absolute inset-0 z-[100] flex items-center justify-center bg-white'>
              <div className='flex flex-col items-center gap-2'>
                <div className='h-8 w-8 animate-spin rounded-full border-4 border-green-900 border-t-transparent' />
                <p className='text-sm font-medium text-green-900'>
                  Loading draft…
                </p>
              </div>
            </div>
          )}
          <DialogHeader>
            <DialogTitle className='font-serif text-green-900'>
              Draft Letter for {studentName}
            </DialogTitle>
            <DialogDescription asChild>
              <div className='flex justify-between'>
                <span>
                  Draft your recommendation. Students will never see the
                  contents.
                </span>
                <div className='flex items-center gap-2 text-green-900/70'>
                  <span className='text-xs uppercase tracking-[0.2em]'>
                    Step
                  </span>
                  <span className='font-semibold'>
                    {step === "details"
                      ? "1"
                      : step === "letterhead"
                        ? "2"
                        : "3"}{" "}
                    / 3
                  </span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className='flex-1 overflow-y-auto'>
            <div className='grid gap-4 py-4 px-1'>
              {/* ── Step indicator ── */}
              <div className='flex items-center justify-between rounded-2xl border border-black/5 bg-slate-50/50 px-4 py-3 text-sm'>
                {(["details", "letterhead", "letter"] as const).map(
                  (s, idx) => {
                    const labels = [
                      "Recommender details",
                      "Letterhead + signature",
                      "Letter",
                    ];
                    const isActive =
                      s === step || (s === "letter" && step === "preview");
                    const isPast =
                      (s === "details" && step !== "details") ||
                      (s === "letterhead" &&
                        (step === "letter" || step === "preview"));
                    return (
                      <div key={s} className='flex items-center gap-2'>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isActive
                              ? "bg-green-900"
                              : isPast
                                ? "bg-yellow-600/40"
                                : "bg-green-900/40"
                          }`}
                        />
                        <span
                          className={`font-semibold ${
                            isActive
                              ? "text-green-900"
                              : isPast
                                ? "text-yellow-600"
                                : "text-green-900/40"
                          }`}
                        >
                          {labels[idx]}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>

              {/* ── Step: Recommender details ── */}
              {step === "details" && (
                <div className='grid gap-4 rounded-2xl border border-black/5 bg-white p-4'>
                  <div>
                    <h3 className='text-base font-semibold text-green-900'>
                      Recommender information
                    </h3>
                    <p className='text-sm text-green-900/70'>
                      Used for letterhead and verification details.
                    </p>
                  </div>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    {(
                      [
                        {
                          id: "prefix",
                          label: "Prefix",
                          placeholder: "Dr.",
                          field: "prefix",
                        },
                        {
                          id: "title",
                          label: "Position / Title",
                          placeholder: "Professor",
                          field: "title",
                        },
                        {
                          id: "first-name",
                          label: "First Name",
                          placeholder: "First name",
                          field: "firstName",
                        },
                        {
                          id: "last-name",
                          label: "Last Name",
                          placeholder: "Last name",
                          field: "lastName",
                        },
                        {
                          id: "organization",
                          label: "Organization",
                          placeholder: "University name",
                          field: "organization",
                        },
                        {
                          id: "department",
                          label: "Department / School",
                          placeholder: "Department or school",
                          field: "department",
                        },
                        {
                          id: "relationship",
                          label: "Relationship",
                          placeholder: "Professor, Advisor, Mentor",
                          field: "relationship",
                        },
                        {
                          id: "recommender-email",
                          label: "Email",
                          placeholder: "faculty@university.edu",
                          field: "email",
                          type: "email",
                        },
                        {
                          id: "recommender-phone",
                          label: "Phone",
                          placeholder: "(555) 555-5555",
                          field: "phone",
                        },
                      ] as Array<{
                        id: string;
                        label: string;
                        placeholder: string;
                        field: keyof RecommenderForm;
                        type?: string;
                      }>
                    ).map(({ id, label, placeholder, field, type }) => (
                      <div key={id} className='grid gap-2'>
                        <Label htmlFor={id}>{label}</Label>
                        <Input
                          id={id}
                          type={type ?? "text"}
                          placeholder={placeholder}
                          className='rounded-xl'
                          value={recommenderForm[field]}
                          onChange={(e) =>
                            handleRecommenderChange(field, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className='grid gap-4 sm:grid-cols-3'>
                    <div className='grid gap-2'>
                      <Label htmlFor='country'>Country</Label>
                      <Input
                        id='country'
                        placeholder='United States'
                        className='rounded-xl'
                        value={recommenderForm.country}
                        onChange={(e) =>
                          handleRecommenderChange("country", e.target.value)
                        }
                      />
                    </div>
                    <div className='grid gap-2 sm:col-span-2'>
                      <Label htmlFor='street'>Street</Label>
                      <Input
                        id='street'
                        placeholder='123 University Ave'
                        className='rounded-xl'
                        value={recommenderForm.street}
                        onChange={(e) =>
                          handleRecommenderChange("street", e.target.value)
                        }
                      />
                    </div>
                    <div className='grid gap-2'>
                      <Label htmlFor='city'>City</Label>
                      <Input
                        id='city'
                        placeholder='City'
                        className='rounded-xl'
                        value={recommenderForm.city}
                        onChange={(e) =>
                          handleRecommenderChange("city", e.target.value)
                        }
                      />
                    </div>
                    <div className='grid gap-2'>
                      <Label htmlFor='state'>State / Province</Label>
                      <Input
                        id='state'
                        placeholder='State'
                        className='rounded-xl'
                        value={recommenderForm.state}
                        onChange={(e) =>
                          handleRecommenderChange("state", e.target.value)
                        }
                      />
                    </div>
                    <div className='grid gap-2'>
                      <Label htmlFor='postal'>Postal Code</Label>
                      <Input
                        id='postal'
                        placeholder='Postal code'
                        className='rounded-xl'
                        value={recommenderForm.postalCode}
                        onChange={(e) =>
                          handleRecommenderChange("postalCode", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  {/* ── Sign-off ── */}
                  <div className='grid gap-2'>
                    <Label htmlFor='sign-off'>Sign-off</Label>
                    <Input
                      id='sign-off'
                      placeholder='Sincerely,'
                      className='rounded-xl'
                      value={recommenderForm.signOff}
                      onChange={(e) =>
                        handleRecommenderChange("signOff", e.target.value)
                      }
                    />
                    <p className='text-xs text-gray-400'>
                      e.g. Sincerely, Best regards, With warm regards
                    </p>
                  </div>

                  {/* ── Save-profile strip ── */}
                  <div className='flex items-start justify-between rounded-xl border border-dashed border-black/10 bg-slate-50 px-4 py-3'>
                    <p className='text-xs text-gray-500'>
                      Save your details so they autofill on your next letter.
                    </p>
                    <div className='flex flex-col items-end gap-1'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='rounded-xl'
                        disabled={
                          isSavingProfile ||
                          !isDetailsComplete ||
                          !onSaveProfile
                        }
                        onClick={async () => {
                          if (!onSaveProfile) return;
                          setIsSavingProfile(true);
                          setProfileSaved(false);
                          setProfileSaveError(null);
                          const result = await onSaveProfile(recommenderForm);
                          setIsSavingProfile(false);
                          if (result.success) {
                            setProfileSaved(true);
                          } else {
                            setProfileSaveError(
                              result.error ?? "Failed to save profile.",
                            );
                          }
                        }}
                      >
                        {isSavingProfile
                          ? "Saving…"
                          : profileSaved
                            ? "Saved ✓"
                            : "Save to profile"}
                      </Button>
                      {profileSaveError && (
                        <p className='mt-1 text-xs font-semibold text-red-600 flex items-center gap-1'>
                          ❌ {profileSaveError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step: Letterhead + signature ── */}
              {step === "letterhead" && (
                <div className='grid gap-4 rounded-2xl border border-black/5 bg-white p-4'>
                  <div>
                    <h3 className='text-base font-semibold text-green-900'>
                      Letterhead + signature
                    </h3>
                    <p className='text-sm text-green-900/70'>
                      Upload a logo (any image format) and a transparent PNG
                      signature.
                    </p>
                  </div>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div className='grid gap-2'>
                      <Label htmlFor='letterhead-logo'>Letterhead logo</Label>
                      <div className='flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2'>
                        <label
                          htmlFor='letterhead-logo'
                          className='cursor-pointer rounded-lg bg-green-900/10 px-3 py-1.5 text-sm font-semibold text-green-900 hover:bg-green-900/20'
                        >
                          Choose file
                        </label>
                        <span className='text-sm text-gray-600'>
                          {logoFile ? logoFile.name : "No file chosen"}
                        </span>
                        <Input
                          id='letterhead-logo'
                          type='file'
                          accept='image/*'
                          className='sr-only'
                          onChange={(e) =>
                            void handleLogoSelect(e.target.files?.[0] ?? null)
                          }
                        />
                      </div>
                      <p className='text-xs text-gray-500'>
                        {logoFile ? `Selected: ${logoFile.name}` : "Optional"}
                      </p>
                      {isUploadingLogo && (
                        <span className='text-xs text-blue-600'>
                          Uploading...
                        </span>
                      )}
                      {logoUploadError && (
                        <span className='text-xs font-semibold text-red-600 flex items-center gap-1'>
                          <X /> {logoUploadError}
                        </span>
                      )}
                      {!isUploadingLogo &&
                        !logoUploadError &&
                        logoStoragePath && (
                          <>
                            <span className='text-xs font-medium text-green-700 flex items-center gap-1'>
                              <Check />
                              Uploaded
                            </span>
                          </>
                        )}
                    </div>
                    <div className='grid gap-2'>
                      <Label htmlFor='signature-upload'>Signature (PNG)</Label>
                      <div className='flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2'>
                        <label
                          htmlFor='signature-upload'
                          className='cursor-pointer rounded-lg bg-green-900/10 px-3 py-1.5 text-sm font-semibold text-green-900 hover:bg-green-900/20'
                        >
                          Choose file
                        </label>
                        <span className='text-sm text-gray-600'>
                          {signatureFile
                            ? signatureFile.name
                            : "No file chosen"}
                        </span>
                        <Input
                          id='signature-upload'
                          type='file'
                          accept='image/png'
                          className='sr-only'
                          onChange={(e) =>
                            handleSignatureSelect(e.target.files?.[0] ?? null)
                          }
                        />
                      </div>
                      <p className='text-xs text-gray-500'>
                        {signatureFile
                          ? `Selected: ${signatureFile.name}`
                          : "Required: transparent PNG"}
                      </p>
                      {isUploadingSignature && (
                        <p className='text-xs text-blue-600'>Uploading...</p>
                      )}
                      {signatureUploadError && (
                        <p className='text-xs font-semibold text-red-600 flex items-center gap-1'>
                          <X /> {signatureUploadError}
                        </p>
                      )}
                      {!isUploadingSignature &&
                        !signatureUploadError &&
                        signatureStoragePath && (
                          <p className='text-xs font-medium text-green-700 flex items-center gap-1'>
                            <Check /> Uploaded - saved to your profile
                          </p>
                        )}
                      {signatureError && (
                        <p className='text-xs font-semibold text-amber-700'>
                          {signatureError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className='rounded-lg bg-slate-50 p-3 text-xs text-gray-600'>
                    If your PNG has a white background, use{" "}
                    <a
                      className='font-semibold text-green-900 underline'
                      href='https://www.remove.bg/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      remove.bg
                    </a>{" "}
                    or create a free transparent signature using{" "}
                    <a
                      className='font-semibold text-green-900 underline'
                      href='https://www.signwell.com/online-signature/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      SignWell
                    </a>
                    .
                  </div>
                  <div className='grid gap-3 rounded-lg border border-dashed border-black/10 bg-slate-50 p-4 text-sm text-gray-500'>
                    <p className='font-semibold text-green-900'>Preview</p>
                    <div className='flex flex-wrap items-end gap-6'>
                      <div className='flex flex-col gap-1'>
                        <span className='text-[11px] uppercase tracking-wide text-gray-400'>
                          Logo
                        </span>
                        {(logoPreviewUrl ?? logoDataUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logoPreviewUrl ?? logoDataUrl!}
                            alt='Logo preview'
                            className='h-12 w-32 rounded border border-black/5 bg-white object-contain p-1'
                          />
                        ) : (
                          <div className='flex h-12 w-32 items-center justify-center rounded border border-dashed border-black/10 text-[11px] text-gray-400'>
                            None
                          </div>
                        )}
                      </div>
                      <div className='flex flex-col gap-1'>
                        <span className='text-[11px] uppercase tracking-wide text-gray-400'>
                          Signature
                        </span>
                        {(signaturePreviewUrl ?? signatureDataUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={signaturePreviewUrl ?? signatureDataUrl!}
                            alt='Signature preview'
                            className='h-12 w-40 rounded border border-black/5 bg-white object-contain p-1'
                          />
                        ) : (
                          <div className='flex h-12 w-40 items-center justify-center rounded border border-dashed border-black/10 text-[11px] text-gray-400'>
                            None
                          </div>
                        )}
                      </div>
                    </div>
                    {signatureDataUrl && !signatureFile && (
                      <p className='text-xs font-medium text-green-700'>
                        Using your saved signature. Upload a new PNG above to
                        replace it.
                      </p>
                    )}
                    {logoDataUrl && !logoFile && (
                      <p className='text-xs font-medium text-green-700'>
                        Using your saved logo. Upload a new file above to
                        replace it.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step: Letter content ── */}
              {step === "letter" && (
                <div className='grid gap-2'>
                  <Label htmlFor='letter-content'>Letter content</Label>
                  <LetterEditor
                    initialState={letterEditorState}
                    onChange={({ html, plainText, editorState }) => {
                      setLetterHtml(html);
                      setLetterPlainText(plainText);
                      setLetterEditorState(editorState);
                      setDraftSaved(false);
                      setIsDirty(true);
                    }}
                  />
                  {/* ── Live closing preview ── */}
                  <div className='mt-4 border-t border-black/10 pt-4'>
                    <p className='mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400'>
                      Letter closing preview
                    </p>
                    <div className='flex flex-col items-start gap-2 text-xs text-gray-500'>
                      <span className='text-sm text-gray-500'>
                        {recommenderForm.signOff || "Sincerely,"}
                      </span>
                      {(signaturePreviewUrl ?? signatureDataUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={signaturePreviewUrl ?? signatureDataUrl!}
                          alt='Signature preview'
                          className='h-12 w-40 object-contain'
                        />
                      ) : (
                        <div className='h-12 w-40 rounded-lg border border-dashed border-black/10' />
                      )}
                      <div className='text-xs text-gray-600'>
                        {[
                          recommenderForm.prefix,
                          recommenderForm.firstName,
                          recommenderForm.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || "Your Name"}
                      </div>
                      {recommenderForm.title && (
                        <div className='text-[11px] text-gray-500'>
                          {recommenderForm.title}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='rounded-lg bg-slate-50 p-3 text-xs text-gray-500 mt-2'>
                    <span className='font-bold text-green-900'>
                      Next step:{" "}
                    </span>
                    Review a sealed preview before finalizing.
                  </div>
                </div>
              )}

              {/* ── Step: Preview ── */}
              {step === "preview" && (
                <div className='grid gap-4'>
                  <div>
                    <h3 className='text-base font-semibold text-green-900'>
                      Preview
                    </h3>
                    <p className='text-sm text-green-900/70'>
                      This is how the letterhead and signature will appear on
                      the final letter.
                    </p>
                  </div>
                  <div className='rounded-2xl border border-dashed border-black/10 bg-white p-6'>
                    <div className='flex min-h-[520px] flex-col gap-6 text-sm text-gray-700'>
                      <div className='flex items-start justify-between gap-6'>
                        <div className='flex items-start gap-4'>
                          {(logoPreviewUrl ?? logoDataUrl) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={logoPreviewUrl ?? logoDataUrl!}
                              alt='Letterhead logo preview'
                              className='h-16 w-28 object-contain'
                            />
                          ) : (
                            <div className='flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-black/10 text-[10px] uppercase text-gray-400'>
                              Logo
                            </div>
                          )}
                          <div className='space-y-1 flex flex-col'>
                            <p className='text-sm font-semibold text-green-900'>
                              {`${recommenderForm.prefix} ${recommenderForm.firstName} ${recommenderForm.lastName}` ||
                                "Name"}
                            </p>
                            <p className='text-sm font-semibold text-green-900'>
                              {recommenderForm.title || "Title"}
                            </p>
                            <p className='text-sm font-semibold text-green-900'>
                              {recommenderForm.department || "Department"}
                            </p>
                          </div>
                        </div>
                        <div className='text-right text-xs text-gray-500'>
                          <p>{recommenderForm.street || "Street address"}</p>
                          <p>
                            {(recommenderForm.city || "City") +
                              ", " +
                              (recommenderForm.state || "State") +
                              " " +
                              (recommenderForm.postalCode || "Postal")}
                          </p>
                          <p>{recommenderForm.country || "Country"}</p>
                        </div>
                      </div>
                      <div className='border-t border-dashed border-black/10' />
                      <div className='flex-1 text-sm text-gray-700'>
                        {letterHtml ? (
                          <div
                            className='space-y-3'
                            dangerouslySetInnerHTML={{ __html: letterHtml }}
                          />
                        ) : (
                          <p className='text-xs text-gray-500'>
                            Letter content will render here using your editor
                            text.
                          </p>
                        )}
                      </div>
                      <div className='flex flex-col items-start gap-2 text-xs text-gray-500'>
                        <span className='text-sm text-gray-500'>
                          {recommenderForm.signOff || "Sincerely,"}
                        </span>
                        {(signaturePreviewUrl ?? signatureDataUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={signaturePreviewUrl ?? signatureDataUrl!}
                            alt='Signature preview'
                            className='h-12 w-40 object-contain'
                          />
                        ) : (
                          <div className='h-12 w-40 rounded-lg border border-dashed border-black/10' />
                        )}
                        <div className='text-xs text-gray-600'>
                          {[
                            recommenderForm.prefix,
                            recommenderForm.firstName,
                            recommenderForm.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || "Your Name"}
                        </div>
                        {recommenderForm.title && (
                          <div className='text-[11px] text-gray-500'>
                            {recommenderForm.title}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Student preview toggle */}
                  <div className='flex items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-4 py-3'>
                    <div>
                      <p className='text-sm font-semibold text-green-900'>
                        Allow student preview
                      </p>
                      <p className='mt-0.5 text-xs text-black/50'>
                        Student can view a watermarked copy in their dashboard.
                      </p>
                    </div>
                    <button
                      type='button'
                      role='switch'
                      aria-checked={studentPreviewEnabled}
                      onClick={() => void handleToggleStudentPreview()}
                      className={
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none " +
                        (studentPreviewEnabled ? "bg-green-900" : "bg-black/20")
                      }
                    >
                      <span
                        className={
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform " +
                          (studentPreviewEnabled
                            ? "translate-x-5"
                            : "translate-x-0")
                        }
                      />
                    </button>
                  </div>

                  {/* ── Finalize confirmation ── */}
                  {showFinalizeConfirm && (
                    <div ref={finalizeConfirmRef} className='rounded-xl border border-red-200 bg-red-50 p-4'>
                      <p className='text-sm font-semibold text-red-900'>
                        Confirm finalization
                      </p>
                      <p className='mt-1 text-xs text-red-700'>
                        This is permanent and cannot be undone. The letter will
                        be sealed, locked, and made available for student
                        delivery.
                      </p>
                      {finalizeError && (
                        <p className='mt-2 text-xs font-semibold text-red-600'>
                          ❌ {finalizeError}
                        </p>
                      )}
                      <div className='mt-3 flex gap-2'>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          className='rounded-xl'
                          onClick={() => {
                            setShowFinalizeConfirm(false);
                            setFinalizeError(null);
                          }}
                          disabled={isFinalizing}
                        >
                          Cancel
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          className='rounded-xl bg-red-700 text-white hover:bg-red-800'
                          onClick={() => void handleFinalize()}
                          disabled={isFinalizing}
                        >
                          {isFinalizing
                            ? "Finalizing…"
                            : "Yes, Finalize & Seal"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-2'>
              {step !== "details" && (
                <Button
                  type='button'
                  variant='outline'
                  className='rounded-xl'
                  onClick={() =>
                    setStep(
                      step === "preview"
                        ? "letter"
                        : step === "letter"
                          ? "letterhead"
                          : "details",
                    )
                  }
                >
                  Back
                </Button>
              )}
            </div>
            <div className='flex flex-col gap-2 sm:flex-row'>
              {step === "details" && (
                <Button
                  type='button'
                  className='rounded-xl bg-green-900 hover:bg-[#093820]'
                  onClick={() => setStep("letterhead")}
                  disabled={!isDetailsComplete}
                >
                  Continue to Letterhead
                </Button>
              )}
              {step === "letterhead" && (
                <Button
                  type='button'
                  className='rounded-xl bg-green-900 hover:bg-[#093820]'
                  onClick={() => setStep("letter")}
                  disabled={!isLetterheadReady}
                >
                  Continue to Letter
                </Button>
              )}
              {step === "letter" && (
                <Button
                  type='button'
                  className='rounded-xl bg-green-900 hover:bg-[#093820]'
                  onClick={() => setStep("preview")}
                  disabled={!isLetterComplete}
                >
                  Review Preview
                </Button>
              )}
              {step === "preview" && (
                <>
                  <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800'>
                    <span className='shrink-0 text-base leading-none'>⚠️</span>
                    <p>
                      <span className='font-bold'>
                        Finalization is permanent.
                      </span>{" "}
                      Once sealed, the letter is locked and cannot be edited.
                      Save a draft first if you&rsquo;re not ready.
                    </p>
                  </div>
                  <div className='flex flex-col items-end gap-1'>
                    <Button
                      variant='outline'
                      className={`rounded-xl transition-colors ${
                        draftSaved
                          ? "border-green-700 bg-green-50 text-green-800 hover:bg-green-100"
                          : ""
                      }`}
                      disabled={isSavingDraft}
                      onClick={() => void handleSaveDraft()}
                    >
                      {isSavingDraft
                        ? "Saving…"
                        : draftSaved
                          ? "Draft Saved ✓"
                          : "Save Draft"}
                    </Button>
                    {draftSaveError && (
                      <p className='text-xs font-semibold text-red-600'>
                        ❌ {draftSaveError}
                      </p>
                    )}
                    {footerHint ? (
                      <span className='text-xs font-semibold text-amber-700'>
                        {footerHint}
                      </span>
                    ) : isDirty && requestId ? (
                      <span className='text-xs text-amber-600'>
                        ● Unsaved changes
                      </span>
                    ) : lastAutosaved ? (
                      <span className='text-xs text-green-700'>
                        Autosaved{" "}
                        {lastAutosaved.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    className='rounded-xl bg-green-900 hover:bg-[#093820]'
                    disabled={isFinalizing || showFinalizeConfirm}
                    onClick={() => setShowFinalizeConfirm(true)}
                  >
                    Finalize &amp; Seal Letter
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unsaved-changes guard ── */}
      <Dialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <DialogContent className='rounded-2xl sm:max-w-[400px]'>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes to this draft. If you close now, they
              will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex gap-2 sm:justify-end'>
            <Button
              variant='outline'
              className='rounded-xl'
              onClick={() => setShowCloseWarning(false)}
            >
              Keep editing
            </Button>
            <Button
              className='rounded-xl bg-red-700 text-white hover:bg-red-800'
              onClick={() => {
                setShowCloseWarning(false);
                setIsDirty(false);
                setIsOpen(false);
                setStep("details");
                setLastAutosaved(null);
              }}
            >
              Discard &amp; close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
