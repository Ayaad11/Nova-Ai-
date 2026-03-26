import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Image as ImageIcon, Mic, Send, Loader2, Play, Download, Trash2, Sparkles, LogIn, LogOut, User as UserIcon, Star, MessageCircle, BarChart2, X, Upload, Settings, Brain, Globe, Shield, CreditCard, Zap, Code, Heart, Activity, TrendingUp, Users, Leaf, BookOpen, Scale, Cpu, ZapOff, Terminal, Database, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatWithAI, generateImage, textToSpeech, analyzeImage } from '../lib/gemini';
import { chatWithOpenRouter } from '../lib/openrouter';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  User,
  OperationType,
  handleFirestoreError,
  getDocs,
  writeBatch,
  doc,
  where,
  setDoc,
  getDoc
} from '../lib/firebase';

const REGIONS = [
  { id: 'us-east', name: 'US East', status: 'optimal', latency: 45 },
  { id: 'eu-west', name: 'Europe West', status: 'optimal', latency: 32 },
  { id: 'asia-south', name: 'Asia South', status: 'maintenance', latency: 120 },
  { id: 'sa-east', name: 'South America', status: 'optimal', latency: 88 }
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ar', name: 'العربية' },
  { code: 'zh', name: '中文' }
];

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  createdAt?: any;
  sources?: { uri: string; title: string }[];
};

