"use client";

import { CameraOff, Check, Flashlight, FlashlightOff, Keyboard, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "@/components/Button";
import { Field } from "@/components/fields";
import { Sheet } from "@/components/Sheet";
import { codeOutline, coverPlacement, type CodeOutline } from "@/lib/barcode-outline";

/** How long the read code stays on screen: the ~650ms morph, then a moment to see the number */
const LOCK_MS = 900;
/** Height kept clear above the hint and "Type the number" button at the bottom */
const BOTTOM_CONTROLS = 170;

interface BarcodeScannerProps {
  /** The moment a code is read or typed, so the caller can start looking it up */
  onRead: (barcode: string) => void;
  /** Once the read code has been shown; the caller closes the scanner */
  onFinished: () => void;
  onClose: () => void;
}

interface CameraProblem {
  title: string;
  message: string;
  /** Whether asking for the camera again could help */
  canRetry: boolean;
}

/** The code that was read, and where its outline lands in the view (null: it stays in the frame) */
interface Lock {
  barcode: string;
  outline: CodeOutline | null;
  view: { width: number; height: number };
}

function cameraProblem(error: unknown): CameraProblem {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      title: "The camera is blocked",
      message:
        "Allow camera access for this site in your browser settings, or type the number printed under the barcode.",
      canRetry: true,
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return {
      title: "No camera found",
      message: "There's no camera to scan with. Type the number printed under the barcode instead.",
      canRetry: false,
    };
  }
  if (name === "NotReadableError") {
    return {
      title: "The camera is busy",
      message: "Another app is using the camera. Close it there and try again, or type the number.",
      canRetry: true,
    };
  }
  return {
    title: "The camera couldn't start",
    message: "Try again, or type the number printed under the barcode.",
    canRetry: true,
  };
}

/** Where the number chip sits once the outline has landed: under the code, or above it near the bottom */
function chipPlacement({ outline, view }: Lock): CSSProperties | undefined {
  if (!outline) return undefined;
  const turn = (outline.angle * Math.PI) / 180;
  const halfHeight =
    (outline.width / 2) * Math.abs(Math.sin(turn)) +
    (outline.height / 2) * Math.abs(Math.cos(turn));
  const below = outline.y + halfHeight + 14;
  const top =
    below + 38 <= view.height - BOTTOM_CONTROLS ? below : outline.y - halfHeight - 14 - 38;
  return {
    left: Math.min(Math.max(outline.x, 110), view.width - 110),
    top,
  };
}

