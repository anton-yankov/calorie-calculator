"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IScannerControls } from "@zxing/browser";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

function cameraMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access is blocked. Allow camera permission in your browser settings, or enter the code below.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No rear camera was found. Enter the barcode below instead.";
  }
  if (name === "NotReadableError") {
    return "The camera is in use by another app. Close it there and try again, or enter the code below.";
  }
  return "The camera couldn't start. Enter the barcode below instead.";
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchPending, setTorchPending] = useState(false);
  const [torchError, setTorchError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const previewElement: HTMLVideoElement = videoElement;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera scanning needs HTTPS and a supported browser. Enter the barcode below instead.",
        );
        return;
      }

      try {
        const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatOneDReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 750,
          tryPlayVideoTimeout: 5_000,
        });
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          previewElement,
          (result) => {
            if (!result || detectedRef.current) return;
            const barcode = result.getText().trim();
            if (!/^\d{7,14}$/.test(barcode)) return;
            detectedRef.current = true;
            controlsRef.current?.stop();
            navigator.vibrate?.(60);
            onDetected(barcode);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setTorchAvailable(Boolean(controls.switchTorch));
      } catch (error) {
        if (!cancelled) setCameraError(cameraMessage(error));
      }
    }

    void start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      const stream = previewElement.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected]);

  async function toggleTorch() {
    const switchTorch = controlsRef.current?.switchTorch;
    if (!switchTorch || torchPending) return;

    const nextTorchOn = !torchOn;
    setTorchPending(true);
    setTorchError(null);

    try {
      await switchTorch(nextTorchOn);
      setTorchOn(nextTorchOn);
    } catch {
      setTorchAvailable(false);
      setTorchError("The flashlight isn't available on this camera.");
    } finally {
      setTorchPending(false);
    }
  }

  function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const barcode = manualCode.replace(/\D/g, "");
    if (!/^\d{7,14}$/.test(barcode)) {
      setManualError("Enter the 7–14 digits printed below the barcode.");
      return;
    }
    detectedRef.current = true;
    controlsRef.current?.stop();
    onDetected(barcode);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
      className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-background"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="relative z-10 flex items-center justify-between border-b border-line bg-background/90 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
            Product scanner
          </p>
          <h2 id="barcode-scanner-title" className="font-serif text-xl font-semibold">
            Scan a food barcode
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close scanner"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-lg transition hover:border-accent"
        >
          ✕
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Live camera preview"
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(27,26,22,0.58),transparent_24%,transparent_70%,rgba(27,26,22,0.7))]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-[1.75/1] w-[82%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-panel border-2 border-foreground/85 shadow-[0_0_0_999px_rgba(27,26,22,0.28)]">
          <span className="barcode-scan-line absolute left-[4%] top-[12%] h-0.5 w-[92%] bg-accent shadow-[0_0_16px_3px_rgba(224,138,92,0.65)]" />
        </div>
        {torchAvailable && (
          <button
            type="button"
            aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            aria-pressed={torchOn}
            disabled={torchPending}
            onClick={() => void toggleTorch()}
            className="absolute right-5 top-5 flex h-11 items-center gap-2 rounded-full border border-white/35 bg-black/55 px-4 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-black/70 disabled:cursor-wait disabled:opacity-60"
          >
            <span aria-hidden="true">{torchOn ? "●" : "○"}</span>
            {torchOn ? "Light on" : "Light"}
          </button>
        )}
        {torchError && (
          <p className="absolute right-5 top-5 max-w-56 rounded-panel bg-black/70 px-3 py-2 text-right text-xs text-white backdrop-blur">
            {torchError}
          </p>
        )}
        <p className="absolute bottom-5 left-0 right-0 px-5 text-center text-sm font-medium text-foreground drop-shadow">
          Hold the code inside the frame
        </p>
        {cameraError && (
          <div className="absolute inset-x-5 top-5 rounded-panel border border-danger/50 bg-danger-soft/95 px-4 py-3 text-sm text-danger backdrop-blur">
            {cameraError}
          </div>
        )}
      </div>

      <form
        onSubmit={submitManual}
        className="border-t border-line bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
      >
        <label htmlFor="manual-barcode" className="mb-2 block text-xs font-semibold text-muted">
          Or enter the number below the barcode
        </label>
        <div className="flex gap-2">
          <input
            id="manual-barcode"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={manualCode}
            onChange={(event) => {
              setManualCode(event.target.value);
              setManualError(null);
            }}
            placeholder="e.g. 3017624010701"
            className="min-w-0 flex-1 rounded-panel border border-line bg-surface px-3 py-2.5 font-mono text-sm tabular-nums placeholder:text-muted/65 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:brightness-110"
          >
            Look up
          </button>
        </div>
        {manualError && <p className="mt-2 text-xs text-danger">{manualError}</p>}
      </form>
    </div>,
    document.body,
  );
}
