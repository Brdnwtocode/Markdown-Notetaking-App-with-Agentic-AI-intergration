"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import axios from "axios";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // ── Client-side validation ──────────────────────────────────────────
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await axios.post("/api/auth/register", {
        email: email.toLowerCase().trim(),
        password,
        name: name.trim() || undefined,
      });

      if (res.data?.success) {
        setSuccess("Account created! Signing you in...");

        // Auto sign-in after successful registration
        const signInResult = await signIn("credentials", {
          email: email.toLowerCase().trim(),
          password,
          redirect: false,
        });

        if (signInResult?.ok) {
          window.location.href = "/workspace";
        } else {
          setSuccess("");
          setError("Account created but sign-in failed. Please try signing in.");
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/5 px-4 py-3 text-red-400 font-mono text-xs uppercase tracking-wider">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 border border-[#10B981]/30 bg-[#10B981]/5 px-4 py-3 text-[#10B981] font-mono text-xs uppercase tracking-wider">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Name <span className="text-zinc-700">(optional)</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={isLoading}
            className="pl-10 h-11 bg-[#0E0E0E] border-[#27272A] text-white font-mono text-sm rounded-none placeholder:text-zinc-600 focus:border-[#10B981]/50 focus:ring-0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading}
            className="pl-10 h-11 bg-[#0E0E0E] border-[#27272A] text-white font-mono text-sm rounded-none placeholder:text-zinc-600 focus:border-[#10B981]/50 focus:ring-0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            disabled={isLoading}
            className="pl-10 h-11 bg-[#0E0E0E] border-[#27272A] text-white font-mono text-sm rounded-none placeholder:text-zinc-600 focus:border-[#10B981]/50 focus:ring-0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Confirm Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            disabled={isLoading}
            className="pl-10 h-11 bg-[#0E0E0E] border-[#27272A] text-white font-mono text-sm rounded-none placeholder:text-zinc-600 focus:border-[#10B981]/50 focus:ring-0"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 bg-[#10B981] hover:bg-[#10B981]/90 text-[#0E0E0E] rounded-none font-mono text-xs uppercase tracking-wider font-bold transition-all"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Create Account"
        )}
      </Button>

      <p className="text-center text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-[#10B981] hover:underline font-bold"
        >
          Sign In
        </button>
      </p>
    </form>
  );
}
