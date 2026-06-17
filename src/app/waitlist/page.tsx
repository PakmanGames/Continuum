"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import { Pulse } from "../_components/ui/pulse";

const PROOF_POINTS = [
  "Agentic diagnosis — an LLM explains the failure and proposes the fix",
  "Self-healing — remediation applied automatically, with rollback",
  "Voice escalation — an AI call to the on-call human when it can't heal itself",
];

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("submitting");
    setError(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note: note || undefined }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Something went wrong.");

      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("idle");
    }
  };

  return (
    <div data-theme="light" className="bg-bg text-fg min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="font-display flex items-center gap-2 text-lg font-semibold"
          >
            <Pulse tone="accent" />
            Continiuum
          </Link>
          <Link
            href="/"
            className="text-muted hover:text-fg inline-flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-start lg:py-24">
        <div>
          <p className="border-border bg-surface text-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs tracking-widest uppercase">
            <Pulse tone="accent" />
            Private beta
          </p>
          <h1 className="font-display mt-6 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Continiuum isn&apos;t open yet.
          </h1>
          <p className="text-muted mt-5 text-lg">
            We&apos;re still hardening the agent mesh against real production
            traffic. Leave your email and we&apos;ll get you in as soon as
            there&apos;s room.
          </p>

          <ul className="mt-8 space-y-3">
            {PROOF_POINTS.map((point) => (
              <li key={point} className="text-muted flex gap-3 text-sm">
                <Check
                  className="text-accent mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-border bg-surface rounded-xl border p-8">
          {state === "done" ? (
            <div className="py-4 text-center">
              <span className="bg-success-soft text-success inline-flex h-12 w-12 items-center justify-center rounded-full">
                <Check className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="font-display text-fg mt-5 text-xl font-semibold">
                You&apos;re on the list
              </h2>
              <p className="text-muted mt-2 text-sm">
                We&apos;ll email {email} when your spot opens up.
              </p>
              <Link
                href="/"
                className="text-accent hover:text-accent-strong mt-6 inline-block text-sm font-medium transition-colors"
              >
                Back to the homepage
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="text-fg block text-sm font-medium"
                >
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="border-border bg-bg text-fg placeholder:text-subtle focus:border-accent focus:ring-accent/30 mt-2 h-11 w-full rounded-md border px-3 text-sm transition-colors outline-none focus:ring-2"
                />
              </div>

              <div>
                <label
                  htmlFor="note"
                  className="text-fg block text-sm font-medium"
                >
                  What are you running?{" "}
                  <span className="text-subtle font-normal">(optional)</span>
                </label>
                <textarea
                  id="note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="40 containers on ECS, mostly Node and Go services."
                  className="border-border bg-bg text-fg placeholder:text-subtle focus:border-accent focus:ring-accent/30 mt-2 w-full resize-none rounded-md border px-3 py-2 text-sm transition-colors outline-none focus:ring-2"
                />
              </div>

              {error && (
                <p className="text-danger text-sm" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={state === "submitting"}
                className="bg-accent text-accent-contrast hover:bg-accent-strong hover:shadow-glow inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "submitting" && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {state === "submitting" ? "Joining…" : "Join the waitlist"}
              </button>

              <p className="text-subtle text-center text-xs">
                One email when we let you in. Nothing else.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