export function BarcodeScanner({ onRead, onFinished, onClose }: BarcodeScannerProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frozenRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const manualOpenRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [lock, setLock] = useState<Lock | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchPending, setTorchPending] = useState(false);
  const [torchError, setTorchError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
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

  // The parent hands down fresh callbacks on every render. Reading them
  // through refs keeps the camera effect from restarting on a re-render,
  // which could tear the camera down halfway through starting it.
  const onReadRef = useRef(onRead);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onReadRef.current = onRead;
    onFinishedRef.current = onFinished;
  });

  // Hands over once the read code has been on screen long enough to see
  useEffect(() => {
    if (!lock) return;
    const timer = window.setTimeout(() => onFinishedRef.current(), LOCK_MS);
    return () => window.clearTimeout(timer);
  }, [lock]);

  useEffect(() => {
    let cancelled = false;
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const previewElement: HTMLVideoElement = videoElement;

    /**
     * Lays the frame that was read over the preview, exactly where the
     * preview showed it, so the outline lands on a still picture of the code
     * rather than a moving one. Returns where the outline goes.
     */
    function freeze(frame: HTMLCanvasElement | null, ends: { x: number; y: number }[]) {
      const canvas = frozenRef.current;
      const view = viewRef.current;
      if (!frame?.width || !frame.height || !canvas || !view) return null;
      canvas.width = frame.width;
      canvas.height = frame.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(frame, 0, 0);
      const viewSize = { width: view.clientWidth, height: view.clientHeight };
      const { scale, left, top } = coverPlacement(frame, viewSize);
      Object.assign(canvas.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${frame.width * scale}px`,
        height: `${frame.height * scale}px`,
      });
      return codeOutline(
        ends,
        frame,
        viewSize,
        context.getImageData(0, 0, frame.width, frame.height),
      );
    }

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setProblem({
          title: "Scanning isn't available here",
          message:
            "Camera scanning needs HTTPS and a supported browser. Type the number printed under the barcode instead.",
          canRetry: false,
        });
        return;
      }

      try {
        const { createBarcodeReader, isScanMiss } = await import("@/lib/barcode-reader");
        if (cancelled) return;
        const reader = createBarcodeReader();
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
          (result, error, scan) => {
            // While the number sheet is open the camera keeps running, but reads are ignored
            if (detectedRef.current || manualOpenRef.current) return;
            if (error && !isScanMiss(error)) {
              // zxing ends the scan loop and releases the camera after this
              setProblem({
                title: "The scanner stopped",
                message: "Try the camera again, or type the number printed under the barcode.",
                canRetry: true,
              });
              return;
            }
            if (!result) return;
            const barcode = result.getText().trim();
            if (!/^\d{7,14}$/.test(barcode)) return;
            detectedRef.current = true;
            // Before stopping: the read frame is only kept until the next attempt
            const ends = result.getResultPoints().map((point) => ({
              x: point.getX(),
              y: point.getY(),
            }));
            const view = viewRef.current;
            const outline = freeze(reader.lastFrame, ends);
            scan.stop();
            navigator.vibrate?.(60);
            setLock({
              barcode,
              outline,
              view: { width: view?.clientWidth ?? 0, height: view?.clientHeight ?? 0 },
            });
            onReadRef.current(barcode);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setTorchAvailable(Boolean(controls.switchTorch));
      } catch (error) {
        if (!cancelled) setProblem(cameraProblem(error));
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
  }, [attempt]);

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

  function retryCamera() {
    setProblem(null);
    setTorchAvailable(false);
    setTorchOn(false);
    setAttempt((current) => current + 1);
  }

  function setManual(open: boolean) {
    manualOpenRef.current = open;
    setManualOpen(open);
  }

  function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const barcode = manualCode.replace(/\D/g, "");
    if (!/^\d{7,14}$/.test(barcode)) {
      setManualError("Enter the 7–14 digits printed under the barcode.");
      return;
    }
    detectedRef.current = true;
    controlsRef.current?.stop();
    onRead(barcode);
    onFinished();
  }

  const glassButton =
    "flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition";
  const chip = lock ? chipPlacement(lock) : undefined;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
      className="fixed inset-0 z-50 overflow-hidden bg-background text-foreground"
      onKeyDown={(event) => {
        // Escape in the number sheet closes just the sheet
        if (event.key === "Escape" && !manualOpen) onClose();
      }}
    >
      <div
        ref={viewRef}
        className="absolute inset-0 bg-black"
        style={{ "--scan-frame": "min(70vw, 42dvh, 17rem)" } as CSSProperties}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Live camera preview"
          className="h-full w-full object-cover"
        />
        <canvas
          ref={frozenRef}
          aria-hidden
          className={`absolute max-w-none ${lock ? "" : "hidden"}`}
        />
        {lock && <span aria-hidden className="scan-flash" />}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[linear-gradient(to_bottom,rgb(26_23_32/0.82),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-[linear-gradient(to_top,rgb(26_23_32/0.9)_30%,transparent)]"
        />

        {!problem && (
          <>
            <div
              aria-hidden
              className="scan-frame"
              data-locked={lock ? "" : undefined}
              style={
                lock?.outline
                  ? {
                      left: lock.outline.x,
                      top: lock.outline.y,
                      width: lock.outline.width,
                      height: lock.outline.height,
                      transform: `translate(-50%, -50%) rotate(${lock.outline.angle}deg)`,
                    }
                  : undefined
              }
            >
              <div className="scan-corners">
                <span className="scan-corner scan-corner-tl" />
                <span className="scan-corner scan-corner-tr" />
                <span className="scan-corner scan-corner-bl" />
                <span className="scan-corner scan-corner-br" />
              </div>
            </div>
            <p
              role="status"
              className="scan-status"
              data-locked={lock ? "" : undefined}
              style={chip}
            >
              <span className="scan-status-looking" aria-hidden={Boolean(lock)}>
                <i aria-hidden className="scan-live-dot" />
                Looking for a barcode
              </span>
              <span className="scan-status-found" aria-hidden={!lock}>
                <Check className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden />
                <span className="font-mono tabular-nums">{lock?.barcode}</span>
              </span>
            </p>
          </>
        )}
      </div>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          ref={closeRef}
          type="button"
          aria-label="Close scanner"
          onClick={onClose}
          className={`${glassButton} border-foreground/15 bg-background/55 hover:bg-background/80`}
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
        <h2 id="barcode-scanner-title" className="text-[17px] font-extrabold tracking-tight">
          Scan a barcode
        </h2>
        {torchAvailable && !problem && !lock ? (
          <button
            type="button"
            aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            aria-pressed={torchOn}
            disabled={torchPending}
            onClick={() => void toggleTorch()}
            className={`${glassButton} disabled:cursor-wait disabled:opacity-60 ${
              torchOn
                ? "border-accent bg-accent text-background"
                : "border-foreground/15 bg-background/55 hover:bg-background/80"
            }`}
          >
            {torchOn ? (
              <FlashlightOff className="h-5 w-5" strokeWidth={2} aria-hidden />
            ) : (
              <Flashlight className="h-5 w-5" strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : (
          <span aria-hidden className="h-11 w-11" />
        )}
      </header>

      {torchError && !problem && (
        <p className="absolute right-4 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-10 max-w-56 rounded-panel border border-foreground/15 bg-background/75 px-3 py-2 text-right text-xs backdrop-blur-md">
          {torchError}
        </p>
      )}

      {problem ? (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-background px-6">
          <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
            <span className="mb-1.5 flex h-[76px] w-[76px] items-center justify-center rounded-[26px] bg-surface text-muted">
              <CameraOff className="h-[34px] w-[34px]" strokeWidth={1.9} aria-hidden />
            </span>
            <h3 className="text-[22px] font-extrabold tracking-tight">{problem.title}</h3>
            <p className="mb-3 text-[15px] leading-normal text-muted">{problem.message}</p>
            <Button className="w-full" onClick={() => setManual(true)}>
              <Keyboard className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
              Type the number instead
            </Button>
            {problem.canRetry && (
              <Button variant="outline" className="w-full" onClick={retryCamera}>
                Try the camera again
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md flex-col gap-3.5 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p
            className={`text-center text-[14.5px] font-semibold ${
              lock ? "text-success" : "text-foreground/90"
            }`}
          >
            {lock ? "Got it. Looking it up…" : "Upright or sideways, both work."}
          </p>
          <button
            type="button"
            disabled={Boolean(lock)}
            onClick={() => setManual(true)}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-2xl border border-foreground/12 bg-surface-raised/75 text-[15px] font-bold backdrop-blur-md transition hover:bg-surface-raised disabled:opacity-40"
          >
            <Keyboard className="h-5 w-5 text-accent" strokeWidth={2} aria-hidden />
            Type the number instead
          </button>
        </div>
      )}

      <Sheet open={manualOpen} onClose={() => setManual(false)} title="Type the barcode number">
        <form onSubmit={submitManual} className="flex flex-col gap-3.5">
          <p className="-mt-1.5 text-[13.5px] text-muted">
            The 7–14 digits printed under the bars.
          </p>
          <Field
            label="Barcode number"
            value={manualCode}
            onChange={(value) => {
              setManualCode(value);
              setManualError(null);
            }}
            autoComplete="off"
          />
          {manualError && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {manualError}
            </p>
          )}
          <Button type="submit">Look up</Button>
        </form>
      </Sheet>
    </div>,
    document.body,
  );
}
