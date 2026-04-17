"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Mic, BookOpen } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between py-4">
          <div className="font-bold text-xl">Markdown Notetaking App</div>
          <div className="flex gap-4">
            <Button onClick={() => signIn("github")} variant="outline">
              Sign in with GitHub
            </Button>
            <Button onClick={() => signIn("google")}>Sign in with Google</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="bg-gradient-to-b from-background to-muted py-20 sm:py-32">
          <div className="container space-y-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              AI-Powered Workspace for <br />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Smart Notetaking
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Capture your thoughts with Markdown. Organize data with dynamic tables. Control everything with your voice using AI.
            </p>

            <div className="flex gap-4 justify-center pt-8">
              <Button
                size="lg"
                onClick={() => signIn("github")}
                className="group"
              >
                Get Started <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-16">Key Features</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="border border-border rounded-lg p-6 space-y-4">
                <BookOpen className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold">Smart Notes</h3>
                <p className="text-muted-foreground">
                  Write in Markdown with live preview. Your thoughts are synced seamlessly.
                </p>
              </div>

              <div className="border border-border rounded-lg p-6 space-y-4">
                <Zap className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold">Dynamic Tables</h3>
                <p className="text-muted-foreground">
                  Create custom schemas. Organize structured data with flexible columns.
                </p>
              </div>

              <div className="border border-border rounded-lg p-6 space-y-4">
                <Mic className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold">Voice Control</h3>
                <p className="text-muted-foreground">
                  Hold spacebar to speak. AI understands your commands in Vietnamese or English.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-muted py-20">
          <div className="container text-center space-y-8">
            <h2 className="text-3xl font-bold">Ready to supercharge your workflow?</h2>
            <Button
              size="lg"
              onClick={() => signIn("github")}
              className="group"
            >
              Sign in to Get Started <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background/95 py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Markdown Notetaking App. Built with Next.js and AI.</p>
        </div>
      </footer>
    </div>
  );
}
