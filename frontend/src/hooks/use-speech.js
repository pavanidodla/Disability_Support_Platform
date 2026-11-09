import { applySpeechLanguage, getSpeechLocale } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const utteranceRef = useRef(null);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (
      text,
      options,
    ) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate ?? 1;
      utterance.volume = options?.volume ?? 1;
      applySpeechLanguage(utterance); // language + a matching installed voice, if any
      if (options?.voiceName) {
        // A voice picked in Settings is used only when it matches the current language
        const voice = voices.find((v) => v.name === options.voiceName);
        if (voice && voice.lang.toLowerCase().startsWith(getSpeechLocale().slice(0, 2).toLowerCase())) {
          utterance.voice = voice;
        }
      }
      window.__accessaiSpoke = { text, at: Date.now() }; // lets the voice assistant ignore its own speech
      utterance.onend = () => {
        window.__accessaiSpoke = { text, at: Date.now() };
        setIsSpeaking(false);
        setIsPaused(false);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      setIsPaused(false);
    },
    [voices],
  );

  const pause = useCallback(() => {
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, isPaused]);

  const resume = useCallback(() => {
    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isSpeaking, isPaused]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  return { isSpeaking, isPaused, voices, speak, pause, resume, stop };
}
