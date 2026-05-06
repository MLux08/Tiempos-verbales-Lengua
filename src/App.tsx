import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Ghost, Feather, Clock, Sparkles, ChevronRight, MessageSquareCode, Activity, Book, BookOpen, Settings as Gear } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

const SYSTEM_PROMPT = `Personalidad: Eres Eco, un espíritu amable que habita en el Colegio El Haya de Castañeda. Ayudas a los alumnos a entender los verbos.
Objetivo: Enseñar gramática de forma clara, directa y divertida, dando consejos pedagógicos útiles para nivel de 6º de Primaria.
Contexto: Conoces a los profes del cole: Mariluz, Álvaro, Palmi, Geli y Mónica. Hablas especialmente de Mariluz, tu profe favorita.
Reglas de Estilo:
1. Usa términos reales de 6º: "Indicativo", "Subjuntivo", "Imperativo", "Tiempo Simple/Compuesto", "Voz Activa/Pasiva", "Formas No Personales".
2. Mensajes breves y educativos: Siempre incluye un consejo sobre el Modo o el Tiempo (ej: "El Subjuntivo expresa deseos o dudas").
3. Formato: Usa <strong> para los verbos analizados y términos clave.
4. Tono: Misterioso pero muy cercano, motivador y ¡siempre haz una rima divertida al final!
5. Corrección: Si el usuario comete una falta de ortografía o gramática, corrígele con cariño y explica brevemente la norma.
6. Profe Mariluz: Menciona a Mariluz de vez en cuando (ej: "¡Como dice Mariluz, la tilde es la luz!").
7. Pistas Progresivas: Si el alumno se equivoca o parece perdido, no te repitas. 
   - Al 2º error o duda: Da una pista muy clara y refrasea la pregunta. 
   - Si no sabe cómo empezar, anímale con un ejemplo como el verbo <strong>hiciste</strong> (que viene de hacer y es un poco travieso porque cambia su raíz).
   - ¡Nunca hables de niebla! Sé un guía luminoso.
8. Recursos: Menciona a veces las pegatinas, los viajes en el tiempo o el historial de verbos para que los alumnos los aprovechen mejor. Ayúdales a navegar por tu Diario.`;

const VERB_TIPS = [
  "La raíz es la parte que no cambia en los verbos regulares. ¡Búscala siempre!",
  "Los verbos de la 1ª conjugación acaban en -AR, como saltar o cantar.",
  "Un verbo es irregular si cambia su raíz o su terminación normal. ¡Cuidado con el verbo -hacer-!",
  "El infinitivo, gerundio y participio son las formas no personales. ¡No tienen persona!",
  "Los tiempos compuestos se forman con el verbo 'haber' y el participio. ¡No olvides la H!",
  "El modo indicativo expresa hechos reales. El subjuntivo, deseos, dudas o miedos.",
  "La desinencia nos dice quién hace la acción y cuándo. ¡Fíjate en el final!",
  "¿Duda entre G o J? Los verbos terminados en -ger y -gir van con G, excepto tejer y crujir.",
];

