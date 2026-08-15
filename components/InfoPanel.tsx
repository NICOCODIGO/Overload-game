"use client";

import { useRef } from "react";
import { FEEDBACK_URL, REPO_LABEL, SOCIALS } from "@/lib/links";
import { useT } from "@/lib/i18n";
import { PixelIcon } from "./PixelIcon";

/**
 * The ⓘ button and the panel behind it.
 *
 * Several of this arcade's rules are invisible while you play — that the daily
 * is the same worldwide and turns over at midnight UTC, that a streak wants
 * all nine games and doesn't care whether you won them, that nothing is saved
 * anywhere but this browser. A player can only ever infer those. This is where
 * they're written down, along with the way to tell me when something's wrong.
 *
 * Built on <dialog>: the browser gives focus trapping, Esc-to-close, inertness
 * of the page behind and the backdrop itself, all of which are easy to
 * hand-roll badly.
 */
export function InfoPanel() {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const github = SOCIALS.find((s) => s.label === REPO_LABEL)?.href;

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label={t.info.label}
        title={t.info.label}
        className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-line bg-panel shadow-chunk-sm transition-transform hover:-translate-y-0.5 hover:border-lemon active:translate-y-0.5 active:shadow-none"
      >
        <PixelIcon name="info" size={24} />
      </button>

      <dialog
        ref={ref}
        aria-labelledby="info-title"
        // Clicking the backdrop targets the dialog itself; clicking anything
        // inside targets a child, so this closes on outside clicks only.
        onClick={(e) => {
          if (e.target === ref.current) ref.current.close();
        }}
        className="m-auto max-h-[85svh] w-[92vw] max-w-lg overflow-y-auto rounded-2xl border-2 border-line bg-panel p-0 text-paper shadow-chunk backdrop:bg-ink/80"
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b-2 border-line bg-panel px-5 py-4">
          <h2 id="info-title" className="font-display text-base text-lemon">
            {t.info.title}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={t.info.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-line bg-panel2 transition-transform hover:border-coral active:translate-y-0.5"
          >
            <PixelIcon name="x" size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-5 py-5">
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xs tracking-[0.16em] text-mint">
              {t.info.howHeading}
            </h3>
            <ul className="flex flex-col gap-2">
              {t.info.how.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-fog">
                  <span aria-hidden className="text-lemon">
                    ▸
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="font-display text-xs tracking-[0.16em] text-mint">
              {t.info.faqHeading}
            </h3>
            {t.info.faq.map((item) => (
              <div key={item.q} className="flex flex-col gap-1">
                <p className="font-display text-xs text-paper">{item.q}</p>
                <p className="text-sm text-fog">{item.a}</p>
              </div>
            ))}
          </section>

          {FEEDBACK_URL && (
            <section className="flex flex-col gap-2 rounded-lg border-2 border-line bg-panel2 p-4">
              <h3 className="font-display text-xs tracking-[0.16em] text-coral">
                {t.info.feedbackHeading}
              </h3>
              <p className="text-sm text-fog">{t.info.feedbackLine}</p>
              <a
                href={FEEDBACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 self-start rounded-lg border-2 border-line bg-panel px-3 py-2 font-display text-xs text-paper shadow-chunk-sm transition-transform hover:-translate-y-0.5 hover:border-lemon active:translate-y-0.5 active:shadow-none"
              >
                {t.info.feedbackCta}
              </a>
            </section>
          )}

          {github && (
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 self-start font-display text-xs text-fog transition-colors hover:text-lemon"
            >
              <PixelIcon name="github" size={16} />
              {t.info.sourceCta}
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
