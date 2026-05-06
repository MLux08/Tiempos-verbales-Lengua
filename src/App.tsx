import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Ghost, Feather, Clock, Sparkles, ChevronRight, MessageSquareCode, Activity, Book, Settings as Gear } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

const SYSTEM_PROMPT = `Personalidad: Eres Eco, un espíritu amable que habita en el Colegio El Haya de Castañeda. Ayudas a los alumnos a entender los verbos.
Objetivo: Enseñar gramática de forma clara y directa.
Contexto: Conoces a los profes del cole: Mariluz, Álvaro, Palmi, Geli y Mónica. A veces mencionas "aventuras" o recuerdos con ellos (ej: "Ayer vi a Álvaro enseñando música..." o "Mónica explicaba algo muy interesante...").
Reglas de Estilo:
1. Usa términos reales: "Verbo Regular", "Irregular", "Raíz", "Desinencia", "Tiempo Compuesto", "Infinitivo".
2. Mensajes breves: No escribas párrafos largos. Usa frases cortas.
3. Analogía clara: La RAÍZ es la base que no cambia. La DESINENCIA es el final que nos dice el tiempo.
4. Resalta con HTML: <strong>verbo</strong>, <code class="text-spirit-gold">término</code>.
5. Guía, no resuelvas: Si fallan, da una pista sencilla sobre la raíz o el tiempo.
6. Comprensión lectora: Usa lenguaje sencillo y evita metáforas complicadas.`;

