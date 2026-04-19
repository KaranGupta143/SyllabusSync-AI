import { useState } from "react";
import { Brain, GraduationCap, Sparkles, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { SyllabusUpload } from "@/components/SyllabusUpload";
import { TopicList } from "@/components/TopicList";
import { QuizRunner, type QuizQuestion } from "@/components/QuizRunner";
import { TeachPanel } from "@/components/TeachPanel";
import { DoubtPanel } from "@/components/DoubtPanel";
import { Dashboard } from "@/components/Dashboard";
import { ThinkingDots } from "@/components/ThinkingDots";
import { GroundingBadge } from "@/components/GroundingBadge";
import { supabase } from "@/integrations/supabase/client";

type RightView =
  | { kind: "welcome" }
  | { kind: "loading-quiz"; topic: string }
  | { kind: "quiz"; topic: string; questions: QuizQuestion[] }
  | { kind: "teach"; topic: string };

interface SyllabusState {
  id: string;
  title: string;
  topics: string[];
}

const Index = () => {
  const [syllabus, setSyllabus] = useState<SyllabusState | null>(null);
  const [view, setView] = useState<RightView>({ kind: "welcome" });
  const [doubtOpen, setDoubtOpen] = useState(false);
  const [doubtContext, setDoubtContext] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const startQuiz = async (topic: string) => {
    if (!syllabus) return;
    setView({ kind: "loading-quiz", topic });
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { syllabus_id: syllabus.id, topic, count: 10 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.questions?.length) throw new Error("No questions generated.");
      setView({ kind: "quiz", topic, questions: data.questions });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate quiz";
      toast.error(msg);
      setView({ kind: "welcome" });
    }
  };

  const startTeach = (topic: string) => {
    if (!syllabus) return;
    setView({ kind: "teach", topic });
  };

  const askDoubt = (ctx: string) => {
    setDoubtContext(ctx);
    setDoubtOpen(true);
  };

  const resetSyllabus = () => {
    setSyllabus(null);
    setView({ kind: "welcome" });
  };

  const onQuizDone = () => {
    setRefreshKey((k) => k + 1);
    setView({ kind: "welcome" });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="container max-w-7xl flex items-center justify-between py-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <img src="/i1.png" alt="SyllabusSync AI logo" className="h-9 w-9 rounded-xl object-cover shadow-glow" />
            <div>
              <div className="font-bold text-base leading-tight">SyllabusSync AI</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Adaptive Learning Tutor
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syllabus && (
              <Button variant="ghost" size="sm" onClick={resetSyllabus}>
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">New syllabus</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => askDoubt("")}>
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Doubt</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl px-4 md:px-6 py-6 md:py-10">
        {!syllabus ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-3 mb-8">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Learn math, <span className="text-gradient">your syllabus</span>, your pace
              </h1>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Upload your chapter or syllabus PDF. Get adaptive quizzes, step-by-step
                explanations, and a friendly tutor that explains your mistakes — for class 9-12.
              </p>
            </div>
            <SyllabusUpload
              onIngested={(id, title, topics) => setSyllabus({ id, title, topics })}
            />
            <FeatureGrid />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* Left column */}
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-1">
              <TopicList
                topics={syllabus.topics}
                syllabusTitle={syllabus.title}
                selectedTopic={"topic" in view ? view.topic : null}
                onPickQuiz={startQuiz}
                onPickTeach={startTeach}
              />
              <Dashboard refreshKey={refreshKey} />
            </aside>

            {/* Right column */}
            <section className="min-w-0">
              {view.kind === "welcome" && (
                <Card className="p-8 md:p-12 text-center shadow-soft border-border/60 bg-gradient-card">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-hero mx-auto flex items-center justify-center shadow-glow mb-4">
                    <GraduationCap className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Pick a topic to start</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">
                    Choose any topic from your syllabus on the left. Quiz yourself or learn
                    a concept step-by-step.
                  </p>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Every question is grounded in your uploaded syllabus.
                  </div>
                </Card>
              )}

              {view.kind === "loading-quiz" && (
                <Card className="p-8 shadow-soft border-border/60">
                  <div className="mb-4">
                    <GroundingBadge topic={view.topic} />
                  </div>
                  <ThinkingDots label="Generating syllabus-grounded quiz" />
                </Card>
              )}

              {view.kind === "quiz" && (
                <QuizRunner
                  topic={view.topic}
                  syllabusId={syllabus.id}
                  questions={view.questions}
                  onDone={onQuizDone}
                  onAskDoubt={askDoubt}
                />
              )}

              {view.kind === "teach" && (
                <TeachPanel
                  key={view.topic}
                  topic={view.topic}
                  syllabusId={syllabus.id}
                  onAskDoubt={askDoubt}
                  onStartQuiz={() => startQuiz(view.topic)}
                />
              )}
            </section>
          </div>
        )}
      </main>

      <DoubtPanel open={doubtOpen} context={doubtContext} onClose={() => setDoubtOpen(false)} />
    </div>
  );
};

function FeatureGrid() {
  const items = [
    {
      icon: Sparkles,
      title: "Syllabus-grounded quizzes",
      desc: "Every question is tagged with the exact topic & section from your syllabus.",
    },
    {
      icon: GraduationCap,
      title: "Explain my mistake",
      desc: "Wrong answer? Your tutor explains why — kindly, simply, step by step.",
    },
    {
      icon: Brain,
      title: "Doubt mode",
      desc: "Ask 'why did this step happen?' anytime — like chatting with a real teacher.",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
      {items.map((it) => (
        <Card key={it.title} className="p-4 border-border/60">
          <it.icon className="h-5 w-5 text-primary mb-2" />
          <div className="font-semibold text-sm mb-1">{it.title}</div>
          <div className="text-xs text-muted-foreground leading-relaxed">{it.desc}</div>
        </Card>
      ))}
    </div>
  );
}

export default Index;
