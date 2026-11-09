import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Accessibility,
  ArrowRight,
  Eye,
  FileText,
  Hand,
  Mic,
  Shield,
  Zap,
  Users,
  Globe,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";

const EASE = [0.22, 1, 0.36, 1] ;

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: EASE },
  }),
};

const fadeScale = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.5, ease: EASE },
  }),
};

const slideIn = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.45, ease: EASE },
  }),
};

// A warm, earthbound palette — gold and teal as the two leads, with plum, rust
// and dusty rose filling out the feature set.
const accents = ["#1B7A72", "#D8A73D", "#8C5383", "#C1592E", "#C05470", "#2E8B6F"];

const features = [
  {
    icon: Eye,
    title: "Object Detection",
    desc: "Real-time AI vision that identifies objects, reads your surroundings, and provides voice guidance — so you always know what's around you.",
  },
  {
    icon: FileText,
    title: "Read Aloud",
    desc: "Point your camera at any text — documents, labels, signs — and hear it read aloud instantly with crystal-clear text-to-speech.",
  },
  {
    icon: Hand,
    title: "Sign Language",
    desc: "Translate recognized hand gestures into text and speech in real time using advanced AI-powered computer vision.",
  },
  {
    icon: Mic,
    title: "Voice Commands",
    desc: "Navigate the entire platform hands-free. Speak naturally to open features, control cameras, and manage your experience.",
  },
].map((f, i) => ({ ...f, accent: accents[i] }));

const challenges = [
  { stat: "1.3B", label: "people globally experience significant disability" },
  { stat: "96%", label: "of websites have detectable WCAG failures" },
  { stat: "1 in 4", label: "adults live with some form of disability" },
];

const benefits = [
  "Unified platform — one app for all accessibility needs",
  "Privacy-first — camera data stays on your device",
  "Accessible by design — WCAG-inspired interface",
  "AI-powered real-time processing",
  "Offline-capable core features",
  "Open architecture — swap AI models as they improve",
];

function SectionTag({ label, accent }) {
  return (
    <div className="mb-3 flex items-center justify-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      <span className="accessai-serif text-sm italic" style={{ color: accent }}>
        {label}
      </span>
    </div>
  );
}

