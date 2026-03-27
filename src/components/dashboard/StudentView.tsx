"use client";

import { useState, useEffect } from "react";
import {
  sendLetterRequest,
  getFinishedLetters,
  getPendingRequests,
} from "@/app/actions/letters";
import type { FinishedLetter, PendingRequest } from "@/app/actions/letters";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SendToSchoolDialog } from "@/components/dashboard/SendToSchoolDialog";
import { LetterPreviewDialog } from "@/components/dashboard/LetterPreviewDialog";

export function StudentView() {
  const [profEmail, setProfEmail] = useState("");
  const [courseContext, setCourseContext] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<
    | { status: "requested" | "invited" }
    | { status: "error"; error: string }
    | null
  >(null);

  const [finishedLetters, setFinishedLetters] = useState<FinishedLetter[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Show a toast and clean the URL if returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (paymentStatus === "success") {
      toast.success("Payment successful! Your professor has been notified and your delivery link has been generated.");
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment cancelled — no charge was made.");
    }
    if (paymentStatus) {
      params.delete("payment");
      const newUrl = [window.location.pathname, params.toString()].filter(Boolean).join("?");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const [finished, pending] = await Promise.all([
        getFinishedLetters(),
        getPendingRequests(),
      ]);
      setFinishedLetters(finished);
      setPendingRequests(pending);
      setDataLoading(false);
    }
    void load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    const res = await sendLetterRequest({
      professorEmail: profEmail,
      courseContext: courseContext || undefined,
      studentNote: studentNote || undefined,
    });

    setResult(res.status === "error" ? res : { status: res.status });

    if (res.status !== "error") {
      setProfEmail("");
      setCourseContext("");
      setStudentNote("");
      // Refresh pending list
      const pending = await getPendingRequests();
      setPendingRequests(pending);
    }

    setIsLoading(false);
  };

  return (
    <div className='grid gap-6 grid-cols-1 md:grid-cols-12'>
      {/* LEFT COL: Request Form */}
      <div className='md:col-span-4'>
        <Card className='rounded-2xl border-black/5 shadow-lg shadow-black/5'>
          <CardHeader>
            <CardTitle className='text-xl font-serif text-green-900'>
              Request a Letter
            </CardTitle>
            <CardDescription>
              Ask a professor for a recommendation.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
{result?.status === "requested" && (
              <div className='rounded-xl bg-green-50 p-3 text-sm text-green-800'>
                ✅ Request sent! Your professor has been notified and will see
                it in their dashboard.
              </div>
            )}
            {result?.status === "invited" && (
              <div className='rounded-xl bg-blue-50 p-3 text-sm text-blue-800'>
                📨 Invitation sent! Your professor doesn&apos;t have an account
                yet — we&apos;ve emailed them a personal invitation to join and
                help you.
              </div>
            )}
            {result?.status === "error" && (
              <div className='rounded-xl bg-red-50 p-3 text-sm text-red-700'>
                ❌ {(result as { status: "error"; error: string }).error}
              </div>
            )}

            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='prof-email'>Professor&apos;s Email</Label>
                <Input
                  id='prof-email'
                  type='email'
                  required
                  placeholder='professor@university.edu'
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className='rounded-xl border-black/10 focus-visible:ring-green-900'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='course'>Course / Context (Optional)</Label>
                <Input
                  id='course'
                  placeholder='e.g. BIO 101, Fall 2023'
                  value={courseContext}
                  onChange={(e) => setCourseContext(e.target.value)}
                  className='rounded-xl border-black/10 focus-visible:ring-green-900'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='message'>Personal Note</Label>
                <Textarea
                  id='message'
                  placeholder="Hi Professor, I'm applying to med school..."
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  className='rounded-xl border-black/10 min-h-[100px] focus-visible:ring-green-900'
                />
              </div>
              <Button
                type='submit'
                disabled={isLoading}
                className='w-full rounded-xl bg-green-900 hover:bg-[#093820] disabled:opacity-60'
              >
                {isLoading ? "Sending…" : "Send Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COL: Status Tabs */}
      <div className='md:col-span-8'>
        <Tabs defaultValue='completed' className='w-full'>
          <TabsList className='grid w-full grid-cols-2 rounded-xl bg-green-900/5 p-1'>
            <TabsTrigger
              value='completed'
              className='rounded-lg data-[state=active]:bg-white data-[state=active]:text-green-900 data-[state=active]:shadow-sm'
            >
              Ready to Send
            </TabsTrigger>
            <TabsTrigger
              value='pending'
              className='rounded-lg data-[state=active]:bg-white data-[state=active]:text-green-900 data-[state=active]:shadow-sm'
            >
              Pending
            </TabsTrigger>
          </TabsList>

          {/* COMPLETED REQUESTS (Ready to send to schools) */}
          <TabsContent value='completed' className='mt-4 space-y-4'>
            <Card className='rounded-2xl border-black/5'>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow className='hover:bg-transparent'>
                      <TableHead>Professor</TableHead>
                      <TableHead>Date Signed</TableHead>
                      <TableHead className='text-right'>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className='py-10 text-center text-sm text-gray-400'
                        >
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : finishedLetters.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className='py-10 text-center text-sm text-gray-400'
                        >
                          No letters ready to send yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      finishedLetters.map((letter) => (
                        <TableRow key={letter.letterId}>
                          <TableCell className='font-medium'>
                            {letter.facultyName}
                          </TableCell>
                          <TableCell className='text-sm text-gray-500'>
                            {new Date(letter.finalizedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className='text-right'>
                            <div className='flex items-center justify-end gap-2'>
                              <LetterPreviewDialog
                                letterId={letter.letterId}
                                facultyName={letter.facultyName}
                                previewEnabled={letter.studentPreviewEnabled}
                              />
                              <SendToSchoolDialog letterId={letter.letterId} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PENDING REQUESTS */}
          <TabsContent value='pending' className='mt-4'>
            <Card className='rounded-2xl border-black/5'>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow className='hover:bg-transparent'>
                      <TableHead>Professor</TableHead>
                      <TableHead>Sent On</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className='py-10 text-center text-sm text-gray-400'
                        >
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : pendingRequests.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className='py-10 text-center text-sm text-gray-400'
                        >
                          No pending requests yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingRequests.map((req) => (
                        <TableRow key={req.requestId}>
                          <TableCell className='text-sm text-gray-700'>
                            {req.facultyEmail}
                          </TableCell>
                          <TableCell className='text-sm text-gray-500'>
                            {new Date(req.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                req.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : req.status === "invited"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {req.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
