import { useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, VolumeX } from 'lucide-react';
import type { ThemeMusicPreset, ThemeMusicSource, ThemeTemplate } from '../theme/types';
import { rhHiddenThemeMusicUrl } from '../theme/defaultTemplates';
import { useHiddenFeatureStore } from '../stores/hiddenFeatures';

interface ThemeMusicToggleProps {
  template: ThemeTemplate;
}

type Note = {
  freq: number;
  at: number;
  len: number;
  type?: OscillatorType;
};

const PRESET_NOTES: Record<ThemeMusicPreset, Note[]> = {
  'tech-pulse': [
    { freq: 220, at: 0, len: 0.12, type: 'sawtooth' },
    { freq: 330, at: 0.24, len: 0.09, type: 'triangle' },
    { freq: 277, at: 0.48, len: 0.12, type: 'sawtooth' },
    { freq: 440, at: 0.72, len: 0.1, type: 'triangle' },
    { freq: 392, at: 1.18, len: 0.14, type: 'sine' },
  ],
  'pixel-pop': [
    { freq: 523, at: 0, len: 0.08, type: 'square' },
    { freq: 659, at: 0.14, len: 0.08, type: 'square' },
    { freq: 784, at: 0.28, len: 0.08, type: 'square' },
    { freq: 1047, at: 0.42, len: 0.1, type: 'square' },
    { freq: 784, at: 0.62, len: 0.08, type: 'square' },
    { freq: 659, at: 0.76, len: 0.08, type: 'square' },
  ],
  'grand-line-adventure': [
    { freq: 392, at: 0, len: 0.18, type: 'triangle' },
    { freq: 494, at: 0.26, len: 0.16, type: 'triangle' },
    { freq: 587, at: 0.52, len: 0.18, type: 'triangle' },
    { freq: 659, at: 0.82, len: 0.2, type: 'sine' },
    { freq: 784, at: 1.18, len: 0.26, type: 'triangle' },
    { freq: 659, at: 1.62, len: 0.18, type: 'sine' },
  ],
  'rh-pulse': [
    { freq: 196, at: 0, len: 0.11, type: 'sine' },
    { freq: 294, at: 0.18, len: 0.08, type: 'triangle' },
    { freq: 392, at: 0.36, len: 0.08, type: 'triangle' },
    { freq: 523, at: 0.72, len: 0.11, type: 'sine' },
    { freq: 440, at: 1.08, len: 0.08, type: 'triangle' },
    { freq: 659, at: 1.34, len: 0.1, type: 'sine' },
  ],
  'shinobi-flame': [
    { freq: 147, at: 0, len: 0.08, type: 'sawtooth' },
    { freq: 220, at: 0.16, len: 0.08, type: 'square' },
    { freq: 294, at: 0.32, len: 0.1, type: 'sawtooth' },
    { freq: 440, at: 0.54, len: 0.1, type: 'triangle' },
    { freq: 392, at: 0.82, len: 0.08, type: 'square' },
    { freq: 587, at: 1.04, len: 0.12, type: 'sawtooth' },
    { freq: 784, at: 1.34, len: 0.16, type: 'triangle' },
  ],
  'eva-sync': [
    { freq: 110, at: 0, len: 0.08, type: 'sawtooth' },
    { freq: 165, at: 0.18, len: 0.08, type: 'square' },
    { freq: 220, at: 0.36, len: 0.1, type: 'sawtooth' },
    { freq: 330, at: 0.58, len: 0.11, type: 'triangle' },
    { freq: 247, at: 0.86, len: 0.08, type: 'square' },
    { freq: 494, at: 1.08, len: 0.12, type: 'sawtooth' },
    { freq: 659, at: 1.36, len: 0.18, type: 'triangle' },
  ],
  'spirit-gun': [
    { freq: 196, at: 0, len: 0.1, type: 'triangle' },
    { freq: 294, at: 0.18, len: 0.08, type: 'sawtooth' },
    { freq: 392, at: 0.36, len: 0.1, type: 'triangle' },
    { freq: 587, at: 0.62, len: 0.12, type: 'sine' },
    { freq: 784, at: 0.86, len: 0.12, type: 'triangle' },
    { freq: 988, at: 1.18, len: 0.16, type: 'sawtooth' },
    { freq: 740, at: 1.54, len: 0.14, type: 'sine' },
  ],
  'buzzer-beater': [
    { freq: 130, at: 0, len: 0.08, type: 'triangle' },
    { freq: 196, at: 0.18, len: 0.08, type: 'sine' },
    { freq: 262, at: 0.36, len: 0.09, type: 'triangle' },
    { freq: 330, at: 0.58, len: 0.1, type: 'sine' },
    { freq: 392, at: 0.82, len: 0.11, type: 'triangle' },
    { freq: 523, at: 1.08, len: 0.12, type: 'sine' },
    { freq: 392, at: 1.42, len: 0.1, type: 'square' },
    { freq: 659, at: 1.68, len: 0.16, type: 'triangle' },
  ],
};

const PRESET_LOOP_SECONDS: Record<ThemeMusicPreset, number> = {
  'tech-pulse': 1.75,
  'pixel-pop': 1.08,
  'grand-line-adventure': 2.15,
  'rh-pulse': 1.72,
  'shinobi-flame': 1.7,
  'eva-sync': 1.72,
  'spirit-gun': 1.92,
  'buzzer-beater': 2.08,
};

function clampVolume(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.16;
  return Math.max(0, Math.min(value, 0.5));
}

