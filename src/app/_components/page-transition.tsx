"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTransition } from "./transition-provider";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({
  children,
  className = "",
}: PageTransitionProps) {
  const { duration, isTransitioning, showLoadingIndicator, loadingThreshold } =
    useTransition();
  const [isVisible, setIsVisible] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    // Slide in when component mounts
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Show loading indicator if transition takes too long
    if (isTransitioning && showLoadingIndicator) {
      const timer = setTimeout(() => {
        setShowLoading(true);
      }, loadingThreshold);

      return () => {
        clearTimeout(timer);
        setShowLoading(false);
      };
    } else {
      setShowLoading(false);
    }
  }, [isTransitioning, showLoadingIndicator, loadingThreshold]);

  return (
    <>
      {/* Loading indicator overlay */}
      {showLoading && (
        <div className="bg-bg/60 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="loading-spinner border-border border-t-accent h-10 w-10 rounded-full border-4" />
            <p className="text-muted text-sm">Loading…</p>
          </div>
        </div>
      )}

      {/* Page content with slide-in animation */}
      <div
        className={`page-transition-enter flex flex-1 ${className}`}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) translateX(0)" : "translateY(16px) translateX(-8px)",
          transition: `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        {children}
      </div>
    </>
  );
}
