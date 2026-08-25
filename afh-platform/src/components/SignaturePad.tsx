"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draw-to-sign canvas. The drawn image is a PNG data URL in a hidden input, and
 * the typed name is captured alongside it — a typed name is what actually makes
 * the signature usable when someone signs from a keyboard-only device, so the
 * drawing is optional and the name is not.
 */
export function SignaturePad({
  action,
  signatureId,
  token,
  signerLabel,
  consentText,
  defaultName = "",
  submitLabel = "Sign",
}: {
  action: (formData: FormData) => void | Promise<void>;
  signatureId?: string;
  token?: string;
  signerLabel: string;
  consentText: string;
  defaultName?: string;
  submitLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [imageData, setImageData] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size the backing store to the device pixel ratio so the line isn't blurry
    // on a phone, which is where most family members will sign.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#12181f";

    let drawing = false;

    const pos = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };

    const start = (event: PointerEvent) => {
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const { x, y } = pos(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      event.preventDefault();
    };

    const move = (event: PointerEvent) => {
      if (!drawing) return;
      const { x, y } = pos(event);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasDrawing(true);
      event.preventDefault();
    };

    const end = () => {
      if (!drawing) return;
      drawing = false;
      setImageData(canvas.toDataURL("image/png"));
    };

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);

    return () => {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointerleave", end);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    setImageData("");
  };

  return (
    <form action={action} className="space-y-4">
      {signatureId && <input type="hidden" name="signatureId" value={signatureId} />}
      {token && <input type="hidden" name="token" value={token} />}
      <input type="hidden" name="imageData" value={imageData} />

      <div>
        <label className="label" htmlFor={`typedName-${signatureId ?? token}`}>
          Full name of {signerLabel} <span className="text-red-600">*</span>
        </label>
        <input
          id={`typedName-${signatureId ?? token}`}
          name="typedName"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          autoComplete="name"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="label mb-0">Draw your signature (optional)</span>
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="h-36 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
          aria-label="Signature drawing area"
        />
        <p className="mt-1 text-xs text-slate-500">
          {hasDrawing
            ? "Signature captured."
            : "Sign with a finger, stylus, or mouse. Your typed name is enough on its own."}
        </p>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>{consentText}</span>
      </label>

      <button type="submit" disabled={!agreed || name.trim() === ""} className="btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}
