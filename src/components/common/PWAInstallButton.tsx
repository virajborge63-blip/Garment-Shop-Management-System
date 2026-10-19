import React, { useState } from 'react';
import { usePWAInstall } from '../../usePWAInstall.ts';
import { 
  Download, Smartphone, Monitor, CheckCircle2, 
  X, ExternalLink, Sparkles, ShieldCheck 
} from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'hero' | 'minimal';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'header',
  className = ''
}) => {
  const { isInstallable, isInstalled, isAndroid, isWindows, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // If already running in standalone PWA app mode on desktop/mobile
  if (isInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Installed App</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const res = await install();
      if (!res) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <>
      {variant === 'hero' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 ${className}`}
        >
          <Download className="w-4 h-4 text-slate-950 shrink-0" />
          <span>Install for Android / Windows</span>
        </button>
      ) : variant === 'minimal' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App (Android & Windows)</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {/* Guide Modal for Android & Windows installation */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
                👑
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  H.M. RAJPAL GARMENT SHOP
                </h3>
                <p className="text-xs text-amber-400 font-semibold">
                  Install Full Working App for Android & Windows
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              This app is a progressive desktop and mobile application. You can install and run it natively on your Android phones/tablets and Windows desktop PCs without needing app store downloads!
            </p>

            {isInstallable && (
              <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-300 block">1-Click Fast Install Ready</span>
                  <span className="text-[11px] text-slate-400">Click to install directly on your current device</span>
                </div>
                <button
                  onClick={async () => {
                    await install();
                    setShowModal(false);
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg shadow-md"
                >
                  Install Now
                </button>
              </div>
            )}

            {/* Platform Guides */}
            <div className="space-y-3 mb-5">
              {/* Android Guide */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 mb-1 text-emerald-400 font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                  <span>How to Install on Android:</span>
                </div>
                <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside pl-1">
                  <li>Open this URL in <strong>Google Chrome</strong> or <strong>Edge</strong> on your Android phone.</li>
                  <li>Tap the <strong>three dots menu (⋮)</strong> at the top-right corner.</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>The app icon will appear on your Android home screen and app drawer, running full screen like a native app!</li>
                </ol>
              </div>

              {/* Windows Guide */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 mb-1 text-sky-400 font-bold text-xs">
                  <Monitor className="w-4 h-4" />
                  <span>How to Install on Windows PC:</span>
                </div>
                <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside pl-1">
                  <li>Open this URL in <strong>Microsoft Edge</strong> or <strong>Google Chrome</strong> on Windows.</li>
                  <li>Click the <strong>Install App icon (⊕)</strong> on the right side of the URL address bar, or open browser menu <strong>(⋯) &gt; Apps &gt; Install this site as an app</strong>.</li>
                  <li>Click <strong>Install</strong>. It launches in its own dedicated window and can be pinned to your <strong>Windows Taskbar</strong> and <strong>Start Menu</strong>!</li>
                </ol>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={copyUrl}
                className="text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5"
              >
                {copiedLink ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">URL Copied!</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Copy App URL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
