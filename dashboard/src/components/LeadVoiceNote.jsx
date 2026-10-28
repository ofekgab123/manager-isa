import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Play, Send } from 'lucide-react';
import Recorder from 'opus-recorder';
import { API_BASE } from '../config';

const ENCODER_URL = '/opus-encoder-worker.min.js?v=8.0.5';
const MAX_RECORD_MS = 120_000;
const MIC_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

function stopMicStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try { track.stop(); } catch { /* already stopped */ }
  });
}

function formatVoiceClock(ms) {
  const total = Math.max(0, Math.round(Number(ms) / 1000) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the recording'));
    reader.readAsDataURL(blob);
  });
}

async function releaseRecorder(recorder, { discard = false } = {}) {
  if (!recorder) return;
  try {
    if (discard) recorder.ondataavailable = () => {};
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      await recorder.stop();
    }
  } catch {
    /* already stopped */
  }
  try {
    await recorder.close();
  } catch {
    /* mic already released */
  }
}

export async function sendVoiceNote(leadId, blob, durationMs) {
  const audioBase64 = await blobToBase64(blob);
  const res = await fetch(`${API_BASE}/leads/${leadId}/send-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/ogg',
      durationMs,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not send the voice message');
  return data;
}

export function VoiceMessagePlayer({ leadId, messageId, durationMs, inverted = false }) {
  const audioRef = useRef(null);
  const urlRef = useRef('');
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [knownDuration, setKnownDuration] = useState(durationMs || 0);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const load = async () => {
    if (src) {
      audioRef.current?.play?.().catch(() => {});
      return;
    }
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/messages/${messageId}/audio`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not load the recording');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const el = audioRef.current;
      if (el) el.src = url;
      setSrc(url);
      await el?.play?.().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-[200px]">
      <div className="flex items-center gap-2">
        {!src && (
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              inverted ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
            aria-label="Play voice message"
          >
            {loading ? <span className="text-xs">…</span> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>
        )}
        <div className="min-w-0">
          <p className={`text-xs font-medium ${inverted ? 'text-indigo-100' : 'text-slate-500'}`}>
            Voice message{knownDuration ? ` · ${formatVoiceClock(knownDuration)}` : ''}
          </p>
          <audio
            ref={audioRef}
            src={src || undefined}
            controls={!!src}
            preload="none"
            className={src ? 'h-8 max-w-[220px] mt-1' : 'hidden'}
            onLoadedMetadata={(event) => {
              const seconds = event.currentTarget.duration;
              if (Number.isFinite(seconds) && seconds > 0) setKnownDuration(seconds * 1000);
            }}
          />
        </div>
      </div>
      {error && (
        <p className={`text-[11px] mt-1 ${inverted ? 'text-indigo-100' : 'text-red-600'}`}>{error}</p>
      )}
    </div>
  );
}

export function VoiceRecordButton({ disabled = false, onBusyChange, onError, onSend }) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const discardRef = useRef(false);
  const busyRef = useRef(false);
  const startedAtRef = useRef(0);
  const tickRef = useRef(null);
  const limitRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pending, setPending] = useState(null);

  const busy = phase !== 'idle';

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const clearTimers = () => {
    clearInterval(tickRef.current);
    clearTimeout(limitRef.current);
    tickRef.current = null;
    limitRef.current = null;
  };

  const releaseMic = () => {
    const stream = streamRef.current;
    const audioContext = audioContextRef.current;
    streamRef.current = null;
    audioContextRef.current = null;
    stopMicStream(stream);
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  };

  const stopAndClose = async (discard) => {
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    await releaseRecorder(recorder, { discard });
    releaseMic();
  };

  useEffect(() => () => {
    discardRef.current = true;
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    releaseRecorder(recorder, { discard: true });
    const stream = streamRef.current;
    const audioContext = audioContextRef.current;
    streamRef.current = null;
    audioContextRef.current = null;
    stopMicStream(stream);
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  }, []);

  const start = async () => {
    if (disabled || busyRef.current || phase !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia || !Recorder.isRecordingSupported()) {
      onError?.('This browser cannot record voice messages. Use Chrome or Edge.');
      return;
    }
    onError?.('');
    discardRef.current = false;

    // Invoked in the click, before any await, so the browser shows the permission prompt.
    const streamPromise = navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    let audioContext;
    try {
      audioContext = new AudioContext();
      audioContextRef.current = audioContext;
    } catch (err) {
      streamPromise.then((stream) => stopMicStream(stream)).catch(() => {});
      onError?.(err?.message || 'Could not start the microphone');
      return;
    }

    let stream;
    try {
      stream = await streamPromise;
    } catch (err) {
      releaseMic();
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      onError?.(denied
        ? 'Allow the microphone in the browser prompt, then click the mic again.'
        : (err?.message || 'Could not start the microphone'));
      return;
    }
    streamRef.current = stream;
    if (discardRef.current) {
      releaseMic();
      return;
    }

    const sourceNode = audioContext.createMediaStreamSource(stream);
    const recorder = new Recorder({
      encoderPath: ENCODER_URL,
      sourceNode,
      encoderApplication: 2048,
      encoderBitRate: 24000,
      numberOfChannels: 1,
      encoderSampleRate: 48000,
      streamPages: false,
      monitorGain: 0,
    });
    recorderRef.current = recorder;
    try {
      await recorder.start();
    } catch (err) {
      await releaseRecorder(recorder, { discard: true });
      recorderRef.current = null;
      releaseMic();
      onError?.(err?.message || 'Could not start the microphone');
      return;
    }
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setPhase('recording');
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    limitRef.current = setTimeout(() => {
      finishAndSend();
    }, MAX_RECORD_MS);
  };

  const takeRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) throw new Error('Not recording');
    const durationMs = Date.now() - startedAtRef.current;
    const bytes = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Recording timed out')), 8000);
      recorder.ondataavailable = (data) => {
        clearTimeout(timer);
        resolve(data instanceof Uint8Array ? data : new Uint8Array(data || []));
      };
      recorder.stop().catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    recorderRef.current = null;
    clearTimers();
    try {
      await recorder.close();
    } catch {
      /* already closed */
    }
    releaseMic();
    if (!bytes?.byteLength || bytes.byteLength < 800 || durationMs < 500) {
      throw new Error('Recording is too short');
    }
    return {
      blob: new Blob([bytes], { type: 'audio/ogg; codecs=opus' }),
      durationMs,
    };
  };

  const upload = async (blob, durationMs) => {
    busyRef.current = true;
    setPhase('sending');
    onError?.('');
    try {
      await onSend(blob, durationMs);
      setPending(null);
      setPhase('idle');
      setElapsedMs(0);
    } catch (err) {
      setPending({ blob, durationMs });
      setPhase('pending');
      onError?.(err.message || 'Could not send the voice message');
    } finally {
      busyRef.current = false;
    }
  };

  const finishAndSend = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const recorded = await takeRecording();
      busyRef.current = false;
      if (discardRef.current) {
        setPhase('idle');
        setElapsedMs(0);
        return;
      }
      await upload(recorded.blob, recorded.durationMs);
    } catch (err) {
      busyRef.current = false;
      await stopAndClose(true);
      setPhase('idle');
      setElapsedMs(0);
      if (!discardRef.current) onError?.(err.message || 'Could not finish the recording');
    }
  };

  const cancel = async () => {
    discardRef.current = true;
    busyRef.current = false;
    setPending(null);
    await stopAndClose(true);
    setPhase('idle');
    setElapsedMs(0);
    onError?.('');
  };

  if (phase === 'recording' || phase === 'sending') {
    return (
      <div className="flex flex-1 items-center gap-2 min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-3">
        <span className={`w-2 h-2 rounded-full bg-red-500 ${phase === 'recording' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium text-red-700 tabular-nums">{formatVoiceClock(elapsedMs)}</span>
        <span className="text-xs text-red-400">/ 2:00</span>
        <span className="flex-1 text-xs text-red-700/80">
          {phase === 'sending' ? 'Sending voice message…' : 'Recording'}
        </span>
        <button
          type="button"
          onClick={cancel}
          disabled={phase === 'sending'}
          className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={finishAndSend}
          disabled={phase === 'sending'}
          className="btn-primary px-3 py-2"
          aria-label="Send voice message"
        >
          {phase === 'sending' ? '…' : <Send className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  if (phase === 'pending' && pending) {
    return (
      <div className="flex flex-1 items-center gap-2 min-h-[44px] rounded-xl border border-amber-200 bg-amber-50 px-3">
        <span className="flex-1 text-xs text-amber-800">Voice message was not sent.</span>
        <button type="button" onClick={cancel} className="text-xs text-slate-500 hover:text-slate-800">
          Discard
        </button>
        <button
          type="button"
          onClick={() => upload(pending.blob, pending.durationMs)}
          className="btn-primary px-3 py-2 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      title="Record a voice message"
      aria-label="Record a voice message"
      className="shrink-0 h-[44px] w-[44px] rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 flex items-center justify-center"
    >
      <Mic className="w-4 h-4" />
    </button>
  );
}

const ATTACH_BUTTON_CLASS = 'shrink-0 h-[44px] w-[44px] rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 flex items-center justify-center';
const PHOTO_PLACEHOLDERS = new Set(['Photo', 'Sticker']);

export function imageCaption(body) {
  const text = String(body || '').trim();
  if (!text || PHOTO_PLACEHOLDERS.has(text)) return '';
  return text;
}

export function prepareChatImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('Choose a photo'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const edge = Math.max(img.width, img.height) || 1;
      const scale = Math.min(1, 1600 / edge);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not read the photo'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const exportJpeg = (quality) => new Promise((done) => {
        canvas.toBlob((blob) => done(blob), 'image/jpeg', quality);
      });
      (async () => {
        let quality = 0.82;
        let blob = await exportJpeg(quality);
        while (blob && blob.size > 2_400_000 && quality > 0.5) {
          quality -= 0.12;
          blob = await exportJpeg(quality);
        }
        if (!blob) throw new Error('Could not read the photo');
        if (blob.size > 4 * 1024 * 1024) throw new Error('Photo is too large');
        resolve(blob);
      })().catch(reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the photo. Use a JPEG or PNG.'));
    };
    img.src = url;
  });
}

export async function sendChatImage(leadId, blob, caption) {
  const imageBase64 = await blobToBase64(blob);
  const res = await fetch(`${API_BASE}/leads/${leadId}/send-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType: blob.type || 'image/jpeg',
      caption: caption || '',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not send the photo');
  return data;
}

export function ChatImage({ leadId, messageId, caption = '' }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let url = '';
    let cancelled = false;
    (async () => {
      const res = await fetch(`${API_BASE}/leads/${leadId}/messages/${messageId}/media`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not load the photo');
      }
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      setSrc(url);
    })().catch((err) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [leadId, messageId]);

  if (error) return <p className="text-xs">{error}</p>;
  if (!src) return <p className="text-xs opacity-70">Loading photo…</p>;
  return (
    <button
      type="button"
      onClick={() => window.open(src, '_blank', 'noopener')}
      className="block"
      title="Open photo"
    >
      <img
        src={src}
        alt={caption || 'Photo'}
        className="max-h-64 max-w-[240px] rounded-xl object-cover bg-black/5"
      />
    </button>
  );
}

export function ImagePickButton({ disabled = false, onPick, onError }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file) => {
    if (!file) return;
    setBusy(true);
    onError?.('');
    try {
      const blob = await prepareChatImage(file);
      onPick(blob);
    } catch (err) {
      onError?.(err.message || 'Could not read the photo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          choose(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        title="Send a photo"
        aria-label="Send a photo"
        className={ATTACH_BUTTON_CLASS}
      >
        {busy ? <span className="text-xs">…</span> : <ImageIcon className="w-4 h-4" />}
      </button>
    </>
  );
}
