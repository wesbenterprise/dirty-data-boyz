'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// ============================================================
// FILE PARSERS
// ============================================================
function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const headers = json[0] || [];
        const rows = json.slice(1, 501);
        resolve({ headers, rows, totalRows: json.length - 1, totalCols: headers.length, truncated: json.length - 1 > 500 });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = Papa.parse(e.target.result, { header: false, skipEmptyLines: true });
        const headers = result.data[0] || [];
        const rows = result.data.slice(1, 501);
        resolve({ headers, rows, totalRows: result.data.length - 1, totalCols: headers.length, truncated: result.data.length - 1 > 500 });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parsePDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = btoa(new Uint8Array(e.target.result).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      resolve({ base64, isPDF: true });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') return { ...(await parseXLSX(file)), fileType: 'xlsx' };
  if (ext === 'csv' || ext === 'tsv') return { ...(await parseCSV(file)), fileType: 'csv' };
  if (ext === 'pdf') return { ...(await parsePDF(file)), fileType: 'pdf' };
  throw new Error(`Unsupported file type: .${ext}`);
}

// ============================================================
// DESIGN
// ============================================================
const NP = '#FF2D95', NC = '#00F0FF', NG = '#39FF14', NY = '#FFE814', NPU = '#BF40FF';
const DB = '#0A0A12', DC = '#12121F', DC2 = '#1A1A2E';

function formatSize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
function formatDate(d) { const dt = new Date(d); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' — ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }

function Scanlines() {
  return <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)', pointerEvents: 'none', zIndex: 9999 }} />;
}

function GeometricBackground() {
  const shapes = [
    { type: 'triangle', x: '5%', y: '10%', size: 60, color: NP, delay: 0, dur: 12 },
    { type: 'circle', x: '85%', y: '15%', size: 40, color: NC, delay: 2, dur: 15 },
    { type: 'diamond', x: '70%', y: '60%', size: 50, color: NPU, delay: 4, dur: 18 },
    { type: 'triangle', x: '15%', y: '75%', size: 45, color: NG, delay: 1, dur: 14 },
    { type: 'circle', x: '90%', y: '80%', size: 35, color: NY, delay: 3, dur: 16 },
    { type: 'diamond', x: '40%', y: '5%', size: 30, color: NP, delay: 5, dur: 20 },
    { type: 'triangle', x: '55%', y: '90%', size: 55, color: NC, delay: 2, dur: 13 },
    { type: 'circle', x: '25%', y: '45%', size: 25, color: NPU, delay: 6, dur: 17 },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', right: '-10%', height: '50%', background: 'linear-gradient(transparent 0%, rgba(0,240,255,0.05) 100%)', transform: 'perspective(500px) rotateX(60deg)', backgroundImage: 'linear-gradient(rgba(191,64,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(191,64,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      {shapes.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.size, height: s.size, opacity: 0.12, border: `2px solid ${s.color}`, borderRadius: s.type === 'circle' ? '50%' : s.type === 'diamond' ? '4px' : '0', transform: s.type === 'diamond' ? 'rotate(45deg)' : s.type === 'triangle' ? 'rotate(30deg)' : 'none', clipPath: s.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none', animation: `floatShape${i % 3} ${s.dur}s ease-in-out infinite`, animationDelay: `${s.delay}s`, boxShadow: `0 0 20px ${s.color}33` }} />
      ))}
    </div>
  );
}

function GlitchText({ children, style = {} }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', ...style }}>
      <span style={{ position: 'relative', zIndex: 2 }}>{children}</span>
      <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', color: NC, zIndex: 1, clipPath: 'inset(0 0 65% 0)', animation: 'glitch1 3s infinite linear alternate-reverse' }}>{children}</span>
      <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', color: NP, zIndex: 1, clipPath: 'inset(65% 0 0 0)', animation: 'glitch2 3s infinite linear alternate-reverse' }}>{children}</span>
    </span>
  );
}

