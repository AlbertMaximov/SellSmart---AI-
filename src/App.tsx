import { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Link as LinkIcon, 
  Mic, 
  Send, 
  Copy, 
  RefreshCw, 
  MessageSquare, 
  Settings, 
  Plus, 
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Volume2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeItem, chatWithAI, speakText, rewriteText, type AnalysisResult } from './services/geminiService';
import confetti from 'canvas-confetti';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [filters, setFilters] = useState({
    speed: false,
    maxPrice: false,
    local: false
  });
  const [customParams, setCustomParams] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customParamText, setCustomParamText] = useState('');
  const [analyzingImage, setAnalyzingImage] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      processImage(base64, false);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (data: string, isUrl: boolean) => {
    setLoading(true);
    setError(null);
    setAnalyzingImage(data);
    setImageLoadError(false);
    try {
      const analysis = await analyzeItem(data, isUrl);
      setResult(analysis);
      if (analysis.confidence > 0.8) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      setError('Не удалось проанализировать изображение. Попробуйте еще раз или используйте другую ссылку.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (imageUrl) {
      processImage(imageUrl, true);
      setShowUrlInput(false);
    }
  };

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText;
    if (!messageText.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, text: messageText }];
    setMessages(newMessages);
    setInputText('');

    try {
      const aiResponse = await chatWithAI(messageText, result || undefined);
      setMessages([...newMessages, { role: 'ai' as const, text: aiResponse || 'Извините, я не смог ответить.' }]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Ваш браузер не поддерживает распознавание речи.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
    };
    recognition.start();
  };

  const playTTS = async (text: string) => {
    const audioBase64 = await speakText(text);
    if (audioBase64) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const binaryString = atob(audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // PCM 16-bit is 2 bytes per sample
        const pcmData = new Int16Array(bytes.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0;
        }
        
        const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000);
        audioBuffer.getChannelData(0).set(floatData);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      } catch (err) {
        console.error("Error playing PCM audio:", err);
      }
    }
  };

  const handleRewrite = async (style: 'short' | 'selling') => {
    if (!result || isRewriting) return;
    setIsRewriting(true);
    try {
      const newDescription = await rewriteText(result.description, style);
      setResult({ ...result, description: newDescription });
    } catch (err) {
      console.error(err);
    } finally {
      setIsRewriting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Объявление скопировано!');
  };

  const getAdjustedPrice = () => {
    if (!result) return 0;
    let price = result.recommendedPrice;
    if (filters.speed) price *= 0.85;
    if (filters.maxPrice) price *= 1.15;
    return Math.round(price);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/30 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-bottom border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <RefreshCw className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">SellSmart</h1>
        </div>
        <button 
          onClick={() => setChatOpen(true)}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors relative"
        >
          <MessageSquare className="w-6 h-6 text-slate-600" />
          {messages.length > 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
          )}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 pb-32">
        {!result && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 py-12"
          >
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">
                Продай вещь <br />
                <span className="text-emerald-500">быстрее с ИИ</span>
              </h2>
              <p className="text-slate-500 text-lg">
                Сфотографируйте предмет, и мы сделаем всё остальное: <br />
                оценим цену и напишем объявление.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-3 bg-slate-900 text-white py-5 rounded-2xl font-semibold text-xl shadow-xl hover:bg-slate-800 active:scale-95 transition-all"
              >
                <Camera className="w-7 h-7" />
                Сделать фото
              </button>
              <button 
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-semibold text-lg hover:border-slate-300 active:scale-95 transition-all"
              >
                <LinkIcon className="w-6 h-6" />
                Загрузить по ссылке
              </button>
            </div>

            <AnimatePresence>
              {showUrlInput && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <input 
                      type="text" 
                      placeholder="Вставьте ссылку на фото..."
                      className="flex-1 px-4 py-2 outline-none text-slate-700"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                    <button 
                      onClick={handleUrlSubmit}
                      className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                    >
                      Анализировать
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </motion.div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            {analyzingImage && !imageLoadError ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white"
              >
                <img 
                  src={analyzingImage} 
                  alt="Analyzing" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageLoadError(true)}
                />
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              </motion.div>
            ) : imageLoadError ? (
              <div className="w-full max-w-sm aspect-square bg-slate-100 rounded-3xl flex flex-col items-center justify-center p-8 text-center space-y-4 border-2 border-dashed border-slate-200">
                <AlertCircle className="w-12 h-12 text-slate-300" />
                <p className="text-slate-500 font-medium">Не удалось загрузить изображение для предпросмотра, но мы продолжаем анализ...</p>
              </div>
            ) : (
              <div className="relative">
                <div className="w-20 h-20 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 w-8 h-8 animate-pulse" />
              </div>
            )}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-800">Анализируем товар...</h3>
              <p className="text-slate-500">Ищем похожие предложения на рынке</p>
            </div>
          </div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 border border-red-100 p-6 rounded-2xl flex items-start gap-4 mb-8"
          >
            <AlertCircle className="text-red-500 w-6 h-6 shrink-0 mt-1" />
            <div className="space-y-2">
              <p className="text-red-800 font-medium">{error}</p>
              <button 
                onClick={() => { setError(null); setResult(null); }}
                className="text-red-600 font-semibold text-sm underline"
              >
                Попробовать снова
              </button>
            </div>
          </motion.div>
        )}

        {result && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {analyzingImage && !imageLoadError && (
              <div className="w-full max-w-sm mx-auto aspect-square rounded-3xl overflow-hidden shadow-xl border-4 border-white">
                <img 
                  src={analyzingImage} 
                  alt="Analyzed item" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {imageLoadError && (
              <div className="bg-slate-100 p-4 rounded-xl flex items-center gap-3 border border-slate-200">
                <AlertCircle className="text-slate-400 w-5 h-5" />
                <p className="text-slate-500 text-sm">Изображение не загрузилось, но анализ завершен.</p>
              </div>
            )}
            {result.confidence < 0.6 && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-3">
                <AlertCircle className="text-amber-500 w-5 h-5" />
                <p className="text-amber-800 text-sm">
                  Я не полностью уверен в товаре. Можете уточнить детали в чате.
                </p>
              </div>
            )}

            {/* Price Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Мин.</p>
                <p className="text-lg font-bold text-slate-700">{result.minPrice.toLocaleString()} ₽</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm text-center ring-2 ring-emerald-500/20">
                <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider mb-1">Реком.</p>
                <p className="text-xl font-black text-emerald-700">{getAdjustedPrice().toLocaleString()} ₽</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Средняя</p>
                <p className="text-lg font-bold text-slate-700">{result.avgPrice.toLocaleString()} ₽</p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-400" />
                  <h3 className="font-bold text-slate-800">Параметры продажи</h3>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setFilters(f => ({ ...f, speed: !f.speed }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filters.speed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Продать быстро
                </button>
                <button 
                  onClick={() => setFilters(f => ({ ...f, maxPrice: !f.maxPrice }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filters.maxPrice ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Максимальная цена
                </button>
                <button 
                  onClick={() => setFilters(f => ({ ...f, local: !f.local }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filters.local ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Самовывоз/Локально
                </button>
                {customParams.map((p, i) => (
                  <span key={i} className="px-4 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-600 flex items-center gap-2">
                    {p}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setCustomParams(ps => ps.filter((_, idx) => idx !== i))} />
                  </span>
                ))}
                <button 
                  onClick={() => setShowCustomInput(true)}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-slate-100 text-slate-400 border border-dashed border-slate-300 hover:bg-slate-200 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Добавить параметр
                </button>
              </div>

              <AnimatePresence>
                {showCustomInput && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2"
                  >
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Напр: срочно, торг..."
                      className="flex-1 px-4 py-2 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-emerald-500"
                      value={customParamText}
                      onChange={(e) => setCustomParamText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customParamText) {
                          setCustomParams([...customParams, customParamText]);
                          setCustomParamText('');
                          setShowCustomInput(false);
                        }
                      }}
                    />
                    <button 
                      onClick={() => setShowCustomInput(false)}
                      className="p-2 text-slate-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Ad Card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
              <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                <div>
                  <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Готовое объявление</p>
                  <h3 className="text-xl font-bold">{result.title}</h3>
                </div>
                <button 
                  onClick={() => copyToClipboard(`${result.title}\n\n${result.description}\n\nХарактеристики:\n${Object.entries(result.characteristics).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nЦена: ${getAdjustedPrice()} ₽`)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors"
                >
                  <Copy className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Описание</h4>
                  <div className={`relative ${isRewriting ? 'opacity-50' : ''}`}>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{result.description}</p>
                    {isRewriting && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(result.characteristics).map(([key, value]) => (
                    <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">{key}</p>
                      <p className="text-slate-800 font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    disabled={isRewriting}
                    onClick={() => handleRewrite('short')}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Сделать короче
                  </button>
                  <button 
                    disabled={isRewriting}
                    onClick={() => handleRewrite('selling')}
                    className="flex-1 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-all disabled:opacity-50"
                  >
                    Сделать продающим
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setResult(null)}
              className="w-full py-4 text-slate-400 font-medium hover:text-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Начать заново
            </button>
          </motion.div>
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center pointer-events-none">
        <div className="flex gap-4 pointer-events-auto">
          <button 
            onClick={handleVoice}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${isRecording ? 'bg-red-500 animate-pulse scale-110' : 'bg-slate-900 hover:bg-slate-800'}`}
          >
            <Mic className="w-8 h-8 text-white" />
          </button>
          <button 
            onClick={() => setChatOpen(true)}
            className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200 hover:bg-emerald-600 transition-all"
          >
            <MessageSquare className="w-8 h-8 text-white" />
          </button>
        </div>
      </div>

      {/* Chat Drawer */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[80vh] bg-white rounded-t-[40px] z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <RefreshCw className="text-emerald-600 w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Ассистент SellSmart</h3>
                    <p className="text-xs text-emerald-500 font-medium">Онлайн</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="p-2 bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 && (
                  <div className="text-center py-10 space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                      <MessageSquare className="text-slate-300 w-8 h-8" />
                    </div>
                    <p className="text-slate-400">Задайте любой вопрос о продаже вашего товара</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['Сколько стоит?', 'Как продать быстрее?', 'Где разместить?'].map(q => (
                        <button 
                          key={q}
                          onClick={() => handleSendMessage(q)}
                          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-sm text-slate-600 border border-slate-100 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-3xl ${m.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                      <p className="text-sm leading-relaxed">{m.text}</p>
                      {m.role === 'ai' && (
                        <button 
                          onClick={() => playTTS(m.text)}
                          className="mt-2 text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs font-bold"
                        >
                          <Volume2 className="w-3 h-3" />
                          Озвучить
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                  <input 
                    type="text" 
                    placeholder="Ваш вопрос..."
                    className="flex-1 px-4 py-2 outline-none text-slate-700"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button 
                    onClick={() => handleSendMessage()}
                    className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
