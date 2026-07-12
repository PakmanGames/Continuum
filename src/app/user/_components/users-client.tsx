"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Phone, Plus, Trash2, UserRound, X } from "lucide-react";

import type { users } from "~/server/db/schema";
import { relativeTime } from "~/lib/time";
import { Button, Card } from "~/app/_components/ui";

type User = typeof users.$inferSelect;

interface UsersClientProps {
  users: User[];
  createUserAction: (formData: FormData) => Promise<void>;
  deleteUserAction: (userId: number) => Promise<void>;
}

const inputClass =
  "border-border bg-bg text-fg placeholder:text-subtle focus:border-accent focus:ring-accent/30 mt-1.5 h-10 w-full rounded-md border px-3 text-sm transition-colors outline-none focus:ring-2";

/**
 * The on-call roster. These are the people Continuum escalates to — the number
 * on file is who gets the voice call — so the page says so, and deleting one
 * is a two-click inline confirm rather than a native dialog.
 */
export function UsersClient({
  users,
  createUserAction,
  deleteUserAction,
}: UsersClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setIsSaving(true);
      await createUserAction(new FormData(form));
      form.reset();
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      setDeletingId(userId);
      await deleteUserAction(userId);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-fg text-3xl font-semibold">
            On-call
          </h1>
          <p className="text-muted mt-1 text-sm">
            Who Continuum escalates to when it can&apos;t heal a service itself.
            The number on file is the one that gets the call.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Add person
        </Button>
      </header>

      {users.length === 0 ? (
        <Card className="py-16 text-center">
          <UserRound
            className="text-subtle mx-auto h-8 w-8"
            aria-hidden="true"
          />
          <p className="text-fg mt-4 text-sm font-medium">Nobody on call yet</p>
          <p className="text-muted mx-auto mt-1 max-w-sm text-sm">
            Add the first person and their phone number to receive escalations.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => {
            const confirming = confirmingId === user.id;
            const deleting = deletingId === user.id;
            return (
              <li key={user.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-fg truncate font-medium">{user.name}</p>
                      <p className="text-muted mt-0.5 truncate text-sm">
                        {user.email}
                      </p>
                    </div>
                    {!confirming && (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(user.id)}
                        className="text-subtle hover:bg-danger-soft hover:text-danger rounded-md p-1.5 transition-colors"
                        aria-label={`Remove ${user.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <p className="text-fg mt-4 flex items-center gap-2 font-mono text-sm">
                    <Phone className="text-subtle h-3.5 w-3.5" aria-hidden="true" />
                    {user.phoneNumber}
                  </p>

                  <div className="mt-auto pt-4">
                    {confirming ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted text-xs">
                          Remove from on-call?
                        </span>
                        <span className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingId(null)}
                            disabled={deleting}
                          >
                            Keep
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDelete(user.id)}
                            disabled={deleting}
                          >
                            {deleting ? (
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              "Remove"
                            )}
                          </Button>
                        </span>
                      </div>
                    ) : (
                      <p className="text-subtle text-xs">
                        Added {relativeTime(user.createdAt.toISOString())}
                      </p>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {isFormOpen && (
        <div
          className="bg-bg/60 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-person-title"
        >
          <Card className="w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="add-person-title"
                  className="font-display text-fg text-lg font-semibold"
                >
                  Add to on-call
                </h2>
                <p className="text-muted mt-1 text-sm">
                  They&apos;ll get a voice call when an incident needs a human.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-subtle hover:text-fg rounded-md p-1 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-fg text-sm font-medium">Name</span>
                <input
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Doe"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-fg text-sm font-medium">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="jane@company.com"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-fg text-sm font-medium">Phone</span>
                <input
                  name="phoneNumber"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="+1 555 123 4567"
                  className={inputClass}
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving && (
                    <Loader2
                      className="mr-2 h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {isSaving ? "Saving…" : "Add person"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
