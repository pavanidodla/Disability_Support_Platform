import { LANGUAGES, applySpeechLanguage, getSpeechLocale, translate, useI18n } from "@/i18n";
import { logActivity } from "@/lib/activity";
import {
  detectWake,
  getHelpText,
  normalize,
  parseVoiceCommand,
} from "@/lib/voice-commands";
import { Mic, MicOff } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";

const STORAGE_KEY = "accessai_voice_enabled";
const AWAKE_MS = 90_000; // go back to sleep after this long without a command
const PUBLIC_PATHS = ["/", "/auth"];
const CLICKABLE =
  "button, a[href], [role='button'], [role='tab'], [role='switch'], [role='checkbox'], [role='menuitem'], summary";

const VoiceAssistantContext = createContext(null);

export function useVoiceAssistant() {
  const ctx = useContext(VoiceAssistantContext);
  if (!ctx) throw new Error("useVoiceAssistant must be used inside VoiceAssistantProvider");
  return ctx;
}

/* ---------------------------- DOM helpers ---------------------------- */

function isVisible(el) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none";
}
const isDisabled = (el) => el.disabled === true || el.getAttribute("aria-disabled") === "true";
const labelOf = (el) =>
  (el.getAttribute("aria-label") || el.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();

// Find a visible button/link on the page by its label (aria-label or text)
function findClickable(labels) {
  const all = [...document.querySelectorAll(CLICKABLE)].filter(
    (el) => !el.closest("[data-voice-ignore]") && isVisible(el),
  );
  const candidates = all.map((el) => ({ el, label: labelOf(el) }));
  let sawDisabled = false;

  for (const raw of labels) {
    const q = raw.replace(/\b(button|link|tab|option)\b/g, "").replace(/\s+/g, " ").trim();
    if (!q) continue;

    const byLength = (a, b) => a.label.length - b.label.length;
    let matches = candidates.filter((c) => c.label === q);
    if (!matches.length) matches = candidates.filter((c) => c.label.includes(q)).sort(byLength);
    if (!matches.length) {
      const words = q.split(" ").filter((w) => w.length > 1);
      if (words.length) {
        matches = candidates
          .map((c) => ({ ...c, score: words.filter((w) => c.label.includes(w)).length / words.length }))
          .filter((c) => c.score >= 0.75)
          .sort((a, b) => b.score - a.score || byLength(a, b));
      }
    }
    const usable = matches.find((m) => !isDisabled(m.el));
    if (usable) return { el: usable.el, disabled: false };
    if (matches.length) sawDisabled = true;
  }
  return { el: null, disabled: sawDisabled };
}

function describePage(t) {
  const heading = document.querySelector("h1")?.textContent?.trim();
  const root = document.querySelector("main") || document.body;
  const names = [];
  root.querySelectorAll(CLICKABLE).forEach((el) => {
    if (el.closest("[data-voice-ignore]") || !isVisible(el) || isDisabled(el)) return;
    const name = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
    if (name && name.length < 40 && !names.includes(name)) names.push(name);
  });
  const parts = [];
  if (heading) parts.push(t("You are on {title}.", { title: heading }));
  if (names.length) parts.push(t("Available actions: {actions}.", { actions: names.slice(0, 8).join(", ") }));
  return parts.join(" ") || t("I can't see anything on this page yet.");
}

function scrollPage(direction) {
  const main = document.querySelector("main");
  const target = main && main.scrollHeight > main.clientHeight ? main : null;
  const current = target ? target.scrollTop : window.scrollY;
  const max = target ? target.scrollHeight : document.documentElement.scrollHeight;
  const amount = window.innerHeight * 0.7;
  const top =
    direction === "down" ? current + amount : direction === "up" ? current - amount : direction === "top" ? 0 : max;
  (target || window).scrollTo({ top, behavior: "smooth" });
}

// A short tone gives instant audible feedback (no speech-engine delay)
let audioCtx = null;
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // audio not available yet (needs a first click or key press)
  }
}

function say(text, lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  applySpeechLanguage(u, lang); // speak in the chosen language
  window.__accessaiSpoke = { text, at: Date.now() };
  u.onend = () => {
    window.__accessaiSpoke = { text, at: Date.now() };
  };
  // speak() straight after cancel() can be dropped by Chrome, so give it a moment
  if (busy) setTimeout(() => synth.speak(u), 40);
  else synth.speak(u);
}

