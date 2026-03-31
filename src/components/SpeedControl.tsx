import { useState, useRef, useEffect } from "react";

interface SpeedControlProps {
  currentSpeed: number;
  options: number[];
  onSpeedChange: (speed: number) => void;
}

export function SpeedControl({
  currentSpeed,
  options,
  onSpeedChange,
}: SpeedControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="vp-control-group" ref={ref}>
      <button
        className="vp-control-btn"
        onClick={() => setOpen(!open)}
        title="Playback speed"
      >
        {currentSpeed}x
      </button>
      {open && (
        <div className="vp-dropdown vp-dropdown-up">
          {options.map((speed) => (
            <button
              key={speed}
              className={`vp-dropdown-item ${speed === currentSpeed ? "active" : ""}`}
              onClick={() => {
                onSpeedChange(speed);
                setOpen(false);
              }}
            >
              {speed}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
