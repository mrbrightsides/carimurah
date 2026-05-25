declare var pendo: { trackAgent: (eventType: string, metadata: object) => void };

import { motion, AnimatePresence } from "motion/react";
import React, { useState, useRef, useEffect } from "react";
import { 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  Camera, 
  Upload, 
  Mic, 
  ShoppingBag, 
  CheckCircle2, 
  ChevronRight, 
  Loader2, 
  Volume2, 
  History as HistoryIcon, 
  Store,
  ExternalLink,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Eye,
  Trash,
  X,
  TrendingDown,
  PieChart,
  Users,
  Wallet,
  LogIn,
  LogOut,
  User as UserIcon,
  Keyboard,
  Star,
  Truck,
  AlertCircle,
  Layers,
  Sparkles,
  Settings,
  Bell,
  Globe,
  Coins,
  Wifi,
  WifiOff,
  Download,
  FileText,
  FileSearch,
  MessageSquare
} from "lucide-react";
import Markdown from "react-markdown";
import type { InputMode, AnalysisState, BatchAnalysisResult, HistoryItem, UserProfile, ItemAnalysis, MarketOption } from "./types";
import { auth, loginWithGoogle, logout, saveHistory, getHistory, getUserProfile, updateProfile, deleteHistoryItems, updateHistoryItem } from "./lib/mongodb_client";
import { onAuthStateChanged, User } from "firebase/auth";

function CountingNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000;
    const startValue = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setDisplayValue(Math.floor(progress * (value - startValue) + startValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <>{prefix}{displayValue.toLocaleString("id-ID")}{suffix}</>;
}

function ComparisonTable({ options, isB2B }: { options: any[]; isB2B: boolean }) {
  return (
    <div className={`p-8 rounded-[2.5rem] ${isB2B ? "bg-white/5" : "bg-slate-50"} overflow-hidden`}>
      <h4 className="text-xs font-black uppercase tracking-widest opacity-40 mb-6">Supplier Metrics Comparison</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-dashed border-slate-200 dark:border-white/10">
              <th className="py-4 opacity-40 uppercase font-black text-[8px]">Platform / Supplier</th>
              <th className="py-4 opacity-40 uppercase font-black text-[8px] text-right">Rating</th>
              <th className="py-4 opacity-40 uppercase font-black text-[8px] text-right">Reliability</th>
              <th className="py-4 opacity-40 uppercase font-black text-[8px] text-right">Ship Time</th>
              <th className="py-4 opacity-40 uppercase font-black text-[8px] text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {options.map((opt, idx) => (
              <tr key={idx} className="border-b border-white/5 last:border-0 group">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    {opt.isWinner && <Sparkles className="w-3 h-3 text-emerald-500" />}
                    <span className={`font-bold ${opt.isWinner ? "text-emerald-500" : ""}`}>{opt.platform}</span>
                  </div>
                </td>
                <td className="py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Star className={`w-3 h-3 ${opt.rating > 0 ? "text-amber-500 fill-current" : "opacity-20"}`} />
                    <span className="font-bold">{opt.rating > 0 ? opt.rating : (opt.supplierRating || 4.5)}</span>
                  </div>
                </td>
                <td className="py-4 text-right">
                  <span className={`font-bold ${opt.reliabilityScore >= 95 ? "text-emerald-500" : ""}`}>
                    {opt.reliabilityScore || 98}%
                  </span>
                </td>
                <td className="py-4 text-right font-bold opacity-60">
                  {opt.deliveryDays}
                </td>
                <td className="py-4 text-right">
                  <span className="font-black">Rp{opt.price.toLocaleString("id-ID")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<InputMode | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [loading, setLoading] = useState(false);
  const [isB2B, setIsB2B] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<ItemAnalysis[]>([]);
  const [manualText, setManualText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  
  // Dashboard Filters & Sorting
  const [filterType, setFilterType] = useState<"ALL" | "B2C" | "B2B">("ALL");
  const [sortBy, setSortBy] = useState<"date" | "savings">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateRange, setDateRange] = useState<"ALL" | "7D" | "30D">("ALL");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [watchlistThreshold, setWatchlistThreshold] = useState(5);
  const [trendItemId, setTrendItemId] = useState<number | null>(null);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [expandedAuditIdx, setExpandedAuditIdx] = useState<number | null>(null);
  const [reliabilityFilter, setReliabilityFilter] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Analysis Result Filters & Sorting
  const [analysisFilterStock, setAnalysisFilterStock] = useState(false);
  const [analysisSortBy, setAnalysisSortBy] = useState<"price" | "savings" | "rating" | "delivery" | "reliability">("savings");
  const [analysisSortOrder, setAnalysisSortOrder] = useState<"asc" | "desc">("desc");
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        loadHistoryFromDB(u.uid);
        const p = await getUserProfile(u.uid);
        setProfile(p);
        pendo.identify({
          visitor: {
            id: u.uid,
            email: u.email || '',
            full_name: u.displayName || '',
            subscriptionTier: p?.subscription?.tier || 'FREE',
            subscriptionExpiresAt: p?.subscription?.expiresAt || '',
            preferencesCurrency: p?.preferences?.currency || 'IDR',
            preferencesLanguage: p?.preferences?.language || 'id',
            notifyOnBetterPrices: p?.preferences?.notifyOnBetterPrices ?? true,
            b2bFocus: p?.preferences?.b2bFocus || 'price',
            showTrendChartsByDefault: p?.preferences?.showTrendChartsByDefault ?? false,
          }
        });
      }
      else {
        const saved = localStorage.getItem("carimurah_history");
        if (saved) setHistory(JSON.parse(saved));
      }
    });
    return () => unsubscribe();
  }, []);

  const loadHistoryFromDB = async (uid: string) => {
    try {
      const items = await getHistory(uid);
      setHistory(items);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const handleBulkDelete = async () => {
    if (!user || selectedHistoryIds.length === 0) return;
    const deletedCount = selectedHistoryIds.length;
    const totalHistoryCount = history.length;
    try {
      setLoading(true);
      await deleteHistoryItems(user.uid, selectedHistoryIds);
      setSelectedHistoryIds([]);
      await loadHistoryFromDB(user.uid);
      setShowDeleteConfirm(false);

      if (window.pendo) {
        pendo.track("bulk_history_deleted", {
          deleted_count: deletedCount,
          total_history_count: totalHistoryCount,
          user_id: user.uid
        });
      }
    } catch (e) {
      console.error("Failed to bulk delete", e);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlySummary = async () => {
    if (history.length === 0) return;
    setIsGeneratingSummary(true);
    setMonthlySummary(null);

    const conversationId = crypto.randomUUID();
    const promptMessageId = crypto.randomUUID();

    if (typeof pendo !== "undefined") {
      pendo.trackAgent("prompt", {
        agentId: "zalXvF7bvqBY1qCtMTglr-WZuHA",
        conversationId,
        messageId: promptMessageId,
        content: "Generate monthly savings summary",
        suggestedPrompt: true,
      });
    }

    try {
      const res = await fetch("/api/monthly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: history.slice(0, 50), // Send recent 50 for context
          preferences: profile?.preferences
        }),
      });
      const data = await res.json();
      if (data.report) {
        setMonthlySummary(data.report);

        if (window.pendo) {
          pendo.track("monthly_summary_generated", {
            history_items_analyzed: Math.min(history.length, 50),
            currency: profile?.preferences?.currency || "IDR",
            language: profile?.preferences?.language || "id",
            user_tier: profile?.subscription?.tier || "FREE"
          });
        }
      }
    } catch (e) {
      console.error("Summary generation failed", e);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const exportToCSV = () => {
    if (filteredHistory.length === 0) return;
    
    const headers = ["ID", "Date", "Type", "Items Count", "Total Saved (IDR)", "Note"];
    const rows = filteredHistory.map(item => [
      item.id,
      new Date(item.date).toLocaleDateString("id-ID"),
      item.type,
      item.itemsCount,
      item.totalSaved,
      item.note || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `CariMurah_Savings_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.pendo) {
      pendo.track("csv_export_completed", {
        rows_count: filteredHistory.length,
        filter_type: filterType,
        date_range: dateRange,
        sort_by: sortBy,
        file_name: `CariMurah_Savings_${new Date().toISOString().split('T')[0]}.csv`
      });
    }
  };

  const handleUpdateNote = async (historyId: string, note: string) => {
    const existingItem = history.find(h => h.id === historyId);
    const isNewNote = !existingItem?.note;

    if (!user) {
      // Local updates for guests
      const updated = history.map(h => h.id === historyId ? { ...h, note } : h);
      setHistory(updated);
      localStorage.setItem("carimurah_history", JSON.stringify(updated));

      if (window.pendo) {
        pendo.track("history_note_updated", {
          history_id: historyId,
          note_length: note.length,
          is_new_note: isNewNote,
          is_guest: true
        });
      }
      return;
    }

    try {
      await updateHistoryItem(user.uid, historyId, { note });
      setHistory(history.map(h => h.id === historyId ? { ...h, note } : h));

      if (window.pendo) {
        pendo.track("history_note_updated", {
          history_id: historyId,
          note_length: note.length,
          is_new_note: isNewNote,
          is_guest: false
        });
      }
    } catch (e) {
      console.error("Failed to update note", e);
    }
  };

  const dashboardChartData = (() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0];
    });

    let cumulative = 0;
    return last30Days.map(dateStr => {
      const daySavings = history
        .filter(h => h.date.split('T')[0] === dateStr)
        .reduce((sum, curr) => sum + curr.totalSaved, 0);
      cumulative += daySavings;
      return {
        date: dateStr,
        savings: cumulative
      };
    });
  })();

  const processInput = async (payload: { image?: string; text?: string; audio?: string }) => {
    const processingStart = Date.now();
    setLoading(true);
    setAnalysis({ step: "parsing" });

    const conversationId = crypto.randomUUID();
    const promptMessageId = crypto.randomUUID();

    if (typeof pendo !== "undefined") {
      pendo.trackAgent("prompt", {
        agentId: "zalXvF7bvqBY1qCtMTglr-WZuHA",
        conversationId,
        messageId: promptMessageId,
        content: payload.text || (payload.image ? "[image uploaded]" : "[audio uploaded]"),
        suggestedPrompt: false,
        fileUploaded: !!(payload.image || payload.audio),
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort("TIMEOUT");
    }, 180000); // 180s (3 minutes) for complex scans

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, isB2B, preferences: profile?.preferences }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        const errorData = contentType?.includes("application/json") ? await res.json() : null;
        throw new Error(errorData?.error || "Gagal menghubungi agen pusat.");
      }
      
      if (!contentType?.includes("application/json")) {
        throw new Error("Respon server tidak valid (Bukan JSON).");
      }

      const batchResult: BatchAnalysisResult = await res.json();
      if (!batchResult.items) {
         throw new Error("Agen tidak menemukan data barang.");
      }
      const processingEnd = Date.now();
      setAnalysis({ step: "complete", batchResult });

      if (window.pendo) {
        pendo.track("price_analysis_completed", {
          input_type: payload.image ? "image" : payload.text ? "text" : "audio",
          is_b2b: isB2B,
          items_count: batchResult.items.length,
          total_potential_savings: batchResult.totalPotentialSavings,
          currency: profile?.preferences?.currency || "IDR",
          language: profile?.preferences?.language || "id",
          processing_duration_ms: processingEnd - processingStart,
          user_tier: profile?.subscription?.tier || "FREE",
          is_guest: !user
        });
      }

      if (user) {
        await saveHistory(user.uid, {
          date: new Date().toISOString(),
          totalSaved: batchResult.totalPotentialSavings,
          itemsCount: batchResult.items.length,
          type: isB2B ? "B2B" : "B2C",
          result: batchResult
        });
        loadHistoryFromDB(user.uid);

        if (window.pendo) {
          pendo.track("analysis_history_saved", {
            total_saved_amount: batchResult.totalPotentialSavings,
            items_count: batchResult.items.length,
            type: isB2B ? "B2B" : "B2C",
            storage_method: "cloud",
            is_guest: false
          });
        }
      } else {
         const newItem: HistoryItem = {
           id: Math.random().toString(36).substr(2, 9),
           date: new Date().toLocaleDateString("id-ID"),
           totalSaved: batchResult.totalPotentialSavings,
           itemsCount: batchResult.items.length,
           type: isB2B ? "B2B" : "B2C",
           result: batchResult
         };
         const updated = [newItem, ...history].slice(0, 10);
         setHistory(updated);
         localStorage.setItem("carimurah_history", JSON.stringify(updated));

         if (window.pendo) {
           pendo.track("analysis_history_saved", {
             total_saved_amount: batchResult.totalPotentialSavings,
             items_count: batchResult.items.length,
             type: isB2B ? "B2B" : "B2C",
             storage_method: "localStorage",
             is_guest: true
           });
         }
      }
      playVoice(batchResult.summaryVoice);
    } catch (error: any) {
      const isTimeout = error === "TIMEOUT" || error.name === "AbortError" || controller.signal.aborted;
      if (isTimeout) {
        console.error("Process Input Timeout/Abort:", error);
        setAnalysis({ 
          step: "error", 
          error: "Analisis Memakan Waktu Terlalu Lama. Mohon maaf, agen AI sedang bekerja ekstra keras. Silakan coba unggah ulang atau pastikan struk/daftar barang tidak terlalu panjang." 
        });
      } else {
        console.error("Process Input Error:", error);
        setAnalysis({ step: "error", error: error.message || "Gagal menghubungi agen pusat." });
      }
    } finally {
      setLoading(false);
      setMode(null);
    }
  };

  const startScanning = async () => {
    if (!canvasRef.current || !videoRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (context) {
      // Optimize: Limit dimensions for mobile performance
      const maxWidth = 800;
      const maxHeight = 600;
      let width = videoRef.current.videoWidth;
      let height = videoRef.current.videoHeight;

      if (width > maxWidth) {
        height = height * (maxWidth / width);
        width = maxWidth;
      }

      canvasRef.current.width = width;
      canvasRef.current.height = height;
      context.drawImage(videoRef.current, 0, 0, width, height);
      const imageData = canvasRef.current.toDataURL("image/jpeg", 0.7);

      if (window.pendo) {
        pendo.track("camera_scan_submitted", {
          is_b2b: isB2B,
          user_tier: profile?.subscription?.tier || "FREE",
          camera_facing_mode: "environment"
        });
      }

      stopCamera();
      await processInput({ image: imageData });
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: "environment" } 
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(err.name === "NotAllowedError" || err.name === "PermissionDeniedError" 
        ? "Izin kamera ditolak. Silakan buka aplikasi di tab baru atau cek pengaturan browser Anda." 
        : "Gagal mengakses kamera. Pastikan kamera tidak sedang digunakan aplikasi lain.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setMode(null);
  };

  const startRecording = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = profile?.preferences.language === 'en' ? 'en-US' : 'id-ID';
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join("");
        setManualText(transcript);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setMode(null);
        if (manualText) {
          if (window.pendo) {
            pendo.track("voice_input_submitted", {
              transcript_length: manualText.length,
              language: profile?.preferences?.language || "id",
              is_b2b: isB2B,
              user_tier: profile?.subscription?.tier || "FREE",
              recognition_method: "SpeechRecognition"
            });
          }
          processInput({ text: manualText });
        }
      };

      recognition.start();
      setIsRecording(true);
      setMode("voice");
    } else {
      // Fallback to audio blob (existing logic)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await processInput({ audio: base64Audio });
          };
          stream.getTracks().forEach(t => t.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setMode("voice");
      } catch (err) {
        console.error("Mic error:", err);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (loading) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;

      if (window.pendo) {
        pendo.track("file_upload_analyzed", {
          file_type: file.type,
          file_size_bytes: file.size,
          is_b2b: isB2B,
          user_tier: profile?.subscription?.tier || "FREE"
        });
      }

      processInput({ image: base64 });
    };
    reader.readAsDataURL(file);
  };

  const playVoice = async (text: string) => {
    // Stop any existing browser synthesis
    window.speechSynthesis.cancel();
    
    if (!text) return;

    try {
      // Use high-quality Studio TTS via server
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "Zephyr" }) // User requested Zephyr voice
      });
      
      const data = await res.json();
      
      if (data.audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // PCM 16-bit Mono (S16LE) 24kHz
        const view = new Int16Array(bytes.buffer);
        const audioBuffer = audioCtx.createBuffer(1, view.length, data.rate || 24000);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < view.length; i++) {
          channelData[i] = view[i] / 32768; // Normalize i16 to f32
        }
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => {
          if (window.pendo) {
            pendo.track("tts_playback_completed", {
              voice_model: "Zephyr",
              audio_duration_ms: Math.round((audioBuffer.length / (data.rate || 24000)) * 1000),
              tts_source: "studio_ai",
              language: profile?.preferences?.language || "id"
            });
          }
        };
        source.start();
      } else {
        throw new Error("No audio returned from Studio AI");
      }
    } catch (err) {
      console.error("Studio TTS fallback to Web Speech:", err);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const totalAllTimeSaved = history.reduce((acc, curr) => acc + curr.totalSaved, 0);
  const totalAllTimeSpent = history.reduce((acc, curr) => acc + (curr.result.totalCurrentSpent || 0), 0);

  const filteredHistory = history
    .filter(item => {
      if (filterType !== "ALL" && item.type !== filterType) return false;
      
      const itemDate = new Date(item.date);
      const now = new Date();
      if (dateRange === "7D") {
        const diff = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diff > 7) return false;
      }
      if (dateRange === "30D") {
        const diff = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diff > 30) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      } else {
        return sortOrder === "desc" ? b.totalSaved - a.totalSaved : a.totalSaved - b.totalSaved;
      }
    });

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${isB2B ? "bg-slate-950 text-white" : "bg-white text-slate-900"}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b ${isB2B ? "bg-slate-950/80 border-white/10" : "bg-white/80 border-slate-100"}`}>
        {!isOnline && (
          <div className="bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest py-2 text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-3 h-3" /> Real-time price monitoring unavailable while offline
          </div>
        )}
        <div className="max-w-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isB2B ? "bg-indigo-500" : "bg-emerald-500"}`}>
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">CariMurah<span className={isB2B ? "text-indigo-400" : "text-emerald-500"}>.ai</span></h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                {isOnline ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5 text-rose-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">Offline</span>
                  </>
                )}
             </div>
             <button onClick={() => setMode(mode === "dashboard" ? null : "dashboard")} className="p-2 opacity-60 hover:opacity-100 transition-opacity">
                <PieChart className="w-5 h-5" />
             </button>
             {user ? (
               <div className="flex items-center gap-2">
                 <button 
                    onClick={() => {
                       setMode(null);
                       setShowSettings(!showSettings);
                    }} 
                    className="p-2 opacity-60 hover:opacity-100 active:scale-95 transition-transform"
                  >
                    <Settings className="w-5 h-5" />
                 </button>
                 <button onClick={() => { pendo.clearSession(); logout(); }} className="p-2 opacity-60 hover:opacity-100">
                    <LogOut className="w-5 h-5" />
                 </button>
               </div>
             ) : (
               <button onClick={() => loginWithGoogle()} className="p-2 opacity-60 hover:opacity-100">
                  <LogIn className="w-5 h-5" />
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 pb-32">
        <AnimatePresence mode="wait">
          {mode === "dashboard" ? (
            <motion.section key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
               <div className="flex items-center gap-4">
                  <button onClick={() => setMode(null)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                  <h2 className="text-2xl font-bold">Smart Dashboard</h2>
               </div>

               {!user && (
                 <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 text-amber-900 flex flex-col items-center gap-4">
                    <p className="text-sm font-medium text-center">Login untuk sinkronkan riwayat belanja Anda di cloud.</p>
                    <button onClick={loginWithGoogle} className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                       <LogIn className="w-4 h-4" /> Login Sekarang
                    </button>
                 </div>
               )}

                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-6 rounded-3xl ${isB2B ? "bg-indigo-500/20 border border-indigo-500/30" : "bg-emerald-50 border border-emerald-100"}`}>
                    <Wallet className={`w-6 h-6 mb-3 ${isB2B ? "text-indigo-400" : "text-emerald-600"}`} />
                    <span className="block text-[10px] font-bold uppercase opacity-50">Total Penghematan</span>
                    <span className="text-xl font-black">
                      <CountingNumber 
                        value={totalAllTimeSaved} 
                        prefix={profile?.preferences.currency === 'USD' ? '$' : 'Rp'} 
                      />
                    </span>
                  </div>
                  <div className={`p-6 rounded-3xl ${isB2B ? "bg-white/5 border border-white/10" : "bg-slate-50 border border-slate-100"}`}>
                    <UserIcon className="w-6 h-6 mb-3 text-rose-500" />
                    <span className="block text-[10px] font-bold uppercase opacity-50">Analisis Dilakukan</span>
                    <span className="text-xl font-black">
                      <CountingNumber value={history.length} />
                    </span>
                  </div>
               </div>

               {/* Monthly Summary Action */}
               <div className="relative overflow-hidden p-6 rounded-[2.5rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                  <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                     <Sparkles className="w-24 h-24" />
                  </div>
                  <div className="relative z-10 space-y-4">
                     <div>
                        <h3 className="text-xl font-bold">Rangkuman AI Bulanan</h3>
                        <p className="text-white/80 text-xs font-medium">Bahas performa belanja & tips hemat khusus untukmu.</p>
                     </div>
                     <button 
                        onClick={generateMonthlySummary}
                        disabled={isGeneratingSummary || history.length === 0}
                        className={`group relative flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10 disabled:opacity-50 disabled:hover:scale-100 ${isGeneratingSummary ? "pr-10" : ""}`}
                     >
                        {isGeneratingSummary ? (
                           <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sedang Merangkum...
                           </>
                        ) : (
                           <>
                              <FileSearch className="w-4 h-4" />
                              Buat Laporan Sekarang
                           </>
                        )}
                     </button>
                  </div>

                  <AnimatePresence>
                    {monthlySummary && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-6 pt-6 border-t border-white/20"
                      >
                         <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-strong:text-indigo-200">
                           <Markdown>{monthlySummary}</Markdown>
                         </div>
                         <button 
                           onClick={() => setMonthlySummary(null)}
                           className="mt-4 px-4 py-2 bg-indigo-600 text-white/80 rounded-xl text-[8px] font-black uppercase hover:text-white transition-colors"
                         >
                           Tutup Laporan
                         </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>

               {/* Line Chart Section */}
               <div className={`p-6 rounded-3xl ${isB2B ? "bg-white/5" : "bg-slate-50"} space-y-4`}>
                 <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">Savings Trend (Last 30 Days)</h3>
                    <div className="flex items-center gap-1">
                       <TrendingDown className="w-3 h-3 text-emerald-500" />
                       <span className="text-[10px] font-bold text-emerald-500">+{((dashboardChartData[29]?.savings - dashboardChartData[0]?.savings) || 0).toLocaleString("id-ID")}</span>
                    </div>
                 </div>
                 <div className="h-40 w-full overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={dashboardChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isB2B ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                          <XAxis 
                            dataKey="date" 
                            hide 
                          />
                          <YAxis hide />
                          <RechartsTooltip 
                             contentStyle={{ 
                               backgroundColor: isB2B ? "#1e1b4b" : "white", 
                               borderRadius: "1rem", 
                               border: "none", 
                               boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                               fontSize: "10px",
                               fontWeight: "900"
                             }}
                             itemStyle={{ color: isB2B ? "#818cf8" : "#10b981" }}
                             labelFormatter={(val) => new Date(val).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                             formatter={(val: number) => [`Rp${val.toLocaleString("id-ID")}`, "Total Savings"]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="savings" 
                            stroke={isB2B ? "#6366f1" : "#10b981"} 
                            strokeWidth={3} 
                            dot={false}
                            animationDuration={1500}
                          />
                       </LineChart>
                    </ResponsiveContainer>
                 </div>
               </div>

               {/* Filters UI */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <h3 className="font-bold text-xs uppercase tracking-widest opacity-40">Filter & Sortir</h3>
                     <div className="flex items-center gap-2">
                        {selectedHistoryIds.length > 0 && (
                          <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                          >
                             <Trash className="w-3 h-3" /> Hapus ({selectedHistoryIds.length})
                          </button>
                        )}
                        <button 
                          onClick={exportToCSV}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isB2B ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                           <Download className="w-3 h-3" /> Export CSV
                        </button>
                        <button 
                           onClick={() => { setFilterType("ALL"); setSortBy("date"); setSortOrder("desc"); setDateRange("ALL"); }}
                           className="text-[10px] font-bold uppercase opacity-40 hover:opacity-100"
                        >
                           Reset
                        </button>
                     </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                     <select 
                       value={filterType} 
                       onChange={(e) => setFilterType(e.target.value as any)}
                       className={`px-4 py-2 rounded-xl text-xs font-bold border-none outline-none appearance-none ${isB2B ? "bg-white/5 text-white" : "bg-slate-50 text-slate-900"}`}
                     >
                        <option value="ALL">Semua Jenis</option>
                        <option value="B2C">Eceran (B2C)</option>
                        <option value="B2B">Grosir (B2B)</option>
                     </select>

                     <select 
                       value={dateRange} 
                       onChange={(e) => setDateRange(e.target.value as any)}
                       className={`px-4 py-2 rounded-xl text-xs font-bold border-none outline-none appearance-none ${isB2B ? "bg-white/5 text-white" : "bg-slate-50 text-slate-900"}`}
                     >
                        <option value="ALL">Semua Waktu</option>
                        <option value="7D">7 Hari Terakhir</option>
                        <option value="30D">30 Hari Terakhir</option>
                     </select>

                     <button 
                        onClick={() => {
                          if (sortBy === "savings") setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                          else setSortBy("savings");
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sortBy === "savings" ? (isB2B ? "bg-indigo-500 text-white" : "bg-emerald-500 text-white") : (isB2B ? "bg-white/5 text-white/40" : "bg-slate-50 text-slate-400")}`}
                     >
                        Rp {sortBy === "savings" && (sortOrder === "desc" ? "↓" : "↑")}
                     </button>

                     <button 
                        onClick={() => {
                          if (sortBy === "date") setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                          else setSortBy("date");
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sortBy === "date" ? (isB2B ? "bg-indigo-500 text-white" : "bg-emerald-500 text-white") : (isB2B ? "bg-white/5 text-white/40" : "bg-slate-50 text-slate-400")}`}
                     >
                        Tgl {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
                     </button>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <h3 className="font-bold text-sm uppercase tracking-widest opacity-40">Riwayat Analisis Agen ({filteredHistory.length})</h3>
                     <div className="flex items-center gap-3">
                        {filteredHistory.length > 0 && (
                          <button 
                            onClick={() => {
                              if (selectedHistoryIds.length === filteredHistory.length) setSelectedHistoryIds([]);
                              else setSelectedHistoryIds(filteredHistory.map(h => h.id));
                            }}
                            className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-all px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10"
                          >
                             {selectedHistoryIds.length === filteredHistory.length ? "Deselect All" : "Select All"}
                          </button>
                        )}
                        {selectedHistoryIds.length > 0 && (
                          <button 
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                          >
                             <Trash className="w-3 h-3" /> Hapus ({selectedHistoryIds.length})
                          </button>
                        )}
                     </div>
                  </div>
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/10">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isB2B ? "bg-white/5" : "bg-slate-100"}`}>
                        <HistoryIcon className="w-10 h-10 opacity-20" />
                      </div>
                      <div className="max-w-xs space-y-2">
                        <h3 className="font-bold text-lg">Belum Ada Riwayat</h3>
                        <p className="text-xs opacity-50 leading-relaxed">Pindai struk belanja atau input daftar barang kamu untuk melihat analisis penghematan di sini.</p>
                      </div>
                      <button 
                        onClick={() => { setMode(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-xl ${isB2B ? "bg-indigo-500 text-white shadow-indigo-500/20" : "bg-emerald-500 text-white shadow-emerald-500/20"}`}
                      >
                         Mulai Pindai Sekarang
                      </button>
                    </div>
                  ) : filteredHistory.map(item => (
                    <div key={item.id} className="relative group">
                       <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedHistoryIds.includes(item.id)) setSelectedHistoryIds(selectedHistoryIds.filter(id => id !== item.id));
                              else setSelectedHistoryIds([...selectedHistoryIds, item.id]);
                            }}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedHistoryIds.includes(item.id) ? "bg-indigo-500 border-indigo-500" : "bg-transparent border-slate-300 dark:border-white/20"}`}
                          >
                             {selectedHistoryIds.includes(item.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </button>
                       </div>
                       <button 
                         onClick={() => setAnalysis({ step: "complete", batchResult: item.result, isCached: true })}
                         className={`w-full p-5 pl-14 rounded-2xl flex justify-between items-center text-left transition-transform active:scale-95 ${isB2B ? "bg-white/5" : "bg-slate-50"} ${selectedHistoryIds.includes(item.id) ? "ring-2 ring-indigo-500/50" : ""}`}
                       >
                          <div className="flex-1">
                             <div className="flex items-center gap-3 mb-1">
                                <span className="block font-bold text-sm">{item.itemsCount} Barang - {item.type}</span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const names = item.result.items.map(it => it.productName).join(", ");

                                    if (window.pendo) {
                                      const originalDate = new Date(item.date);
                                      const daysSince = Math.floor((Date.now() - originalDate.getTime()) / (1000 * 3600 * 24));
                                      pendo.track("reorder_initiated", {
                                        original_analysis_date: item.date,
                                        original_savings: item.totalSaved,
                                        items_count: item.itemsCount,
                                        type: item.type,
                                        days_since_original: daysSince
                                      });
                                    }

                                    processInput({ text: `Cari barang: ${names}` });
                                  }}
                                  className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${isB2B ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white"}`}
                                >
                                   <Sparkles className="w-2.5 h-2.5" /> Quick Reorder
                                </button>
                             </div>
                             <span className="text-[10px] opacity-50">{new Date(item.date).toLocaleDateString("id-ID")}</span>
                          </div>
                          <div className="text-right">
                             <span className={`block font-bold ${isB2B ? "text-indigo-400" : "text-emerald-600"}`}>+Rp{item.totalSaved.toLocaleString("id-ID")}</span>
                             <span className="text-[8px] opacity-40 uppercase font-black">Saved</span>
                          </div>
                       </button>
                       <div className="mt-2 pr-4 pl-14">
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30" />
                            <input 
                              type="text"
                              defaultValue={item.note || ""}
                              onBlur={(e) => handleUpdateNote(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder="Tambah catatan (Contoh: Jajanan Kantor)"
                              className={`w-full py-2.5 pl-8 pr-4 rounded-xl text-[10px] font-medium outline-none transition-all placeholder:opacity-40 ${isB2B ? "bg-white/5 text-white/70 focus:bg-white/10" : "bg-slate-100 text-slate-600 focus:bg-slate-200"}`}
                            />
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </motion.section>
          ) : showSettings && profile ? (
            <motion.section key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="flex items-center gap-4">
                  <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full"><ArrowLeft /></button>
                  <h2 className="text-2xl font-bold">Pengaturan Profil</h2>
               </div>

               <div className="space-y-6">
                  <div className={`p-8 rounded-[2rem] ${isB2B ? "bg-white/5" : "bg-slate-50"} space-y-8`}>
                     <div className="flex items-center justify-between border-b border-dashed pb-6">
                        <div className="flex items-center gap-4">
                           <Sparkles className="w-6 h-6 text-emerald-500" />
                           <div>
                              <span className="block text-[8px] font-black uppercase opacity-40">Status Keanggotaan</span>
                              <span className="font-bold text-lg">{(profile as any).subscription?.tier || "FREE"} USER</span>
                           </div>
                        </div>
                        <button onClick={() => { setShowSettings(false); setMode("pricing"); }} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Upgrade</button>
                     </div>

                     <div className="flex items-center gap-4 border-b border-dashed pb-6 opacity-80">
                        <Coins className="w-6 h-6" />
                        <div className="flex-1">
                           <span className="block text-[10px] font-black uppercase tracking-widest opacity-40">Mata Uang</span>
                           <select 
                            value={profile.preferences.currency}
                            onChange={(e) => {
                              const previousValue = profile.preferences.currency;
                              const news = { ...profile.preferences, currency: e.target.value as any };
                              setProfile({ ...profile, preferences: news });
                              updateProfile(user!.uid, { preferences: news });
                              if (window.pendo) {
                                pendo.track("user_preferences_updated", {
                                  setting_changed: "currency",
                                  new_value: e.target.value,
                                  previous_value: previousValue,
                                  user_tier: profile.subscription?.tier || "FREE"
                                });
                              }
                            }}
                            className="w-full bg-transparent font-bold outline-none"
                           >
                              <option value="IDR">IDR - Rupiah</option>
                              <option value="USD">USD - Dollar</option>
                              <option value="MYR">MYR - Ringgit</option>
                           </select>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 border-b border-dashed pb-6 opacity-80">
                        <Globe className="w-6 h-6" />
                        <div className="flex-1">
                           <span className="block text-[10px] font-black uppercase tracking-widest opacity-40">Bahasa AI</span>
                           <select 
                            value={profile.preferences.language}
                            onChange={(e) => {
                              const previousValue = profile.preferences.language;
                              const news = { ...profile.preferences, language: e.target.value as any };
                              setProfile({ ...profile, preferences: news });
                              updateProfile(user!.uid, { preferences: news });
                              if (window.pendo) {
                                pendo.track("user_preferences_updated", {
                                  setting_changed: "language",
                                  new_value: e.target.value,
                                  previous_value: previousValue,
                                  user_tier: profile.subscription?.tier || "FREE"
                                });
                              }
                            }}
                            className="w-full bg-transparent font-bold outline-none"
                           >
                              <option value="id">Bahasa Indonesia</option>
                              <option value="en">English</option>
                           </select>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 opacity-80">
                        <Bell className="w-6 h-6" />
                        <div className="flex-1 flex justify-between items-center">
                           <div>
                              <span className="block text-[10px] font-black uppercase tracking-widest opacity-40">Notifikasi Harga</span>
                              <span className="font-bold">Aktifkan Price Drop</span>
                           </div>
                           <button 
                            onClick={() => {
                              const newValue = !profile.preferences.notifyOnBetterPrices;
                              const news = { ...profile.preferences, notifyOnBetterPrices: newValue };
                              setProfile({ ...profile, preferences: news });
                              updateProfile(user!.uid, { preferences: news });
                              if (window.pendo) {
                                pendo.track("user_preferences_updated", {
                                  setting_changed: "notifyOnBetterPrices",
                                  new_value: String(newValue),
                                  previous_value: String(!newValue),
                                  user_tier: profile.subscription?.tier || "FREE"
                                });
                              }
                            }}
                            className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${profile.preferences.notifyOnBetterPrices ? "bg-emerald-500" : "bg-slate-300"}`}
                           >
                              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${profile.preferences.notifyOnBetterPrices ? "translate-x-6" : ""}`} />
                           </button>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 opacity-80 pt-6 border-t border-dashed">
                        <Layers className="w-6 h-6" />
                        <div className="flex-1 flex justify-between items-center">
                           <div>
                              <span className="block text-[10px] font-black uppercase tracking-widest opacity-40">Fokus B2B</span>
                              <span className="font-bold">Prioritaskan Rekomendasi</span>
                           </div>
                           <select 
                            value={profile.preferences.b2bFocus}
                            onChange={(e) => {
                              const previousValue = profile.preferences.b2bFocus;
                              const news = { ...profile.preferences, b2bFocus: e.target.value as any };
                              setProfile({ ...profile, preferences: news });
                              updateProfile(user!.uid, { preferences: news });
                              if (window.pendo) {
                                pendo.track("user_preferences_updated", {
                                  setting_changed: "b2bFocus",
                                  new_value: e.target.value,
                                  previous_value: previousValue,
                                  user_tier: profile.subscription?.tier || "FREE"
                                });
                              }
                            }}
                            className="bg-transparent font-bold outline-none"
                           >
                              <option value="price">Harga Terendah</option>
                              <option value="delivery">Pengiriman Tercepat</option>
                              <option value="rating">Rating Supplier Terbaik</option>
                           </select>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 opacity-80 pt-6 border-t border-dashed">
                        <TrendingDown className="w-6 h-6" />
                        <div className="flex-1 flex justify-between items-center">
                           <div>
                              <span className="block text-[10px] font-black uppercase tracking-widest opacity-40">Tampilan Harga</span>
                              <span className="font-bold">Tampilkan Grafik Trend Default</span>
                           </div>
                           <button 
                            onClick={() => {
                              const newValue = !profile.preferences.showTrendChartsByDefault;
                              const news = { ...profile.preferences, showTrendChartsByDefault: newValue };
                              setProfile({ ...profile, preferences: news });
                              updateProfile(user!.uid, { preferences: news });
                              if (window.pendo) {
                                pendo.track("user_preferences_updated", {
                                  setting_changed: "showTrendChartsByDefault",
                                  new_value: String(newValue),
                                  previous_value: String(!newValue),
                                  user_tier: profile.subscription?.tier || "FREE"
                                });
                              }
                            }}
                            className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${profile.preferences.showTrendChartsByDefault ? "bg-indigo-500" : "bg-slate-300"}`}
                           >
                              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${profile.preferences.showTrendChartsByDefault ? "translate-x-6" : ""}`} />
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            </motion.section>
          ) : !mode && !analysis ? (
            <motion.section key="hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="flex justify-between items-start">
                  <div className="space-y-4">
                    <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-balance">
                      {isB2B ? "Laba Warung Bakal Melejit." : "Belanja Irit Gak Pakai Ribet."}
                    </h2>
                    <p className={`text-lg leading-relaxed ${isB2B ? "text-slate-400" : "text-slate-500"}`}>
                      CariMurah.ai membantu kamu menemukan harga distributor & retail termurah se-Indonesia.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newMode = !isB2B;
                      setIsB2B(newMode);
                      if (window.pendo) {
                        pendo.track("b2b_mode_toggled", {
                          new_mode: newMode ? "B2B" : "B2C",
                          previous_mode: isB2B ? "B2B" : "B2C",
                          user_tier: profile?.subscription?.tier || "FREE"
                        });
                      }
                    }}
                    className={`p-1 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${isB2B ? "border-indigo-500 bg-indigo-500/10" : "border-slate-100 bg-slate-50"}`}
                  >
                    <div className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest ${isB2B ? "bg-indigo-500 text-white" : "bg-white text-slate-400"}`}>
                      {isB2B ? "Grosir" : "Eceran"}
                    </div>
                  </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <button onClick={startCamera} className={`col-span-3 aspect-video rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl ${isB2B ? "bg-white text-slate-950 shadow-white/5" : "bg-emerald-500 text-white shadow-emerald-500/20"}`}>
                  <Camera className="w-12 h-12" />
                  <div className="text-center">
                    <span className="block font-bold text-xl tracking-tight">Kamera AI Scan</span>
                    <span className="text-xs opacity-70">Nota / Barcode / Produk</span>
                  </div>
                </button>
                
                <label className={`p-4 rounded-3xl border flex flex-col items-center gap-2 active:scale-95 transition-all cursor-pointer ${isB2B ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}>
                  <Upload className="w-6 h-6 opacity-40" />
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-center leading-tight">Unggah</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>

                <button 
                  onClick={startRecording}
                  className={`p-4 rounded-3xl border flex flex-col items-center gap-2 active:scale-95 transition-all ${isB2B ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                >
                  <Mic className={`w-6 h-6 ${isRecording ? "text-rose-500 animate-pulse" : "opacity-40"}`} />
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-center leading-tight">Suara</span>
                </button>

                <button 
                  onClick={() => setMode("manual")}
                  className={`p-4 rounded-3xl border flex flex-col items-center gap-2 active:scale-95 transition-all ${isB2B ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                >
                  <Keyboard className="w-6 h-6 opacity-40" />
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-center leading-tight">Manual</span>
                </button>
              </div>

              {/* Strategi Monetisasi (The Ultimate P&L Scheme) */}
              <div className="grid grid-cols-2 gap-4">
                 <button 
                   onClick={() => setMode("pricing")}
                   className={`p-6 rounded-[2.5rem] border-2 border-dashed flex items-center gap-4 transition-all hover:border-emerald-500/50 ${isB2B ? "bg-white/5 border-white/10" : "bg-emerald-50 border-emerald-100"}`}
                 >
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                       <Coins className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="text-left">
                       <span className="block text-[8px] font-black uppercase opacity-40">Revenue Engine</span>
                       <span className="text-xs font-bold">Go Pro</span>
                    </div>
                 </button>
                 <button 
                    onClick={() => setMode("watchlist")}
                    className={`p-6 rounded-[2.5rem] border-2 border-dashed flex items-center gap-4 transition-all ${isB2B ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                  >
                     <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-rose-500" />
                     </div>
                     <div className="text-left">
                        <span className="block text-[8px] font-black uppercase opacity-40">Alerts Hub</span>
                        <span className="text-xs font-bold">Watchlist</span>
                     </div>
                  </button>
              </div>

              {history.length > 0 && (
                <div className={`p-6 rounded-3xl border ${isB2B ? "border-white/10 bg-white/5" : "bg-slate-50 border-slate-100"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-emerald-500">
                      <Sparkles className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest leading-none">Smart Savings Active</span>
                    </div>
                    <span className="text-xl font-black">Rp{totalAllTimeSaved.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              )}
            </motion.section>
          ) : mode === "watchlist" ? (
             <motion.section key="watchlist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="flex items-center gap-4">
                   <button onClick={() => setMode(null)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                   <h2 className="text-2xl font-black">Smart Watchlist</h2>
                </div>

                 <div className="p-8 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/20">
                   <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center">
                         <TrendingDown className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                         <span className="block font-black text-xs uppercase tracking-widest text-indigo-400">24/7 Monitoring</span>
                         <h3 className="font-bold text-lg leading-tight">Agen Otonom Aktif</h3>
                      </div>
                   </div>
                   <p className="text-xs opacity-60 leading-relaxed italic mb-6">Agen kami terus memantau harga di Tokopedia, Shopee, & Distributor. Kamu akan menerima notifikasi otomatis saat harga menyentuh target.</p>
                   
                   <div className="pt-6 border-t border-indigo-500/10">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Threshold Notifikasi: {watchlistThreshold}%</label>
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        value={watchlistThreshold} 
                        onChange={(e) => setWatchlistThreshold(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-indigo-500/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-[8px] font-bold uppercase opacity-40 mt-1">
                         <span>Sensitif (1%)</span>
                         <span>Hemat Besar (50%)</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   {watchlist.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-indigo-500/5 rounded-[2.5rem] border border-dashed border-indigo-500/20">
                       <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isB2B ? "bg-white/5" : "bg-slate-100"}`}>
                         <Eye className="w-10 h-10 opacity-20 text-indigo-500" />
                       </div>
                       <div className="max-w-xs space-y-2">
                         <h3 className="font-bold text-lg text-indigo-400">Watchlist Kosong</h3>
                         <p className="text-xs opacity-50 leading-relaxed">Tambahkan barang ke watchlist saat hasil analisis keluar untuk memantau penurunan harganya secara otomatis oleh AI.</p>
                       </div>
                       <button 
                         onClick={() => { setMode(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                         className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-xl ${isB2B ? "bg-indigo-500 text-white shadow-indigo-500/20" : "bg-emerald-500 text-white shadow-emerald-500/20"}`}
                       >
                          Cari Barang & Pantau
                       </button>
                     </div>
                   ) : (
                      watchlist.map((item, idx) => (
                         <div key={idx} className={`p-6 rounded-3xl border ${isB2B ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}>
                            <div className="flex justify-between items-start mb-4">
                               <div>
                                  <span className="block text-[8px] font-black uppercase tracking-widest opacity-40">{item.brand}</span>
                                  <h4 className="font-bold text-sm">{item.productName}</h4>
                               </div>
                               <button
                                 onClick={() => {
                                   if (window.pendo) {
                                     pendo.track("watchlist_item_removed", {
                                       product_name: item.productName,
                                       watchlist_size_after: watchlist.length - 1,
                                       user_tier: profile?.subscription?.tier || "FREE"
                                     });
                                   }
                                   setWatchlist(watchlist.filter((_, i) => i !== idx));
                                 }}
                                 className="p-1 opacity-20 hover:opacity-100 text-rose-500"
                               >
                                  <Trash className="w-4 h-4" />
                               </button>
                            </div>
                             <div className="mb-4">
                                <input
                                  type="range"
                                  min="1"
                                  max="50"
                                  value={item.minPriceDrop || 5}
                                  onChange={(e) => {
                                    const newWatchlist = [...watchlist];
                                    newWatchlist[idx] = { ...item, minPriceDrop: parseInt(e.target.value) };
                                    setWatchlist(newWatchlist);
                                  }}
                                  onMouseUp={(e) => {
                                    if (window.pendo) {
                                      pendo.track("watchlist_threshold_configured", {
                                        product_name: item.productName,
                                        threshold_percent: parseInt((e.target as HTMLInputElement).value),
                                        previous_threshold: item.minPriceDrop || 5,
                                        user_tier: profile?.subscription?.tier || "FREE"
                                      });
                                    }
                                  }}
                                  onTouchEnd={(e) => {
                                    if (window.pendo) {
                                      pendo.track("watchlist_threshold_configured", {
                                        product_name: item.productName,
                                        threshold_percent: parseInt((e.target as HTMLInputElement).value),
                                        previous_threshold: item.minPriceDrop || 5,
                                        user_tier: profile?.subscription?.tier || "FREE"
                                      });
                                    }
                                  }}
                                  className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${isB2B ? "bg-white/10" : "bg-slate-200"}`}
                                />
                             </div>

                             <div className="flex justify-between items-end">
                               <div className="space-y-1">
                                  <span className="block text-[8px] font-black uppercase opacity-40">Min. Drop Target ({item.minPriceDrop || 5}%)</span>
                                  <span className="text-lg font-black text-emerald-500">Rp{(item.recommendedPrice * (1 - (item.minPriceDrop || 5)/100)).toLocaleString("id-ID")}</span>
                               </div>
                               <a href={item.url} target="_blank" className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest ${isB2B ? "bg-white text-slate-950" : "bg-slate-900 text-white"}`}>Cek Manual</a>
                            </div>
                         </div>
                      ))
                   )}
                </div>
             </motion.section>
          ) : mode === "rfq" && analysis?.batchResult ? (
             <motion.section key="rfq" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                <div className="flex items-center gap-4">
                   <button onClick={() => setMode(null)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                   <h2 className="text-2xl font-black text-indigo-400">Draft Request for Quotation</h2>
                </div>
                
                <div className="p-8 rounded-[2.5rem] bg-white text-slate-950 space-y-6 shadow-2xl">
                   <div className="border-b-4 border-slate-900 pb-4">
                      <h3 className="text-xl font-black uppercase italic">OFFICIAL RFQ DOCUMENT</h3>
                      <p className="text-[10px] opacity-60">Generated by CariMurah.ai Enterprise Agent</p>
                   </div>
                   
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 text-xs font-bold gap-4">
                         <div>
                            <span className="block opacity-40 uppercase text-[8px] mb-1">To Supplier</span>
                            <span>Multiple Verified Vendors</span>
                         </div>
                         <div className="text-right">
                            <span className="block opacity-40 uppercase text-[8px] mb-1">Date</span>
                            <span>{new Date().toLocaleDateString("id-ID")}</span>
                         </div>
                      </div>

                      <table className="w-full text-left text-xs">
                         <thead className="border-b border-slate-200">
                            <tr>
                               <th className="py-2">Item</th>
                               <th className="py-2 text-right">Target Price</th>
                            </tr>
                         </thead>
                         <tbody>
                            {analysis.batchResult.items.map((it, ii) => (
                               <tr key={ii} className="border-b border-slate-50 last:border-0">
                                  <td className="py-2 font-medium">{it.productName}</td>
                                  <td className="py-2 text-right font-bold">Rp{it.recommendedPrice.toLocaleString("id-ID")}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>

                   <button
                     onClick={() => {
                       setAnalysis({
                         ...analysis,
                         batchResult: { ...analysis.batchResult!, rfqStatus: 'sent' }
                       });

                       if (window.pendo) {
                         pendo.track("rfq_sent", {
                           items_count: analysis.batchResult!.items.length,
                           total_target_price: analysis.batchResult!.items.reduce((sum, it) => sum + it.recommendedPrice, 0),
                           send_method: "whatsapp_email",
                           user_tier: profile?.subscription?.tier || "FREE",
                           product_names: analysis.batchResult!.items.map(it => it.productName).join(", ").substring(0, 200)
                         });
                       }

                       setMode(null);
                     }}
                     className="w-full py-5 bg-slate-950 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl"
                   >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Send via API WhatsApp/Email
                   </button>
                </div>
             </motion.section>
          ) : mode === "camera" ? (
             <motion.section key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] bg-black flex flex-col">
                <div className="relative flex-1">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  
                  {cameraError ? (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-10 text-center">
                       <div className="max-w-xs space-y-6">
                          <div className="w-16 h-16 bg-rose-500/20 rounded-[2rem] flex items-center justify-center mx-auto">
                             <AlertCircle className="w-8 h-8 text-rose-500" />
                          </div>
                          <p className="text-white font-bold leading-relaxed text-sm">
                            {cameraError}
                          </p>
                          <button 
                            onClick={() => { setMode(null); window.open(window.location.href, '_blank'); }} 
                            className="px-6 py-3 bg-white text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
                          >
                             Buka di Tab Baru
                          </button>
                       </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-64 border-2 border-emerald-500/50 rounded-3xl relative">
                           <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                           <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />
                        </div>
                    </div>
                  )}
                  <button onClick={stopCamera} className="absolute top-8 right-6 w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white"><X /></button>
                </div>
                <div className="h-40 bg-black flex items-center justify-center">
                    <button 
                      onClick={startScanning} 
                      disabled={loading || !!cameraError} 
                      className="w-20 h-20 bg-white rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-20 disabled:scale-100"
                    >
                     {loading ? <Loader2 className="animate-spin text-slate-950" /> : <div className="w-16 h-16 border-4 border-slate-950 rounded-full" />}
                   </button>
                </div>
                <canvas ref={canvasRef} className="hidden" width="640" height="480" />
             </motion.section>
          ) : mode === "manual" ? (
            <motion.section key="manual" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center gap-4">
                  <button onClick={() => setMode(null)} className="p-2 rounded-full bg-slate-100 dark:bg-white/10"><ArrowLeft /></button>
                  <h3 className="font-bold text-xl">Ketik Daftar Belanja</h3>
                </div>
                <textarea 
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Contoh: Minyak Goreng Bimoli 2L, Beras Pandan Wangi 5kg..."
                  className={`w-full h-48 p-6 rounded-[2rem] border-2 transition-all outline-none text-lg ${isB2B ? "bg-white/5 border-white/10 focus:border-indigo-500" : "bg-slate-50 border-slate-100 focus:border-emerald-500 text-slate-900"}`}
                />
                <button 
                  onClick={() => processInput({ text: manualText })}
                  disabled={!manualText || loading}
                  className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isB2B ? "bg-white text-slate-950 shadow-xl" : "bg-slate-900 text-white shadow-xl shadow-slate-200"}`}
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Gaskeun Analisis AI"}
                </button>
            </motion.section>
          ) : mode === "voice" ? (
             <motion.section key="voice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-10 text-center">
                <div className="relative w-56 h-56 flex items-center justify-center mb-10">
                   <motion.div 
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl" 
                   />
                   <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="relative bg-emerald-500 p-10 rounded-full shadow-[0_0_50px_rgba(16,185,129,0.4)]" 
                   >
                     <Mic className="w-16 h-16 text-white" />
                   </motion.div>
                </div>
                <h3 className="text-3xl font-black text-white mb-3">Tengah Mendengarkan...</h3>
                <p className="text-white/40 text-lg mb-8 max-w-xs">Sebutkan barang-barang belanjaan Anda dengan jelas.</p>
                <div className="text-emerald-400 font-bold mb-16 text-2xl h-12 overflow-hidden text-ellipsis px-6">
                   {manualText || "Menunggu suara..."}
                </div>
                <button 
                  onClick={() => { 
                    recognitionRef.current?.stop();
                    mediaRecorderRef.current?.stop(); 
                    setIsRecording(false); 
                    if (!manualText) setMode(null); 
                  }} 
                  className="px-16 py-5 bg-white text-slate-950 rounded-full font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-transform"
                >
                  Selesai Berbicara
                </button>
             </motion.section>
          ) : mode === "compare" && selectedItemIndex !== null && analysis?.batchResult ? (
            <motion.section key="compare" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="flex items-center gap-4">
                  <button onClick={() => setMode(null)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full font-bold shadow-sm">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-black tracking-tight">Perbandingan Harga</h2>
               </div>

               {(() => {
                 const item = analysis.batchResult.items[selectedItemIndex];
                 const allOptions: MarketOption[] = [
                   { platform: "Harga Anda", price: item.currentPrice, rating: 0, deliveryDays: "-", bulkDiscount: "-", stockStatus: "Punya", isUser: true, reliabilityScore: 100, url: "", isWinner: false },
                   { platform: item.platform, price: item.recommendedPrice, rating: item.rating || 4.8, deliveryDays: item.deliveryDays || "1-2 Hari", bulkDiscount: item.bulkDiscount || "Grosir", stockStatus: item.stockStatus || "Ready", url: item.url, isWinner: true, reliabilityScore: (item as any).reliabilityScore || 98, forecasting: item.forecasting },
                   ...(item.alternatives || [])
                     .map(alt => ({ ...alt, isWinner: false, reliabilityScore: alt.reliabilityScore || 95 }))
                     .filter(alt => !reliabilityFilter || (alt.reliabilityScore || 0) >= 90)
                 ];

                 return (
                   <div className="space-y-8">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{item.brand}</span>
                        <h3 className="text-3xl font-black leading-tight">{item.productName}</h3>
                        <p className={`text-emerald-500 font-bold ${isB2B ? "text-indigo-400" : ""}`}>Potensi Cuan Rp{item.saving.toLocaleString("id-ID")}</p>
                      </div>

                      <div className="overflow-x-auto -mx-6 px-6 pb-6">
                        <div className="flex gap-4 min-w-[600px]">
                           {allOptions.map((opt, idx) => (
                             <div key={idx} className={`flex-1 min-w-[280px] p-8 rounded-[2.5rem] border-2 transition-all hover:scale-[1.02] relative ${opt.isWinner ? (isB2B ? "bg-indigo-900 shadow-2xl border-indigo-500" : "bg-emerald-50 border-emerald-500") : (isB2B ? "bg-white/5 border-white/5" : "bg-white border-slate-100")}`}>
                                {opt.isWinner && <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg ${isB2B ? "bg-indigo-500" : "bg-emerald-500"}`}>Best Choice</div>}
                                
                                <div className="mb-8">
                                   <span className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">{opt.platform}</span>
                                   <div className="text-4xl font-black tracking-tighter">Rp{opt.price.toLocaleString("id-ID")}</div>
                                </div>

                                <div className="space-y-5">
                                   <div className="flex items-center gap-3">
                                      <Star className={`w-4 h-4 ${opt.rating > 0 ? "text-amber-500 fill-current" : "opacity-20"}`} />
                                      <span className="text-xs font-bold">{opt.rating > 0 ? opt.rating : "N/A Rating"}</span>
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <Truck className="w-4 h-4 opacity-30" />
                                      <span className="text-xs font-bold text-balance">{opt.deliveryDays}</span>
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <Layers className="w-4 h-4 opacity-30" />
                                      <span className="text-xs font-bold text-balance">{opt.bulkDiscount}</span>
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <Sparkles className="w-4 h-4 opacity-30" />
                                      <span className="text-xs font-bold text-balance">{opt.stockStatus}</span>
                                   </div>

                                   {/* PRO / ENTERPRISE Forecaster */}
                                   {(profile?.subscription?.tier === "PRO" || profile?.subscription?.tier === "ENTERPRISE") && opt.forecasting && (
                                     <div className="mt-4 pt-4 border-t border-dashed opacity-80">
                                        <div className="flex items-center justify-between mb-3">
                                           <span className="text-[8px] font-black uppercase tracking-widest opacity-40">AI Forecast</span>
                                           <div className={`flex items-center gap-1 text-[10px] font-bold ${opt.forecasting.trend === 'down' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                              {opt.forecasting.trend === 'down' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                                              Target: Rp{opt.forecasting.predictedNextWeek.toLocaleString("id-ID")}
                                           </div>
                                        </div>
                                        {/* Simple Visual Trend */}
                                        <div className="h-8 flex items-end gap-1 px-1">
                                           {(opt.forecasting.history || []).map((h, hi) => (
                                              <div key={hi} className="flex-1 bg-current opacity-20 rounded-t-sm" style={{ height: `${(h.price / opt.price) * 100}%` }} />
                                           ))}
                                        </div>
                                     </div>
                                   )}

                                   {/* ENTERPRISE Landed Cost */}
                                   {profile?.subscription?.tier === "ENTERPRISE" && item.landedCost && idx === 1 && (
                                     <div className="mt-4 pt-4 border-t border-dashed opacity-80 space-y-2">
                                        <span className="block text-[8px] font-black uppercase tracking-widest opacity-40">Procurement Insight</span>
                                        <div className="flex justify-between text-[10px] font-bold">
                                           <span className="opacity-40 uppercase tracking-tighter">Pajak & Biaya</span>
                                           <span>Rp{(item.landedCost.tax + item.landedCost.shipping).toLocaleString("id-ID")}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-black text-indigo-500">
                                           <span className="uppercase tracking-tighter">TOTAL LANDED</span>
                                           <span>Rp{item.landedCost.total.toLocaleString("id-ID")}</span>
                                        </div>
                                     </div>
                                   )}
                                </div>

                                {isB2B && (
                                  <div className="mt-8 pt-8 border-t border-dashed opacity-80 space-y-4">
                                     <span className="block text-[8px] font-black uppercase tracking-widest opacity-40">Supplier Metrics</span>
                                     <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="opacity-40 uppercase">Rating</span>
                                        <span className="text-amber-500 flex items-center gap-1">{(opt as any).supplierRating || 4.5} <Star className="w-2.5 h-2.5 fill-current" /></span>
                                     </div>
                                     <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="opacity-40 uppercase">Reliability</span>
                                        <span className={opt.isWinner ? "text-emerald-400" : ""}>{(opt as any).reliabilityScore || "98"}%</span>
                                     </div>
                                  </div>
                                )}

                                {opt.url && (
                                  <div className="space-y-2 mt-10">
                                     <a href={opt.url} target="_blank" className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${opt.isWinner ? (isB2B ? "bg-white text-slate-950" : "bg-slate-950 text-white") : "bg-slate-100 text-slate-500"}`}>
                                       Beli Sekarang <ExternalLink className="w-4 h-4" />
                                     </a>
                                     {profile?.subscription?.tier !== "FREE" && (
                                       <button 
                                         onClick={() => {
                                           if (!watchlist.find(w => w.productName === item.productName)) {
                                             setWatchlist([...watchlist, item]);
                                             if (window.pendo) {
                                               pendo.track("watchlist_item_added", {
                                                 product_name: item.productName,
                                                 current_price: item.recommendedPrice,
                                                 watchlist_size: watchlist.length + 1,
                                                 user_tier: profile?.subscription?.tier || "FREE"
                                               });
                                             }
                                           }
                                         }}
                                         className="w-full py-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center justify-center gap-2"
                                       >
                                          <Bell className="w-3 h-3" /> Tambahkan ke Watchlist
                                       </button>
                                     )}
                                  </div>
                                )}
                             </div>
                           ))}
                        </div>
                      </div>

                      <ComparisonTable options={allOptions} isB2B={isB2B} />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white space-y-6">
                            <h4 className="text-xs font-black uppercase tracking-widest opacity-40">Fitur & Spesifikasi</h4>
                            <ul className="space-y-4">
                               {item.features?.map((f, fi) => (
                                 <li key={fi} className="flex items-center gap-3">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <span className="text-sm font-medium">{f}</span>
                                 </li>
                               ))}
                            </ul>
                         </div>

                         <div className={`p-8 rounded-[2.5rem] ${isB2B ? "bg-white/5" : "bg-slate-50"} space-y-6`}>
                            <div className="flex justify-between items-center">
                               <h4 className="text-xs font-black uppercase tracking-widest opacity-40">Ulasan Pengguna</h4>
                               <div className="flex items-center gap-1 text-amber-500">
                                  <Star className="w-4 h-4 fill-current" />
                                  <span className="font-bold">{item.rating || 4.8}</span>
                               </div>
                            </div>
                            <div className="space-y-6">
                               {(item.reviews || [
                                 { user: "Andi S.", rating: 5, comment: "Barang ori, pengiriman cepat sampai. Harga paling miring se-Shopee.", date: "2 hari lalu" },
                                 { user: "Budi J.", rating: 4, comment: "Kualitas oke, tapi packingnya kurang tebal.", date: "5 hari lalu" }
                               ]).map((r, ri) => (
                                 <div key={ri} className="space-y-2 border-b border-dashed pb-4 last:border-0">
                                    <div className="flex justify-between text-[10px] font-bold">
                                       <span className="opacity-60">{r.user}</span>
                                       <span className="opacity-40">{r.date}</span>
                                    </div>
                                    <p className="text-xs leading-relaxed opacity-80 italic">"{r.comment}"</p>
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                 );
               })()}
            </motion.section>
          ) : mode === "pricing" ? (
            <motion.section key="pricing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
               <div className="flex items-center gap-4">
                  <button onClick={() => setMode(null)} className="p-2 bg-slate-100 rounded-full"><ArrowLeft /></button>
                  <h2 className="text-2xl font-black">Pilih Skema Hemat Anda</h2>
               </div>

               <div className="space-y-6">
                  <div className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl space-y-4">
                     <div className="flex justify-between items-start">
                        <div>
                           <h3 className="text-xl font-black">Free Tier (B2C)</h3>
                           <p className="text-xs opacity-50">Cocok untuk belanja harian massal.</p>
                        </div>
                        <div className="text-xl font-black text-emerald-500">GRATIS</div>
                     </div>
                     <ul className="space-y-2">
                        <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Scan Foto/Voice Visual</li>
                        <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Perbandingan Harga Instan</li>
                        <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Checkout Afiliasi Aman</li>
                     </ul>
                     <button className="w-full py-4 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase opacity-40">Terpilih</button>
                  </div>

                  <div className="p-8 rounded-[2.5rem] bg-slate-950 text-white relative overflow-hidden space-y-4 shadow-2xl">
                     <div className="absolute top-0 right-0 p-4 bg-emerald-500 text-slate-950 font-black text-[8px] uppercase tracking-widest rounded-bl-2xl">Paling Laris</div>
                     <div className="flex justify-between items-start">
                        <div>
                           <h3 className="text-xl font-black">Pro Tier (Smart Saver)</h3>
                           <p className="text-xs opacity-40 italic">Untuk pemburu diskon agresif.</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-emerald-400">Rp49.000</div>
                          <div className="text-[8px] opacity-40">PER BULAN</div>
                        </div>
                     </div>
                     <ul className="space-y-2">
                        <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> AI Pricing Forecast (7 Hari)</li>
                        <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Watchlist Alert Unlimit</li>
                        <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> WhatsApp Price Drop Alerts</li>
                     </ul>
                     <button 
                       onClick={() => {
                         if (user && profile) {
                            const previousTier = profile.subscription?.tier || "FREE";
                            const subs = { tier: "PRO" as const, expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString() };
                            setProfile({ ...profile, subscription: subs });
                            updateProfile(user.uid, { subscription: subs });
                            if (window.pendo) {
                              pendo.track("subscription_upgraded", {
                                new_tier: "PRO",
                                previous_tier: previousTier,
                                expires_at: subs.expiresAt,
                                duration_days: 30,
                                user_id: user.uid
                              });
                            }
                            setMode(null);
                         }
                       }}
                       className="w-full py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
                     >
                        Langganan Sekarang
                     </button>
                  </div>

                  <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white space-y-4">
                     <div className="flex justify-between items-start">
                        <div>
                           <h3 className="text-xl font-black">Enterprise (Procurement)</h3>
                           <p className="text-xs opacity-60">Untuk UMKM & Perusahaan Besar.</p>
                        </div>
                        <div className="text-right">
                           <div className="text-xl font-black">Rp1.490.000</div>
                           <div className="text-[8px] opacity-60">PER BULAN</div>
                        </div>
                      </div>
                      <ul className="space-y-2">
                         <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-200" /> Collaborative Workflow (Tim)</li>
                         <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-200" /> Landed Cost Calculator</li>
                         <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-200" /> Sistem Auto-RFQ Multi Supplier</li>
                         <li className="text-xs flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-200" /> Laporan Audit P&L Bulanan</li>
                      </ul>
                      <button 
                        onClick={() => {
                          if (user && profile) {
                             const previousTier = profile.subscription?.tier || "FREE";
                             const subs = { tier: "ENTERPRISE" as const, expiresAt: new Date(Date.now() + 365*24*60*60*1000).toISOString() };
                             setProfile({ ...profile, subscription: subs });
                             updateProfile(user.uid, { subscription: subs });
                             if (window.pendo) {
                               pendo.track("subscription_upgraded", {
                                 new_tier: "ENTERPRISE",
                                 previous_tier: previousTier,
                                 expires_at: subs.expiresAt,
                                 duration_days: 365,
                                 user_id: user.uid
                               });
                             }
                             setMode(null);
                          }
                        }}
                        className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
                      >
                        Upgrade Enterprise
                      </button>
                   </div>
                </div>
             </motion.section>
          ) : analysis && (
            <motion.section key="analysis" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
               <div className="flex items-center gap-4">
                  <button onClick={() => { setAnalysis(null); setMode(null); }} className={`p-2 rounded-full ${isB2B ? "bg-white/10" : "bg-slate-100"}`}><ArrowLeft /></button>
                  <h3 className="font-bold text-xl">{analysis.step === "complete" ? "Laporan Penemuan Agen" : analysis.step === "error" ? "Hasil Gagal" : "Agen Beraksi..."}</h3>
               </div>

               {analysis.step === "error" && (
                 <div className="py-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
                       <X className="w-10 h-10 text-rose-500" />
                    </div>
                    <div className="space-y-2">
                       <p className="font-bold">{analysis.error || "Gagal Menganalisis Gambar"}</p>
                       <p className="text-xs opacity-50 px-10">{analysis.error ? "Klik tombol di bawah untuk mengulangi proses." : "Pastikan koneksi internet stabil dan gambar tidak terlalu gelap/buram."}</p>
                    </div>
                    <button onClick={() => {
                      if (typeof pendo !== "undefined") {
                        pendo.trackAgent("user_reaction", {
                          agentId: "zalXvF7bvqBY1qCtMTglr-WZuHA",
                          conversationId: crypto.randomUUID(),
                          messageId: `retry_${Date.now()}`,
                          content: "retry",
                        });
                      }
                      setAnalysis(null); setMode(null);
                    }} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm">Coba Lagi</button>
                 </div>
               )}

               {loading && (
                 <div className="py-20 text-center space-y-8">
                    <div className="relative w-32 h-32 mx-auto">
                       <Loader2 className="w-32 h-32 text-emerald-500 animate-spin" />
                       <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="w-10 h-10 text-emerald-500/20" /></div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-lg font-black italic">Mencari Lubang Penghematan...</p>
                       <p className="text-xs opacity-40 uppercase tracking-widest font-bold">Menyisir Shopee, Tokopedia, & Jaringan Grosir</p>
                    </div>
                 </div>
               )}

               {analysis.batchResult && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    {/* Summary Hero */}
                    <div className={`p-10 rounded-[2.5rem] border-4 ${isB2B ? "bg-indigo-900/40 border-indigo-500 shadow-2xl shadow-indigo-500/30" : "bg-emerald-50 border-emerald-500 shadow-2xl shadow-emerald-500/10"}`}>
                       <div className="flex justify-between items-start mb-8">
                          <div>
                            <span className="block text-xs font-black uppercase tracking-widest opacity-40 mb-3">Total Potensi Penghematan</span>
                            <div className="text-6xl font-black tracking-tighter leading-none">Rp{analysis.batchResult.totalPotentialSavings.toLocaleString("id-ID")}</div>
                          </div>
                          <div className={`p-4 rounded-2xl ${isB2B ? "bg-indigo-500 shadow-lg shadow-indigo-500/50" : "bg-emerald-500 shadow-lg shadow-emerald-500/50"}`}><CheckCircle2 className="w-8 h-8 text-white" /></div>
                       </div>
                       
                       <div className={`p-6 rounded-3xl flex gap-5 items-center ${isB2B ? "bg-black/20" : "bg-white shadow-sm border border-emerald-100"}`}>
                          <div className={`p-3 rounded-full ${isB2B ? "bg-indigo-500/20" : "bg-emerald-50"}`}>
                             <Volume2 className={`w-6 h-6 ${isB2B ? "text-indigo-400" : "text-emerald-500"}`} />
                          </div>
                          <p className={`text-sm font-semibold leading-relaxed italic ${isB2B ? "text-indigo-100" : "text-slate-700"}`}>"{analysis.batchResult.summaryVoice}"</p>
                       </div>
                       
                       {isB2B && (profile?.subscription?.tier === "ENTERPRISE") && (
                          <div className="flex gap-4 mt-8">
                             <button 
                               onClick={() => setMode("rfq")}
                               className="flex-1 py-4 bg-white text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform"
                             >
                                <Users className="w-4 h-4" /> Generate RFQ List
                             </button>
                             <button 
                               onClick={() => {
                                 if (!analysis?.batchResult) return;
                                 const summary = `CariMurah.ai: Saya baru saja menemukan potensi penghematan sebesar Rp${analysis.batchResult.totalPotentialSavings.toLocaleString("id-ID")}! 🚀\n\n${analysis.batchResult.items.map(it => `- ${it.productName}: Hemat Rp${it.saving.toLocaleString("id-ID")}`).join("\n")}`;
                                 navigator.clipboard.writeText(summary);
                                 setShowShareSuccess(true);
                                 setTimeout(() => setShowShareSuccess(false), 2000);

                                 if (window.pendo) {
                                   pendo.track("analysis_report_shared", {
                                     total_savings_shared: analysis.batchResult.totalPotentialSavings,
                                     items_count: analysis.batchResult.items.length,
                                     share_method: "clipboard",
                                     is_b2b: isB2B
                                   });
                                 }
                               }}
                               className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 ${showShareSuccess ? "bg-emerald-500 text-white" : "bg-indigo-500/20 border border-indigo-500/30 text-white"}`}
                             >
                                {showShareSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                {showShareSuccess ? "Copied!" : "Share Report"}
                             </button>
                          </div>
                       )}
                    </div>

                    {/* Audit Insights Bento (B2B Enterprise) */}
                    {isB2B && analysis.batchResult.auditInsights && analysis.batchResult.auditInsights.length > 0 && (
                       <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black uppercase opacity-40 tracking-widest">Historical OCR Audit Insights</h4>
                              {analysis.isCached && (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                   <WifiOff className="w-3 h-3" />
                                   <span className="text-[8px] font-black uppercase tracking-widest">Offline Cache</span>
                                </div>
                              )}
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {analysis.batchResult.auditInsights.map((insight, idx) => (
                               <button 
                                 key={idx} 
                                 onClick={() => setExpandedAuditIdx(expandedAuditIdx === idx ? null : idx)}
                                 className={`p-6 rounded-3xl bg-indigo-500 text-white space-y-4 shadow-xl text-left transition-all relative overflow-hidden group ${expandedAuditIdx === idx ? "md:col-span-2" : ""}`}
                               >
                                  <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-indigo-200" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">{insight.wasteCategory}</span>
                                     </div>
                                     <ChevronRight className={`w-4 h-4 text-indigo-200 transition-transform ${expandedAuditIdx === idx ? "rotate-90" : ""}`} />
                                  </div>
                                  <p className="text-sm font-bold leading-relaxed">{insight.recommendation}</p>

                                  <div className="space-y-1.5">
                                     <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-indigo-100">
                                        <span className="opacity-60">Budget Impact</span>
                                        <span>{totalAllTimeSpent > 0 ? ((insight.potentialAnnualSaving / totalAllTimeSpent) * 100).toFixed(1) : "0.0"}%</span>
                                     </div>
                                     <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${Math.min((totalAllTimeSpent > 0 ? (insight.potentialAnnualSaving / totalAllTimeSpent) * 100 : 0), 100)}%` }}
                                          className="h-full bg-white transition-all"
                                        />
                                     </div>
                                  </div>

                                  <AnimatePresence>
                                    {expandedAuditIdx === idx && insight.details && (
                                      <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                         <div className="pt-4 border-t border-indigo-400 space-y-3">
                                            <span className="block text-[8px] font-black uppercase tracking-widest text-indigo-100 text-left">Leak Details Identified</span>
                                            <ul className="space-y-2 text-left">
                                               {insight.details.map((detail, dIdx) => (
                                                  <li key={dIdx} className="flex items-start gap-2 text-xs opacity-90">
                                                     <div className="w-1 h-1 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                                                     <span>{detail}</span>
                                                  </li>
                                               ))}
                                            </ul>
                                         </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  <div className="pt-4 border-t border-indigo-400 flex items-end justify-between">
                                     <div>
                                        <span className="block text-[8px] font-black uppercase tracking-widest opacity-60">Potential Annual Saving</span>
                                        <span className="text-xl font-black italic">+Rp{insight.potentialAnnualSaving.toLocaleString("id-ID")}</span>
                                     </div>
                                     {expandedAuditIdx !== idx && (
                                       <span className="text-[8px] font-black uppercase tracking-widest text-indigo-100 opacity-40 group-hover:opacity-100 transition-opacity">Click to Expand</span>
                                     )}
                                  </div>
                               </button>
                             ))}
                          </div>
                       </div>
                    )}

                    {/* Comparison List */}
                    <div className="space-y-6">
                       <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                 <h4 className="text-xs font-black uppercase opacity-40 tracking-widest">Detail Item & Supplier</h4>
                                 <button 
                                   onClick={() => setReliabilityFilter(!reliabilityFilter)}
                                   className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${reliabilityFilter ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : (isB2B ? "bg-white/5 text-white/40 border border-white/10" : "bg-slate-50 text-slate-400 border border-slate-100")}`}
                                 >
                                    <Star className={`w-2.5 h-2.5 ${reliabilityFilter ? "fill-current" : ""}`} />
                                    Reliability &gt; 90%
                                 </button>
                              </div>
                             <span className="text-[10px] font-bold opacity-40">{analysis.batchResult.items.length} Barang</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                             <button 
                              onClick={() => setAnalysisFilterStock(!analysisFilterStock)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${analysisFilterStock ? (isB2B ? "bg-indigo-500 text-white" : "bg-emerald-500 text-white") : (isB2B ? "bg-white/5 text-white/40" : "bg-slate-50 text-slate-400")}`}
                             >
                                Stok Tersedia Only
                             </button>
                             <select 
                              value={analysisSortBy}
                              onChange={(e) => setAnalysisSortBy(e.target.value as any)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-bold border-none outline-none ${isB2B ? "bg-white/5 text-white" : "bg-slate-50 text-slate-900"}`}
                             >
                                <option value="savings">Urut: Untung</option>
                                <option value="price">Urut: Harga</option>
                                <option value="rating">Urut: Rating</option>
                                <option value="reliability">Urut: Reliability</option>
                                <option value="delivery">Urut: Pengiriman</option>
                             </select>
                             <button 
                              onClick={() => setAnalysisSortOrder(analysisSortOrder === "desc" ? "asc" : "desc")}
                              className={`px-4 py-2 rounded-xl text-[10px] font-bold ${isB2B ? "bg-white/5 text-white" : "bg-slate-50 text-slate-900"}`}
                             >
                                {analysisSortOrder === "desc" ? "Tinggi → Rendah" : "Rendah → Tinggi"}
                             </button>
                          </div>
                       </div>

                       {isB2B && (profile as any)?.subscription?.tier === "ENTERPRISE" && (
                         <div className="p-8 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/20 space-y-6">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-[1.5rem] bg-indigo-500 flex items-center justify-center text-white">
                                  <Users className="w-6 h-6" />
                               </div>
                               <div>
                                  <h4 className="font-black text-sm uppercase tracking-widest text-indigo-500">Collaborative Workflow</h4>
                                  <p className="text-xs opacity-60 italic">Kirim draft belanja ini ke Manajer/Owner untuk approval.</p>
                               </div>
                            </div>
                            <div className="flex gap-3">
                               <button 
                                 onClick={() => setMode("rfq")}
                                 className="flex-1 py-4 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
                               >
                                  Request Approval
                               </button>
                               <button 
                                 onClick={() => {
                                   setMode(null);
                                   setShowSettings(true);
                                 }}
                                 className="p-4 bg-white/5 text-white rounded-2xl active:scale-95 transition-transform"
                               >
                                  <Settings className="w-5 h-5" />
                               </button>
                            </div>
                         </div>
                       )}

                       <div className="space-y-5">
                          {analysis.batchResult.items
                            .filter(item => !analysisFilterStock || item.stockStatus === "Tersedia")
                            .filter(item => !reliabilityFilter || (item.reliabilityScore || 98) >= 90)
                            .sort((a, b) => {
                               const order = analysisSortOrder === "desc" ? -1 : 1;
                               if (analysisSortBy === "price") return (a.recommendedPrice - b.recommendedPrice) * order * -1; // Price high-to-low if desc
                               if (analysisSortBy === "savings") return (a.saving - b.saving) * order;
                               if (analysisSortBy === "rating") return ((a.rating || 0) - (b.rating || 0)) * order;
                               if (analysisSortBy === "reliability") return ((a.reliabilityScore || 98) - (b.reliabilityScore || 98)) * order;
                               if (analysisSortBy === "delivery") return ((parseInt(a.deliveryDays || "0")) - (parseInt(b.deliveryDays || "0"))) * order;
                               return 0;
                            })
                            .map((item, i) => (
                            <button 
                              key={i} 
                              onClick={() => {
                                setSelectedItemIndex(i);
                                setMode("compare");
                              }}
                              className={`w-full p-8 rounded-[2.5rem] border-2 text-left transition-all hover:scale-[1.02] relative ${isB2B ? "bg-white/5 border-white/5" : "bg-white border-slate-100 shadow-xl shadow-slate-100/50"}`}
                            >
                               <div className="flex justify-between items-start mb-6">
                                  <div className="flex-1">
                                     <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isB2B ? "bg-indigo-500" : "bg-emerald-500"} text-white`}>AI CHOICE</span>
                                        <span className="text-[10px] opacity-40 font-black uppercase tracking-widest">{item.brand}</span>
                                     </div>
                                     <h5 className="font-black text-xl leading-snug">{item.productName}</h5>
                                  </div>
                                  <div className="text-right">
                                     <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black mb-3 ${item.stockStatus === "Tersedia" ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.stockStatus === "Tersedia" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                                        {item.stockStatus || "Ready Stock"}
                                     </div>
                                     
                                     {profile?.subscription?.tier !== "FREE" && (item as any).forecasting?.reason && (
                                       <div className="flex items-center justify-end gap-1 text-emerald-500 mb-1">
                                          <TrendingDown className="w-3 h-3" />
                                          <span className="text-[8px] font-bold italic">{(item as any).forecasting.reason}</span>
                                       </div>
                                     )}

                                     <div className="flex items-center justify-end gap-1 text-amber-500 mb-1">
                                        <Star className="w-3.5 h-3.5 fill-current" />
                                        <span className="text-sm font-black">{item.rating || "4.8"}</span>
                                     </div>
                                     <div className={`text-xs font-black uppercase tracking-widest ${isB2B ? "text-indigo-400" : "text-emerald-600"}`}>SAVE Rp{item.saving.toLocaleString("id-ID")}</div>
                                  </div>
                               </div>

                               {item.features && item.features.length > 0 && (
                                 <div className="flex flex-wrap gap-2 mb-6">
                                    {item.features.map((f, fi) => (
                                      <span key={fi} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold ${isB2B ? "bg-white/5" : "bg-slate-50 text-slate-500"}`}>
                                         {f}
                                      </span>
                                    ))}
                                 </div>
                               )}

                               <div className="grid grid-cols-2 gap-4 mb-8">
                                  <div className={`p-4 rounded-2xl flex items-center gap-3 ${isB2B ? "bg-white/5" : "bg-slate-50"}`}>
                                     <Truck className="w-5 h-5 opacity-40" />
                                     <div>
                                        <span className="block text-[8px] font-bold uppercase opacity-40">Estimasi</span>
                                        <span className="text-xs font-bold">{item.deliveryDays || "1-2 Hari"}</span>
                                     </div>
                                  </div>
                                  <div className={`p-4 rounded-2xl flex items-center gap-3 ${isB2B ? "bg-white/5" : "bg-slate-50"}`}>
                                     <Layers className="w-5 h-5 opacity-40" />
                                     <div>
                                        <span className="block text-[8px] font-bold uppercase opacity-40">Grosir</span>
                                        <span className="text-xs font-bold">{item.bulkDiscount || "Min. 1 Unit"}</span>
                                     </div>
                                  </div>
                               </div>

                               <div className="flex items-center justify-between gap-6 border-t border-dashed pt-6 mt-2 opacity-100">
                                  <div>
                                     {item.forecasting?.history && (
                                       <button 
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setTrendItemId(trendItemId === i ? -1 : i);
                                         }}
                                         className={`flex items-center gap-2 mb-2 text-[8px] font-black uppercase tracking-widest ${isB2B ? "text-indigo-400" : "text-emerald-500"} hover:underline transition-all`}
                                       >
                                          <TrendingDown className="w-3 h-3" /> {(trendItemId === i || (profile?.preferences.showTrendChartsByDefault && trendItemId !== -1)) ? "Hide Trend Chart" : "View Price Trend"}
                                       </button>
                                     )}
                                     <span className="block text-[10px] opacity-40 font-black uppercase tracking-widest mb-1">{item.platform}</span>
                                     <div className="text-3xl font-black tracking-tight">Rp{item.recommendedPrice.toLocaleString("id-ID")}</div>
                                  </div>
                                  <div className={`px-8 py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 shadow-lg transition-transform active:scale-95 ${isB2B ? "bg-white text-slate-950 shadow-white/5" : "bg-slate-900 text-white shadow-slate-900/20"}`}>
                                    Bandingkan <ChevronRight className="w-4 h-4" />
                                  </div>
                               </div>

                               {((trendItemId === i) || (profile?.preferences.showTrendChartsByDefault && trendItemId !== -1)) && item.forecasting?.history && (
                                 <motion.div 
                                   initial={{ opacity: 0, height: 0 }} 
                                   animate={{ opacity: 1, height: "auto" }} 
                                   className="mt-6 pt-6 border-t border-white/10 overflow-hidden"
                                   onClick={(e) => e.stopPropagation()}
                                 >
                                    <h6 className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-4">Last 7 Days Trend (Rp)</h6>
                                    <div className="h-40 w-full">
                                       <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={item.forecasting.history}>
                                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isB2B ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                             <XAxis 
                                               dataKey="date" 
                                               axisLine={false} 
                                               tickLine={false} 
                                               tick={{ fontSize: 8, fontWeight: 900, fill: isB2B ? "#6366f1" : "#10b981" }}
                                               tickFormatter={(val) => val.split('-').pop() || val}
                                             />
                                             <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
                                             <RechartsTooltip 
                                               contentStyle={{ 
                                                 backgroundColor: isB2B ? "#1e1b4b" : "white", 
                                                 borderRadius: "1rem", 
                                                 border: "none", 
                                                 boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                                                 fontSize: "10px",
                                                 fontWeight: "900"
                                               }}
                                               itemStyle={{ color: isB2B ? "#818cf8" : "#059669" }}
                                               labelStyle={{ display: "none" }}
                                               cursor={{ fill: isB2B ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                                             />
                                             <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                                                {item.forecasting.history.map((entry: any, index: number) => (
                                                  <Cell key={`cell-${index}`} fill={isB2B ? "#6366f1" : "#10b981"} fillOpacity={0.4 + (index / 10)} />
                                                ))}
                                             </Bar>
                                          </BarChart>
                                       </ResponsiveContainer>
                                    </div>
                                 </motion.div>
                               )}
                            </button>
                          ))}
                       </div>
                    </div>

                    <button className={`w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl ${isB2B ? "bg-indigo-500 text-white shadow-indigo-500/20" : "bg-slate-900 text-white shadow-slate-900/20"}`}>
                       Checkout Otomatis Lewat Agen <Sparkles className="w-5 h-5" />
                    </button>
                 </motion.div>
               )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Persistence Floating Bar */}
      {isB2B && !mode && !analysis && (
        <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="fixed bottom-8 left-6 right-6 z-40">
           <div className="bg-white rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-50">
                    <img src={user?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky"} alt="avatar" />
                 </div>
                 <div>
                    <span className="block text-slate-950 font-black text-xs uppercase tracking-widest">{user?.displayName?.split(" ")[0] || "Tamu"}</span>
                    <span className="block text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">B2B Pro Member</span>
                 </div>
              </div>
              <div className="flex gap-6 h-full border-l border-indigo-50 pl-6 ml-auto">
                 <div className="text-right">
                    <span className="block text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Cuan Hari Ini</span>
                    <span className="block text-indigo-600 font-black text-lg leading-none">Rp{totalAllTimeSaved.toLocaleString("id-ID")}</span>
                 </div>
              </div>
           </div>
        </motion.div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`max-w-md w-full p-8 rounded-[3rem] ${isB2B ? "bg-slate-900 border border-white/10" : "bg-white"} shadow-2xl text-center space-y-6`}
            >
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
                <Trash className="w-10 h-10 text-rose-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Hapus {selectedHistoryIds.length} Riwayat?</h3>
                <p className="text-sm opacity-60">Tindakan ini tidak dapat dibatalkan. Riwayat belanja yang dipilih akan dihapus selamanya dari akun Anda.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`py-4 rounded-2xl font-bold transition-all ${isB2B ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"}`}
                >
                  Batal
                </button>
                <button 
                  onClick={handleBulkDelete}
                  disabled={loading}
                  className="py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Ya, Hapus"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