// The microphone can pick up our own speech; ignore transcripts that just repeat it
function isEcho(text) {
  const spoke = window.__accessaiSpoke;
  if (!spoke || Date.now() - spoke.at > 8000) return false;
  const words = text.split(" ");
  if (words.length < 3) return false;
  const spoken = new Set(normalize(spoke.text).split(" "));
  return words.filter((w) => spoken.has(w)).length / words.length >= 0.8;
}

/* ------------------------------ Provider ------------------------------ */

export function VoiceAssistantProvider({ children }) {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const tRef = useRef(t);
  const langRef = useRef(lang);
  tRef.current = t;
  langRef.current = lang;
  const supported =
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [enabled, setEnabledState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "0"; // on by default
    } catch {
      return true;
    }
  });
  const [listening, setListening] = useState(false);
  const [awake, setAwake] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);
  const [diag, setDiag] = useState({ started: false, audio: false, speech: false, lastResult: "", lastError: "", restarts: 0 });

  const recRef = useRef(null);
  const enabledRef = useRef(enabled);
  const awakeRef = useRef(false);
  const fatalRef = useRef(false);
  const restartTimerRef = useRef(null);
  const restartDelayRef = useRef(60);
  const sleepTimerRef = useRef(null);
  const lastUnknownRef = useRef(0);
  const handleRef = useRef(() => {});
  const wokeAtRef = useRef(0);

  const addLog = useCallback((entry) => {
    setLog((prev) => [{ ...entry, at: Date.now() }, ...prev].slice(0, 30));
  }, []);

  /* ----- awake / asleep ----- */
  const setAwakeState = useCallback((value) => {
    awakeRef.current = value;
    setAwake(value);
    if (!value) clearTimeout(sleepTimerRef.current);
  }, []);

  const goToSleep = useCallback(
    (announce = true) => {
      setAwakeState(false);
      if (announce) say(tRef.current("Going to sleep. Say hi to wake me up."));
      addLog({ message: tRef.current("Voice control is sleeping"), success: true });
    },
    [addLog, setAwakeState],
  );

  const armSleepTimer = useCallback(() => {
    clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => goToSleep(true), AWAKE_MS);
  }, [goToSleep]);

  const wake = useCallback(
    (greet = true) => {
      setAwakeState(true);
      armSleepTimer();
      chime();
      if (greet) say(tRef.current("Hi! I'm listening."));
      addLog({ message: tRef.current("Voice control activated"), success: true });
    },
    [addLog, armSleepTimer, setAwakeState],
  );

  // Wake the moment "hi" is heard (before the browser finalises the sentence): tone + greeting at once
  const wakeEarly = useCallback(() => {
    if (awakeRef.current) return;
    setAwakeState(true);
    armSleepTimer();
    wokeAtRef.current = Date.now();
    chime();
    say(tRef.current("Hi! I'm listening."));
    addLog({ message: tRef.current("Voice control activated"), success: true });
  }, [addLog, armSleepTimer, setAwakeState]);

  /* ----- run a spoken command ----- */
  const execute = useCallback(
    (text) => {
      const cmd = parseVoiceCommand(text, langRef.current);

      if (cmd.type === "UNKNOWN") {
        const now = Date.now();
        if (now - lastUnknownRef.current > 4000) {
          lastUnknownRef.current = now;
          addLog({ text, message: tRef.current('Didn\'t understand "{text}"', { text }), success: false });
          say(tRef.current("Sorry, I didn't understand. Say help to hear what I can do."));
        }
        return;
      }

      armSleepTimer();
      const done = (message, success = true, speech = message) => {
        addLog({ text, message, success });
        say(speech);
        if (success) {
          logActivity({
            feature: "voice-command",
            action: "command",
            title: `"${text.slice(0, 80)}"`,
            summary: message,
          });
        }
      };

      switch (cmd.type) {
        case "SLEEP":
          goToSleep(true);
          break;
        case "HELP":
          addLog({ text, message: tRef.current("Listed available commands"), success: true });
          say(getHelpText(langRef.current));
          break;
        case "DESCRIBE":
          say(describePage(tRef.current));
          addLog({ text, message: tRef.current("Described the page"), success: true });
          break;
        case "BACK":
          navigate(-1);
          done(tRef.current("Going back"));
          break;
        case "SCROLL":
          scrollPage(cmd.direction);
          done(
            tRef.current(
              { down: "Scrolling down", up: "Scrolling up", top: "Scrolling to the top", bottom: "Scrolling to the bottom" }[cmd.direction],
            ),
          );
          break;
        case "SIGNOUT":
          try {
            localStorage.removeItem("accessai_token");
            localStorage.removeItem("accessai_user");
          } catch {
            // ignore
          }
          navigate("/");
          done(tRef.current("Signed out"), true, tRef.current("You are signed out."));
          break;
        case "NAVIGATE": {
          let signedIn = false;
          try {
            signedIn = !!localStorage.getItem("accessai_token");
          } catch {
            // ignore
          }
          if (!signedIn && !PUBLIC_PATHS.includes(cmd.path)) {
            navigate("/auth");
            done(
              tRef.current("Please sign in first"),
              false,
              tRef.current("Please sign in first. I opened the sign in page."),
            );
          } else {
            navigate(cmd.path);
            done(tRef.current("Opening {page}", { page: tRef.current(cmd.label) }));
          }
          break;
        }
        case "SET_LANGUAGE": {
          const target = LANGUAGES.find((l) => l.code === cmd.code);
          const message = translate(cmd.code, "Language changed to {language}", { language: target.native });
          setLang(cmd.code);
          addLog({ text, message, success: true });
          say(message, cmd.code);
          break;
        }
        case "CLICK": {
          // Match both the English label and its translation (the page is shown in the current language)
          const cap = (l) => l.charAt(0).toUpperCase() + l.slice(1);
          const labels = cmd.labels.flatMap((l) => [l, tRef.current(cap(l)).toLowerCase()]);
          const { el, disabled } = findClickable(labels);
          if (el) {
            el.click();
            done(tRef.current(cmd.sayKey, cmd.sayVars));
          } else if (disabled) {
            done(tRef.current("{phrase} is not available yet", { phrase: cmd.phrase }), false);
          } else {
            done(tRef.current("I can't find {phrase} on this page", { phrase: cmd.phrase }), false);
          }
          break;
        }
        default:
          break;
      }
    },
    [addLog, armSleepTimer, goToSleep, navigate, setLang],
  );

  /* ----- every final transcript lands here ----- */
  const handleTranscript = useCallback(
    (raw) => {
      const text = normalize(raw);
      if (!text) return;
      if (isEcho(text)) return;
      const w = detectWake(text, langRef.current);
      // While something is being spoken, only react to "hi + a command" (not to our own voice)
      if (window.speechSynthesis?.speaking && !(w.woke && w.rest)) return;
      setHeard(text);

      if (!awakeRef.current) {
        if (!w.woke) return; // asleep: only the wake word counts
        if (w.rest && parseVoiceCommand(w.rest, langRef.current).type !== "UNKNOWN") {
          wake(false);
          execute(w.rest);
        } else {
          wake(true);
        }
        return;
      }

      if (w.woke) {
        if (w.rest) {
          execute(w.rest);
        } else {
          armSleepTimer();
          // Already greeted a moment ago when "hi" was first heard
          if (Date.now() - wokeAtRef.current > 4000) say(tRef.current("I'm listening."));
        }
        return;
      }
      execute(text);
    },
    [armSleepTimer, execute, wake],
  );
  handleRef.current = handleTranscript;

  /* ----- continuous speech recognition ----- */
  const stopRecognition = useCallback(() => {
    clearTimeout(restartTimerRef.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  const startRecognition = useCallback(() => {
    if (!supported || recRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true; // live captions in the status box
    rec.maxAlternatives = 1;
    let locale = getSpeechLocale(langRef.current);
    if (langRef.current === "en") {
      locale = navigator.language?.toLowerCase().startsWith("en") ? navigator.language : "en-US";
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") locale = "en-IN"; // better for Indian English
      } catch {
        // ignore
      }
    }
    rec.lang = locale;

    rec.onstart = () => {
      restartDelayRef.current = 60;
      setListening(true);
      setError(null);
      setDiag((d) => ({ ...d, started: true }));
    };
    rec.onaudiostart = () => setDiag((d) => ({ ...d, audio: true }));
    rec.onspeechstart = () => setDiag((d) => ({ ...d, speech: true }));
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          console.log("[Voice] heard:", transcript);
          handleRef.current(transcript);
        } else if (!window.speechSynthesis?.speaking) {
          setHeard(normalize(transcript)); // show what is being heard right now
          if (!awakeRef.current) {
            const w = detectWake(transcript, langRef.current);
            if (w.woke && !w.rest) wakeEarly();
          }
        }
        setDiag((d) => ({ ...d, lastResult: normalize(transcript) }));
      }
    };
    rec.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[Voice] recognition error:", event.error);
      }
      setDiag((d) => ({ ...d, lastError: event.error }));
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        fatalRef.current = true;
        setError(tRef.current("Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then press Retry."));
      } else if (event.error === "audio-capture") {
        fatalRef.current = true;
        setError(tRef.current("No microphone was found."));
      } else if (event.error === "network") {
        restartDelayRef.current = 3000;
        setError(tRef.current("Can't reach the speech service. Check your internet connection (Brave and some Chromium browsers don't support this - use Chrome or Edge)."));
      } else if (event.error === "language-not-supported") {
        fatalRef.current = true;
        setError(tRef.current("This browser language isn't supported for voice control."));
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setDiag((d) => ({ ...d, restarts: d.restarts + 1 }));
      // Browsers end recognition after silence: start again automatically
      if (enabledRef.current && !fatalRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(startRecognition, restartDelayRef.current);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
    }
  }, [supported, wakeEarly]);

  useEffect(() => {
    enabledRef.current = enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // ignore
    }
    if (!supported) return;
    if (enabled) {
      fatalRef.current = false;
      startRecognition();
    } else {
      stopRecognition();
      setAwakeState(false);
    }
    return () => stopRecognition();
  }, [enabled, supported, lang, startRecognition, stopRecognition, setAwakeState]);

  const setEnabled = useCallback((value) => {
    setEnabledState(value);
    if (value) say(tRef.current("Voice control is on. Say hi to wake me up."));
    else window.speechSynthesis?.cancel();
  }, []);

  const retry = useCallback(() => {
    fatalRef.current = false;
    restartDelayRef.current = 60;
    setError(null);
    setDiag({ started: false, audio: false, speech: false, lastResult: "", lastError: "", restarts: 0 });
    stopRecognition();
    startRecognition();
  }, [startRecognition, stopRecognition]);

  const value = useMemo(
    () => ({ supported, enabled, setEnabled, listening, awake, wake, sleep: goToSleep, heard, error, log, retry, diag }),
    [supported, enabled, setEnabled, listening, awake, wake, goToSleep, heard, error, log, retry, diag],
  );

  return (
    <VoiceAssistantContext.Provider value={value}>
      {children}
      <VoiceIndicator />
    </VoiceAssistantContext.Provider>
  );
}

