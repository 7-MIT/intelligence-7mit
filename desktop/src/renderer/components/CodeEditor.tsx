import Editor from '@monaco-editor/react';
import '@/lib/monaco';

/** Dimuat malas (React.lazy): Monaco + worker-nya hanya masuk memori saat editor benar-benar dibuka. */
export default function CodeEditor(props: React.ComponentProps<typeof Editor>) {
  return <Editor {...props} />;
}