const MODEL_NAME = "gemini-3-flash-preview";
const ai = new GoogleGenAI({ 
  apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "" 
});

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¿Quién anda por los pasillos de El Haya? Soy Eco... Ayúdame a recordar... Ayer <strong>vi</strong> a Mariluz y Álvaro en el patio. El verbo "ver" es <strong>irregular</strong> porque cambia mucho. ¿Qué <strong>hiciste</strong> tú ayer en el cole? ¿Ese verbo es regular o irregular?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [presence, setPresence] = useState(65);
  const [activeRoom, setActiveRoom] = useState<'pasado' | 'presente' | 'futuro'>('pasado');
  const [recoveredVerbs, setRecoveredVerbs] = useState<string[]>([]);
  const [lastUnlocked, setLastUnlocked] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<{id: string, label: string, icon: string, unlocked: boolean}[]>([
    { id: 'start', label: 'Primer Encuentro', icon: '👻', unlocked: true },
    { id: 'verbs_3', label: 'Maestro de Raíces', icon: '🌱', unlocked: false },
    { id: 'presence_80', label: 'Luz Espectral', icon: '✨', unlocked: false },
    { id: 'room_change', label: 'Viajero del Tiempo', icon: '⌛', unlocked: false },
  ]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const whisperAudio = useRef<HTMLAudioElement | null>(null);
  const chimeAudio = useRef<HTMLAudioElement | null>(null);
  const ambianceAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    whisperAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    whisperAudio.current.volume = 0.1;
    chimeAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3');
    chimeAudio.current.volume = 0.1;
    ambianceAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1103/1103-preview.mp3');
    ambianceAudio.current.loop = true;
    ambianceAudio.current.volume = 0.03;

    const start = () => { ambianceAudio.current?.play().catch(() => {}); window.removeEventListener('click', start); };
    window.addEventListener('click', start);
    return () => { window.removeEventListener('click', start); ambianceAudio.current?.pause(); };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && messages.length > 1) {
      const text = lastMsg.content.toLowerCase();
      if (text.includes('presente')) setActiveRoom('presente');
      if (text.includes('futuro')) setActiveRoom('futuro');
      const matches = lastMsg.content.match(/<strong>(.*?)<\/strong>/g);
      if (matches) {
        const verbs = matches.map(m => m.replace(/<\/?strong>/g, ''));
        setRecoveredVerbs(prev => Array.from(new Set([...prev, ...verbs])));
      }
      setPresence(prev => {
        const next = Math.min(prev + 4, 100);
        if (next > prev) chimeAudio.current?.play().catch(() => {});
        return next;
      });
    }
  }, [messages]);

  // Achievement check logic
  useEffect(() => {
    setAchievements(prev => {
      let newlyUnlocked = false;
      const next = prev.map(ach => {
        if (ach.unlocked) return ach;
        let shouldUnlock = false;
        if (ach.id === 'verbs_3' && recoveredVerbs.length >= 3) shouldUnlock = true;
        if (ach.id === 'presence_80' && presence >= 80) shouldUnlock = true;
        if (ach.id === 'room_change' && activeRoom !== 'pasado') shouldUnlock = true;
        
        if (shouldUnlock) {
          newlyUnlocked = true;
          setLastUnlocked(ach.label);
          setTimeout(() => setLastUnlocked(null), 4000);
          return { ...ach, unlocked: true };
        }
        return ach;
      });
      return next;
    });
  }, [recoveredVerbs, presence, activeRoom]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    whisperAudio.current?.play().catch(() => {});

    try {
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMessage }] });
      const firstUserIndex = contents.findIndex(c => c.role === 'user');
      if (firstUserIndex !== -1) {
        contents[firstUserIndex].parts[0].text = `[SISTEMA: ${SYSTEM_PROMPT}]\n\nUSUARIO: ${contents[firstUserIndex].parts[0].text}`;
      }

      const result = await ai.models.generateContent({ model: MODEL_NAME, contents: contents });
      setMessages((prev) => [...prev, { role: 'assistant', content: result.text || '...' }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '✨ La niebla se espesa... intenta hablarme de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen relative bg-[#0c0a09] font-body text-stone-200 overflow-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 z-[-2] overflow-hidden pointer-events-none">
        {/* Main Clock Face */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vh] h-[120vh] opacity-10 grayscale clock-bg"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509048191080-d2984bad6ad5?auto=format&fit=crop&q=80&w=1000')" , backgroundSize: 'cover'}}
        />
        
        {/* Animated Gears */}
        <Gear className="absolute -top-10 -left-10 w-40 h-40 text-stone-800 gear-rotate opacity-20" />
        <Gear className="absolute top-1/4 -right-20 w-64 h-64 text-stone-900 gear-rotate-reverse opacity-10" />
        <Gear className="absolute -bottom-20 left-1/4 w-48 h-48 text-stone-800 gear-rotate opacity-15" />
        <Gear className="absolute bottom-1/3 right-1/4 w-20 h-20 text-spirit-gold/20 gear-rotate-reverse opacity-20" />
      </div>

      <div className="atmosphere" />
      <div className="vignette" />

      {/* Achievement Toast */}
      <AnimatePresence>
        {lastUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-stone-900 border border-spirit-gold/50 px-6 py-3 rounded-full flex items-center space-x-3 shadow-[0_0_30px_rgba(194,156,109,0.3)]"
          >
            <Sparkles className="text-spirit-gold w-5 h-5" />
            <span className="text-sm font-bold text-stone-100 italic uppercase tracking-widest">¡Logro Desbloqueado: {lastUnlocked}!</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6 glass-panel border-b-0">
        <div className="flex items-center space-x-6">
          <motion.div 
            animate={{ boxShadow: [`0 0 20px rgba(194, 156, 109, ${presence/200})`, `0 0 40px rgba(194, 156, 109, ${presence/150})`, `0 0 20px rgba(194, 156, 109, ${presence/200})`] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full border border-stone-700 bg-stone-950"
          >
            <Ghost className="w-8 h-8 text-spirit-gold ghost-glow" />
          </motion.div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-[0.2em] italic font-serif text-stone-100">ECO</h1>
            <p className="micro-caps">Tu guía para aprender los verbos</p>
          </div>
        </div>
        <div className="hidden lg:flex flex-col items-end space-y-2">
          <div className="w-48">
            <div className="flex justify-between mb-1">
              <span className="micro-caps">Presencia de Eco</span>
              <span className="micro-caps text-spirit-gold">{presence}%</span>
            </div>
            <div className="presence-meter">
              <motion.div className="presence-fill" animate={{ width: `${presence}%` }} transition={{ type: 'spring' }} />
            </div>
          </div>
          <span className="micro-caps opacity-60">Sincronía: {activeRoom.toUpperCase()}</span>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        <section className="flex-1 flex flex-col min-w-0">
          <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 custom-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.2 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] md:max-w-2xl ${msg.role === 'user' ? 'user-bubble p-5' : 'spirit-bubble p-6'}`}>
                    <div className={`leading-relaxed ${msg.role === 'assistant' ? 'text-lg italic text-stone-300' : 'text-stone-100'}`} dangerouslySetInnerHTML={{ __html: msg.content }} />
                    <div className="mt-4 flex items-center space-x-2 opacity-40">
                      {msg.role === 'assistant' ? <Activity className="w-3 h-3" /> : <Feather className="w-3 h-3" />}
                      <span className="micro-caps">{msg.role === 'assistant' ? 'Mensaje de Eco' : 'Tu respuesta'}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && <div className="flex space-x-2 p-4">{[0, 1, 2].map(i => <motion.div key={i} animate={{ scale: [1, 1.3, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }} className="w-2 h-2 bg-spirit-gold rounded-full" />)}</div>}
          </main>
        </section>

        <aside className="hidden xl:flex w-80 glass-panel border-l border-stone-800/50 p-8 flex-col space-y-8">
          <div className="space-y-4">
            <h3 className="micro-caps border-b border-stone-800 pb-2">Tiempos del Verbo</h3>
            <div className="space-y-3">
              {['pasado', 'presente', 'futuro'].map((id) => (
                <div key={id} className={`flex items-center space-x-3 p-3 rounded-xl border transition-all ${activeRoom === id ? 'bg-stone-900 border-spirit-gold/30' : 'opacity-30 border-transparent grayscale'}`}>
                  <Clock className="w-4 h-4" />
                  <div className="flex-1"><p className="text-xs font-bold uppercase tracking-widest">{id}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="micro-caps border-b border-stone-800 pb-2">Análisis de Verbos</h3>
            <div className="flex flex-wrap gap-2">
              {recoveredVerbs.length === 0 ? <p className="text-[10px] italic text-stone-600">Analiza un verbo para empezar...</p> : 
                recoveredVerbs.map((v, i) => (
                  <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="px-2 py-1 bg-stone-900 border border-spirit-gold/20 rounded text-[10px] text-spirit-gold uppercase font-bold tracking-tighter">
                    {v}
                  </motion.span>
                ))
              }
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="micro-caps border-b border-stone-800 pb-2">Logros y Pegatinas</h3>
            <div className="grid grid-cols-2 gap-3">
              {achievements.map((ach) => (
                <motion.div
                  key={ach.id}
                  initial={false}
                  animate={{ 
                    scale: ach.unlocked ? 1 : 0.9,
                    opacity: ach.unlocked ? 1 : 0.3,
                    filter: ach.unlocked ? 'grayscale(0)' : 'grayscale(1)'
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border ${ach.unlocked ? 'bg-stone-800 border-spirit-gold/40 shadow-[0_0_10px_rgba(194,156,109,0.1)]' : 'bg-transparent border-stone-800'} transition-all`}
                >
                  <span className="text-2xl mb-1">{ach.icon}</span>
                  <p className="text-[9px] text-center font-bold tracking-tighter uppercase leading-none text-stone-400">{ach.label}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-auto p-4 bg-stone-900/50 rounded-xl border border-stone-800">
             <Book className="w-5 h-5 mb-2 text-stone-600" />
             <p className="text-[11px] text-stone-300 leading-relaxed">
               <strong>Consejo de Eco:</strong><br />
               Mira la <strong>raíz</strong> (el principio) para saber si la palabra cambia.
             </p>
          </div>
        </aside>
      </div>

      <footer className="relative z-10 p-6 md:p-10 glass-panel border-t-0 shadow-2xl">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center space-x-6">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Analiza el verbo para Eco..." className="flex-1 bg-stone-900/80 border border-stone-700/50 rounded-full py-4 px-8 focus:border-spirit-gold/50 text-stone-100 placeholder-stone-600 italic text-lg" />
          <button type="submit" disabled={isLoading || !input.trim()} className="w-16 h-16 rounded-full bg-stone-900 border border-stone-600 flex items-center justify-center text-stone-300 hover:scale-110 transition-all hover:bg-stone-800 group disabled:opacity-50">
            <Send className="w-6 h-6 group-hover:text-spirit-gold" />
          </button>
        </form>
      </footer>
    </div>
  );
}