function scheduleNote(ctx: AudioContext, master: GainNode, note: Note, startAt: number, volume: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const attack = 0.012;
  const release = 0.045;
  const noteStart = startAt + note.at;
  const noteEnd = noteStart + note.len;

  oscillator.type = note.type || 'sine';
  oscillator.frequency.setValueAtTime(note.freq, noteStart);
  gain.gain.setValueAtTime(0.0001, noteStart);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), noteStart + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + release);

  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(noteStart);
  oscillator.stop(noteEnd + release + 0.02);
}

export default function ThemeMusicToggle({ template }: ThemeMusicToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const rhDuckUploadIds = useHiddenFeatureStore((s) => s.rhDuckUploadIds);
  const yyhPortraitIds = useHiddenFeatureStore((s) => s.yyhPortraitIds);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const autoHiddenMusicRef = useRef(false);
  const enabledRef = useRef(false);

  const rhHiddenMusicActive = template.visuals?.style === 'rh' && rhDuckUploadIds.length > 0;
  const yyhHiddenMusicActive = template.visuals?.style === 'yyh' && yyhPortraitIds.length > 0;
  const hiddenMusicActive = rhHiddenMusicActive || yyhHiddenMusicActive;
  const music = useMemo(() => {
    const base = template.music;
    if (!hiddenMusicActive) return base;
    if (yyhHiddenMusicActive) {
      return {
        title: base?.hiddenTitle || '幽游隐藏模式',
        preset: base?.preset || 'spirit-gun',
        source: (base?.hiddenUrl ? 'url' : base?.source || 'synth') as ThemeMusicSource,
        url: base?.hiddenUrl || base?.url,
        volume: base?.hiddenVolume ?? base?.volume ?? 0.18,
        bpm: base?.bpm,
        copyrightNote: base?.copyrightNote,
      };
    }
    return {
      title: base?.hiddenTitle || '沙耶之歌',
      preset: base?.preset || 'rh-pulse',
      source: 'url' as const,
      url: base?.hiddenUrl || rhHiddenThemeMusicUrl,
      volume: base?.hiddenVolume ?? base?.volume ?? 0.2,
      bpm: base?.bpm,
      copyrightNote: base?.copyrightNote,
    };
  }, [
    hiddenMusicActive,
    rhHiddenMusicActive,
    yyhHiddenMusicActive,
    template.music?.bpm,
    template.music?.copyrightNote,
    template.music?.hiddenTitle,
    template.music?.hiddenUrl,
    template.music?.hiddenVolume,
    template.music?.preset,
    template.music?.source,
    template.music?.title,
    template.music?.url,
    template.music?.volume,
  ]);

  const title = music?.title || 'Theme Music';
  const preset = music?.preset || 'tech-pulse';
  const volume = clampVolume(music?.volume);
  const musicKey = `${template.id}|${rhHiddenMusicActive ? 'rh-hidden' : yyhHiddenMusicActive ? 'yyh-hidden' : 'normal'}|${music?.preset || ''}|${music?.source || ''}|${music?.url || ''}|${volume}`;

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const stop = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (masterGainRef.current) {
      masterGainRef.current.disconnect();
      masterGainRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const playUrl = async (url: string) => {
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;
    await audio.play();
  };

  const playSynth = async () => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor() as AudioContext;
    const master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
    audioCtxRef.current = ctx;
    masterGainRef.current = master;
    if (ctx.state === 'suspended') await ctx.resume();

    const notes = PRESET_NOTES[preset] || PRESET_NOTES['tech-pulse'];
    const loopSeconds = PRESET_LOOP_SECONDS[preset] || PRESET_LOOP_SECONDS['tech-pulse'];
    const playLoop = () => {
      const startAt = ctx.currentTime + 0.015;
      notes.forEach((note) => scheduleNote(ctx, master, note, startAt, volume));
    };

    playLoop();
    timerRef.current = window.setInterval(playLoop, loopSeconds * 1000);
  };

  const playCurrentMusic = async () => {
    stop();
    try {
      if ((music?.source === 'url' || music?.source === 'upload') && music.url?.trim()) {
        await playUrl(music.url.trim());
      } else {
        await playSynth();
      }
      setEnabled(true);
      enabledRef.current = true;
    } catch (error) {
      stop();
      setEnabled(false);
      enabledRef.current = false;
      console.warn('[theme-music] unable to start theme music', error);
    }
  };

  const toggle = async () => {
    autoHiddenMusicRef.current = false;
    if (enabled) {
      stop();
      setEnabled(false);
      enabledRef.current = false;
      return;
    }
    await playCurrentMusic();
  };

  useEffect(() => {
    const wasPlaying = enabledRef.current;
    stop();
    if (hiddenMusicActive) {
      autoHiddenMusicRef.current = !wasPlaying;
      void playCurrentMusic();
      return stop;
    }

    if (wasPlaying && !autoHiddenMusicRef.current) {
      void playCurrentMusic();
    } else {
      setEnabled(false);
      enabledRef.current = false;
    }
    autoHiddenMusicRef.current = false;
    return stop;
  }, [musicKey]);

  return (
    <button
      type="button"
      className={`t8-theme-music-toggle nodrag nopan ${enabled ? 'is-playing' : ''}`}
      onClick={toggle}
      title={enabled ? `关闭主题音乐：${title}` : `播放主题音乐：${title}`}
      aria-label={enabled ? `关闭主题音乐：${title}` : `播放主题音乐：${title}`}
      aria-pressed={enabled}
    >
      {enabled ? <Disc3 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}
