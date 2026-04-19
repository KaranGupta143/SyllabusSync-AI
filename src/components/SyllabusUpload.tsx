import { useState } from "react";
import { Upload, FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { extractPdfText } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";

interface Props {
  onIngested: (syllabusId: string, title: string, topics: string[]) => void;
}

export function SyllabusUpload({ onIngested }: Props) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");

  const handleFile = async (file: File) => {
    if (!file) return;
    setBusy(true);
    setBusyMsg("Reading PDF...");
    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const extracted = await extractPdfText(file);
        setText(extracted);
        if (!title) setTitle(file.name.replace(/\.pdf$/i, ""));
        toast.success("PDF text extracted. Review and click Process.");
      } else {
        const t = await file.text();
        setText(t);
        if (!title) setTitle(file.name);
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not read file. Try pasting the text instead.");
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  };

  const handleSubmit = async () => {
    if (text.trim().length < 50) {
      toast.error("Please provide more syllabus text (min 50 chars).");
      return;
    }
    setBusy(true);
    setBusyMsg("Analyzing syllabus & creating embeddings...");
    try {
      const { data, error } = await supabase.functions.invoke("ingest-syllabus", {
        body: {
          device_id: getDeviceId(),
          title: title || "My Syllabus",
          text,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Syllabus ready! ${data.topics?.length ?? 0} topics detected.`);
      onIngested(data.syllabus_id, title || "My Syllabus", data.topics ?? []);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Failed to process syllabus";
      toast.error(msg);
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  };

  return (
    <Card className="p-6 md:p-8 shadow-soft border-border/60">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Start with your syllabus</h2>
          <p className="text-sm text-muted-foreground">
            Upload a PDF or paste your chapter text. We'll detect topics automatically.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Input
          placeholder="Syllabus name (e.g. Class 10 Maths Ch. 4)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />

        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-base ${
            busy ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">Click to upload PDF or text file</div>
          <div className="text-xs text-muted-foreground">PDF, TXT — extracted on-device</div>
          <input
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>

        <div className="text-xs text-muted-foreground text-center">— or paste text below —</div>

        <Textarea
          placeholder="Paste your syllabus / chapter content here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          disabled={busy}
          className="resize-none"
        />

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            {text.length.toLocaleString()} characters
          </div>
          <Button onClick={handleSubmit} disabled={busy || text.length < 50} size="lg">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {busyMsg || "Processing..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Process Syllabus
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
