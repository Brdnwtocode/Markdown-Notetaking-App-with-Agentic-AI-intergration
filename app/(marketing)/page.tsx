"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, Zap, Mic, BookOpen, Play, Mail, Github } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";

const words = ["Train", "Research", "Track", "Organize", "Study"];

export default function LandingPage() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const targetWord = words[currentWordIndex];
    const typingSpeed = isDeleting ? 75 : 150;

    if (!isDeleting && currentText === targetWord) {
      // Hold the full word for 2 seconds before deleting
      timer = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && currentText === "") {
      setIsDeleting(false);
      setCurrentWordIndex((prev) => (prev + 1) % words.length);
    } else {
      timer = setTimeout(() => {
        setCurrentText((prev) =>
          isDeleting
            ? targetWord.slice(0, prev.length - 1)
            : targetWord.slice(0, prev.length + 1)
        );
      }, typingSpeed);
    }

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentWordIndex]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0E0E0E] text-white font- technical selection:bg-[#10B981]/30 selection:text-[#10B981]">
      <style>{`
        @keyframes blink {
          50% { border-color: transparent }
        }
        .cursor-blink {
          animation: blink 0.8s step-end infinite;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-[#27272A] bg-[#0E0E0E]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0E0E0E]/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between py-4 max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[#10B981]"></span>
            <div className="font-bold text-lg uppercase tracking-wider font-mono">
              LOCK IN // MD
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setAuthMode("login")}
              className="border border-[#27272A] text-zinc-300 hover:text-white hover:bg-white/5 hover:border-zinc-500 rounded-none px-4 py-2 font-mono text-[11px] uppercase tracking-wider font-bold transition-all flex items-center gap-2"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
            <button
              onClick={() => signIn("github")}
              className="border border-[#27272A] text-zinc-300 hover:text-white hover:bg-white/5 hover:border-zinc-500 rounded-none px-4 py-2 font-mono text-[11px] uppercase tracking-wider font-bold transition-all"
            >
              GitHub
            </button>
            <button
              onClick={() => signIn("google")}
              className="bg-white text-[#0E0E0E] hover:bg-white/90 rounded-none px-4 py-2 font-mono text-[11px] uppercase tracking-wider font-bold transition-all"
            >
              Google
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative py-24 md:py-36 border-b border-[#27272A] overflow-hidden">
          {/* Subtle grid lines background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#131313_1px,transparent_1px),linear-gradient(to_bottom,#131313_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

          <div className="container relative space-y-10 text-center max-w-4xl mx-auto px-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#10B981]/30 bg-[#10B981]/5 text-[#10B981] font-mono text-xs uppercase tracking-wider font-semibold">
              <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></span>
              Flow State Environment Initialized
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl font-mono uppercase leading-tight">
              Lock In and <br className="sm:hidden" />
              <span className="text-[#10B981] border-r-2 border-[#10B981] pr-1.5 cursor-blink inline-block min-w-[100px] text-left">
                {currentText}
              </span>{" "}
              <br className="hidden sm:inline" />
              In Markdown
            </h1>

            <p className="text-sm md:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed font-mono uppercase tracking-wide">
              Capture technical schemas, compile structures dynamically, and execute hands-free commands with high-density voice AI.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 max-w-md mx-auto">
              <button
                onClick={() => setAuthMode("register")}
                className="flex-1 h-12 bg-white hover:bg-white/90 text-[#0E0E0E] rounded-none font-mono text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAuthMode("login")}
                className="flex-1 h-12 border border-[#27272A] hover:bg-white/5 hover:border-zinc-500 text-white rounded-none font-mono text-xs uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Play className="h-3.5 w-3.5 fill-current text-[#10B981]" /> Sign In
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 border-b border-[#27272A]">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="text-center space-y-2 mb-20">
              <h2 className="text-2xl font-bold uppercase tracking-wider font-mono">
                System Core Capabilities
              </h2>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">
                High-utility modules optimized for speed and structure
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="border border-[#27272A] bg-[#131313] p-8 space-y-5 hover:border-[#10B981]/40 transition-colors duration-200">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 border border-[#27272A] bg-[#0E0E0E] flex items-center justify-center text-[#10B981]">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span className="text-zinc-600 font-mono text-xs">01 // NOTEBOOK</span>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Markdown Synthesizer
                </h3>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed uppercase">
                  Write notes in rich markdown with real-time preview parsing, integrated code blocks, and dynamic tree layout structures.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="border border-[#27272A] bg-[#131313] p-8 space-y-5 hover:border-[#10B981]/40 transition-colors duration-200">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 border border-[#27272A] bg-[#0E0E0E] flex items-center justify-center text-[#10B981]">
                    <Zap className="h-5 w-5" />
                  </div>
                  <span className="text-zinc-600 font-mono text-xs">02 // DATA_STACK</span>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Schema Stack Builder
                </h3>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed uppercase">
                  Define schemas with multi-column configurations. Preview dynamically with auto-generated mock database tables.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="border border-[#27272A] bg-[#131313] p-8 space-y-5 hover:border-[#10B981]/40 transition-colors duration-200">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 border border-[#27272A] bg-[#0E0E0E] flex items-center justify-center text-[#10B981]">
                    <Mic className="h-5 w-5" />
                  </div>
                  <span className="text-zinc-600 font-mono text-xs">03 // AI_VOICE</span>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Voice Orchestrator
                </h3>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed uppercase">
                  Hold Spacebar to execute commands or append text hands-free. AI parses tasks and filters events contextually.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-[#131313]">
          <div className="container text-center space-y-8 max-w-3xl mx-auto px-4">
            <h2 className="text-2xl sm:text-3xl font-bold uppercase font-mono tracking-tight text-white leading-tight">
              Ready to Initiate Flow State?
            </h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto uppercase tracking-wider leading-relaxed font-mono">
              Create an account with email, or sign in via GitHub or Google to instantiate your secure cloud sandbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <button
                onClick={() => setAuthMode("register")}
                className="h-12 px-8 bg-white hover:bg-white/90 text-[#0E0E0E] rounded-none font-mono text-xs uppercase tracking-wider font-bold transition-all inline-flex items-center justify-center gap-2"
              >
                Create Account <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => signIn("github")}
                className="h-12 px-6 border border-[#27272A] hover:bg-white/5 hover:border-zinc-500 text-white rounded-none font-mono text-xs uppercase tracking-wider font-bold transition-all inline-flex items-center justify-center gap-2"
              >
                <Github className="h-4 w-4" /> GitHub
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272A] bg-[#0E0E0E] py-8">
        <div className="container flex flex-col sm:flex-row justify-between items-center max-w-6xl mx-auto px-4 text-xs text-zinc-500 font-mono uppercase gap-4">
          <p>&copy; 2026 LOCK IN // MD. ALL RIGHTS RESERVED.</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse shadow-[0_0_8px_#10B981]"></span>
            <span>SYSTEM_STATUS: READY</span>
          </div>
        </div>
      </footer>

      {/* ── Auth Dialog ──────────────────────────────────────────────── */}
      <Dialog open={authMode !== null} onOpenChange={() => setAuthMode(null)}>
        <DialogContent className="sm:max-w-md bg-[#131313] border-[#27272A] p-0 gap-0 rounded-none">
          <div className="p-6 border-b border-[#27272A]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#10B981]"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                {authMode === "login" ? "Sign In" : "Create Account"}
              </h2>
            </div>
          </div>

          <div className="p-6">
            {authMode === "login" ? (
              <LoginForm onSwitchToRegister={() => setAuthMode("register")} />
            ) : authMode === "register" ? (
              <RegisterForm onSwitchToLogin={() => setAuthMode("login")} />
            ) : null}
          </div>

          {/* OAuth Divider */}
          <div className="px-6 pb-6">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#27272A]"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#131313] px-3 text-zinc-600 font-mono tracking-widest">
                  Or continue with
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => signIn("github")}
                className="flex-1 h-10 border border-[#27272A] hover:bg-white/5 hover:border-zinc-500 text-zinc-300 rounded-none font-mono text-[10px] uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2"
              >
                <Github className="h-4 w-4" /> GitHub
              </button>
              <button
                onClick={() => signIn("google")}
                className="flex-1 h-10 bg-white hover:bg-white/90 text-[#0E0E0E] rounded-none font-mono text-[10px] uppercase tracking-wider font-bold transition-all"
              >
                Google
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