export default function Landing() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="accessai-font min-h-screen bg-[#F6F3EC] text-[#1E2320] dark:bg-[#14201C] dark:text-[#F1EEE5]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600&display=swap');
        .accessai-font { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .accessai-serif { font-family: 'Lora', ui-serif, Georgia, serif; }
      `}</style>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-[#1E2320]/10 bg-[#F6F3EC]/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#14201C]/85" role="banner">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-[#1B7A72] text-white">
              <Accessibility className="size-4.5" />
            </div>
            <span className="accessai-serif text-lg font-semibold tracking-tight">{t("Disability Support Platform")}</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex" aria-label={t("Landing navigation")}>
            <a href="#features" className="text-sm text-[#1E2320]/60 hover:text-[#1E2320] dark:text-white/60 dark:hover:text-white transition-colors">{t("Features")}</a>
            <a href="#how-it-works" className="text-sm text-[#1E2320]/60 hover:text-[#1E2320] dark:text-white/60 dark:hover:text-white transition-colors">{t("How it works")}</a>
            <a href="#technology" className="text-sm text-[#1E2320]/60 hover:text-[#1E2320] dark:text-white/60 dark:hover:text-white transition-colors">{t("Technology")}</a>
            <a href="#benefits" className="text-sm text-[#1E2320]/60 hover:text-[#1E2320] dark:text-white/60 dark:hover:text-white transition-colors">{t("Benefits")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher className="w-32 sm:w-36" />
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="cursor-pointer">{t("Sign in")}</Button>
            <Button
              size="sm"
              onClick={() => navigate("/auth")}
              className="cursor-pointer gap-1.5 bg-[#D8A73D] text-[#1E2320] hover:bg-[#c99930]"
            >{t("Get started")}{" "}<ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — deep teal panel, not black */}
      <section className="relative overflow-hidden bg-[#123F3A]" aria-label={t("Hero section")}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px circle at 15% 10%, rgba(216,167,61,0.14), transparent 60%), radial-gradient(600px circle at 85% 30%, rgba(27,122,114,0.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 md:pt-32">
          <motion.div initial="hidden" animate="visible" className="mx-auto max-w-3xl text-center">
            <motion.div
              variants={fadeUp}
              custom={0}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D8A73D]/30 bg-[#D8A73D]/10 px-4 py-1.5 text-xs font-medium text-[#E8C170]"
            >
              <Zap className="size-3" aria-hidden="true" />{t("AI-powered accessibility platform")}</motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="accessai-serif text-4xl font-semibold tracking-tight text-[#F6F3EC] sm:text-5xl md:text-[3.4rem]"
            >{t("One platform. Multiple ways to access the world.")}</motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#F6F3EC]/65"
            >{t("AccessAI combines four AI-powered accessibility tools into a single unified platform — designed for people with visual, hearing, and mobility impairments. Real camera access, real AI processing, real results.")}</motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="cursor-pointer gap-2 bg-[#D8A73D] px-8 text-[#1E2320] hover:bg-[#c99930]"
              >{t("Start using AccessAI")}<ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="cursor-pointer border-white/25 px-8 text-[#F6F3EC] hover:bg-white/5 hover:text-[#F6F3EC]"
              >{t("Explore features")}</Button>
            </motion.div>
          </motion.div>

          {/* Signal rail */}
          <motion.div
            variants={fadeUp}
            custom={4}
            initial="hidden"
            animate="visible"
            className="relative mt-20 hidden md:block"
          >
            <div className="absolute left-0 right-0 top-6 h-px bg-white/10" aria-hidden="true" />
            <div className="relative grid grid-cols-4 gap-2">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  variants={fadeScale}
                  custom={4 + i}
                  className="flex flex-col items-center gap-3 text-center"
                >
                  <div
                    className="relative z-10 flex size-12 items-center justify-center rounded-full bg-[#123F3A]"
                    style={{ color: f.accent, boxShadow: `0 0 0 3px ${f.accent}33` }}
                  >
                    <f.icon className="size-5" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-medium text-[#F6F3EC]/80">{t(f.title)}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            custom={4}
            initial="hidden"
            animate="visible"
            className="mt-16 grid grid-cols-2 gap-4 md:hidden"
          >
            {features.map((f, i) => (
              <motion.div key={f.title} variants={fadeScale} custom={4 + i} className="flex flex-col items-center gap-2 text-center">
                <div
                  className="flex size-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${f.accent}26`, color: f.accent }}
                >
                  <f.icon className="size-5" aria-hidden="true" />
                </div>
                <p className="text-xs font-medium text-[#F6F3EC]/80">{t(f.title)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Challenges — light paper band, serif numerals doing the heavy lifting */}
      <section className="py-20" aria-label={t("Accessibility challenges")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}>
            <SectionTag label={t("The challenge")} accent="#1B7A72" />
            <motion.p
              variants={fadeUp}
              custom={1}
              className="accessai-serif text-center text-2xl font-semibold tracking-tight sm:text-3xl"
            >{t("Accessibility is a human right, not a luxury.")}</motion.p>
          </motion.div>

          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {challenges.map((c, i) => (
              <motion.div
                key={c.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeScale}
                custom={i}
                className="text-center"
              >
                <p className="accessai-serif text-5xl font-semibold" style={{ color: accents[i % accents.length] }}>
                  {c.stat}
                </p>
                <motion.span
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.5, ease: EASE }}
                  className="mx-auto mt-4 block h-0.5 w-10 origin-left rounded-full"
                  style={{ backgroundColor: accents[i % accents.length] }}
                />
                <p className="mt-4 text-sm leading-relaxed text-[#1E2320]/65 dark:text-[#F1EEE5]/65">{t(c.label)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#EFEADD] py-20 dark:bg-[#1B211D]" aria-label={t("Core features")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mx-auto max-w-2xl text-center"
          >
            <SectionTag label={t("Core features")} accent={accents[1]} />
            <motion.p variants={fadeUp} custom={1} className="accessai-serif text-2xl font-semibold tracking-tight sm:text-3xl">{t("Four AI-powered tools, one unified experience.")}</motion.p>
          </motion.div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeScale}
                custom={i}
              >
                <Card
                  className="group h-full overflow-hidden rounded-2xl border-[#1E2320]/10 bg-[#F6F3EC] shadow-none transition-transform duration-200 hover:-translate-y-1 dark:border-white/10 dark:bg-[#14201C]"
                  style={{ borderTop: `3px solid ${f.accent}` }}
                  onMouseEnter={(e) => {
                    (e.currentTarget ).style.boxShadow = `0 16px 32px -18px ${f.accent}55`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget ).style.boxShadow = "none";
                  }}
                >
                  <CardContent className="pt-7 pb-7">
                    <div
                      className="mb-4 flex size-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${f.accent}1F`, color: f.accent }}
                    >
                      <f.icon className="size-5.5" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold">{t(f.title)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#1E2320]/65 dark:text-[#F1EEE5]/65">{t(f.desc)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20" aria-label={t("How it works")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mx-auto max-w-2xl text-center"
          >
            <SectionTag label={t("How it works")} accent={accents[2]} />
            <motion.p variants={fadeUp} custom={1} className="accessai-serif text-2xl font-semibold tracking-tight sm:text-3xl">{t("Simple, powerful, accessible.")}</motion.p>
          </motion.div>

          <div className="relative mt-16">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE }}
              className="absolute left-0 right-0 top-6 hidden h-px origin-left bg-[#1E2320]/10 dark:bg-white/10 lg:block"
              aria-hidden="true"
            />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: "01", title: "Sign up", desc: "Create an account in seconds. Choose your accessibility preferences to personalize your experience." },
                { step: "02", title: "Choose a feature", desc: "Select from four AI-powered tools — object detection, read aloud, sign language, and voice commands." },
                { step: "03", title: "AI processing", desc: "AccessAI processes your camera, microphone, or upload in real time using advanced AI models." },
                { step: "04", title: "Get results", desc: "Receive voice guidance, text output, or visual feedback. Every session is saved to your history." },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  variants={fadeScale}
                  custom={i}
                  className="relative"
                >
                  <div
                    className="accessai-serif relative z-10 flex size-12 items-center justify-center rounded-full bg-[#F6F3EC] text-sm font-semibold dark:bg-[#123F3A]"
                    style={{ color: accents[i], boxShadow: `0 0 0 1px ${accents[i]}40` }}
                  >
                    {s.step}
                  </div>
                  <h3 className="accessai-serif mt-4 text-base font-semibold">{t(s.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1E2320]/65 dark:text-[#F1EEE5]/65">{t(s.desc)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Technology */}
      <section id="technology" className="bg-[#EFEADD] py-20 dark:bg-[#1B211D]" aria-label={t("Technology stack")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mx-auto max-w-2xl text-center"
          >
            <SectionTag label={t("Built with")} accent={accents[5]} />
            <motion.p variants={fadeUp} custom={1} className="accessai-serif text-2xl font-semibold tracking-tight sm:text-3xl">{t("Modern AI, engineered for accessibility.")}</motion.p>
          </motion.div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "TensorFlow.js", desc: "Real-time object detection that runs directly in your browser" },
              { name: "MediaPipe", desc: "Hand landmark detection for sign language recognition" },
              { name: "Tesseract.js", desc: "Client-side OCR for reading documents and labels" },
              { name: "Web Speech API", desc: "Speech recognition and text-to-speech synthesis" },
              { name: "React + Node.js", desc: "Responsive frontend with a secure backend for accounts and history" },
              { name: "Computer Vision", desc: "Real-time object detection and gesture classification in the browser" },
            ].map((tech, i) => (
              <motion.div
                key={tech.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={slideIn}
                custom={i}
              >
                <Card className="rounded-2xl border-[#1E2320]/10 bg-[#F6F3EC] shadow-none dark:border-white/10 dark:bg-[#14201C]">
                  <CardContent className="flex items-start gap-4 pt-6 pb-6">
                    <div className="accessai-serif flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E2320]/5 text-xs font-semibold dark:bg-white/10">
                      {tech.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{t(tech.name)}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#1E2320]/65 dark:text-[#F1EEE5]/65">{t(tech.desc)}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20" aria-label={t("Benefits")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mx-auto max-w-2xl text-center"
          >
            <SectionTag label={t("Benefits")} accent={accents[3]} />
            <motion.p variants={fadeUp} custom={1} className="accessai-serif text-2xl font-semibold tracking-tight sm:text-3xl">{t("Why AccessAI?")}</motion.p>
          </motion.div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b, i) => (
              <motion.div
                key={b}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={slideIn}
                custom={i}
                className="flex items-start gap-3 rounded-xl border border-[#1E2320]/10 bg-[#F6F3EC] px-5 py-4 transition-colors dark:border-white/10 dark:bg-[#14201C]"
                onMouseEnter={(e) => {
                  (e.currentTarget ).style.backgroundColor = `${accents[i % accents.length]}14`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget ).style.backgroundColor = "";
                }}
              >
                <ChevronRight className="mt-0.5 size-4 shrink-0" style={{ color: accents[i % accents.length] }} aria-hidden="true" />
                <span className="text-sm">{t(b)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported users */}
      <section className="bg-[#EFEADD] py-20 dark:bg-[#1B211D]" aria-label={t("Supported users")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mx-auto max-w-2xl text-center"
          >
            <SectionTag label={t("For everyone")} accent={accents[4]} />
            <motion.p variants={fadeUp} custom={1} className="accessai-serif text-2xl font-semibold tracking-tight sm:text-3xl">{t("Designed for diverse needs.")}</motion.p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Eye,
                title: "Visual impairments",
                accent: accents[0],
                features: ["Object detection & voice guidance", "Document & label read-aloud", "Real-time obstacle guidance"],
              },
              {
                icon: Ear,
                title: "Hearing impairments",
                accent: accents[2],
                features: ["Sign language translation", "Visual alerts & captions", "Voice command alternatives"],
              },
              {
                icon: Hand,
                title: "Mobility impairments",
                accent: accents[3],
                features: ["Voice-activated controls", "Voice command navigation", "Hands-free interaction"],
              },
            ].map((u, i) => (
              <motion.div
                key={u.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeScale}
                custom={i}
              >
                <Card
                  className="h-full rounded-2xl border-[#1E2320]/10 bg-[#F6F3EC] shadow-none dark:border-white/10 dark:bg-[#14201C]"
                  style={{ borderLeft: `4px solid ${u.accent}` }}
                >
                  <CardContent className="pt-7 pb-7">
                    <div
                      className="mb-4 flex size-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${u.accent}1F`, color: u.accent }}
                    >
                      <u.icon className="size-5.5" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold">{t(u.title)}</h3>
                    <ul className="mt-3 space-y-2">
                      {u.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-[#1E2320]/65 dark:text-[#F1EEE5]/65">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: u.accent }} aria-hidden="true" />
                          {t(f)}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Future */}
      <section className="py-20" aria-label={t("Future possibilities")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mx-auto max-w-2xl text-center"
          >
            <SectionTag label={t("Looking ahead")} accent={accents[1]} />
            <motion.p variants={fadeUp} custom={1} className="accessai-serif text-2xl font-semibold tracking-tight sm:text-3xl">{t("What's next for AccessAI.")}</motion.p>
            <motion.p variants={fadeUp} custom={2} className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#1E2320]/65 dark:text-[#F1EEE5]/65">{t("We're building toward a world where technology adapts to every person — not the other way around.")}</motion.p>
          </motion.div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Globe, title: "Multi-language support", desc: "Object detection, OCR, and sign language across 50+ languages." },
              { icon: Shield, title: "Enhanced privacy", desc: "Full on-device processing with WebAssembly AI models." },
              { icon: Users, title: "Community features", desc: "Crowd-sourced accessibility ratings for public spaces worldwide." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeScale}
                custom={i}
              >
                <Card className="h-full rounded-2xl border-[#1E2320]/10 bg-[#F6F3EC] shadow-none dark:border-white/10 dark:bg-[#14201C]">
                  <CardContent className="pt-7 pb-7">
                    <div
                      className="mb-4 flex size-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${accents[(i + 1) % accents.length]}1F`, color: accents[(i + 1) % accents.length] }}
                    >
                      <f.icon className="size-5.5" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold">{t(f.title)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#1E2320]/65 dark:text-[#F1EEE5]/65">{t(f.desc)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — deep teal panel, bookending the hero */}
      <section className="py-20" aria-label={t("Get started")}>
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeScale}
            custom={0}
            className="relative overflow-hidden rounded-3xl bg-[#123F3A] px-8 py-16 text-center"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(500px circle at 20% 20%, rgba(216,167,61,0.16), transparent 60%), radial-gradient(500px circle at 80% 80%, rgba(27,122,114,0.18), transparent 60%)",
              }}
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="accessai-serif text-3xl font-semibold tracking-tight text-[#F6F3EC] sm:text-4xl">{t("Ready to experience AccessAI?")}</h2>
              <p className="mt-4 text-[#F6F3EC]/65">{t("Join AccessAI today and discover a new way to interact with the world — powered by AI, designed for everyone.")}</p>
              <div className="mt-8">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="cursor-pointer gap-2 bg-[#D8A73D] px-10 text-[#1E2320] hover:bg-[#c99930]"
                >{t("Get started for free")}<ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E2320]/10 py-8 dark:border-white/10" role="contentinfo">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-[#1B7A72] text-white">
              <Accessibility className="size-3.5" />
            </div>
            <span className="accessai-serif text-sm font-semibold">{t("AccessAI")}</span>
          </div>
          <p className="text-xs text-[#1E2320]/55 dark:text-[#F1EEE5]/55">{t("© {n0} AccessAI. Built for accessibility. Designed for everyone.", { n0: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-[#1E2320]/55 hover:text-[#1E2320] dark:text-[#F1EEE5]/55 dark:hover:text-[#F1EEE5] transition-colors">{t("Privacy")}</a>
            <a href="#" className="text-xs text-[#1E2320]/55 hover:text-[#1E2320] dark:text-[#F1EEE5]/55 dark:hover:text-[#F1EEE5] transition-colors">{t("Terms")}</a>
            <a href="#" className="text-xs text-[#1E2320]/55 hover:text-[#1E2320] dark:text-[#F1EEE5]/55 dark:hover:text-[#F1EEE5] transition-colors">{t("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Ear(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10.5" />
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 0 0 4 0" />
    </svg>
  );
}