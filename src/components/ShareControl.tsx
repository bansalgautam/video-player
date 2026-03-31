import { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

interface ShareControlProps {
  videoUrl: string;
}

export function ShareControl({ videoUrl }: ShareControlProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shortenedUrl, setShortenedUrl] = useState<string | null>(null);
  const [shortening, setShortening] = useState(false);
  const [shortenError, setShortenError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const shareUrl = window.location.href;

  // Build a shorter URL without the headers param for QR code
  const qrUrl = (() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("h");
      return u.toString();
    } catch {
      return shareUrl;
    }
  })();

  const hasHeaders = new URL(window.location.href).searchParams.has("h");

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset state when panel opens or URL changes
  useEffect(() => {
    setCopied(false);
    setShortenedUrl(null);
    setShortenError(null);
  }, [videoUrl]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const shortenUrl = useCallback(async () => {
    setShortening(true);
    setShortenError(null);
    try {
      const response = await fetch(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(shareUrl)}`,
      );
      const data = await response.json();
      if (data.shorturl) {
        setShortenedUrl(data.shorturl);
      } else {
        setShortenError(data.errormessage || "Failed to shorten URL");
      }
    } catch {
      setShortenError("Failed to shorten URL. Check your connection.");
    } finally {
      setShortening(false);
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Video Player",
          url: shortenedUrl || shareUrl,
        });
      } catch {
        // User cancelled
      }
    }
  }, [shareUrl, shortenedUrl]);

  const displayUrl = shortenedUrl || shareUrl;

  return (
    <div className="share-control" ref={ref}>
      <button
        className="change-video-btn share-btn"
        onClick={() => setOpen(!open)}
        title="Share video"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="currentColor"
          style={{ marginRight: 6 }}
        >
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
        </svg>
        Share
      </button>

      {open && (
        <div className="share-panel">
          <h3>Share this video</h3>

          {/* QR Code */}
          <div className="share-qr">
            <QRCodeSVG
              value={shortenedUrl || qrUrl}
              size={160}
              bgColor="#1a1b23"
              fgColor="#ffffff"
              level="M"
              marginSize={2}
            />
            {hasHeaders && !shortenedUrl && (
              <p className="share-qr-note">
                QR code contains URL only. Copy the full link to include
                headers.
              </p>
            )}
          </div>

          {/* URL display + copy */}
          <div className="share-url-row">
            <input
              className="share-url-field"
              value={displayUrl}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              className="share-copy-btn"
              onClick={() => copyToClipboard(displayUrl)}
            >
              {copied ? (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                >
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
              )}
            </button>
          </div>

          {/* Shorten URL */}
          <div className="share-actions">
            {!shortenedUrl && (
              <button
                className="share-action-btn"
                onClick={shortenUrl}
                disabled={shortening}
              >
                {shortening ? "Shortening..." : "Shorten URL"}
              </button>
            )}
            {shortenError && (
              <span className="share-error">{shortenError}</span>
            )}

            {/* Native share (mobile) */}
            {"share" in navigator && (
              <button className="share-action-btn" onClick={handleNativeShare}>
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                  style={{ marginRight: 4 }}
                >
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                </svg>
                Share via...
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
