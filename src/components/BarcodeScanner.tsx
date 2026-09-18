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

  // The parent hands down a fresh onDetected closure on every render. Reading it
  // through a ref keeps the camera effect on an empty dependency list, so a
  // re-render can't tear the camera down halfway through starting it.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

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
        const { createBarcodeReader, isScanMiss } = await import("@/lib/barcode-reader");
        if (cancelled) return;
        const controls = await createBarcodeReader().decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          previewElement,
          (result, error, scan) => {
            if (detectedRef.current) return;
            if (error && !isScanMiss(error)) {
              // zxing ends the scan loop and releases the camera after this
              setCameraError("The scanner stopped unexpectedly. Enter the barcode below instead.");
              return;
            }
            if (!result) return;
            const barcode = result.getText().trim();
            if (!/^\d{7,14}$/.test(barcode)) return;
            detectedRef.current = true;
            scan.stop();
            navigator.vibrate?.(60);
            onDetectedRef.current(barcode);
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
  }, []);

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
        <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(78vw,52vh,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-white/45 shadow-[0_0_0_999px_rgba(27,26,22,0.32)]">
          <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-panel border-l-2 border-t-2 border-white" />
          <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-panel border-r-2 border-t-2 border-white" />
          <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-panel border-b-2 border-l-2 border-white" />
          <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-panel border-b-2 border-r-2 border-white" />
          <span className="barcode-scan-line-horizontal absolute left-[7%] top-1/2 h-0.5 w-[86%] -translate-y-1/2 bg-accent shadow-[0_0_16px_3px_rgba(224,138,92,0.65)]" />
          <span className="barcode-scan-line-vertical absolute left-1/2 top-[7%] h-[86%] w-0.5 -translate-x-1/2 bg-accent/55 shadow-[0_0_14px_2px_rgba(224,138,92,0.45)]" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
            Upright or sideways
          </div>
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
          Center the barcode and hold steady
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
