// Voice command parsing for the always-on voice assistant (English, Hindi, Telugu, Tamil).
// Pure functions (no React / DOM) so they are easy to test.
import { LANG_NAMES, LANG_WORDS, VOCAB } from "./voice-vocab.js";

// "label" is an English key that is translated for display
export const ROUTES = [
  { path: "/dashboard", label: "dashboard", words: ["dashboard", "home", "main menu", "main page"] },
  { path: "/object-detection", label: "object detection", words: ["object detection", "objects", "object", "detection", "detect objects", "obstacle detection"] },
  { path: "/read-aloud", label: "read aloud", words: ["read aloud", "reading", "read text", "text reader", "ocr"] },
  { path: "/sign-language", label: "sign language", words: ["sign language", "signs", "sign"] },
  { path: "/voice-commands", label: "voice commands", words: ["voice commands", "voice control", "voice"] },
  { path: "/history", label: "history", words: ["history", "activity"] },
  { path: "/settings", label: "settings", words: ["settings", "preferences", "options"] },
  { path: "/auth", label: "sign in", words: ["sign in", "log in", "login", "register", "sign up"] },
  { path: "/", label: "welcome page", words: ["landing", "welcome"] },
];

// Spoken phrase -> button labels to click (matched against aria-label or button text, in English
// and in the current language). `say` is an English key that is translated when spoken.
const ACTIONS = [
  { id: "start-camera", say: "Starting the camera", phrases: ["start camera", "start the camera", "turn on camera", "turn on the camera", "open camera", "start detection", "start detecting", "begin detection", "start"], labels: ["start camera"] },
  { id: "stop-camera", say: "Stopping the camera", phrases: ["stop camera", "stop the camera", "turn off camera", "turn off the camera", "close camera", "stop detection", "stop detecting"], labels: ["stop camera"] },
  { id: "capture", say: "Capturing text", phrases: ["capture", "capture text", "take picture", "take a picture", "take photo", "take a photo", "read this", "scan text"], labels: ["capture and read text", "capture"] },
  { id: "start-reading", say: "Reading", phrases: ["start reading", "read it", "read it out", "read out loud", "read the text", "begin reading", "play"], labels: ["start reading text"] },
  { id: "stop-reading", say: "Stopping", phrases: ["stop reading", "stop", "stop it", "pause"], labels: ["stop reading", "stop camera"] },
  { id: "repeat", say: "Reading again", phrases: ["repeat", "read again", "repeat reading", "say it again"], labels: ["repeat reading"] },
  { id: "speak", say: "Speaking the sentence", phrases: ["speak", "speak sentence", "say it", "say sentence", "speak it"], labels: ["speak sentence"] },
  { id: "clear", say: "Clearing", phrases: ["clear", "clear sentence", "clear text", "delete sentence", "start over"], labels: ["clear sentence"] },
  { id: "copy", say: "Copying", phrases: ["copy", "copy sentence", "copy text"], labels: ["copy sentence"] },
  { id: "mute", say: "Muting voice guidance", phrases: ["mute", "mute voice", "mute guidance", "voice guidance off"], labels: ["mute voice guidance"] },
  { id: "unmute", say: "Turning voice guidance on", phrases: ["unmute", "unmute voice", "voice guidance on"], labels: ["enable voice guidance"] },
  { id: "high-contrast", say: "Toggling high contrast", phrases: ["high contrast", "toggle high contrast", "turn on high contrast", "turn off high contrast"], labels: ["toggle high contrast mode"] },
  { id: "large-text", say: "Toggling large text", phrases: ["large text", "toggle large text", "bigger text", "make text bigger"], labels: ["toggle large text"] },
  { id: "reduced-motion", say: "Toggling reduced motion", phrases: ["reduced motion", "toggle reduced motion", "reduce motion"], labels: ["toggle reduced motion"] },
  { id: "voice-feedback", say: "Toggling voice feedback", phrases: ["toggle voice feedback", "voice feedback"], labels: ["toggle voice feedback"] },
  { id: "settings-panel", say: "Opening settings panel", phrases: ["show settings", "toggle settings", "open settings panel"], labels: ["toggle settings"] },
];
const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export const HELP_TEXT =
  "You can say: open dashboard, open object detection, open read aloud, open sign language, open history, or open settings. " +
  "On a page, say start camera, stop camera, capture, start reading, stop reading, speak, or clear. " +
  "Say click followed by a button name to press any button. " +
  "Say scroll down or scroll up, go back, where am I, sign out, or go to sleep. " +
  "To change the language, say language Hindi, language Telugu or language Tamil.";

export const HELP_GROUPS = [
  { category: "Wake up", commands: ["Hi", "Hello", "Hey AccessAI", "Hi, open object detection"] },
  { category: "Navigation", commands: ["Open dashboard", "Open object detection", "Open read aloud", "Open sign language", "Open history", "Open settings", "Open voice commands", "Go back"] },
  { category: "On a page", commands: ["Start camera", "Stop camera", "Capture", "Start reading", "Stop reading", "Speak", "Clear", "Mute", "Scroll down", "Scroll up"] },
  { category: "Anything else", commands: ["Click <button name>", "Where am I", "Help", "Sign out", "Go to sleep", "Language Hindi"] },
];

