import React, { useMemo } from 'react';
import { parseMarkdownToBlocks } from '@plannotator/ui/utils/parser';
import { BlockRenderer } from '@plannotator/ui/components/BlockRenderer';

interface LandingPreviewProps {
  markdown: string;
  fileName: string | null;
  onClear: () => void;
}

export default function LandingPreview({ markdown }: LandingPreviewProps): React.ReactElement {
  const blocks = useMemo(() => parseMarkdownToBlocks(markdown), [markdown]);

  return (
    <div className="p-4">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {blocks.map(block => (
          <BlockRenderer key={block.id} block={block} />
        ))}
      </div>
    </div>
  );
}
