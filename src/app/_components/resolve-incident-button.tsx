"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Button } from "./ui";

export function ResolveIncidentButton({
  incidentId,
  onResolved,
}: {
  incidentId: string;
  onResolved?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  const handleResolve = async () => {
    setIsLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/error/${incidentId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to resolve incident");

      if (onResolved) {
        onResolved();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Error resolving incident:", error);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {failed && (
        <span className="text-danger text-xs" role="alert">
          Couldn&apos;t resolve — try again
        </span>
      )}
      <Button size="sm" onClick={handleResolve} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isLoading ? "Resolving…" : "Mark resolved"}
      </Button>
    </div>
  );
}
