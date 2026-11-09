import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechRecognition(options) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const SpeechRecognition =
      (window ).SpeechRecognition ||
      (window ).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    const SpeechRecognition =
      (window ).SpeechRecognition ||
      (window ).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = options?.continuous ?? true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          optionsRef.current?.onResult?.({
            transcript: result[0].transcript,
            confidence: result[0].confidence,
          });
          optionsRef.current?.onCommand?.(result[0].transcript.trim().toLowerCase());
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart if continuous and still should be listening
      if (options?.continuous && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError("Failed to start speech recognition.");
    }
  }, [options?.continuous]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  return { isListening, isSupported, transcript, error, startListening, stopListening };
}
