import { Composer } from '@/components/agent';
import { ModelPicker, useCurrentTask } from '@/components/common';
import { Thread } from '@/components/thread';
import { Empty } from '@/components/ui';
import { send, store } from '@/lib/state';

const greeting = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'; };
const SUGGESTIONS = [
  { t: 'Jelaskan konsep', d: 'Terangkan perubahan iklim dengan bahasa sederhana' },
  { t: 'Bantu menulis', d: 'Buat draf email permohonan izin yang sopan' },
  { t: 'Rangkum', d: 'Rangkum langkah belajar efektif untuk ujian' },
  { t: 'Brainstorm', d: 'Beri 10 ide nama untuk proyek aplikasi belajar' }
];

export function ChatPage() {
  const conv = store.use((s) => s.conv);
  const task = useCurrentTask();
  const has = !!conv && conv.mode === 'chat' && conv.messages.length > 0;
  const composer = <Composer mode="chat" task={task} placeholder="Tanyakan apa saja…" rightExtra={<ModelPicker />} below={<span>Chat biasa tanpa akses ke komputer Anda. Untuk agen yang bertindak, pindah ke <b>Code</b>.</span>} />;
  return (
    <>
      <div className="topbar drag"><span className="title no-drag">{has ? conv!.title : 'Chat baru'}</span></div>
      <div className="chat-wrap">
        {has ? (<><Thread code={false} />{composer}</>) : (
          <div className="empty"><div className="empty-in">
            <Empty title={`${greeting()}. Apa yang ingin Anda bahas?`} />
            <div style={{ marginTop: -8 }}>{composer}</div>
            <div className="sugs">{SUGGESTIONS.map((s) => <button key={s.t} className="sug" onClick={() => send('chat', s.d)}><b>{s.t}</b>{s.d}</button>)}</div>
          </div></div>
        )}
      </div>
    </>
  );
}
