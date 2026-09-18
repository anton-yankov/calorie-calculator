import { BrowserMultiFormatOneDReader, HTMLCanvasElementLuminanceSource } from "@zxing/browser";
import {
  BarcodeFormat,
  BinaryBitmap,
  ChecksumException,
  DecodeHintType,
  FormatException,
  HybridBinarizer,
  NotFoundException,
  type LuminanceSource,
} from "@zxing/library";

/** The captured frame turned a quarter turn, so a sideways barcode reads as an upright one. */
function turnedFrame(frame: HTMLCanvasElement): HTMLCanvasElement {
  const turned = document.createElement("canvas");
  turned.width = frame.height;
  turned.height = frame.width;
  const context = turned.getContext("2d");
  if (!context) throw new Error("Couldn't get a 2D context to turn the camera frame.");
  context.translate(0, frame.width);
  context.rotate(-Math.PI / 2);
  context.drawImage(frame, 0, 0);
  return turned;
}

/**
 * zxing's own canvas source crashes when the TRY_HARDER hint asks it to rotate
 * (its temp canvas is never created, and it wouldn't swap width and height if
 * it were), which silently ends the scan loop and blanks the preview. This one
 * rotates by drawing a turned copy of the frame instead.
 */
class TurnableFrameSource extends HTMLCanvasElementLuminanceSource {
  constructor(private readonly frame: HTMLCanvasElement) {
    super(frame);
  }

  override rotateCounterClockwise(): LuminanceSource {
    return new HTMLCanvasElementLuminanceSource(turnedFrame(this.frame));
  }
}

class SidewaysCapableReader extends BrowserMultiFormatOneDReader {
  override decodeFromCanvas(canvas: HTMLCanvasElement) {
    return this.decodeBitmap(
      new BinaryBitmap(new HybridBinarizer(new TurnableFrameSource(canvas))),
    );
  }
}

/** A reader for the retail formats that reads them upright or sideways. */
export function createBarcodeReader() {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.CODE_128,
  ]);
  return new SidewaysCapableReader(hints, {
    delayBetweenScanAttempts: 180,
    delayBetweenScanSuccess: 750,
    tryPlayVideoTimeout: 5_000,
  });
}

/**
 * "No barcode in this frame" errors, which zxing reports on almost every frame
 * and keeps scanning after. Anything else ends the scan loop for good.
 */
export function isScanMiss(error: unknown): boolean {
  return (
    error instanceof NotFoundException ||
    error instanceof ChecksumException ||
    error instanceof FormatException
  );
}