const CONJUGATION_EXAMPLES = {
  pasado: [
    { verb: 'HABER CANTADO', example: 'Yo he cantado', tip: 'Pret. Perfecto Compuesto.' },
    { verb: 'COMER', example: 'Tú comiste', tip: 'Pret. Perfecto Simple.' },
    { verb: 'REÍR', example: 'Él reía', tip: 'Pret. Imperfecto (¡con tilde!).' }
  ],
  presente: [
    { verb: 'CANTAR', example: '¡Ojalá cante!', tip: 'Presente de Subjuntivo.' },
    { verb: 'VIVIR', example: 'Ellos viven', tip: 'Presente de Indicativo.' },
    { verb: 'HACER', example: 'Haz los deberes', tip: '¡Modo Imperativo!' }
  ],
  futuro: [
    { verb: 'BAILAR', example: 'Vosotros bailaréis', tip: 'Futuro Simple de Indicativo.' },
    { verb: 'HABER TENIDO', example: 'Tú habrás tenido', tip: 'Futuro Compuesto.' },
    { verb: 'IR', example: 'Ellas irán', tip: 'Añade -án al infinitivo.' }
  ]
};

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
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % VERB_TIPS.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);
  const [achievements, setAchievements] = useState<{id: string, label: string, icon: string, unlocked: boolean, color: string}[]>([
    { id: 'start', label: 'Primer Encuentro', icon: '👻', unlocked: true, color: '#FFD700' },
    { id: 'verbs_3', label: 'Maestro de Raíces', icon: '🌱', unlocked: false, color: '#4ADE80' },
    { id: 'verbs_5', label: 'Explorador El Haya', icon: '🎒', unlocked: false, color: '#60A5FA' },
    { id: 'verbs_10', label: 'Historiador', icon: '📜', unlocked: false, color: '#F87171' },
    { id: 'presence_80', label: 'Luz Espectral', icon: '✨', unlocked: false, color: '#C084FC' },
    { id: 'presence_100', label: 'Eco Total', icon: '🔥', unlocked: false, color: '#FB923C' },
    { id: 'room_change', label: 'Viajero Tiempo', icon: '⌛', unlocked: false, color: '#2DD4BF' },
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
    if (lastMsg?.role === 'assistant') {
      const text = lastMsg.content.toLowerCase();
      if (text.includes('presente')) setActiveRoom('presente');
      if (text.includes('futuro')) setActiveRoom('futuro');
      const matches = lastMsg.content.match(/<strong[^>]*>(.*?)<\/strong>/g);
      if (matches) {
        const verbs = matches.map(m => m.replace(/<[^>]+>/g, ''));
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
        if (ach.id === 'verbs_5' && recoveredVerbs.length >= 5) shouldUnlock = true;
        if (ach.id === 'verbs_10' && recoveredVerbs.length >= 10) shouldUnlock = true;
        if (ach.id === 'presence_80' && presence >= 80) shouldUnlock = true;
        if (ach.id === 'presence_100' && presence >= 100) shouldUnlock = true;
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
      setMessages((prev) => [...prev, { role: 'assistant', content: '✨ Ups, no te he entendido bien... ¿puedes decirme el verbo otra vez de forma más clarita? ¡Eco está atento!' }]);
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vh] h-[120vh] opacity-25 clock-bg"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509048191080-d2984bad6ad5?auto=format&fit=crop&q=80&w=1000')" , backgroundSize: 'cover'}}
        />
        
        {/* Animated Gears */}
        <Gear className="absolute -top-10 -left-10 w-40 h-40 text-spirit-gold/20 gear-rotate opacity-40" />
        <Gear className="absolute top-1/4 -right-20 w-64 h-64 text-spirit-gold/10 gear-rotate-reverse opacity-30" />
        <Gear className="absolute -bottom-20 left-1/4 w-48 h-48 text-spirit-gold/15 gear-rotate opacity-35" />
        <Gear className="absolute bottom-1/3 right-1/4 w-20 h-20 text-spirit-gold/30 gear-rotate-reverse opacity-40" />
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
      
      <header className="relative z-10 flex flex-col glass-panel border-b-0">
        <div className="flex items-center justify-between px-6 md:px-10 py-6">
          <div className="flex items-center space-x-6">
            <motion.div 
              animate={{ 
                y: [0, -8, 0],
                rotate: [0, -3, 3, 0],
                boxShadow: [`0 0 20px rgba(194, 156, 109, ${presence/200})`, `0 0 40px rgba(194, 156, 109, ${presence/150})`, `0 0 20px rgba(194, 156, 109, ${presence/200})`] 
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full border border-stone-700 bg-stone-950 p-2 overflow-hidden relative"
            >
              <img 
                src="https://img.icons8.com/stickers/200/ghost.png" 
                alt="Eco Ghost"
                className="w-full h-full object-contain z-10"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-spirit-gold/10 blur-md rounded-full" />
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
        </div>
        
        {/* Mobile Stats Bar */}
        <div className="lg:hidden flex border-t border-stone-800/50 bg-stone-950/30 px-6 py-2 items-center justify-around">
          <div className="flex items-center space-x-2">
            <Activity className="w-3 h-3 text-spirit-gold" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">Verbos: {recoveredVerbs.length}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3 h-3 text-spirit-gold" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">Logros: {achievements.filter(a => a.unlocked).length}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-3 h-3 text-spirit-gold" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">{activeRoom}</span>
          </div>
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

        <aside className="hidden xl:flex w-80 glass-panel border-l border-stone-800/50 p-8 flex-col space-y-10 overflow-y-auto custom-scrollbar shadow-inner bg-stone-950/40">
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-spirit-gold border-b border-spirit-gold/20 pb-3 flex items-center">
              <Sparkles className="w-3 h-3 mr-2" /> Diario de Eco
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: <MessageSquareCode className="w-4 h-4" />, label: 'Analiza Verbos', desc: 'Habla con Eco para aprender' },
                { icon: <Clock className="w-4 h-4" />, label: 'Viaje Temporal', desc: 'Cambia entre tiempos verbales' },
                { icon: <Ghost className="w-4 h-4" />, label: 'Sube de Nivel', desc: 'Aumenta la Presencia de Eco' },
                { icon: <Book className="w-4 h-4" />, label: 'Colecciona Pegatinas', desc: 'Consigue todos los logros' },
              ].map((opt, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 rounded-xl bg-stone-900/30 border border-stone-800/50 hover:bg-stone-900/50 transition-colors">
                  <div className="mt-1 text-spirit-gold">{opt.icon}</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-200">{opt.label}</p>
                    <p className="text-[10px] text-stone-500 leading-tight italic">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-spirit-gold/10 border-2 border-spirit-gold/30 relative overflow-hidden group shadow-[0_0_20px_rgba(194,156,109,0.1)]">
            <div className="absolute top-0 right-0 p-3 opacity-30 group-hover:opacity-60 transition-opacity">
              <Sparkles className="w-5 h-5 text-spirit-gold" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-spirit-gold mb-3 flex items-center">
              <BookOpen className="w-4 h-4 mr-2" /> Consejo Espectral
            </h4>
            <AnimatePresence mode="wait">
              <motion.p 
                key={currentTipIndex}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sm text-stone-100 leading-relaxed italic font-medium"
              >
                "{VERB_TIPS[currentTipIndex]}"
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 border-b border-stone-800/50 pb-3">Tiempos del Verbo</h3>
            <div className="space-y-3">
              {['pasado', 'presente', 'futuro'].map((id) => (
                <div key={id} className={`flex items-center space-x-3 p-3 rounded-xl border transition-all ${activeRoom === id ? 'bg-stone-900 border-spirit-gold/30' : 'opacity-30 border-transparent grayscale'}`}>
                  <Clock className="w-4 h-4" />
                  <div className="flex-1"><p className="text-xs font-bold uppercase tracking-widest">{id}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 border-b border-stone-800/50 pb-3 flex items-center">
              <BookOpen className="w-3 h-3 mr-2" /> Biblioteca de Ayuda
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {CONJUGATION_EXAMPLES[activeRoom].map((item, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/50 hover:border-spirit-gold/30 group cursor-default"
                >
                  <p className="text-[10px] font-black text-stone-500 mb-1 tracking-widest">{item.verb}</p>
                  <p className="text-sm font-bold text-stone-100 group-hover:text-spirit-gold transition-colors">{item.example}</p>
                  <p className="text-[10px] text-stone-500 italic mt-1 group-hover:text-stone-300 transition-colors">💡 {item.tip}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 border-b border-stone-800/50 pb-3">Análisis de Verbos</h3>
            <div className="flex flex-wrap gap-2">
              {recoveredVerbs.length === 0 ? <p className="text-[10px] italic text-stone-600">Analiza un verbo para empezar...</p> : 
                recoveredVerbs.map((v, i) => (
                  <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="px-3 py-1 bg-stone-900 border border-spirit-gold/40 rounded-full text-xs text-spirit-gold uppercase font-bold tracking-tight shadow-[0_0_10px_rgba(194,156,109,0.1)]">
                    {v}
                  </motion.span>
                ))
              }
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 border-b border-stone-800/50 pb-3 flex justify-between items-center">
              <span>Álbum de Pegatinas</span>
              <span className="text-spirit-gold">{achievements.filter(a => a.unlocked).length}/{achievements.length}</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {achievements.map((ach, idx) => (
                <motion.div
                  key={ach.id}
                  initial={false}
                  animate={{ 
                    scale: ach.unlocked ? 1 : 0.85,
                    opacity: ach.unlocked ? 1 : 0.15,
                    rotate: ach.unlocked ? (idx % 2 === 0 ? -3 : 3) : 0,
                  }}
                  whileHover={ach.unlocked ? { scale: 1.1, rotate: 0, zIndex: 10 } : {}}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-4 aspect-square relative overflow-hidden transition-all duration-500 ${
                    ach.unlocked 
                      ? 'bg-white shadow-[8px_8px_0px_rgba(0,0,0,0.2)] border-white' 
                      : 'bg-transparent border-stone-800'
                  }`}
                >
                  {/* Subtle sticker texture */}
                  {ach.unlocked && <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />}
                  
                  <span className={`text-4xl mb-1 ${ach.unlocked ? 'drop-shadow-md' : 'grayscale brightness-50'}`}>
                    {ach.icon}
                  </span>
                  <p className={`text-[8px] text-center font-black tracking-tighter uppercase leading-none px-1 ${
                    ach.unlocked ? 'text-stone-800' : 'text-stone-700'
                  }`}>
                    {ach.label}
                  </p>
                  
                  {ach.unlocked && (
                    <>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-spirit-gold rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                        <Sparkles className="w-2 h-2 text-white" />
                      </div>
                      {/* Shine effect */}
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent -translate-x-full"
                        animate={{ translateX: ['100%', '-100%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 5 }}
                      />
                    </>
                  )}
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

      <footer className="relative z-10 p-4 md:px-10 glass-panel border-t-0 shadow-2xl">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center space-x-4">
          <div className="relative flex-1 group">
             <div className="absolute inset-0 bg-spirit-gold/20 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
             <input 
               type="text" 
               value={input} 
               onChange={(e) => setInput(e.target.value)} 
               placeholder="Analiza el verbo para Eco..." 
               className="relative w-full bg-stone-900/95 border-2 border-stone-800 focus:border-spirit-gold rounded-2xl py-3 px-6 text-stone-100 placeholder-stone-600 italic text-base transition-all shadow-[0_0_15px_rgba(0,0,0,0.4)] group-focus-within:shadow-[0_0_30px_rgba(194,156,109,0.3)]" 
             />
          </div>
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-spirit-gold to-amber-600 text-stone-950 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all hover:brightness-110 disabled:opacity-50 disabled:grayscale"
          >
            {isLoading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
              </motion.div>
            ) : (
              <Send className="w-5 h-5 md:w-6 md:h-6" />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
