import { MapPin } from "lucide-react";

export function GroundingBadge({ topic, pageRef }: { topic: string; pageRef?: string | null }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
      <MapPin className="h-3 w-3" />
      <span>
        Based on your syllabus · <span className="font-semibold">{topic}</span>
        {pageRef ? <span className="text-primary/70"> · {pageRef}</span> : null}
      </span>
    </div>
  );
}
