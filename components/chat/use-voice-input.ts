"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";

/*
 * Voice input for the composer: ask for the microphone, record with the
 * browser's MediaRecorder, send the clip to /api/transcribe, receive text.
 * The recording never leaves the request; nothing is stored. The states map
 * one to one onto the voice window the composer shows. Whether the browser
 * can record at all is read through useSyncExternalStore so the server and
 * the first client render agree.
 */

export type VoiceState = "idle" | "requesting" | "listening" | "transcribing" | "denied" | "unsupported" | "error";

const MAX_SECONDS = 60;

function canRecord(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder === "function" && Boolean(navigator.mediaDevices?.getUserMedia);
}

const subscribe = () => () => {};

function preferredMime(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function isPermissionError(error: unknown): boolean {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError";
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const supported = useSyncExternalStore(subscribe, canRecord, () => false);
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const cancelled = useRef(false);
  const latest = useRef(onTranscript);
  useEffect(() => {
    latest.current = onTranscript;
  });

  const releaseStream = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ticker.current) window.clearInterval(ticker.current);
    timer.current = null;
    ticker.current = null;
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  /** Ends the recording; the clip is then transcribed. */
  const stop = useCallback(() => {
    const active = recorder.current;
    if (!active || active.state === "inactive") return;
    active.stop();
  }, []);

  /** Closes the window and throws the recording away. */
  const cancel = useCallback(() => {
    cancelled.current = true;
    const active = recorder.current;
    if (active && active.state !== "inactive") active.stop();
    else releaseStream();
    setState("idle");
    setError(null);
  }, [releaseStream]);

  const start = useCallback(async () => {
    if (state === "listening" || state === "requesting" || state === "transcribing") return;
    setError(null);
    setSeconds(0);
    cancelled.current = false;
    if (!canRecord()) {
      setState("unsupported");
      return;
    }
    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (caught) {
      setState(isPermissionError(caught) ? "denied" : "error");
      setError(isPermissionError(caught) ? null : "The microphone could not be started. Check that another app is not using it.");
      return;
    }
    if (cancelled.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const mimeType = preferredMime();
    const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    media.onstop = async () => {
      const type = media.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks.current, { type });
      releaseStream();
      if (cancelled.current) return;
      if (blob.size === 0) {
        setState("error");
        setError("Nothing was recorded. Try again a little closer to the microphone.");
        return;
      }
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "voice.webm");
        const language = navigator.language?.slice(0, 2);
        if (language) form.append("language", language);
        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        if (cancelled.current) return;
        if (!response.ok) {
          setState("error");
          setError(await errorMessageFrom(response, "The recording could not be transcribed."));
          return;
        }
        const json = (await response.json()) as { text: string };
        if (json.text) {
          latest.current(json.text);
          setState("idle");
        } else {
          setState("error");
          setError("Nothing was heard. Try again a little closer to the microphone.");
        }
      } catch {
        if (cancelled.current) return;
        setState("error");
        setError("The connection dropped. Please try again.");
      }
    };
    recorder.current = media;
    media.start();
    setState("listening");
    timer.current = window.setTimeout(stop, MAX_SECONDS * 1000);
    ticker.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
  }, [state, releaseStream, stop]);

  return { supported, state, error, seconds, maxSeconds: MAX_SECONDS, start, stop, cancel };
}
