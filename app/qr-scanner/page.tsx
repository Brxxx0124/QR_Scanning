"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import axios from "axios";

export default function QRScannerPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [result, setResult] = useState<string>("");

  interface TorchConstraint extends MediaTrackConstraintSet {
    torch?: boolean;
  }

  function extractEmailFromQR(qrResult: string): string | null {
    if (!qrResult) return null;

    // Case 1: QR has "mailto:" format
    if (qrResult.startsWith("mailto:")) {
      return qrResult.replace("mailto:", "").trim();
    }

    // Case 2: QR is a plain email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(qrResult)) {
      return qrResult.trim();
    }

    // Case 3: QR is something else (like URL, text, etc.)
    return qrResult;
  }

  // init camera list
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        const cams = devices.map((d) => ({
          id: d.id,
          label: d.label || `Camera ${d.id}`,
        }));
        setCameras(cams);
        setCameraId(cams[0]?.id ?? null);
      })
      .catch(console.error);
  }, []);

  // start scanner when cameraId changes
  useEffect(() => {
    if (!cameraId) return;

    const elId = "qr-reader";
    // create instance once
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(elId, { verbose: false });
    }

    // const config: Html5QrcodeCameraScanConfig = {
    //   fps: 15,
    //   qrbox: { width: 260, height: 260 },
    //   aspectRatio: 1.7778,
    //   // Try continuous autofocus; browsers will ignore unsupported constraints.
    //   experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    // };

    const config: Html5QrcodeCameraScanConfig & {
      experimentalFeatures?: { useBarCodeDetectorIfSupported?: boolean };
    } = {
      fps: 15,
      qrbox: { width: 260, height: 260 },
      aspectRatio: 1.7778,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }, // ✅ allowed now
    };
    let cancelled = false;

    const start = async () => {
      try {
        await scannerRef.current!.start(
          { deviceId: { exact: cameraId } },
          config,
          (decodedText) => {
            setResult(decodedText);
            // stop after first good read (optional)
            axios.post("/api/send-email", { To: decodedText });
            stop();
            try {
              navigator.vibrate?.(100);
            } catch {}
          },
          (error) => {
            // scan errors are noisy; ignore unless debugging
            // console.debug(error);
          }
        );
        // apply torch state if requested
        if (torchOn) await toggleTorch(true);
      } catch (e) {
        console.error(e);
      }
    };

    const stop = async () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    };

    start();

    return () => {
      if (!cancelled) {
        cancelled = true;
        stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  const stop = async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
  };

  const restart = async () => {
    if (!cameraId) return;
    await stop();
    setResult("");
    // trigger effect by “re-setting” cameraId
    setCameraId((id) => (id ? `${id}` : id));
  };

  const toggleTorch = async (on?: boolean) => {
    if (!scannerRef.current) return;

    // html5-qrcode exposes capability via applyVideoConstraints on the underlying stream
    // It proxies constraints; browsers will ignore unsupported torch.
    try {
      const stream = (scannerRef.current as any).getState()?.stream as
        | MediaStream
        | undefined;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return;

      const target = on ?? !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: target } as TorchConstraint],
      });
      setTorchOn(target);
    } catch (err) {
      console.warn("Torch not supported on this device/browser.", err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Ensure scanner instance exists
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("qr-reader");
      // axios.post("/api/send-email", { To: scannerRef.current });
    }
    try {
      setResult("");
      await stop();
      const text = await scannerRef.current.scanFile(file, true); // show image
      console.log("TESXT : ", text);
      axios.post("/api/send-email", { to: text });
      setResult(text);
    } catch (err) {
      setResult("No QR found in image.");
    }
  };

  return (
    <main className="min-h-screen p-6 flex flex-col items-center gap-4 bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Next.js QR Scanner</h1>

        {/* Controls */}
        <div className="flex flex-col gap-2 mb-3">
          <label className="text-sm">Camera</label>
          <select
            className="border rounded px-3 py-2"
            value={cameraId ?? ""}
            onChange={(e) => setCameraId(e.target.value)}
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              onClick={restart}
              className="px-3 py-2 rounded bg-black text-white"
            >
              Restart
            </button>
            <button
              onClick={() => toggleTorch()}
              className="px-3 py-2 rounded border"
            >
              {torchOn ? "Torch Off" : "Torch On"}
            </button>
            <label className="px-3 py-2 rounded border cursor-pointer">
              Upload Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </div>
        </div>

        {/* Scanner viewport */}
        <div
          id="qr-reader"
          className="rounded-lg overflow-hidden border bg-black aspect-video flex items-center justify-center"
        />

        {/* Result */}
        <div className="mt-4">
          <p className="text-sm text-gray-600">Result</p>
          <textarea
            readOnly
            className="w-full min-h-[96px] border rounded p-2 text-sm"
            value={result}
          />
        </div>
      </div>
    </main>
  );
}
