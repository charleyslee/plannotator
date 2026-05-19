interface CompletionBannerProps {
  submitted: 'approved' | 'denied' | 'feedback' | 'exited' | null | false;
  title: string;
  subtitle: string;
}

export function CompletionBanner({ submitted, title, subtitle }: CompletionBannerProps) {
  if (!submitted) return null;

  const isApproved = submitted === 'approved';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0 ${
        isApproved
          ? 'bg-success/10 border-success/20 text-success'
          : 'bg-accent/10 border-accent/20 text-accent'
      }`}
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        {isApproved ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        )}
      </svg>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
      </div>
    </div>
  );
}