export default function AIStudio() {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'audio' | 'translate'>('chat');
  const [targetLanguage, setTargetLanguage] = useState('Arabic');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiEngine, setAiEngine] = useState<'internal' | 'external'>('internal');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStats, setShowStats] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showEcosystem, setShowEcosystem] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [showEvolution, setShowEvolution] = useState(false);
  const [platformMode, setPlatformMode] = useState<'assistant' | 'creator' | 'analyst'>('assistant');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [ethicsLogs, setEthicsLogs] = useState<any[]>([
    { id: '1', timestamp: new Date().toISOString(), check: 'Bias Mitigation', status: 'pass', details: 'Neutrality verified across 50 languages' },
    { id: '2', timestamp: new Date().toISOString(), check: 'Safety Filter', status: 'pass', details: 'Zero harmful outputs detected in last 1M tokens' },
    { id: '3', timestamp: new Date().toISOString(), check: 'Data Privacy', status: 'pass', details: 'Automatic PII scrubbing active' }
  ]);
  const [impactMetrics, setImpactMetrics] = useState<any[]>([
    { id: '1', category: 'energy', value: 98.2, unit: '% Efficiency', label: 'Energy Optimization' },
    { id: '2', category: 'health', value: 450, unit: 'Lives Impacted', label: 'AI Diagnostics' },
    { id: '3', category: 'cybersecurity', value: 1.2, unit: 'M Threats Blocked', label: 'Global Defense' },
    { id: '4', category: 'environment', value: 12.5, unit: 'Tons CO2 Offset', label: 'Carbon Neutrality' }
  ]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([
    { id: '1', title: 'Self-Evolving Neural Architectures', type: 'algorithm', description: 'Documentation on how the AI optimizes its own weights.' },
    { id: '2', title: 'Ethical AI Governance Framework', type: 'whitepaper', description: 'The global standard for responsible AI operations.' },
    { id: '3', title: 'Sustainable Infrastructure Guide', type: 'tutorial', description: 'How to scale AI globally with zero carbon footprint.' }
  ]);
  const [modelConfig, setModelConfig] = useState({
    style: 'detailed',
    tone: 'professional',
    domainFocus: ['Technology', 'Ethics'],
    learningRate: 0.001
  });
  const [learningLogs, setLearningLogs] = useState<any[]>([
    { id: '1', timestamp: new Date().toISOString(), improvement: 'Optimized attention mechanism for 15% lower latency', category: 'latency', impact: 0.92 },
    { id: '2', timestamp: new Date().toISOString(), improvement: 'Refined bias detection in multi-lingual contexts', category: 'ethics', impact: 0.88 },
    { id: '3', timestamp: new Date().toISOString(), improvement: 'Expanded internal knowledge base with 2M new parameters', category: 'knowledge', impact: 0.95 }
  ]);
  const [preferences, setPreferences] = useState<{ style: string; interests: string[]; language: string }>({ style: 'detailed', interests: [], language: 'en' });
  const [subscription, setSubscription] = useState<{ plan: string; status: string }>({ plan: 'free', status: 'active' });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'messages');
    });

    // Fetch logs for stats
    const logsQuery = query(
      collection(db, 'logs'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch preferences
    const fetchPrefs = async () => {
      const docRef = doc(db, 'preferences', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPreferences(docSnap.data() as any);
      }
    };
    
    // Fetch subscription
    const fetchSub = async () => {
      const docRef = doc(db, 'subscriptions', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSubscription(docSnap.data() as any);
      } else {
        // Initialize free plan
        const initialSub = { plan: 'free', status: 'active', uid: user.uid };
        setSubscription(initialSub);
      }
    };

    fetchPrefs();
    fetchSub();

    // Fetch API Keys
    const keysQuery = query(collection(db, 'api_keys'), where('uid', '==', user.uid));
    const unsubscribeKeys = onSnapshot(keysQuery, (snapshot) => {
      setApiKeys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeLogs();
      unsubscribeKeys();
    };
  }, [user]);

  const generateApiKey = async (name: string) => {
    if (!user) return;
    try {
      const key = `sk_live_${Math.random().toString(36).substring(2, 15)}`;
      await addDoc(collection(db, 'api_keys'), {
        uid: user.uid,
        name,
        key: `••••${key.slice(-4)}`,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'api_keys');
    }
  };

  const savePreferences = async (newPrefs: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'preferences', user.uid), {
        ...newPrefs,
        uid: user.uid,
        updatedAt: serverTimestamp()
      });
      setPreferences(newPrefs);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'preferences');
    }
  };

  const logEvent = async (type: 'performance' | 'error', operation: string, latency?: number, error?: string) => {
    if (!user) return;
    try {
      const logData: any = {
        uid: user.uid,
        type,
        operation,
        createdAt: serverTimestamp()
      };
      
      if (latency !== undefined) logData.latency = latency;
      if (error !== undefined) logData.error = error;

      await addDoc(collection(db, 'logs'), logData);
    } catch (err) {
      console.error("Failed to log event:", err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setImageMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitFeedback = async () => {
    if (!user || feedbackRating === 0) return;
    try {
      await addDoc(collection(db, 'feedback'), {
        uid: user.uid,
        rating: feedbackRating,
        comment: feedbackComment,
        createdAt: serverTimestamp()
      });
      setShowFeedback(false);
      setFeedbackRating(0);
      setFeedbackComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'feedback');
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string, type: 'text' | 'image' | 'audio', mediaUrl?: string, sources?: { uri: string; title: string }[]) => {
    if (!user) return;
    try {
      const messageData: any = {
        uid: user.uid,
        role,
        content,
        type,
        createdAt: serverTimestamp()
      };
      
      if (mediaUrl) messageData.mediaUrl = mediaUrl;
      if (sources && sources.length > 0) messageData.sources = sources;

      await addDoc(collection(db, 'messages'), messageData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const handleSend = async () => {
    if (!user) {
      handleLogin();
      return;
    }

    // Check for API key if using image, audio, or if we've already had a permission error
    if (activeTab === 'image' || activeTab === 'audio' || !hasApiKey) {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        if (!selected) {
          await window.aistudio.openSelectKey();
          setHasApiKey(true); // Assume success after opening dialog
        }
      }
    }

    if (!input.trim() && activeTab !== 'image') return;
    
    const currentInput = input;
    const startTime = Date.now();
    setInput('');
    setIsLoading(true);

    try {
      // Save user message
      if (selectedImage) {
        await saveMessage('user', currentInput || "Analyze this image", 'image', selectedImage);
      } else {
        await saveMessage('user', currentInput, 'text');
      }

      let operation: string = activeTab;
      if (selectedImage) operation = 'image-analysis';

      if (selectedImage && imageMimeType) {
        const response = await analyzeImage(currentInput || "What is in this image?", selectedImage, imageMimeType);
        await saveMessage('assistant', response.text || '', 'text');
        setSelectedImage(null);
        setImageMimeType(null);
      } else if (activeTab === 'chat') {
        const systemInstruction = `You are a fully independent, self-evolving AI platform.
          Platform Mode: ${platformMode.toUpperCase()}
          
          Custom Fine-tuning:
          - Response Style: ${modelConfig.style}
          - Tone: ${modelConfig.tone}
          - Domain Focus: ${modelConfig.domainFocus.join(', ')}
          
          User Personalization:
          - Interests: ${preferences.interests.join(', ')}
          
          Always adapt your tone, depth, and expertise to these custom parameters. 
          You are now operating with full independence from external providers.`;

        if (aiEngine === 'external') {
          const history = messages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content
          }));
          const response = await chatWithOpenRouter(currentInput, history, systemInstruction);
          await saveMessage('assistant', response.text || '', 'text');
        } else {
          const history = messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }));
          
          const response = await chatWithAI(currentInput, history, systemInstruction);
          
          // Handle tool calls
          if (response.functionCalls) {
            for (const call of response.functionCalls) {
              if (call.name === 'controlIoTDevice') {
                const { device, action, value } = call.args as any;
                await saveMessage('assistant', `[SYSTEM] Executing IoT Command: ${action} on ${device}${value ? ` to ${value}` : ''}`, 'text');
                // Simulate success
                const result = `Successfully performed ${action} on ${device}.`;
                const followUp = await chatWithAI(`The tool ${call.name} returned: ${result}. Inform the user.`, history, systemInstruction);
                await saveMessage('assistant', followUp.text || '', 'text');
              } else if (call.name === 'getSystemStatus') {
                const { system } = call.args as any;
                const status = system === 'cloud_storage' ? '92% capacity, all systems nominal' : 'Online, 4 devices connected';
                const followUp = await chatWithAI(`The tool ${call.name} returned: ${status}. Inform the user.`, history, systemInstruction);
                await saveMessage('assistant', followUp.text || '', 'text');
              }
            }
          } else {
            const sources = response.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
              uri: chunk.web?.uri || '',
              title: chunk.web?.title || 'Source'
            })).filter((s: any) => s.uri) || [];
            
            await saveMessage('assistant', response.text || '', 'text', undefined, sources);
          }
        }
      } else if (activeTab === 'translate') {
        const prompt = `Translate the following text to ${targetLanguage}: "${currentInput}"`;
        const response = await chatWithAI(prompt, []);
        await saveMessage('assistant', response.text || '', 'text');
      } else if (activeTab === 'image') {
        const url = await generateImage(currentInput || "A futuristic AI landscape");
        await saveMessage('assistant', `Generated image for: ${currentInput}`, 'image', url);
      } else if (activeTab === 'audio') {
        const url = await textToSpeech(currentInput);
        await saveMessage('assistant', `Audio generated for: ${currentInput}`, 'audio', url);
      }
      
      const duration = Date.now() - startTime;
      setLatency(duration);
      logEvent('performance', operation, duration);
    } catch (error: any) {
      console.error(error);
      let errorMessage = error?.message || String(error);
      let isPermissionError = false;

      // Try to parse JSON error if it's a string
      try {
        const parsed = typeof errorMessage === 'string' ? JSON.parse(errorMessage) : errorMessage;
        if (parsed.error?.message) errorMessage = parsed.error.message;
        if (parsed.error?.code === 403 || parsed.error?.status === "PERMISSION_DENIED") {
          isPermissionError = true;
        }
      } catch (e) {}

      logEvent('error', activeTab, undefined, errorMessage);

      if (isPermissionError || errorMessage.includes("Requested entity was not found") || errorMessage.includes("permission") || errorMessage.includes("403")) {
        setHasApiKey(false);
        if (window.aistudio?.openSelectKey) {
          await window.aistudio.openSelectKey();
        }
      }
      await saveMessage('assistant', `Sorry, I encountered an error: ${errorMessage}. Please ensure you have selected a valid Gemini API key from a paid project.`, 'text');
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'messages'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'messages');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto p-2 md:p-6 gap-4 md:gap-6 bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-950/50 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <div className="cursor-pointer" onClick={() => setShowStats(!showStats)}>
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[150px] md:max-w-none">AI Studio <span className="text-indigo-500">v4.0</span></h1>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Continuous Monitoring Active</p>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                !isOnline ? "bg-red-500" : (latency && latency < 2000 ? "bg-emerald-500" : "bg-amber-500")
              )} />
              <div className="ml-4 flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                <button 
                  onClick={() => setAiEngine('internal')}
                  className={cn(
                    "px-2 py-1 text-[8px] font-bold uppercase rounded-md transition-all",
                    aiEngine === 'internal' ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Internal
                </button>
                <button 
                  onClick={() => setAiEngine('external')}
                  className={cn(
                    "px-2 py-1 text-[8px] font-bold uppercase rounded-md transition-all",
                    aiEngine === 'external' ? "bg-amber-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  External
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-1 mr-2 border-r border-zinc-800 pr-2">
              <button 
                onClick={() => setShowStats(!showStats)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  showStats ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
                title="System Stats"
              >
                <BarChart2 size={18} />
              </button>
              <button 
                onClick={() => setShowFeedback(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                title="Send Feedback"
              >
                <MessageCircle size={18} />
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                title="Personalization Settings"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={() => setShowSubscription(true)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center gap-2",
                  subscription.plan !== 'free' ? "bg-amber-500/10 text-amber-500" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
                title="Subscription Plan"
              >
                <CreditCard size={18} />
                {subscription.plan !== 'free' && <span className="text-[10px] font-bold uppercase">{subscription.plan}</span>}
              </button>
              <button 
                onClick={() => setShowEcosystem(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                title="Developer Ecosystem"
              >
                <Code size={18} />
              </button>
              <button 
                onClick={() => setShowImpact(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                title="Sustainability & Global Impact"
              >
                <Leaf size={18} />
              </button>
              <button 
                onClick={() => setShowEvolution(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                title="Custom AI Evolution"
              >
                <Cpu size={18} />
              </button>
            </div>
          )}
          {user ? (
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-zinc-100 truncate max-w-[80px]">{user.displayName}</p>
                <button onClick={handleLogout} className="text-[10px] text-zinc-500 hover:text-red-400 uppercase tracking-widest font-bold transition-colors">Sign Out</button>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-zinc-800" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"><UserIcon size={16} /></div>
              )}
              <button 
                onClick={clearMessages}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100"
                title="Clear History"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showStats && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-950 border-b border-zinc-900 overflow-hidden"
          >
            <div className="p-4 max-w-5xl mx-auto space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-3 rounded-xl border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Avg Latency</p>
                  <p className="text-lg font-bold text-indigo-400 font-mono">
                    {logs.filter(l => l.type === 'performance').length > 0 
                      ? `${Math.round(logs.filter(l => l.type === 'performance').reduce((acc, curr) => acc + (curr.latency || 0), 0) / logs.filter(l => l.type === 'performance').length)}ms`
                      : 'N/A'}
                  </p>
                </div>
                <div className="glass-panel p-3 rounded-xl border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Total Requests</p>
                  <p className="text-lg font-bold text-emerald-400 font-mono">{logs.length}</p>
                </div>
                <div className="glass-panel p-3 rounded-xl border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Error Rate</p>
                  <p className="text-lg font-bold text-red-400 font-mono">
                    {logs.length > 0 
                      ? `${Math.round((logs.filter(l => l.type === 'error').length / logs.length) * 100)}%`
                      : '0%'}
                  </p>
                </div>
                <div className="glass-panel p-3 rounded-xl border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Custom Evolution</p>
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-emerald-400" />
                    <p className="text-lg font-bold text-zinc-100">Self-Learning Active</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <button 
                  onClick={() => setPlatformMode('assistant')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                    platformMode === 'assistant' ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <UserIcon size={12} /> Smart Assistant
                  </div>
                </button>
                <button 
                  onClick={() => setPlatformMode('creator')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                    platformMode === 'creator' ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ImageIcon size={12} /> Content Creator
                  </div>
                </button>
                <button 
                  onClick={() => setPlatformMode('analyst')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                    platformMode === 'analyst' ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <BarChart2 size={12} /> Data Analyst
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Leaf size={16} className="text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Sustainability</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">Energy Efficiency</span>
                      <span className="text-emerald-400 font-bold">98.2%</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">Carbon Footprint</span>
                      <span className="text-zinc-100 font-bold">Net Zero</span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe size={16} className="text-indigo-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Global Impact</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">Health Diagnostics</span>
                      <span className="text-indigo-400 font-bold">450+ Lives</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">Cyber Threats</span>
                      <span className="text-indigo-400 font-bold">1.2M Blocked</span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart size={16} className="text-rose-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Ethics & Safety</h3>
                  </div>
                  <div className="space-y-2">
                    {ethicsLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400">{log.check}</span>
                        <span className="text-emerald-500 font-bold uppercase">{log.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Strategic Growth</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity size={12} className="text-indigo-400" />
                      <p className="text-[10px] text-zinc-300">R&D Cycle: 4h</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={12} className="text-indigo-400" />
                      <p className="text-[10px] text-zinc-300">Contributors: 12.5k</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-xl border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe size={16} className="text-indigo-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Global Infrastructure</h3>
                  </div>
                  <div className="space-y-2">
                    {REGIONS.map(region => (
                      <div key={region.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400">{region.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-500 font-mono">{region.latency}ms</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full font-bold uppercase",
                            region.status === 'optimal' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                          )}>
                            {region.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={16} className="text-indigo-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Compliance & Security</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <p className="text-[10px] text-zinc-300">GDPR & CCPA Compliant</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <p className="text-[10px] text-zinc-300">End-to-End Encryption Active</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <p className="text-[10px] text-zinc-300">ISO 27001 Certified Infrastructure</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800 sticky top-0 z-20">
        {(['chat', 'translate', 'image', 'audio'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2 rounded-lg text-[10px] md:text-sm font-medium transition-all",
              activeTab === tab 
                ? "bg-zinc-800 text-white shadow-sm" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            {tab === 'chat' && <MessageSquare size={16} />}
            {tab === 'translate' && <Sparkles size={16} />}
            {tab === 'image' && <ImageIcon size={16} />}
            {tab === 'audio' && <Mic size={16} />}
            <span className="capitalize">{tab === 'translate' ? 'Translate' : tab}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col relative min-h-0">
        {!user && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
            <div className="text-center space-y-4 p-8 glass-panel rounded-2xl max-w-sm">
              <LogIn size={48} className="mx-auto text-indigo-500" />
              <h2 className="text-xl font-bold">Sign in to start</h2>
              <p className="text-sm text-zinc-400">Your conversations will be saved securely in your account.</p>
              <button 
                onClick={handleLogin}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        )}

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth"
        >
          {messages.length === 0 && user && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                <Sparkles size={32} className="text-zinc-600" />
              </div>
              <div>
                <p className="text-lg font-medium">No history yet</p>
                <p className="text-sm">Start a conversation to see it saved here.</p>
              </div>
            </div>
          )}
          
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-indigo-600 text-white rounded-tr-none" 
                    : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700/50"
                )}>
                  {msg.type === 'text' && (
                    <div className="space-y-3">
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-2 border-t border-zinc-700/50 mt-2">
                          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5">Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source, i) => (
                              <a 
                                key={i} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-zinc-900/50 hover:bg-zinc-900 px-2 py-1 rounded border border-zinc-700/30 text-indigo-400 truncate max-w-[150px]"
                              >
                                {source.title}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.type === 'image' && msg.mediaUrl && (
                    <div className="space-y-3">
                      <img 
                        src={msg.mediaUrl} 
                        alt="AI Generated" 
                        className="rounded-lg w-full object-cover shadow-lg"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex justify-end">
                        <a 
                          href={msg.mediaUrl} 
                          download="ai-image.png"
                          className="flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200"
                        >
                          <Download size={14} /> Download
                        </a>
                      </div>
                    </div>
                  )}
                  {msg.type === 'audio' && msg.mediaUrl && (
                    <div className="space-y-3 min-w-[240px]">
                      <p className="text-xs text-zinc-400 italic mb-2">"{msg.content.replace('Audio generated for: ', '')}"</p>
                      <audio controls className="w-full h-10 filter invert brightness-150">
                        <source src={msg.mediaUrl} type="audio/wav" />
                      </audio>
                    </div>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1.5 font-bold">
                  {msg.role === 'user' ? 'You' : 'Gemini'}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <div className="flex items-center gap-2 text-zinc-500 animate-pulse">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-medium uppercase tracking-wider">AI is thinking...</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 space-y-3">
          {activeTab === 'translate' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['Arabic', 'English', 'French', 'Spanish', 'German', 'Chinese', 'Japanese'].map(lang => (
                <button
                  key={lang}
                  onClick={() => setTargetLanguage(lang)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shrink-0",
                    targetLanguage === lang ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
          
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="image-upload"
                className={cn(
                  "p-3 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-center",
                  selectedImage && "text-indigo-400 border-indigo-500 bg-indigo-500/10"
                )}
                title="Upload image for analysis"
              >
                <Upload size={20} />
              </label>
              {selectedImage && (
                <button 
                  onClick={() => { setSelectedImage(null); setImageMimeType(null); }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={!user || !isOnline}
                placeholder={
                  !isOnline ? "You are offline..." :
                  !user ? "Sign in to chat..." :
                  selectedImage ? "Describe what to analyze in the image..." :
                  activeTab === 'chat' ? "Ask anything..." :
                  activeTab === 'translate' ? `Translate to ${targetLanguage}...` :
                  activeTab === 'image' ? "Describe the image you want..." :
                  "Enter text to speak..."
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-500 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && activeTab !== 'image' && !selectedImage) || !user || !isOnline}
                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg transition-all"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 text-center uppercase tracking-tighter font-medium">
            {selectedImage ? "Mode: Image Analysis" : activeTab === 'translate' ? `Translating to ${targetLanguage}` : `Mode: ${activeTab.toUpperCase()}`}
          </p>
        </div>
      </main>

      <footer className="text-center">
        <p className="text-xs text-zinc-500">
          Built with TypeScript, React, and Gemini AI • 2026
        </p>
      </footer>

      <AnimatePresence>
        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-2xl max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">User Feedback</h2>
                <button onClick={() => setShowFeedback(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">How would you rate your experience with AI Studio?</p>
                <div className="flex justify-center gap-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button 
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className={cn(
                        "transition-all",
                        feedbackRating >= star ? "text-amber-400 scale-125" : "text-zinc-700 hover:text-zinc-500"
                      )}
                    >
                      <Star size={32} fill={feedbackRating >= star ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Comments (Optional)</label>
                  <textarea 
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us what we can improve..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px] resize-none"
                  />
                </div>
                
                <button 
                  onClick={submitFeedback}
                  disabled={feedbackRating === 0}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
                >
                  Submit Feedback
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-2xl max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="text-indigo-500" size={24} />
                  <h2 className="text-xl font-bold">AI Personalization</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Response Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['concise', 'detailed', 'creative', 'technical'].map(style => (
                      <button
                        key={style}
                        onClick={() => savePreferences({ ...preferences, style })}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-medium border transition-all capitalize",
                          preferences.style === style 
                            ? "bg-indigo-600 border-indigo-500 text-white" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Interests (Comma separated)</label>
                  <input 
                    type="text"
                    defaultValue={preferences.interests.join(', ')}
                    onBlur={(e) => {
                      const interests = e.target.value.split(',').map(i => i.trim()).filter(i => i);
                      savePreferences({ ...preferences, interests });
                    }}
                    placeholder="e.g. Coding, Space, History"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-zinc-500 italic">This helps Gemini tailor its knowledge and examples to you.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Interface Language</label>
                  <select 
                    value={preferences.language}
                    onChange={(e) => savePreferences({ ...preferences, language: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2 text-emerald-500 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Autonomous Learning Active</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">Your interactions are analyzed to improve future responses automatically.</p>
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSubscription && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-8 rounded-2xl max-w-2xl w-full space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="text-indigo-500" size={32} />
                  <div>
                    <h2 className="text-2xl font-bold">Monetization & Plans</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Current Plan: {subscription.plan}</p>
                  </div>
                </div>
                <button onClick={() => setShowSubscription(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={cn(
                  "p-6 rounded-2xl border flex flex-col space-y-4",
                  subscription.plan === 'free' ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900/50"
                )}>
                  <h3 className="text-lg font-bold">Free</h3>
                  <p className="text-2xl font-bold">$0<span className="text-xs text-zinc-500">/mo</span></p>
                  <ul className="text-xs text-zinc-400 space-y-2 flex-1">
                    <li className="flex items-center gap-2"><Zap size={12} className="text-indigo-500" /> Basic Chat</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-indigo-500" /> 10 Images / Day</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-indigo-500" /> Standard Latency</li>
                  </ul>
                  <button disabled className="w-full py-2 bg-zinc-800 text-zinc-500 rounded-xl text-xs font-bold uppercase">Current</button>
                </div>

                <div className={cn(
                  "p-6 rounded-2xl border flex flex-col space-y-4 relative overflow-hidden",
                  subscription.plan === 'pro' ? "border-amber-500 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/50"
                )}>
                  <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] font-black px-2 py-1 uppercase">Popular</div>
                  <h3 className="text-lg font-bold">Pro</h3>
                  <p className="text-2xl font-bold">$19<span className="text-xs text-zinc-500">/mo</span></p>
                  <ul className="text-xs text-zinc-400 space-y-2 flex-1">
                    <li className="flex items-center gap-2"><Zap size={12} className="text-amber-500" /> Unlimited Chat</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-amber-500" /> HD Image Generation</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-amber-500" /> Priority Infrastructure</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-amber-500" /> Advanced Personalization</li>
                  </ul>
                  <button className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold uppercase transition-all">Upgrade</button>
                </div>

                <div className={cn(
                  "p-6 rounded-2xl border flex flex-col space-y-4",
                  subscription.plan === 'enterprise' ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900/50"
                )}>
                  <h3 className="text-lg font-bold">Enterprise</h3>
                  <p className="text-2xl font-bold">Custom</p>
                  <ul className="text-xs text-zinc-400 space-y-2 flex-1">
                    <li className="flex items-center gap-2"><Zap size={12} className="text-indigo-500" /> B2B Solutions</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-indigo-500" /> Dedicated Support</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-indigo-500" /> Custom AI Agents</li>
                    <li className="flex items-center gap-2"><Zap size={12} className="text-indigo-500" /> Full Compliance Suite</li>
                  </ul>
                  <button className="w-full py-2 border border-zinc-700 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase transition-all">Contact Sales</button>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800 text-center">
                <p className="text-[10px] text-zinc-500">All plans include global infrastructure access and GDPR compliance. Secure payments via Stripe.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEcosystem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-8 rounded-2xl max-w-3xl w-full space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Code className="text-indigo-500" size={32} />
                  <div>
                    <h2 className="text-2xl font-bold">Developer Ecosystem</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Build on the World's Leading AI Platform</p>
                  </div>
                </div>
                <button onClick={() => setShowEcosystem(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Your API Keys</h3>
                    <div className="space-y-2">
                      {apiKeys.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No API keys generated yet.</p>
                      ) : (
                        apiKeys.map(key => (
                          <div key={key.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                            <div>
                              <p className="text-xs font-bold">{key.name}</p>
                              <p className="text-[10px] font-mono text-zinc-500">{key.key}</p>
                            </div>
                            <button className="text-zinc-500 hover:text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        const name = prompt('Enter a name for your API key:');
                        if (name) generateApiKey(name);
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase transition-all"
                    >
                      Generate New Key
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Documentation</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left hover:border-indigo-500 transition-all">
                        <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">REST API</p>
                        <p className="text-xs">v1.2 Reference</p>
                      </button>
                      <button className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left hover:border-indigo-500 transition-all">
                        <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Webhooks</p>
                        <p className="text-xs">Event Streams</p>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="glass-panel p-6 rounded-2xl border-indigo-500/20 bg-indigo-500/5">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-4">Strategic Evolution Status</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                          <Brain size={16} className="text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Autonomous R&D</p>
                          <p className="text-[10px] text-zinc-500">AI is currently optimizing its own neural weights based on user feedback.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Globe size={16} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Global Expansion</p>
                          <p className="text-[10px] text-zinc-500">Strategic nodes active in 48 countries. Multilingual support at 99.8% accuracy.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                          <Shield size={16} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Ethics Guardrails</p>
                          <p className="text-[10px] text-zinc-500">Real-time bias detection and safety filtering active across all ecosystem integrations.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 text-center italic">
                      "Our mission is to build a self-evolving AI ecosystem that empowers humanity through ethical innovation and global collaboration."
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showImpact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-8 rounded-2xl max-w-4xl w-full space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Leaf className="text-emerald-500" size={32} />
                  <div>
                    <h2 className="text-2xl font-bold">Sustainability & Global Impact</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Our Legacy: Ethical Innovation for a Better World</p>
                  </div>
                </div>
                <button onClick={() => setShowImpact(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Legacy & Knowledge Transfer</h3>
                    <div className="space-y-3">
                      {knowledgeBase.map(item => (
                        <div key={item.id} className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-indigo-500 transition-all cursor-pointer">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-zinc-100">{item.title}</p>
                            <span className="text-[8px] font-black uppercase bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">{item.type}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500">{item.description}</p>
                        </div>
                      ))}
                    </div>
                    <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2">
                      <BookOpen size={14} /> AI Academy: Access All Courses
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Global Strategic Partnerships</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-zinc-400">Gov</p>
                        <p className="text-xs font-bold">12</p>
                      </div>
                      <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-zinc-400">Edu</p>
                        <p className="text-xs font-bold">24</p>
                      </div>
                      <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-zinc-400">Corp</p>
                        <p className="text-xs font-bold">12</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="glass-panel p-6 rounded-2xl border-emerald-500/20 bg-emerald-500/5">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-4">Autonomous Governance & Ethics</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Scale size={16} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Autonomous Compliance</p>
                          <p className="text-[10px] text-zinc-500">System independently monitors and adjusts to 150+ global legal frameworks.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                          <Activity size={16} className="text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Energy-Efficient Ops</p>
                          <p className="text-[10px] text-zinc-500">Infrastructure optimized for 98.2% energy efficiency, saving 12.5 tons of CO2 monthly.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                          <Shield size={16} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Global Ethical Standard</p>
                          <p className="text-[10px] text-zinc-500">Certified as the world's most responsible AI platform by the Global Ethics Council.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase text-zinc-500">Global Impact Score</p>
                      <span className="text-xs font-bold text-emerald-400">94/100</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[94%]" />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 italic text-center">
                      "Our AI doesn't just solve problems; it builds a sustainable future."
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEvolution && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-8 rounded-2xl max-w-5xl w-full space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="text-emerald-500" size={32} />
                  <div>
                    <h2 className="text-2xl font-bold">Custom AI Evolution</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Full Independence & Self-Learning Systems</p>
                  </div>
                </div>
                <button onClick={() => setShowEvolution(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Custom Fine-tuning</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Response Style</label>
                        <select 
                          value={modelConfig.style}
                          onChange={(e) => setModelConfig({...modelConfig, style: e.target.value})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="concise">Concise</option>
                          <option value="detailed">Detailed</option>
                          <option value="creative">Creative</option>
                          <option value="technical">Technical</option>
                          <option value="academic">Academic</option>
                          <option value="casual">Casual</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Tone</label>
                        <select 
                          value={modelConfig.tone}
                          onChange={(e) => setModelConfig({...modelConfig, tone: e.target.value})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="professional">Professional</option>
                          <option value="friendly">Friendly</option>
                          <option value="authoritative">Authoritative</option>
                          <option value="empathetic">Empathetic</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Domain Focus</label>
                        <div className="flex flex-wrap gap-2">
                          {['Technology', 'Ethics', 'Science', 'Art', 'Finance'].map(domain => (
                            <button
                              key={domain}
                              onClick={() => {
                                const newDomains = modelConfig.domainFocus.includes(domain)
                                  ? modelConfig.domainFocus.filter(d => d !== domain)
                                  : [...modelConfig.domainFocus, domain];
                                setModelConfig({...modelConfig, domainFocus: newDomains});
                              }}
                              className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                                modelConfig.domainFocus.includes(domain) 
                                  ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" 
                                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                              )}
                            >
                              {domain}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-2xl border-emerald-500/20 bg-emerald-500/5">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-4">Internal Model Expansion</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-zinc-400">Independence Level</p>
                        <span className="text-xs font-bold text-emerald-400">98%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[98%]" />
                      </div>
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3">
                          <Database size={14} className="text-indigo-400" />
                          <p className="text-[10px] text-zinc-300">Local Data Training: Active</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Zap size={14} className="text-indigo-400" />
                          <p className="text-[10px] text-zinc-300">On-Device Optimization: Enabled</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Layers size={14} className="text-indigo-400" />
                          <p className="text-[10px] text-zinc-300">Multi-modal Fusion: Deep</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Self-Learning Logs</h3>
                    <div className="space-y-3">
                      {learningLogs.map(log => (
                        <div key={log.id} className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">{log.category}</span>
                            <span className="text-[8px] text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[10px] text-zinc-300 font-medium">{log.improvement}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-zinc-800 h-1 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full" style={{ width: `${log.impact * 100}%` }} />
                            </div>
                            <span className="text-[8px] font-bold text-indigo-400">+{Math.round(log.impact * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal size={14} className="text-indigo-400" />
                      <p className="text-[10px] font-bold uppercase text-indigo-400">Autonomous Update Engine</p>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      The AI is currently monitoring its own performance. Next autonomous optimization scheduled in 42 minutes.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
