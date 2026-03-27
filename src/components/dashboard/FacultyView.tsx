"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Clock, FileText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { StatsCard } from "@/components/dashboard/StatsCard";
import { WriteLetterDialog } from "@/components/dashboard/WriteLetterDialog";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  getPendingDeliveries,
  getFacultyRequests,
  getFacultyFinalizedLetters,
  approveDelivery,
  rejectDelivery,
  rejectLetterRequest,
  setStudentPreviewEnabled,
  type PendingDelivery,
  type FacultyLetterRequest,
  type FacultyFinalizedLetter,
} from "@/app/actions/letters";
import { getFacultyProfile, saveFacultyProfile, getSignedAssetUrl } from "@/app/actions/faculty";
import type { FacultyProfileRow, RecommenderForm } from "@/lib/faculty-profile";
import { dbRowToProfile } from "@/lib/faculty-profile";

export function FacultyView() {
  const [pendingDeliveries, setPendingDeliveries] = useState<PendingDelivery[]>(
    [],
  );
  const [letterRequests, setLetterRequests] = useState<FacultyLetterRequest[]>(
    [],
  );
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [facultyProfile, setFacultyProfile] =
    useState<FacultyProfileRow | null>(null);
  const [savedLogoUrl, setSavedLogoUrl] = useState<string | null>(null);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  const [savedLogoStoragePath, setSavedLogoStoragePath] = useState<string | null>(null);
  const [savedSignatureStoragePath, setSavedSignatureStoragePath] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authFirstName, setAuthFirstName] = useState<string | null>(null);
  const [authLastName, setAuthLastName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reject request dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Verification settings dialog
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [finalizedLetters, setFinalizedLetters] = useState<
    FacultyFinalizedLetter[]
  >([]);
  const [loadingFinalized, setLoadingFinalized] = useState(false);
  const [previewToggles, setPreviewToggles] = useState<Record<string, boolean>>(
    {},
  );

  function openVerificationDialog() {
    setVerificationDialogOpen(true);
    if (finalizedLetters.length === 0) {
      setLoadingFinalized(true);
      getFacultyFinalizedLetters().then((letters) => {
        setFinalizedLetters(letters);
        setPreviewToggles(
          Object.fromEntries(
            letters.map((l) => [l.letterId, l.studentPreviewEnabled]),
          ),
        );
        setLoadingFinalized(false);
      });
    }
  }

  async function handleTogglePreview(letterId: string, enabled: boolean) {
    setPreviewToggles((prev) => ({ ...prev, [letterId]: enabled }));
    await setStudentPreviewEnabled(letterId, enabled);
  }

  useEffect(() => {
    getPendingDeliveries()
      .then(setPendingDeliveries)
      .finally(() => setLoadingDeliveries(false));

    getFacultyRequests()
      .then(setLetterRequests)
      .finally(() => setLoadingRequests(false));

    getFacultyProfile().then(async (profile) => {
      setFacultyProfile(profile);
      if (profile?.logo_storage_path) {
        setSavedLogoStoragePath(profile.logo_storage_path);
        getSignedAssetUrl(profile.logo_storage_path, "logo").then(setSavedLogoUrl);
      }
      if (profile?.signature_storage_path) {
        setSavedSignatureStoragePath(profile.signature_storage_path);
        getSignedAssetUrl(profile.signature_storage_path, "signature").then(setSavedSignatureUrl);
      }
    });

    // Fetch auth email for profile autofill
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setAuthEmail(data.user.email);
      if (data.user?.user_metadata?.firstName)
        setAuthFirstName(data.user.user_metadata.firstName);
      if (data.user?.user_metadata?.lastName)
        setAuthLastName(data.user.user_metadata.lastName);
    });
  }, []);

  const handleApprove = (id: string) => {
    setActionError(null);
    startTransition(async () => {
      const result = await approveDelivery(id);
      if (result.error) {
        setActionError(result.error);
      } else {
        setPendingDeliveries((prev) =>
          prev.filter((d) => d.deliveryLinkId !== id),
        );
      }
    });
  };

  const handleReject = (id: string) => {
    setActionError(null);
    startTransition(async () => {
      const result = await rejectDelivery(id);
      if (result.error) {
        setActionError(result.error);
      } else {
        setPendingDeliveries((prev) =>
          prev.filter((d) => d.deliveryLinkId !== id),
        );
      }
    });
  };

  const handleSaveProfile = async (form: RecommenderForm) => {
    return saveFacultyProfile(form);
  };

  const openRejectDialog = (requestId: string) => {
    setRejectingRequestId(requestId);
    setRejectReason("");
    setRejectError(null);
    setRejectDialogOpen(true);
  };

  const handleRejectRequest = async () => {
    if (!rejectingRequestId) return;
    setIsRejecting(true);
    setRejectError(null);
    const result = await rejectLetterRequest(rejectingRequestId, rejectReason);
    if (result.error) {
      setRejectError(result.error);
    } else {
      setLetterRequests((prev) =>
        prev.filter((r) => r.requestId !== rejectingRequestId),
      );
      setRejectDialogOpen(false);
    }
    setIsRejecting(false);
  };

  return (
    <>
      {/* Stats Row */}
      <div className='grid gap-4 md:grid-cols-3'>
        <StatsCard
          title='Pending Approvals'
          value={loadingDeliveries ? "…" : String(pendingDeliveries.length)}
          icon={Clock}
          color='text-amber-600'
        />
        <StatsCard
          title='Incoming Requests'
          value={loadingRequests ? "…" : String(letterRequests.length)}
          icon={FileText}
          color='text-emerald-600'
        />
        <StatsCard
          title='Avg. Response Time'
          value='—'
          icon={CheckCircle2}
          color='text-blue-600'
        />
      </div>

      <Card className='rounded-2xl border-black/5 bg-green-900/5'>
        <CardContent className='flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-start gap-3'>
            <div className='mt-0.5 rounded-full bg-white p-2 text-green-900'>
              <ShieldCheck className='h-5 w-5' />
            </div>
            <div>
              <p className='font-semibold text-green-900'>
                Secure letter workflow
              </p>
              <p className='text-sm text-green-900/70'>
                Students never see letter contents. Finalized letters are sealed
                and signed for verification.
              </p>
            </div>
          </div>
          <Button
            variant='outline'
            className='mt-2 rounded-xl border-green-900 text-green-900 hover:bg-green-900/10 sm:mt-0'
            onClick={openVerificationDialog}
          >
            Student Preview Settings
          </Button>
        </CardContent>
      </Card>

      {/* Pending delivery approvals */}
      <Card className='rounded-2xl border-black/5 shadow-sm'>
        <CardHeader>
          <CardTitle className='font-serif text-xl text-green-900'>
            Pending Delivery Approvals
          </CardTitle>
          <CardDescription>
            Students have paid to send your letter to a school. Review and
            approve or reject each request. The 48-hour delivery window starts
            only after you approve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actionError && (
            <p className='mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700'>
              ❌ {actionError}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className='text-right'>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDeliveries ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-10 text-center text-sm text-gray-400'
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : pendingDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-10 text-center text-sm text-gray-400'
                  >
                    No pending approvals.
                  </TableCell>
                </TableRow>
              ) : (
                pendingDeliveries.map((d) => (
                  <TableRow key={d.deliveryLinkId}>
                    <TableCell className='font-medium'>
                      {d.studentFullName}
                    </TableCell>
                    <TableCell>{d.schoolName}</TableCell>
                    <TableCell className='text-sm text-gray-500'>
                      {new Date(d.paidAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          size='sm'
                          className='rounded-lg bg-green-900 hover:bg-[#093820] text-xs disabled:opacity-50'
                          disabled={isPending}
                          onClick={() => handleApprove(d.deliveryLinkId)}
                        >
                          Approve
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          className='rounded-lg border-red-200 text-red-600 hover:bg-red-50 text-xs disabled:opacity-50'
                          disabled={isPending}
                          onClick={() => handleReject(d.deliveryLinkId)}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className='rounded-2xl border-black/5 shadow-sm'>
        <CardHeader>
          <CardTitle className='font-serif text-xl text-green-900'>
            Incoming Requests
          </CardTitle>
          <CardDescription>
            Students requesting a letter of recommendation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class / Context</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className='text-right'>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRequests ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-10 text-center text-sm text-gray-400'
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : letterRequests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-10 text-center text-sm text-gray-400'
                  >
                    No pending requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                letterRequests.map((req) => (
                  <TableRow key={req.requestId}>
                    <TableCell className='font-medium'>
                      {req.studentName}
                    </TableCell>
                    <TableCell className='text-sm text-gray-500'>
                      {req.courseContext ?? "—"}
                    </TableCell>
                    <TableCell className='text-sm text-gray-500'>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <WriteLetterDialog
                          studentName={req.studentName}
                          requestId={req.requestId}
                          savedProfile={
                            facultyProfile
                              ? dbRowToProfile(
                                  facultyProfile,
                                  authEmail,
                                  authFirstName,
                                  authLastName,
                                )
                              : undefined
                          }
                          savedLogoUrl={savedLogoUrl}
                          savedSignatureUrl={savedSignatureUrl}
                          savedLogoStoragePath={savedLogoStoragePath}
                          savedSignatureStoragePath={savedSignatureStoragePath}
                          onSaveProfile={handleSaveProfile}
                          onDraftSaved={() =>
                            getFacultyRequests().then(setLetterRequests)
                          }
                          onFinalized={() =>
                            getFacultyRequests().then(setLetterRequests)
                          }
                        />
                        <Button
                          size='sm'
                          variant='outline'
                          className='rounded-lg border-red-200 text-red-600 hover:bg-red-50 text-xs'
                          onClick={() => openRejectDialog(req.requestId)}
                        >
                          Decline
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className='rounded-2xl border-black/5 shadow-sm'>
        <CardHeader>
          <CardTitle className='font-serif text-xl text-green-900'>
            Finalized Letters
          </CardTitle>
          <CardDescription>
            Sealed recommendations ready for secure delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Finalized</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='text-right'>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='py-10 text-center text-sm text-gray-400'
                >
                  No finalized letters yet.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Student preview settings dialog */}
      <Dialog
        open={verificationDialogOpen}
        onOpenChange={setVerificationDialogOpen}
      >
        <DialogContent className='rounded-2xl sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='font-serif text-green-900'>
              Student Preview Settings
            </DialogTitle>
            <DialogDescription>
              Control whether students can see a watermarked preview of their
              letter in their dashboard. Letters are cryptographically sealed at
              finalization — students never receive an unsecured copy.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-3 py-1'>
            {loadingFinalized ? (
              <p className='py-6 text-center text-sm text-gray-400'>Loading…</p>
            ) : finalizedLetters.length === 0 ? (
              <p className='py-6 text-center text-sm text-gray-400'>
                No finalized letters yet.
              </p>
            ) : (
              finalizedLetters.map((letter) => (
                <div
                  key={letter.letterId}
                  className='flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-slate-50 px-4 py-3'
                >
                  <div>
                    <p className='text-sm font-medium text-gray-800'>
                      {letter.studentName}
                    </p>
                    <p className='text-xs text-gray-500'>
                      Finalized{" "}
                      {new Date(letter.finalizedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type='button'
                    role='switch'
                    aria-checked={previewToggles[letter.letterId] ?? false}
                    onClick={() =>
                      handleTogglePreview(
                        letter.letterId,
                        !(previewToggles[letter.letterId] ?? false),
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-900 ${
                      (previewToggles[letter.letterId] ?? false)
                        ? "bg-green-900"
                        : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        (previewToggles[letter.letterId] ?? false)
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject request dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className='rounded-2xl sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='font-serif text-green-900'>
              Decline Request
            </DialogTitle>
            <DialogDescription>
              The student will be notified by email. You can optionally include
              a brief message.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <Label htmlFor='reject-reason'>Message to student (optional)</Label>
            <Textarea
              id='reject-reason'
              placeholder="e.g. I don't have capacity this semester..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className='rounded-xl min-h-[100px] border-black/10 focus-visible:ring-green-900'
            />
            {rejectError && (
              <p className='text-sm text-red-600'>❌ {rejectError}</p>
            )}
          </div>
          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              className='rounded-xl'
              onClick={() => setRejectDialogOpen(false)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              className='rounded-xl bg-red-600 hover:bg-red-700 text-white'
              onClick={handleRejectRequest}
              disabled={isRejecting}
            >
              {isRejecting ? "Declining…" : "Decline Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
