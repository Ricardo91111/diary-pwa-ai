import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true);

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS 无 beforeinstallprompt，仅通过 UA 显示提示
    if (ios) {
      const stored = localStorage.getItem("pwa_install_dismissed");
      if (!stored) setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [ios, dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    if (ios) localStorage.setItem("pwa_install_dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md px-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <button
          type="button"
          className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          onClick={handleDismiss}
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 pr-8">
          {deferredPrompt ? (
            <>
              <p className="text-sm font-medium text-gray-900">安装到手机</p>
              <p className="text-xs text-gray-500">添加到主屏幕，离线也可使用</p>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm active:scale-95"
                onClick={handleInstall}
              >
                <Download className="h-4 w-4" />
                安装
              </button>
            </>
          ) : ios ? (
            <>
              <p className="text-sm font-medium text-gray-900">添加到主屏幕</p>
              <p className="text-xs text-gray-600">
                点击 Safari 底部 <strong>分享</strong> → <strong>添加到主屏幕</strong>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
