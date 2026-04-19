import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Target, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";

interface TopicStat {
  topic: string;
  total: number;
  correct: number;
  accuracy: number;
}

export function Dashboard({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<TopicStat[]>([]);
  const [overall, setOverall] = useState({ total: 0, correct: 0 });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("topic, is_correct")
        .eq("device_id", getDeviceId());
      if (!data) return;
      const map = new Map<string, { correct: number; total: number }>();
      for (const a of data) {
        const cur = map.get(a.topic) ?? { correct: 0, total: 0 };
        cur.total += 1;
        if (a.is_correct) cur.correct += 1;
        map.set(a.topic, cur);
      }
      const arr: TopicStat[] = Array.from(map.entries())
        .map(([topic, v]) => ({
          topic,
          total: v.total,
          correct: v.correct,
          accuracy: Math.round((v.correct / v.total) * 100),
        }))
        .sort((a, b) => b.total - a.total);
      setStats(arr);
      setOverall({
        total: data.length,
        correct: data.filter((a) => a.is_correct).length,
      });
    })();
  }, [refreshKey]);

  const accuracy = overall.total ? Math.round((overall.correct / overall.total) * 100) : 0;
  const mastered = stats.filter((s) => s.accuracy >= 80 && s.total >= 3).length;
  const weak = stats.filter((s) => s.accuracy < 60 && s.total >= 2);

  return (
    <Card className="p-5 shadow-soft border-border/60">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Your progress</h3>
      </div>

      {overall.total === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Take a quiz to see your progress here.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
              <Target className="h-4 w-4 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold">{accuracy}%</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Accuracy</div>
            </div>
            <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-center">
              <Award className="h-4 w-4 text-success mx-auto mb-1" />
              <div className="text-lg font-bold">{mastered}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Mastered</div>
            </div>
            <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 text-center">
              <TrendingUp className="h-4 w-4 text-accent mx-auto mb-1" />
              <div className="text-lg font-bold">{overall.total}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Attempts</div>
            </div>
          </div>

          {stats.length > 0 && (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    type="category"
                    dataKey="topic"
                    width={100}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v}%`, "Accuracy"]}
                  />
                  <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                    {stats.slice(0, 6).map((s, i) => (
                      <Cell
                        key={i}
                        fill={
                          s.accuracy >= 80
                            ? "hsl(var(--success))"
                            : s.accuracy >= 60
                            ? "hsl(var(--primary))"
                            : "hsl(var(--destructive))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {weak.length > 0 && (
            <div className="rounded-lg bg-warning/5 border border-warning/30 p-3">
              <div className="text-xs font-semibold text-warning-foreground/80 uppercase tracking-wide mb-1">
                Focus areas
              </div>
              <div className="text-xs space-y-0.5">
                {weak.slice(0, 3).map((w) => (
                  <div key={w.topic} className="flex justify-between gap-2">
                    <span className="truncate">{w.topic}</span>
                    <span className="font-semibold text-destructive shrink-0">{w.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
