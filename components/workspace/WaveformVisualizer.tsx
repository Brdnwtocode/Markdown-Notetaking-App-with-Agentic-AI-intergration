"use client";

// WaveformVisualizer.tsx
//
// Real-time canvas-based audio waveform renderer.
// Uses requestAnimationFrame for 60fps performance.
// Renders in Emerald (#10B981) on the dark Lock In background.

import { useRef, useEffect, useCallback } from "react";

interface WaveformVisualizerProps {
  /** Whether recording is active — drives animation loop */
  isActive: boolean;
  /** Current volume level (0–1), typically from an AnalyserNode */
  volume?: number;
  /** Width override; defaults to 100% of parent */
  width?: number;
  /** Height override; defaults to 120px */
  height?: number;
  /** Bar color; defaults to #10B981 (Emerald) */
  color?: string;
  /** Number of frequency bars; defaults to 64 */
  barCount?: number;
  /** Playback progress (0–1), draws a position indicator when provided */
  playbackProgress?: number;
}

export default function WaveformVisualizer({
  isActive,
  volume = 0.3,
  width,
  height = 120,
  color = "#10B981",
  barCount = 64,
  playbackProgress,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array>(new Uint8Array(barCount));

  // ─── Simulated frequency data when no real analyser is connected ─────────
  const getSimulatedData = useCallback(() => {
    const arr = new Uint8Array(barCount);
    const t = Date.now() / 1000;
    for (let i = 0; i < barCount; i++) {
      // Create a dynamic waveform pattern
      const base = Math.sin(t * 2 + i * 0.15) * 0.5 + 0.5;
      const ripple = Math.sin(t * 5 - i * 0.1) * 0.3;
      const noise = Math.random() * 0.15;
      arr[i] = Math.floor(
        Math.max(8, (base + ripple + noise) * volume * 255),
      );
    }
    return arr;
  }, [barCount, volume]);

  // ─── Animation loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = width || canvas.parentElement?.clientWidth || 800;
    const displayHeight = height;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    ctx.scale(dpr, dpr);

    const draw = () => {
      if (!canvas || !ctx) return;

      const w = displayWidth;
      const h = displayHeight;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Background grid lines (subtle)
      ctx.strokeStyle = "rgba(39, 39, 42, 0.3)";
      ctx.lineWidth = 0.5;
      const gridSpacing = 40;
      for (let x = 0; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      const midY = h / 2;
      ctx.strokeStyle = "rgba(39, 39, 42, 0.5)";
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // Get frequency data
      const data = analyserRef.current
        ? (analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>),
          dataArrayRef.current)
        : getSimulatedData();

      // Draw bars
      const barWidth = (w / barCount) * 0.85;
      const gap = (w / barCount) * 0.15;

      for (let i = 0; i < barCount; i++) {
        const value = data[i] / 255;
        const barHeight = Math.max(2, value * h * 0.9);

        // Gradient from muted to bright Emerald
        const alpha = 0.4 + value * 0.6;
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;

        const x = i * (barWidth + gap);
        const y = midY - barHeight / 2;

        // Rounded top corners
        const radius = Math.min(2, barWidth / 2);
        ctx.beginPath();
        ctx.moveTo(x, y + barHeight);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + barHeight);
        ctx.closePath();
        ctx.fill();
      }

      // Playback progress indicator
      if (typeof playbackProgress === "number" && playbackProgress > 0) {
        const px = playbackProgress * w;
        ctx.strokeStyle = "#10B981";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Playhead dot
        ctx.fillStyle = "#10B981";
        ctx.beginPath();
        ctx.arc(px, midY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, volume, width, height, barCount, color, getSimulatedData, playbackProgress]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-sm"
      style={{ minHeight: height }}
    />
  );
}

/**
 * Hook to connect a MediaStream to the WaveformVisualizer via AnalyserNode.
 * Returns { analyser, connectStream } — call connectStream(stream) once you
 * have the mic MediaStream, then pass analyser to WaveformVisualizer via ref.
 */
export function useWaveformAnalyser() {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const connectStream = useCallback((stream: MediaStream) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
    }
    const analyser = audioCtxRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;

    const source = audioCtxRef.current.createMediaStreamSource(stream);
    source.connect(analyser);
    // Don't connect to destination — we don't want speaker feedback

    analyserRef.current = analyser;
  }, []);

  const disconnect = useCallback(() => {
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  return { analyserRef, connectStream, disconnect };
}
