'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false })

export default function EmailRichTextEditor({ value, onChange, disabled = false, height = 440 }: { value: string; onChange: (value: string) => void; disabled?: boolean; height?: number }) {
  const config = useMemo(() => ({
    readonly: disabled,
    height,
    toolbarAdaptive: false,
    buttons: [
      'source', '|', 'undo', 'redo', '|', 'paragraph', 'font', 'fontsize', '|',
      'bold', 'italic', 'underline', 'strikethrough', 'brush', '|',
      'ul', 'ol', 'outdent', 'indent', 'align', '|', 'table', 'link', 'hr', '|',
      'eraser', 'copyformat', 'preview', 'fullsize'
    ],
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    defaultMode: 1
  }), [disabled, height])

  return <JoditEditor
    value={value}
    config={config}
    onBlur={onChange}
  />
}