export const getHelpText = (lang) => VOCAB[lang]?.helpText ?? HELP_TEXT;
export const getHelpGroups = (lang) => VOCAB[lang]?.examples ?? HELP_GROUPS;

const FILLERS = /\b(please|can you|could you|would you|i want to|i would like to|i'd like to|just|now|the|a|to the|page|screen|app)\b/g;

export function normalize(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[.,!?;:"।]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Spaces, zero-width characters and nukta vary between speech engines: compare without them
export const compact = (s) =>
  String(s || "").toLowerCase().normalize("NFC").replace(/[\s\u200b-\u200d\u093c]/g, "");

/* ------------------------------ wake words ------------------------------ */

const WAKE_FIRST_WORDS = new Set(["hi", "hii", "hiii", "hey", "hay", "hello", "hai", "hye", "hy", "hallo", "helo", "hiya", "high", "yo"]);
const WAKE_PHRASES = ["wake up", "access ai", "accessai", "start listening", "activate voice control", "start voice control", "voice control on", "activate"];

function detectWakeEnglish(raw) {
  let text = normalize(raw);
  if (!text) return { woke: false, rest: "" };
  const words = text.split(" ");
  if (WAKE_FIRST_WORDS.has(words[0])) {
    words.shift();
    text = words.join(" ").replace(/^(there|access ?ai|a i|assistant)\b\s*/, "");
    return { woke: true, rest: text };
  }
  for (const phrase of WAKE_PHRASES) {
    if (text === phrase || text.startsWith(`${phrase} `) || text.startsWith(`hey ${phrase}`) || text.startsWith(`ok ${phrase}`)) {
      return { woke: true, rest: text.replace(new RegExp(`^(?:hey |ok |okay )?${phrase}\\s*`), "") };
    }
  }
  return { woke: false, rest: "" };
}

// Remove a leading phrase from `text` while ignoring spaces / zero-width characters
function stripLeading(text, phrase) {
  const target = compact(phrase).length;
  let consumed = 0;
  let i = 0;
  for (; i < text.length && consumed < target; i++) consumed += compact(text[i]).length;
  return text.slice(i).trim();
}

/**
 * Does the utterance wake the assistant? Returns { woke, rest } where `rest` is any command
 * spoken in the same breath ("hi open dashboard" -> rest = "open dashboard").
 */
export function detectWake(raw, lang = "en") {
  const vocab = VOCAB[lang];
  if (vocab) {
    const text = normalize(raw);
    const c = compact(text);
    const words = [...vocab.wake].sort((a, b) => compact(b).length - compact(a).length);
    for (const w of words) {
      if (c.startsWith(compact(w))) return { woke: true, rest: stripLeading(text, w) };
    }
  }
  return detectWakeEnglish(raw); // English greetings always work too
}

/* ------------------------------ language switch ------------------------------ */

function parseLanguageSwitch(text) {
  const c = compact(text);
  for (const [code, names] of Object.entries(LANG_NAMES)) {
    for (const name of names) {
      const cn = compact(name);
      if (!c.includes(cn)) continue;
      if (c === cn || LANG_WORDS.some((w) => c.includes(compact(w)))) return { type: "SET_LANGUAGE", code };
    }
  }
  return null;
}

/* ------------------------------ native languages ------------------------------ */

function parseNative(text, lang) {
  const v = VOCAB[lang];
  const c = compact(text);
  const has = (list) => list.some((p) => c.includes(compact(p)));
  const exact = (list) => list.some((p) => c === compact(p));

  let route = null;
  let routeLen = 0;
  for (const [path, words] of Object.entries(v.routes)) {
    for (const w of words) {
      const cw = compact(w);
      if (c.includes(cw) && cw.length > routeLen) {
        route = path;
        routeLen = cw.length;
      }
    }
  }
  // Page names spoken in English inside a Hindi/Telugu/Tamil sentence ("dashboard खोलो")
  if (!route) {
    let bestLen = 0;
    for (const r of ROUTES) {
      for (const w of r.words) {
        if (new RegExp(`(^|\\s)${w}(\\s|$)`).test(text) && w.length > bestLen) {
          route = r.path;
          bestLen = w.length;
        }
      }
    }
  }
  const routeInfo = route && ROUTES.find((r) => r.path === route);

  if (has(v.help)) return { type: "HELP" };
  if (has(v.describe)) return { type: "DESCRIBE" };
  if (has(v.signout)) return { type: "SIGNOUT" };
  if (has(v.scrollTop)) return { type: "SCROLL", direction: "top" };
  if (has(v.scrollBottom)) return { type: "SCROLL", direction: "bottom" };

  // "open <page>" in the native language
  if (routeInfo && has(v.navVerbs)) return { type: "NAVIGATE", path: routeInfo.path, label: routeInfo.label };

  // Page actions: the longest matching phrase wins
  let best = null;
  for (const [id, phrases] of Object.entries(v.actions)) {
    for (const p of phrases) {
      const cp = compact(p);
      if (c.includes(cp) && (!best || cp.length > best.len)) best = { id, len: cp.length };
    }
  }
  if (best) {
    const a = ACTION_BY_ID[best.id];
    return { type: "CLICK", labels: a.labels, sayKey: a.say, phrase: text };
  }

  if (has(v.back)) return { type: "BACK" };
  if (has(v.scrollDown)) return { type: "SCROLL", direction: "down" };
  if (has(v.scrollUp)) return { type: "SCROLL", direction: "up" };

  // "click <button name>"
  const clickVerbs = v.clickVerbs.map(compact);
  const stripWords = new Set([...v.clickVerbs, ...v.clickStrip].map(compact));
  if (clickVerbs.some((cv) => c.includes(cv))) {
    const query = text
      .split(" ")
      .filter((w) => w && !stripWords.has(compact(w)) && !clickVerbs.some((cv) => compact(w).includes(cv)))
      .join(" ")
      .trim();
    if (query) return { type: "CLICK", labels: [query], sayKey: "Clicking {name}", sayVars: { name: query }, phrase: query };
  }

  if (routeInfo) return { type: "NAVIGATE", path: routeInfo.path, label: routeInfo.label };
  if (exact(v.sleepExact) || has(v.sleep)) return { type: "SLEEP" };
  return { type: "UNKNOWN", text };
}

/* ------------------------------ English ------------------------------ */

const NAV_VERB = /^(?:open|go to|go|show me|show|take me to|navigate to|launch|switch to|visit|goto)\s+(.+)$/;

function matchRoute(phrase) {
  let best = null;
  for (const route of ROUTES) {
    for (const w of route.words) {
      if (phrase === w || phrase.endsWith(` ${w}`) || phrase.startsWith(`${w} `)) {
        if (!best || w.length > best.len) best = { route, len: w.length };
      }
    }
  }
  return best?.route ?? null;
}

function parseEnglish(original) {
  const text = original.replace(FILLERS, " ").replace(/\s+/g, " ").trim();
  if (!text) return { type: "UNKNOWN", text: original };

  if (/^(go to sleep|sleep|stop listening|goodbye|good bye|bye|bye bye|that is all|that's all|turn off voice control|stop voice control|be quiet|quiet)$/.test(text)) return { type: "SLEEP" };
  if (/^(help|what can i say|what can you do|commands|list commands|show commands)$/.test(text)) return { type: "HELP" };
  if (/^(where am i|what is this|what's here|what is here|what can i do here|read screen|describe|describe screen|what is on screen)$/.test(text)) return { type: "DESCRIBE" };
  if (/^(sign out|log out|logout|signout)$/.test(text)) return { type: "SIGNOUT" };
  if (/^(go back|back|previous|go to previous|navigate back)$/.test(text)) return { type: "BACK" };

  const scroll = text.match(/^(?:scroll|page)\s*(down|up)$/) || text.match(/^(?:scroll to|go to)?\s*(top|bottom)$/) || text.match(/^scroll (?:to )?(top|bottom)$/);
  if (scroll) return { type: "SCROLL", direction: scroll[1] };

  const click = text.match(/^(?:click|press|tap|push|select|choose|hit)\s+(?:on\s+)?(.+)$/);
  if (click) {
    const name = click[1].trim();
    return { type: "CLICK", labels: [name], sayKey: "Clicking {name}", sayVars: { name }, phrase: name };
  }

  for (const action of ACTIONS) {
    if (action.phrases.includes(text)) return { type: "CLICK", labels: action.labels, sayKey: action.say, phrase: text };
  }

  const verb = text.match(NAV_VERB);
  const target = verb ? verb[1] : text;
  const route = matchRoute(target);
  if (route && (verb || route.words.some((w) => w === target))) {
    return { type: "NAVIGATE", path: route.path, label: route.label };
  }
  return { type: "UNKNOWN", text: original };
}

/**
 * Turn a spoken command into an action object:
 * NAVIGATE | BACK | SCROLL | CLICK | SIGNOUT | HELP | DESCRIBE | SLEEP | SET_LANGUAGE | UNKNOWN
 */
export function parseVoiceCommand(raw, lang = "en") {
  const original = normalize(raw);
  if (!original) return { type: "UNKNOWN", text: original };

  const switchLang = parseLanguageSwitch(original);
  if (switchLang) return switchLang;

  if (VOCAB[lang]) {
    const native = parseNative(original, lang);
    if (native.type !== "UNKNOWN") return native;
  }
  return parseEnglish(original); // English commands work in every language (code-mixed speech)
}
