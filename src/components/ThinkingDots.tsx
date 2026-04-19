export function ThinkingDots({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <span>{label}</span>
      <span className="flex gap-1">
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
    </div>
  );
}
