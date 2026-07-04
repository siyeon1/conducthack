// useTypewriter.js — typewriter-animated placeholder suggestions for the change-request bar.
//
// While `active`, cycles through `prompts`: types each out character-by-character (with a ▌
// cursor), holds, deletes, moves to the next. Exposes both the animated `placeholder` text and
// the full `suggestion` currently in rotation — the component uses the latter for Tab-to-accept.
// Respects prefers-reduced-motion (static first suggestion, no animation). Timers are fully
// cleaned up on deactivate/unmount so there are no ghost updates.
import { useEffect, useState } from "react";

const TYPE_MS = 45;
const DELETE_MS = 22;
const HOLD_MS = 1800;
const GAP_MS = 450;
const CURSOR = "▌";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useTypewriterPlaceholder(prompts, { active = true, fallback = "" } = {}) {
  const [text, setText] = useState("");
  // The full prompt currently in rotation. Deliberately NOT reset on deactivate — when the user
  // focuses the bar (animation stops), Tab-to-accept still targets the last shown suggestion.
  const [suggestion, setSuggestion] = useState(prompts[0] || "");

  useEffect(() => {
    if (!active || !prompts.length) return undefined;
    if (prefersReducedMotion()) {
      setText(prompts[0]);
      setSuggestion(prompts[0]);
      return undefined;
    }

    let i = 0;
    let pos = 0;
    let phase = "typing"; // typing → holding → deleting → (next prompt) typing
    let timer = null;
    let alive = true;
    setSuggestion(prompts[0]);

    const tick = () => {
      if (!alive) return;
      const prompt = prompts[i];
      if (phase === "typing") {
        pos += 1;
        setText(prompt.slice(0, pos) + CURSOR);
        if (pos >= prompt.length) {
          phase = "holding";
          timer = setTimeout(tick, HOLD_MS);
        } else {
          timer = setTimeout(tick, TYPE_MS);
        }
      } else if (phase === "holding") {
        phase = "deleting";
        timer = setTimeout(tick, DELETE_MS);
      } else {
        pos -= 1;
        setText(pos > 0 ? prompt.slice(0, pos) + CURSOR : "");
        if (pos <= 0) {
          i = (i + 1) % prompts.length;
          setSuggestion(prompts[i]);
          phase = "typing";
          timer = setTimeout(tick, GAP_MS);
        } else {
          timer = setTimeout(tick, DELETE_MS);
        }
      }
    };

    timer = setTimeout(tick, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, prompts.join("|")]);

  return { placeholder: active ? text : fallback, suggestion };
}