function Mascot({ size = 120 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <defs>
        <filter id="ng"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={NC} /><stop offset="100%" stopColor={NPU} /></linearGradient>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={NP} /><stop offset="100%" stopColor={NY} /></linearGradient>
      </defs>
      <ellipse cx="60" cy="85" rx="28" ry="25" fill="url(#bg)" filter="url(#ng)" />
      <circle cx="60" cy="42" r="26" fill={NC} filter="url(#ng)" /><circle cx="60" cy="42" r="22" fill="#1a1a2e" />
      <ellipse cx="50" cy="40" rx="3" ry="4" fill={NG} /><ellipse cx="70" cy="40" rx="3" ry="4" fill={NG} />
      <rect x="38" y="34" width="18" height="12" rx="3" fill="#111" stroke="url(#sg)" strokeWidth="2" />
      <rect x="64" y="34" width="18" height="12" rx="3" fill="#111" stroke="url(#sg)" strokeWidth="2" />
      <line x1="56" y1="40" x2="64" y2="40" stroke="url(#sg)" strokeWidth="2" />
      <line x1="38" y1="40" x2="32" y2="38" stroke="url(#sg)" strokeWidth="2" />
      <line x1="82" y1="40" x2="88" y2="38" stroke="url(#sg)" strokeWidth="2" />
      <rect x="40" y="36" width="6" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="66" y="36" width="6" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <path d="M 48 52 Q 60 62 72 52" stroke={NG} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <polygon points="42,22 38,5 48,20" fill={NP} /><polygon points="52,18 50,0 58,16" fill={NY} />
      <polygon points="62,16 65,0 68,16" fill={NP} /><polygon points="72,18 78,2 76,20" fill={NY} />
      <path d="M 32 80 Q 18 75 14 65" stroke="url(#bg)" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="2" y="50" width="22" height="22" rx="2" fill="#333" stroke={NG} strokeWidth="1.5" filter="url(#ng)" />
      <rect x="6" y="50" width="14" height="8" rx="1" fill="#222" /><rect x="8" y="62" width="10" height="8" rx="1" fill="#555" />
      <text x="10" y="68" fontSize="5" fill={NG} fontFamily="monospace">DD</text>
      <path d="M 88 80 Q 100 75 102 85" stroke="url(#bg)" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="104" cy="86" r="5" fill={NC} /><rect x="102" y="78" width="4" height="8" rx="2" fill={NC} />
      <ellipse cx="48" cy="108" rx="12" ry="6" fill="#222" stroke={NP} strokeWidth="1.5" />
      <ellipse cx="72" cy="108" rx="12" ry="6" fill="#222" stroke={NP} strokeWidth="1.5" />
    </svg>
  );
}

