import { Layout } from "@/components/Layout";
import { ArrowLeft, Bot, ListChecks, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useSetOperatorContext } from "@/contexts/OperatorPageContext";

export default function NewTestSelection() {
  const [, setLocation] = useLocation();

  useSetOperatorContext({
    label: "New Test",
    context:
      "User is on the test type selection screen, choosing between Autonomous AI Agent and Scripted Steps (Deterministic) test types.",
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-10 pb-20">
        <Link
          href="/tests"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-8 group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to library
        </Link>

        <div className="mb-8">
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
            Create a Test
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Choose how you want to define and run this test.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Autonomous AI Agent */}
          <button
            onClick={() => setLocation("/tests/new/autonomous")}
            className="text-left surface-subtle border border-border rounded-[8px] p-6 hover:border-border/80 hover:shadow-sm transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 rounded-[8px] bg-muted shrink-0">
                <Bot className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-foreground leading-tight">
                  Autonomous AI Agent
                </div>
                <div className="text-[13px] text-muted-foreground mt-1 leading-snug">
                  Describe a goal — the AI navigates and tests your app like a
                  real user
                </div>
              </div>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                "No predefined steps needed",
                "Adapts to UI changes in real time",
                "Best for exploratory or complex flows",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-[6px] bg-secondary text-muted-foreground text-[11px] font-mono border border-border">
                Autonomous
              </span>
              <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">
                Get started →
              </span>
            </div>
          </button>

          {/* Scripted Steps */}
          <button
            onClick={() => setLocation("/tests/new/deterministic")}
            className="text-left surface-subtle border border-border rounded-[8px] p-6 hover:border-border/80 hover:shadow-sm transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 rounded-[8px] bg-muted shrink-0">
                <ListChecks className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-foreground leading-tight">
                  Scripted Steps
                </div>
                <div className="text-[13px] text-muted-foreground mt-1 leading-snug">
                  Define precise steps — manually or with AI — that run with
                  self-healing
                </div>
              </div>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                "Full control over each action",
                "AI self-healing for selector drift",
                "Best for critical or regression flows",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-[6px] bg-secondary text-muted-foreground text-[11px] font-mono border border-border">
                Deterministic
              </span>
              <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">
                Get started →
              </span>
            </div>
          </button>
        </div>
      </div>
    </Layout>
  );
}
