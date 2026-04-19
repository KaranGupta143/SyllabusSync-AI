import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { GraduationCap, Loader2, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThinkingDots } from "@/components/ThinkingDots";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Lesson {
  concept: string;
  analogy: string;
  example_problem: string;
  example_steps: string[];
  example_answer: string;
}

interface Props {
  topic: string;
  syllabusId: string;
  onAskDoubt: (context: string) => void;
  onStartQuiz: () => void;
}

export function TeachPanel({ topic, syllabusId, onAskDoubt, onStartQuiz }: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setLesson(null);
    try {
      const { data, error } = await supabase.functions.invoke("teach-topic", {
        body: { topic, syllabus_id: syllabusId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLesson(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load lesson";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount / when topic changes
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, syllabusId]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Teach Me
          </div>
          <div className="text-lg font-semibold mt-1">{topic}</div>
        </div>
        <Button onClick={onStartQuiz} variant="outline">
          <Sparkles className="h-4 w-4" />
          Quiz me on this
        </Button>
      </div>

      {loading && (
        <Card className="p-6">
          <ThinkingDots label="Your tutor is preparing the lesson" />
        </Card>
      )}

      {lesson && (
        <>
          <Card className="p-6 shadow-soft border-border/60">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Concept</h3>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{lesson.concept}</ReactMarkdown>
            </div>
          </Card>

          <Card className="p-6 shadow-soft border-accent/20 bg-accent/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-accent">Real-life analogy</h3>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{lesson.analogy}</ReactMarkdown>
            </div>
          </Card>

          <Card className="p-6 shadow-soft border-border/60">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Worked example</h3>
            </div>
            <div className="text-sm font-medium mb-3">{lesson.example_problem}</div>
            <ol className="space-y-2 mb-4">
              {lesson.example_steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{step}</ReactMarkdown>
                  </div>
                </li>
              ))}
            </ol>
            <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-sm">
              <span className="font-semibold text-success">Answer: </span>
              {lesson.example_answer}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAskDoubt(`Topic just learned: ${topic}. Concept: ${lesson.concept.slice(0, 300)}`)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask a doubt about this
            </Button>
          </div>
        </>
      )}

      {!loading && !lesson && (
        <Card className="p-6 text-center">
          <Button onClick={load}>
            <Loader2 className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      )}
    </div>
  );
}
