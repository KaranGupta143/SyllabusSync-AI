import { BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  topics: string[];
  syllabusTitle: string;
  selectedTopic: string | null;
  onPickQuiz: (topic: string) => void;
  onPickTeach: (topic: string) => void;
}

export function TopicList({ topics, syllabusTitle, selectedTopic, onPickQuiz, onPickTeach }: Props) {
  if (topics.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No topics detected. Try a different syllabus.
      </Card>
    );
  }

  return (
    <Card className="p-5 shadow-soft border-border/60">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{syllabusTitle}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{topics.length} topics</span>
      </div>
      <div className="space-y-2">
        {topics.map((topic) => {
          const active = selectedTopic === topic;
          return (
            <div
              key={topic}
              className={`group rounded-lg border p-3 transition-base ${
                active
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 hover:border-primary/30 hover:bg-secondary/50"
              }`}
            >
              <div className="text-sm font-medium mb-2 leading-snug">{topic}</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs flex-1"
                  onClick={() => onPickQuiz(topic)}
                >
                  <Sparkles className="h-3 w-3" />
                  Quiz me
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={() => onPickTeach(topic)}
                >
                  <GraduationCap className="h-3 w-3" />
                  Teach me
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
