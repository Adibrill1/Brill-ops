'use client';

import { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Add Brill Ops to your Home Screen".
 *
 * Chrome on Android fires `beforeinstallprompt` and we can trigger the native
 * installer. iOS Safari fires nothing and has no install API at all, so the only
 * honest option there is to show the manual Share -> Add to Home Screen steps.
 * Hence the two branches.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIos =
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else {
      setShowIosSteps(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-slate-50 active:translate-y-px"
      >
        <Smartphone className="h-4 w-4" aria-hidden />
        Add Brill Ops to your Home Screen
      </button>

      {showIosSteps && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
          onClick={() => setShowIosSteps(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 id="install-title" className="text-base font-semibold text-ink">
                Install Brill Ops
              </h2>
              <button
                type="button"
                onClick={() => setShowIosSteps(false)}
                aria-label="Close"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-ink-faint hover:bg-slate-100 hover:text-ink active:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIos ? (
              <ol className="mt-4 space-y-3 text-sm text-ink-muted">
                <li className="flex gap-2">
                  <span className="font-semibold text-ink">1.</span>
                  <span className="flex items-center gap-1">
                    Tap the Share button <Share className="inline h-4 w-4" aria-hidden /> in
                    Safari&rsquo;s toolbar
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-ink">2.</span>
                  <span>Scroll down and choose <strong>Add to Home Screen</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-ink">3.</span>
                  <span>Tap <strong>Add</strong></span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-sm text-ink-muted">
                <li className="flex gap-2">
                  <span className="font-semibold text-ink">1.</span>
                  <span>Open your browser menu (⋮)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-ink">2.</span>
                  <span>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong></span>
                </li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
