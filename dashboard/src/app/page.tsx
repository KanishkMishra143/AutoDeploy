"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Github,
  Globe,
  Radar,
  Rocket,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const featureCards = [
  {
    icon: Rocket,
    title: "One-click repository deployment",
    description: "Connect a GitHub repo, choose a branch and runtime, and let AutoDeploy build and publish it without hand-managed server steps.",
  },
  {
    icon: Radar,
    title: "Real-time deployment visibility",
    description: "Track running jobs, recent history, live status, and deployment results from a single control surface instead of scattered tools.",
  },
  {
    icon: Workflow,
    title: "Operational workflow in one place",
    description: "Handle deployment triggers, topology awareness, and service lifecycle actions from the same product experience.",
  },
  {
    icon: ShieldCheck,
    title: "Auth-protected control plane",
    description: "GitHub sign-in via Supabase keeps the orchestration layer private while still giving the project a public-facing product story.",
  },
];

const workflowSteps = [
  "Sign in with GitHub and register a repository.",
  "Configure branch, build pack, and deployment settings.",
  "Trigger a deployment and watch the pipeline update live.",
  "Open the deployed URL, inspect logs, or stop the service from the dashboard.",
];

export default function LandingPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleLogin = async () => {
    setIsSigningIn(true);
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,#050505_0%,#0a0a0a_50%,#050505_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <section className="relative px-5 pb-20 pt-6 md:px-10 md:pb-28 md:pt-8">
        <div className="mx-auto max-w-6xl">
          <header className="glass mb-14 flex items-center justify-between rounded-[28px] px-5 py-4 md:px-7">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/20">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-lg font-black uppercase tracking-tight">AutoDeploy</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Developer-first deployment orchestration</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="#features"
                className="hidden rounded-2xl border border-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-300 transition hover:border-white/20 hover:text-white md:inline-flex"
              >
                Explore
              </a>
              <button
                onClick={handleLogin}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-accent hover:text-white disabled:cursor-wait disabled:opacity-70"
              >
                <Github className="h-4 w-4" />
                {isSigningIn ? "Signing In" : "Open Dashboard"}
              </button>
            </div>
          </header>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400"> Welcome to the future of orchestration!</span>
              </div>

              <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.92] tracking-[-0.05em] text-white md:text-7xl">
                Deploy repositories through a focused orchestration control plane.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-gray-300 md:text-lg">
                AutoDeploy is a full-stack deployment solution that turns a GitHub repository into a managed application workflow.
                It centralizes repo onboarding, deployment execution, live status tracking, and service control in one dashboard.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={handleLogin}
                  disabled={isSigningIn}
                  className="inline-flex items-center justify-center gap-3 rounded-[22px] bg-accent px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
                >
                  Launch With GitHub
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="#workflow"
                  className="inline-flex items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-gray-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  See Workflow
                </Link>
              </div>
            </div>

            <div className="glass rounded-[32px] p-6 md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Overview</p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Why it matters</h2>
                </div>
                <Server className="h-8 w-8 text-accent" />
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                  <p className="mt-2 text-sm leading-7 text-gray-300">
                    This is not just a UI mockup. It demonstrates product thinking, deployment workflow design, authentication, and operational observability in one system.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                    <Clock3 className="mb-3 h-5 w-5 text-emerald-400" />
                    <p className="text-sm font-black uppercase tracking-wider">Live pipeline feedback</p>
                    <p className="mt-2 text-sm text-gray-400">Recent jobs, running states, logs, and deployment results stay visible.</p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                    <Globe className="mb-3 h-5 w-5 text-blue-400" />
                    <p className="text-sm font-black uppercase tracking-wider">From repo to URL</p>
                    <p className="mt-2 text-sm text-gray-400">The product story is clear: source code in, deployed service out.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Core capabilities</p>
            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight md:text-4xl">What AutoDeploy can do</h2>
            <p className="mt-4 text-sm leading-7 text-gray-400 md:text-base">
              The landing page explains the product in plain language so a recruiter, teammate, or interviewer can understand the system quickly.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {featureCards.map((feature) => (
              <article key={feature.title} className="glass rounded-[28px] p-6 md:p-7">
                <feature.icon className="mb-5 h-7 w-7 text-accent" />
                <h3 className="text-xl font-black uppercase tracking-tight text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-400">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="relative px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="glass rounded-[30px] p-7 md:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">System narrative</p>
            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">How the experience flows</h2>
            <p className="mt-4 text-sm leading-7 text-gray-400">
              The product now works as a guided path from authentication to deployment operations, which makes the whole system easier to present.
            </p>
          </div>

          <div className="space-y-4">
            {workflowSteps.map((step, index) => (
              <div key={step} className="glass flex gap-4 rounded-[28px] p-5 md:p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-sm font-black text-accent">
                  0{index + 1}
                </div>
                <div>
                  <p className="text-lg font-black uppercase tracking-tight text-white">{step}</p>
                  <p className="mt-2 text-sm leading-7 text-gray-400">
                    {index === 0 && "Authentication gates access to the private control plane while keeping the project presentation public."}
                    {index === 1 && "Deployment setup makes it clear the app supports configurable runtime behavior rather than a static demo path."}
                    {index === 2 && "Operational visibility is part of the product experience, not just backend plumbing."}
                    {index === 3 && "The loop closes with live URLs, logs, topology context, and direct lifecycle controls."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl rounded-[36px] border border-white/10 bg-white/[0.04] p-8 md:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Interview talking points</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight md:text-4xl">
                The project now reads like a complete product, not a hidden internal screen.
              </h2>
              <div className="mt-6 space-y-3 text-sm leading-7 text-gray-300">
                <p>It has a clear public-facing explanation of the problem space.</p>
                <p>It shows the practical value of the system before asking the user to sign in.</p>
                <p>It gives you a stronger narrative for your CV, portfolio, and demos.</p>
              </div>
            </div>

            <div className="glass rounded-[30px] p-6 md:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Highlights</p>
              <div className="mt-5 space-y-4">
                {[
                  "Public root landing page on auto-deploy.tech",
                  "Protected dashboard after GitHub authentication",
                  "Single-product story from repository intake to live deployment",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <p className="text-sm leading-7 text-gray-300">{item}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleLogin}
                disabled={isSigningIn}
                className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-white px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-black transition hover:bg-accent hover:text-white disabled:cursor-wait disabled:opacity-70"
              >
                <Github className="h-4 w-4" />
                {isSigningIn ? "Redirecting" : "Sign In To Continue"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
