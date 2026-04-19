import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, XCircle, ArrowRight, Loader2, Lightbulb, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { GroundingBadge } from "@/components/GroundingBadge";
import { ThinkingDots } from "@/components/ThinkingDots";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { toast } from "sonner";

export interface QuizQuestion {
  question: string;
  type: "mcq" | "short";
  options?: string[];
  correct_answer: string;
  solution_steps: string[];
  grounding_ref: string;
}

export interface Evaluation {
  is_correct: boolean;
  step_by_step: string[];
  final_answer: string;
  explain_mistake: string;
  missing_concept: string;
}

interface Props {
  topic: string;
  syllabusId: string;
  questions: QuizQuestion[];
  onDone: () => void;
  onAskDoubt: (context: string) => void;
}

export function QuizRunner({ topic, syllabusId, questions, onDone, onAskDoubt }: Props) {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const q = questions[idx];

  const submit = async () => {
    if (!answer.trim()) {
      toast.error("Please enter or select an answer.");
      return;
    }
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke("evaluate-answer", {
        body: {
          question: q.question,
          user_answer: answer,
          correct_answer: q.correct_answer,
          solution_steps: q.solution_steps,
          topic,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEvaluation(data);
      setScore((s) => ({
        correct: s.correct + (data.is_correct ? 1 : 0),
        total: s.total + 1,
      }));
      // Persist attempt
      await supabase.from("quiz_attempts").insert({
        device_id: getDeviceId(),
        syllabus_id: syllabusId,
        topic,
        question: q.question,
        user_answer: answer,
        correct_answer: q.correct_answer,
        is_correct: data.is_correct,
        question_type: q.type,
        grounding_ref: q.grounding_ref,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Evaluation failed";
      toast.error(msg);
    } finally {
      setEvaluating(false);
    }
  };

  const next = () => {
    setEvaluation(null);
    setAnswer("");
    if (idx + 1 >= questions.length) {
      toast.success(`Quiz complete! ${score.correct + 0}/${questions.length} correct`);
      onDone();
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Quiz · {topic}
          </div>
          <div className="text-lg font-semibold mt-1">
            Question {idx + 1} of {questions.length}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Score</div>
          <div className="text-lg font-semibold text-success">
            {score.correct}/{score.total}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-hero transition-base"
          style={{ width: `${((idx + (evaluation ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <Card className="p-6 shadow-soft border-border/60">
        <div className="mb-4">
          <GroundingBadge topic={topic} pageRef={q.grounding_ref} />
        </div>

        <h3 className="text-lg font-medium leading-relaxed mb-5">{q.question}</h3>

        {q.type === "mcq" && q.options ? (
          <div className="space-y-2">
            {q.options.map((opt) => (
              <button
                key={opt}
                onClick={() => !evaluation && setAnswer(opt)}
                disabled={!!evaluation}
                className={`w-full text-left rounded-lg border p-3 text-sm transition-base ${
                  answer === opt
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border hover:border-primary/30 hover:bg-secondary/50"
                } ${evaluation ? "cursor-default" : "cursor-pointer"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <Textarea
            placeholder="Type your answer here..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!evaluation}
            rows={3}
          />
        )}

        {!evaluation && (
          <div className="flex justify-end mt-5">
            <Button onClick={submit} disabled={evaluating || !answer.trim()} size="lg">
              {evaluating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  Submit
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      {evaluating && (
        <Card className="p-4">
          <ThinkingDots label="Your tutor is checking your answer" />
        </Card>
      )}

      {/* Evaluation card */}
      {evaluation && (
        <Card
          className={`p-6 shadow-soft animate-fade-in-up border-2 ${
            evaluation.is_correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <div className="flex items-start gap-3 mb-4">
            {evaluation.is_correct ? (
              <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive shrink-0" />
            )}
            <div className="flex-1">
              <div className="text-lg font-semibold">
                {evaluation.is_correct ? "Correct! 🎉" : "Not quite — let's learn"}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Final answer:{" "}
                <span className="font-semibold text-foreground">{evaluation.final_answer}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                Step-by-step solution
              </div>
              <ol className="space-y-2">
                {evaluation.step_by_step.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{step}</ReactMarkdown>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Explain mistake — the WOW moment */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <div className="text-sm font-semibold text-primary">
                  {evaluation.is_correct ? "Insight" : "Why your answer was wrong"}
                </div>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert text-foreground/90">
                <ReactMarkdown>{evaluation.explain_mistake}</ReactMarkdown>
              </div>
              {evaluation.missing_concept && (
                <div className="mt-3 text-xs text-muted-foreground">
                  📌 Concept to revise:{" "}
                  <span className="font-semibold text-foreground">{evaluation.missing_concept}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAskDoubt(`Question: ${q.question}\nMy answer: ${answer}\nCorrect: ${evaluation.final_answer}`)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask a doubt
            </Button>
            <Button onClick={next} className="ml-auto">
              {idx + 1 >= questions.length ? (
                <>
                  Finish quiz
                  <RefreshCw className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next question
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
