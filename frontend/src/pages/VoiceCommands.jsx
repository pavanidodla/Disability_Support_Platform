import { AppLayout } from "@/components/AppLayout";
import { useVoiceAssistant } from "@/components/VoiceAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHelpGroups } from "@/lib/voice-commands";
import { Mic, MicOff, Moon, Navigation } from "lucide-react";
import { LANGUAGES, pickVoice, useI18n } from "@/i18n";
import { useEffect, useState } from "react";

export default function VoiceCommands() {
  const { t, lang } = useI18n();
  // Is a spoken voice installed for the chosen language? (voices load asynchronously)
  const [hasVoice, setHasVoice] = useState(true);
  useEffect(() => {
    const synth = window.speechSynthesis;
    const check = () => setHasVoice(lang === "en" || !!pickVoice(lang));
    check();
    synth?.addEventListener?.("voiceschanged", check);
    return () => synth?.removeEventListener?.("voiceschanged", check);
  }, [lang]);
  const { supported, enabled, setEnabled, listening, awake, wake, sleep, heard, error, log, retry, diag } =
    useVoiceAssistant();

  const state = !enabled ? "off" : awake ? "awake" : listening ? "sleeping" : "starting";
  const title = {
    off: "Voice control is off",
    awake: "Listening for your commands",
    sleeping: "Sleeping — say “Hi” to wake me",
    starting: "Starting microphone…",
  }[state];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{t("Voice Commands")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("Control AccessAI entirely by voice. Say “Hi” and then speak what you want to do.")}</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Status */}
              <Card className="border-border/60 shadow-none">
                <CardContent className="flex flex-col items-center py-10">
                  {!supported ? (
                    <div className="text-center">
                      <MicOff className="mx-auto mb-3 size-12 text-muted-foreground/40" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">{t("Voice control is not supported in this browser.")}</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">{t("Please use Google Chrome or Microsoft Edge.")}</p>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`relative flex size-24 items-center justify-center rounded-full transition-all ${
                          state === "awake"
                            ? "scale-105 bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                            : state === "off"
                              ? "bg-muted text-muted-foreground"
                              : "bg-accent text-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {state === "awake" && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                        )}
                        {state === "off" ? <MicOff className="relative size-10" /> : <Mic className="relative size-10" />}
                      </div>
                      <p className="mt-4 text-sm font-medium" role="status" aria-live="polite">
                        {t(title)}
                      </p>
                      {enabled && heard && (
                        <p className="mt-2 max-w-md text-center text-sm italic text-muted-foreground">“{heard}”</p>
                      )}

                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        {!enabled ? (
                          <Button onClick={() => setEnabled(true)} className="cursor-pointer gap-2">
                            <Mic className="size-4" />{" "}{t("Turn on voice control")}</Button>
                        ) : (
                          <>
                            {awake ? (
                              <Button variant="outline" onClick={() => sleep(true)} className="cursor-pointer gap-2">
                                <Moon className="size-4" />{" "}{t("Go to sleep")}</Button>
                            ) : (
                              <Button onClick={() => wake(true)} className="cursor-pointer gap-2">
                                <Mic className="size-4" />{" "}{t("Wake up now")}</Button>
                            )}
                            <Button variant="outline" onClick={() => setEnabled(false)} className="cursor-pointer gap-2">
                              <MicOff className="size-4" />{" "}{t("Turn off")}</Button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {error && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-destructive" role="alert">{error}</p>
                      <Button variant="outline" size="sm" onClick={retry} className="mt-2 cursor-pointer">{t("Retry")}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Microphone check */}
              {supported && enabled && (
                <Card className="border-border/60 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("Microphone check")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {[
                      ["Speech recognition started", diag.started],
                      ["Microphone is receiving audio", diag.audio],
                      ["Your voice was detected", diag.speech],
                    ].map(([label, ok]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t(label)}</span>
                        <span className={ok ? "font-medium text-green-600" : "text-muted-foreground"}>{ok ? t("Yes") : t("Not yet")}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{t("Last words heard")}</span>
                      <span className="truncate italic">{diag.lastResult ? `“${diag.lastResult}”` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("Last error")}</span>
                      <span className={diag.lastError && diag.lastError !== "no-speech" ? "text-destructive" : ""}>{diag.lastError || t("none")}</span>
                    </div>
                    <p className="pt-2 text-xs text-muted-foreground">
                      {!diag.started
                        ? t("The browser has not started the microphone. Allow microphone access (lock icon in the address bar) and press Retry.")
                        : !diag.audio
                          ? t("Speech recognition started but no audio is coming in. Check that the right microphone is selected in your system sound settings.")
                          : !diag.speech
                            ? t("Audio is coming in. Now say “Hi” clearly and watch this panel.")
                            : diag.lastResult
                              ? t("Everything is working. If “Hi” still does not wake it, tell me what appears in “Last words heard”.")
                              : t("Your voice was detected but nothing was recognised yet. Check your internet connection and speak a little slower.")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Spoken replies need an installed voice for the chosen language */}
              {supported && !hasVoice && (
                <Card className="border-amber-500/30 bg-amber-500/5 shadow-none">
                  <CardContent className="py-3 text-sm text-amber-700 dark:text-amber-400">
                    {t("Your device has no {language} voice installed, so spoken replies may be silent or sound wrong. Text still appears on screen. You can add a voice in your device's language settings.", {
                      language: LANGUAGES.find((l) => l.code === lang)?.native,
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Command log */}
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Command Log")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {log.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("Commands will appear here as you speak them.")}</p>
                  ) : (
                    <ul className="space-y-2" role="list" aria-label={t("Command history")}>
                      {log.map((entry, i) => (
                        <li
                          key={`${entry.at}-${i}`}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                            entry.success ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"
                          }`}
                        >
                          <Navigation
                            className={`size-3.5 shrink-0 ${entry.success ? "text-primary" : "text-destructive"}`}
                            aria-hidden="true"
                          />
                          <span className="text-sm">
                            {entry.text && <span className="text-muted-foreground">“{entry.text}” → </span>}
                            {entry.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("What you can say")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getHelpGroups(lang).map((group) => (
                    <div key={group.category}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t(group.category)}
                      </p>
                      <ul className="space-y-1">
                        {group.commands.map((cmd) => (
                          <li key={cmd} className="text-sm text-foreground">“{cmd}”</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-muted/30 shadow-none">
                <CardContent className="space-y-2 py-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{t("Good to know")}</p>
                  <p>{t("AccessAI listens only while it is open in a browser tab. Keep the tab open (or set AccessAI as your browser’s home page) and say “Hi”.")}</p>
                  <p>{t("The first time, allow the microphone when the browser asks. It is remembered afterwards.")}</p>
                  <p>{t("After 90 seconds without a command it goes back to sleep. Say “Hi” to wake it again.")}</p>
                  <p>{t("Chrome and Edge send speech to their servers for recognition, so an internet connection is needed.")}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