function NeonCard({ color, children, style = {} }) {
  return (
    <div style={{ background: DC, border: `1px solid ${color}44`, borderRadius: 8, padding: '20px 24px', position: 'relative', overflow: 'hidden', boxShadow: `0 0 20px ${color}15, inset 0 0 20px ${color}05`, ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      {children}
    </div>
  );
}

function FileIcon({ type, size = 28 }) {
  const colors = { xlsx: NG, csv: NC, pdf: NP };
  const c = colors[type] || NPU;
  return <div style={{ width: size, height: size, border: `2px solid ${c}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontFamily: "'Press Start 2P', monospace", color: c, textTransform: 'uppercase', flexShrink: 0, boxShadow: `0 0 8px ${c}44` }}>{type}</div>;
}

function ProgressBar({ progress }) {
  return (
    <div style={{ width: '100%', height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${NC}, ${NPU})`, borderRadius: 2, transition: 'width 0.3s ease', boxShadow: `0 0 10px ${NC}` }} />
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function Home() {
  const [view, setView] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [showResults, setShowResults] = useState([false, false, false]);
  const [analysis, setAnalysis] = useState(null);
  const [fileName, setFileName] = useState('');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('analyses').select('*').order('created_at', { ascending: false }).limit(50);
      if (!error && data) setHistory(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const processFile = useCallback(async (file) => {
    setError(null); setView('analyzing'); setProgress(0);
    setStatusMsg('Parsing file...'); setFileName(file.name);
    const ext = file.name.split('.').pop().toLowerCase();

    try {
      setProgress(10);
      const parsed = await parseFile(file);
      setProgress(25); setStatusMsg('Sending to Claude for analysis...');

      const fileInfo = {
        fileName: file.name,
        fileSize: formatSize(file.size),
        fileType: ext === 'xls' ? 'xlsx' : ext === 'tsv' ? 'csv' : ext,
        rowCount: parsed.totalRows || 0,
        colCount: parsed.totalCols || 0,
        truncated: parsed.truncated || false,
      };

      const progressInterval = setInterval(() => {
        setProgress((p) => { if (p >= 85) { clearInterval(progressInterval); return 85; } return p + Math.random() * 4 + 1; });
      }, 300);
      setStatusMsg('Claude is reviewing your data...');

      const apiBody = parsed.isPDF
        ? { type: 'pdf', fileName: file.name, data: { base64: parsed.base64 } }
        : { type: 'spreadsheet', fileName: file.name, data: { headers: parsed.headers, rows: parsed.rows, totalRows: parsed.totalRows, totalCols: parsed.totalCols, truncated: parsed.truncated } };

      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiBody) });
      clearInterval(progressInterval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Analysis failed');
      }

      const result = await res.json();
      setProgress(90); setStatusMsg('Saving to database...');

      const { data: saved, error: saveErr } = await supabase.from('analyses').insert({
        file_name: file.name,
        file_type: fileInfo.fileType,
        file_size: fileInfo.fileSize,
        row_count: result.row_count ?? fileInfo.rowCount,
        col_count: result.col_count ?? fileInfo.colCount,
        the_good: result.the_good || [],
        the_bad: result.the_bad || [],
        the_dirty: result.the_dirty || [],
        raw_summary: result.summary || '',
      }).select().single();

      if (saveErr) console.error('Save error:', saveErr);
      setProgress(100);

      setAnalysis({
        ...result,
        id: saved?.id,
        fileName: file.name,
        fileSize: fileInfo.fileSize,
        fileType: fileInfo.fileType,
        rowCount: result.row_count ?? fileInfo.rowCount,
        colCount: result.col_count ?? fileInfo.colCount,
        timestamp: formatDate(new Date().toISOString()),
        truncated: fileInfo.truncated,
      });

      setTimeout(() => {
        setView('results');
        setTimeout(() => setShowResults([true, false, false]), 200);
        setTimeout(() => setShowResults([true, true, false]), 600);
        setTimeout(() => setShowResults([true, true, true]), 1000);
      }, 400);

      loadHistory();
    } catch (err) { console.error(err); setError(err.message); setView('upload'); }
  }, [loadHistory]);

  const handleDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) processFile(f); }, [processFile]);
  const handleSelect = useCallback((e) => { const f = e.target.files?.[0]; if (f) processFile(f); }, [processFile]);

  const viewHistoryItem = useCallback((item) => {
    setAnalysis({ the_good: item.the_good || [], the_bad: item.the_bad || [], the_dirty: item.the_dirty || [], summary: item.raw_summary, id: item.id, fileName: item.file_name, fileSize: item.file_size, fileType: item.file_type, rowCount: item.row_count, colCount: item.col_count, timestamp: formatDate(item.created_at) });
    setView('results');
    setTimeout(() => setShowResults([true, false, false]), 200);
    setTimeout(() => setShowResults([true, true, false]), 600);
    setTimeout(() => setShowResults([true, true, true]), 1000);
  }, []);

  const handleDelete = useCallback(async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this analysis?')) return;
    const { error } = await supabase.from('analyses').delete().eq('id', id);
    if (!error) setHistory((h) => h.filter((x) => x.id !== id));
  }, []);

  const reset = () => { setView('upload'); setProgress(0); setShowResults([false, false, false]); setError(null); if (fileRef.current) fileRef.current.value = ''; };

  const progMsg = progress < 20 ? '>> Parsing file structure...' : progress < 40 ? '>> Extracting data...' : progress < 65 ? '>> Claude is scanning for anomalies...' : progress < 85 ? '>> Generating insights...' : '>> Compiling the down & dirty...';

  return (
    <>
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes floatShape0 { 0%, 100% { transform: translateY(0) rotate(0deg); } 33% { transform: translateY(-20px) rotate(5deg); } 66% { transform: translateY(10px) rotate(-3deg); } }
        @keyframes floatShape1 { 0%, 100% { transform: translateY(0) rotate(45deg); } 50% { transform: translateY(-30px) rotate(50deg); } }
        @keyframes floatShape2 { 0%, 100% { transform: translateY(0) rotate(30deg); } 25% { transform: translateY(15px) rotate(35deg); } 75% { transform: translateY(-15px) rotate(25deg); } }
        @keyframes glitch1 { 0% { transform: translate(0); } 20% { transform: translate(-2px, 1px); } 40% { transform: translate(2px, -1px); } 60% { transform: translate(-1px, -1px); } 80% { transform: translate(1px, 2px); } 100% { transform: translate(0); } }
        @keyframes glitch2 { 0% { transform: translate(0); } 20% { transform: translate(2px, -1px); } 40% { transform: translate(-2px, 1px); } 60% { transform: translate(1px, 1px); } 80% { transform: translate(-1px, -2px); } 100% { transform: translate(0); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes mascotBob { 0%, 100% { transform: translateY(0px) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
        @keyframes uploadPulse { 0%, 100% { border-color: ${NC}44; } 50% { border-color: ${NC}aa; } }
        @keyframes flicker { 0%, 100% { opacity: 1; } 92% { opacity: 1; } 93% { opacity: 0.8; } 94% { opacity: 1; } 96% { opacity: 0.9; } 97% { opacity: 1; } }
        @keyframes rainbowBorder { 0% { border-color: ${NP}; } 25% { border-color: ${NC}; } 50% { border-color: ${NG}; } 75% { border-color: ${NY}; } 100% { border-color: ${NP}; } }
        .upload-zone:hover { border-color: ${NC}88 !important; background: ${DC2} !important; }
        .history-item:hover { background: ${DC2} !important; border-color: ${NPU}66 !important; }
        .nav-btn:hover { background: ${DC2} !important; }
        .action-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
        .del-btn { opacity: 0; transition: opacity 0.2s; }
        .history-item:hover .del-btn { opacity: 1; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${DB}; }
        ::-webkit-scrollbar-thumb { background: ${NPU}44; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: '100vh', background: DB, color: '#E0E0F0', fontFamily: "'Rajdhani', sans-serif", position: 'relative', overflow: 'hidden' }}>
        <GeometricBackground /><Scanlines />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          {/* HEADER */}
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0 20px', borderBottom: `1px solid ${NPU}22`, flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={reset}>
              <div style={{ animation: 'mascotBob 3s ease-in-out infinite' }}><Mascot size={72} /></div>
              <div>
                <GlitchText style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 22, color: NC, textShadow: `0 0 20px ${NC}66, 0 0 40px ${NC}33`, animation: 'flicker 4s infinite', letterSpacing: 2 }}>DIRTY DATA BOYZ</GlitchText>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: NPU, marginTop: 6, letterSpacing: 4 }}>The Down &amp; Dirty on Your Data</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn" onClick={reset} style={{ background: view !== 'history' ? DC2 : 'transparent', border: `1px solid ${view !== 'history' ? NC + '44' : 'transparent'}`, color: '#E0E0F0', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}>⚡ New Analysis</button>
              <button className="nav-btn" onClick={() => { setView('history'); loadHistory(); }} style={{ background: view === 'history' ? DC2 : 'transparent', border: `1px solid ${view === 'history' ? NPU + '44' : 'transparent'}`, color: '#E0E0F0', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}>📁 History ({history.length})</button>
            </div>
          </header>

          {/* ERROR */}
          {error && (
            <div style={{ margin: '20px 0', padding: '16px 20px', background: `${NP}15`, border: `1px solid ${NP}44`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: NP, marginBottom: 4 }}>ANALYSIS FAILED</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: '#C8C8E0', wordBreak: 'break-word' }}>{error}</div>
              </div>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: NP, cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0 }}>✕</button>
            </div>
          )}

          {/* UPLOAD */}
          {view === 'upload' && (
            <div style={{ animation: 'slideUp 0.5s ease-out', paddingTop: 60 }}>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 28, fontWeight: 900, background: `linear-gradient(135deg, ${NC}, ${NPU}, ${NP})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 12 }}>DROP YOUR DATA</h2>
                <p style={{ color: '#8888AA', fontFamily: "'Share Tech Mono', monospace", fontSize: 14 }}>Upload a spreadsheet or PDF and we&apos;ll give you the down &amp; dirty</p>
              </div>
              <div className="upload-zone" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()} style={{ maxWidth: 600, margin: '0 auto', padding: '60px 40px', border: `2px dashed ${dragOver ? NC : NC + '44'}`, borderRadius: 12, background: dragOver ? DC2 : DC, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s ease', animation: dragOver ? 'none' : 'uploadPulse 3s ease-in-out infinite', position: 'relative', overflow: 'hidden' }}>
                {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }].map((pos, i) => (
                  <div key={i} style={{ position: 'absolute', ...pos, width: 20, height: 20, borderTop: pos.top !== undefined ? `2px solid ${NP}88` : 'none', borderBottom: pos.bottom !== undefined ? `2px solid ${NP}88` : 'none', borderLeft: pos.left !== undefined ? `2px solid ${NP}88` : 'none', borderRight: pos.right !== undefined ? `2px solid ${NP}88` : 'none' }} />
                ))}
                <div style={{ marginBottom: 20 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="8" y="4" width="48" height="56" rx="4" stroke={NC} strokeWidth="2" fill={DC2} />
                    <rect x="16" y="4" width="32" height="20" rx="2" fill="#1a1a2e" stroke={NC + '66'} strokeWidth="1" />
                    <rect x="20" y="32" width="24" height="24" rx="2" fill="#1a1a2e" stroke={NPU + '66'} strokeWidth="1" />
                    <line x1="20" y1="38" x2="44" y2="38" stroke={NPU + '44'} strokeWidth="1" />
                    <line x1="20" y1="42" x2="44" y2="42" stroke={NPU + '44'} strokeWidth="1" />
                    <line x1="20" y1="46" x2="36" y2="46" stroke={NPU + '44'} strokeWidth="1" />
                    <rect x="36" y="8" width="8" height="12" rx="1" fill="#333" />
                  </svg>
                </div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, fontWeight: 700, color: NC, marginBottom: 8 }}>{dragOver ? 'RELEASE TO UPLOAD' : 'DRAG & DROP FILE'}</div>
                <div style={{ color: '#6666AA', fontSize: 14, fontFamily: "'Share Tech Mono', monospace" }}>or click to browse</div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                  {['xlsx', 'csv', 'pdf'].map((t) => (
                    <span key={t} style={{ padding: '4px 12px', border: `1px solid ${t === 'xlsx' ? NG : t === 'csv' ? NC : NP}44`, borderRadius: 20, fontSize: 11, fontFamily: "'Press Start 2P', monospace", color: t === 'xlsx' ? NG : t === 'csv' ? NC : NP }}>.{t}</span>
                  ))}
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.pdf" style={{ display: 'none' }} onChange={handleSelect} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 20, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: '#444466' }}>Max 500 rows analyzed per file • Powered by Claude AI</div>
            </div>
          )}

          {/* ANALYZING */}
          {view === 'analyzing' && (
            <div style={{ animation: 'slideUp 0.5s ease-out', paddingTop: 80, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ animation: 'mascotBob 1.5s ease-in-out infinite', marginBottom: 32 }}><Mascot size={100} /></div>
              <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 20, fontWeight: 700, color: NC, marginBottom: 4 }}>GETTING THE DOWN &amp; DIRTY</h2>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: '#8888AA', marginBottom: 16 }}>{fileName}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                {[0, 1, 2].map((i) => (<div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: NC, animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s`, boxShadow: `0 0 8px ${NC}` }} />))}
                <span style={{ color: NC, fontFamily: "'Share Tech Mono', monospace", fontSize: 13, marginLeft: 8 }}>{statusMsg}</span>
              </div>
              <div style={{ marginTop: 32, padding: '0 40px' }}>
                <ProgressBar progress={Math.min(progress, 100)} />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: NPU, marginTop: 12 }}>{progMsg}</div>
              </div>
            </div>
          )}

          {/* RESULTS */}
          {view === 'results' && analysis && (
            <div style={{ paddingTop: 32, paddingBottom: 60 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: DC, borderRadius: 8, border: `1px solid ${NPU}22`, marginBottom: 28, animation: 'slideUp 0.3s ease-out', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileIcon type={analysis.fileType} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{analysis.fileName}</div>
                    <div style={{ fontSize: 12, color: '#6666AA', fontFamily: "'Share Tech Mono', monospace" }}>
                      {analysis.fileSize} • {(analysis.rowCount || 0).toLocaleString()} rows • {analysis.colCount || 0} cols • {analysis.timestamp}
                      {analysis.truncated && <span style={{ color: NY }}> • TRUNCATED</span>}
                    </div>
                  </div>
                </div>
                <button className="action-btn" onClick={reset} style={{ background: `linear-gradient(135deg, ${NC}22, ${NPU}22)`, border: `1px solid ${NC}44`, color: NC, padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>+ New File</button>
              </div>

              {analysis.summary && (
                <div style={{ padding: '12px 20px', background: `${NPU}11`, borderRadius: 8, border: `1px solid ${NPU}22`, marginBottom: 24, animation: 'slideUp 0.3s ease-out' }}>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: NPU, marginRight: 10 }}>SUMMARY:</span>
                  <span style={{ fontSize: 14, color: '#AAAACC' }}>{analysis.summary}</span>
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <GlitchText style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 16, color: NY, textShadow: `0 0 20px ${NY}44`, letterSpacing: 3 }}>THE DOWN &amp; DIRTY</GlitchText>
              </div>

              {/* THE GOOD */}
              <div style={{ animation: showResults[0] ? 'slideUp 0.6s ease-out' : 'none', opacity: showResults[0] ? 1 : 0, marginBottom: 24 }}>
                <NeonCard color={NG}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 22 }}>✅</span>
                    <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 900, color: NG, textShadow: `0 0 10px ${NG}44` }}>THE GOOD</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(analysis.the_good || []).map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', background: `${NG}08`, borderRadius: 6, borderLeft: `3px solid ${NG}66` }}>
                        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: NG, marginTop: 4, flexShrink: 0 }}>[{String(i + 1).padStart(2, '0')}]</span>
                        <span style={{ fontSize: 15, lineHeight: 1.5, color: '#C8C8E0' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </NeonCard>
              </div>

              {/* THE BAD */}
              <div style={{ animation: showResults[1] ? 'slideUp 0.6s ease-out' : 'none', opacity: showResults[1] ? 1 : 0, marginBottom: 24 }}>
                <NeonCard color={NP}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 22 }}>⚠️</span>
                    <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 900, color: NP, textShadow: `0 0 10px ${NP}44` }}>THE BAD</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(analysis.the_bad || []).map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', background: `${NP}08`, borderRadius: 6, borderLeft: `3px solid ${NP}66` }}>
                        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: NP, marginTop: 4, flexShrink: 0 }}>[{String(i + 1).padStart(2, '0')}]</span>
                        <span style={{ fontSize: 15, lineHeight: 1.5, color: '#C8C8E0' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </NeonCard>
              </div>

              {/* THE DIRTY */}
              <div style={{ animation: showResults[2] ? 'slideUp 0.6s ease-out' : 'none', opacity: showResults[2] ? 1 : 0, marginBottom: 24 }}>
                <NeonCard color={NY} style={{ animation: showResults[2] ? 'rainbowBorder 4s linear infinite' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 22 }}>🔍</span>
                    <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 900, color: NY, textShadow: `0 0 10px ${NY}44` }}>THE DIRTY</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(analysis.the_dirty || []).map((item, i) => {
                      const text = typeof item === 'string' ? item : item.text;
                      const why = typeof item === 'string' ? null : item.why;
                      return (
                        <div key={i} style={{ padding: '14px 16px', background: `${NY}06`, borderRadius: 6, borderLeft: `3px solid ${NY}66` }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: NY, marginTop: 4, flexShrink: 0 }}>[{String(i + 1).padStart(2, '0')}]</span>
                            <span style={{ fontSize: 15, lineHeight: 1.5, color: '#C8C8E0' }}>{text}</span>
                          </div>
                          {why && (
                            <div style={{ marginTop: 10, marginLeft: 40, padding: '8px 12px', background: `${NPU}11`, borderRadius: 4, border: `1px solid ${NPU}22` }}>
                              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: NPU, marginRight: 8 }}>WHY IT&apos;S DIRTY:</span>
                              <span style={{ fontSize: 13, color: '#9999BB', lineHeight: 1.5 }}>{why}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </NeonCard>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {view === 'history' && (
            <div style={{ paddingTop: 32, animation: 'slideUp 0.5s ease-out' }}>
              <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 22, fontWeight: 900, color: NPU, marginBottom: 24, textShadow: `0 0 15px ${NPU}44` }}>ANALYSIS HISTORY</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map((item, i) => (
                  <div key={item.id} className="history-item" onClick={() => viewHistoryItem(item)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: DC, border: `1px solid ${NPU}22`, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', animation: 'slideUp 0.4s ease-out', animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}>
                    <FileIcon type={item.file_type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file_name}</div>
                      <div style={{ fontSize: 12, color: '#6666AA', fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>{formatDate(item.created_at)} • {item.file_size}</div>
                    </div>
                    <button className="del-btn" onClick={(e) => handleDelete(item.id, e)} style={{ background: 'none', border: `1px solid ${NP}44`, color: NP, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, transition: 'all 0.2s' }}>DEL</button>
                    <div style={{ color: NC, fontSize: 13, fontFamily: "'Share Tech Mono', monospace", flexShrink: 0 }}>VIEW →</div>
                  </div>
                ))}
              </div>
              {history.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 0', color: '#6666AA', fontFamily: "'Share Tech Mono', monospace" }}>No analyses yet. Drop a file to get started.</div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', padding: '40px 0 24px', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: '#444466', borderTop: `1px solid ${NPU}11`, marginTop: 40 }}>
            DIRTY DATA BOYZ™ • BARNETT FAMILY PARTNERS • v1.0
          </div>
        </div>
      </div>
    </>
  );
}