/* --------------------- Floating status / mic button --------------------- */

function VoiceIndicator() {
  const { supported, enabled, setEnabled, listening, awake, wake, sleep, heard, error, retry } =
    useVoiceAssistant();
  const { t } = useI18n();
  if (!supported) return null;

  const status = error
    ? error
    : !enabled
      ? t("Voice control is off")
      : awake
        ? t("Listening — say a command")
        : listening
          ? t("Say “Hi” to start voice control")
          : t("Starting microphone…");

  const onMainClick = () => {
    if (!enabled) setEnabled(true);
    else if (awake) sleep(true);
    else wake(true);
  };

  return (
    <div data-voice-ignore className="fixed bottom-4 right-4 z-50 flex items-end gap-2">
      <div
        className="max-w-[250px] rounded-2xl border border-border bg-card px-3 py-2 text-xs shadow-lg"
        role="status"
        aria-live="polite"
      >
        <p className={`font-medium ${error ? "text-destructive" : ""}`}>{status}</p>
        {enabled && heard && !error && (
          <p className="mt-0.5 truncate italic text-muted-foreground">“{heard}”</p>
        )}
        <div className="mt-1 flex gap-3">
          {error && (
            <button type="button" onClick={retry} className="underline text-muted-foreground cursor-pointer">
              {t("Retry")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className="underline text-muted-foreground cursor-pointer"
          >
            {enabled ? t("Turn off") : t("Turn on")}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onMainClick}
        aria-label={!enabled ? t("Turn on voice control") : awake ? t("Put voice control to sleep") : t("Wake voice control")}
        className={`relative flex size-12 shrink-0 items-center justify-center rounded-full border shadow-lg transition-colors cursor-pointer ${
          awake
            ? "border-primary bg-primary text-primary-foreground"
            : enabled
              ? "border-border bg-card text-foreground"
              : "border-border bg-muted text-muted-foreground"
        }`}
      >
        {awake && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" aria-hidden="true" />}
        {enabled ? <Mic className="relative size-5" /> : <MicOff className="relative size-5" />}
      </button>
    </div>
  );
}