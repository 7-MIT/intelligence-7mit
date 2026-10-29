import { Sparkles } from 'lucide-react';
import type { AgentMode } from '@shared/types';
import { Composer, Messages, StatusPill } from '@/components/agent';
import { ModelBar, useCurrentTask } from '@/components/common';
import { Empty } from '@/components/ui';
import { store } from '@/lib/state';

export function ChatPane({ mode, placeholder, hint, disabled }: { mode: AgentMode; placeholder: string; hint?: string; disabled?: string }) {
  const conv = store.use((s) => s.conv);
  const task = useCurrentTask(mode);
  const has = conv?.mode === mode && conv.messages.length > 0;
  return (
    <div className="chat-wrap">
      <div style={{ flex: 1, minHeight: 0 }}>
        {has ? <Messages mode={mode} task={task} /> : <Empty title="Apa yang ingin Anda kerjakan?" icon={<Sparkles color="#fff" />}><p style={{ maxWidth: 480 }}>{hint}</p></Empty>}
      </div>
      <Composer mode={mode} task={task} placeholder={placeholder} disabled={disabled} />
    </div>
  );
}

export function ChatPage() {
  const task = useCurrentTask('chat');
  return (
    <>
      <div className="topbar"><h2 className="display">Chat</h2><ModelBar mode="chat" /><StatusPill task={task} /></div>
      <div className="page" style={{ overflow: 'hidden' }}>
        <ChatPane mode="chat" placeholder="Tanyakan apa saja…" hint="Percakapan biasa tanpa akses ke komputer Anda. Gunakan Code, Web, atau Control untuk agen yang bertindak." />
      </div>
    </>
  );
}
