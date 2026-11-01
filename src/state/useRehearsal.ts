"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MIC_DENIED_COPY,
  VOICE_UNSUPPORTED_COPY,
  describeLlmError,
} from "@/components/errors/errorCopy";
import type { AnalysisState } from "@/components/results/ResultsScreen";
import type { RetrySnapshot } from "@/components/results/reveal";
import type {
  InputKind,
  SessionError,
  SessionPhase,
  TranscriptTurn,
} from "@/components/session/SessionScreen";
import { CUT_IN_AFTER_MS, MIN_USER_TURNS_FOR_ANALYSIS } from "@/contracts/constants";
import { LlmError, RehearsalError } from "@/contracts/errors";
import type { LlmClient } from "@/contracts/llm";
import type { SpeechBundle, SpeechError, SpeechMode, Unsubscribe, Utterance } from "@/contracts/speech";
import type {
  EndReason,
  Mood,
  Scenario,
  Session,
  SessionMetrics,
  Turn,
} from "@/contracts/types";
import {
  addCounterpartTurn,
  addOpeningTurn,
  addUserTurn,
  countUserTurns,
  createSession,
  cutInReply,
  endSession,
  requestCounterpartReply,
} from "@/lib/conversation";
import { computeMetrics, hasPlan, replayFrom, requestAnalysis, type PrepPlan } from "@/lib/analysis";
import {
  addEntry,
  entryFromSession,
  progressFor,
  summarizeByScenario,
  type HistoryEntry,
  type ScenarioProgress,
  type ScenarioSummary,
} from "@/lib/history";
import { createSpeechQueue, linkBargeIn, type SpeechQueue } from "@/lib/speech";
import type { RehearsalDeps } from "./deps";

export type RehearsalView = "key" | "picker" | "prep" | "session" | "results";

/** What the session screen needs. Deliberately has no give and no hidden bottom line. */
export interface SessionViewModel {
  title: string;
  counterpartRole: string;
  turns: readonly TranscriptTurn[];
  mood: Mood;
  userTurnCount: number;
  phase: SessionPhase;
  interimText: string;
  inputKind: InputKind;
  mode: SpeechMode;
  notice: string | undefined;
  error: SessionError | null;
}

export interface ResultsViewModel {
  scenario: Scenario;
  turns: readonly Turn[];
  giveHistory: readonly number[];
  moodHistory: readonly Mood[];
  /** The attempt this one retried from, if it came from "Retry from here". */
  retry: RetrySnapshot | null;
  /** What the user planned on the prep screen, if they wrote anything. */
  plan: PrepPlan | null;
  /** This attempt as saved, and how it compares with earlier ones. Null if nothing is saved. */
  progress: { entry: HistoryEntry; progress: ScenarioProgress } | null;
  endReason: EndReason;
  metrics: SessionMetrics;
  analysis: AnalysisState;
}

/** The prep screen shown between picking a scenario and the conversation. */
export interface PrepViewModel {
  scenario: Scenario;
  initial: PrepPlan | null;
}

export interface RehearsalActions {
  submitKey(key: string): void;
  pickScenario(scenario: Scenario): void;
  startConversation(plan: PrepPlan): void;
  backToPicker(): void;
  clearHistory(): void;
  toggleMic(): void;
  changeMode(mode: SpeechMode): void;
  sendTyped(text: string): void;
  endConversation(): void;
  retry(): void;
  requestNewKey(): void;
  retryAnalysis(): void;
  retryFrom(turnIndex: number): void;
  restart(): void;
}

export interface UseRehearsal {
  view: RehearsalView;
  keyRejected: boolean;
  prep: PrepViewModel | null;
  /** One row per scenario practised, for the picker. */
  history: ScenarioSummary[];
  session: SessionViewModel | null;
  results: ResultsViewModel | null;
  actions: RehearsalActions;
}

type Resume = "counterpart" | "analysis" | null;

function errorKind(error: unknown) {
  return error instanceof LlmError ? error.kind : "unknown";
}

function isKeyProblem(error: unknown): boolean {
  return error instanceof LlmError && (error.kind === "invalid_key" || error.kind === "missing_key");
}

function lastMood(session: Session): Mood {
  return session.moodHistory[session.moodHistory.length - 1] ?? "neutral";
}

export function useRehearsal(deps: RehearsalDeps): UseRehearsal {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // Visible state.
  const [view, setView] = useState<RehearsalView>("key");
  const [keyRejected, setKeyRejected] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhaseState] = useState<SessionPhase>("idle");
  const [interimText, setInterimText] = useState("");
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [inputKind, setInputKind] = useState<InputKind>("voice");
  const [mode, setModeState] = useState<SpeechMode>("push-to-talk");
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [error, setError] = useState<SessionError | null>(null);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "loading" });
  const [retrySnapshot, setRetrySnapshot] = useState<RetrySnapshot | null>(null);
  const [prepScenario, setPrepScenario] = useState<Scenario | null>(null);
  /** The plan from the latest start, kept so picking the same scenario again starts filled in. */
  const [history, setHistory] = useState<HistoryEntry[]>(() => deps.history?.load() ?? []);
  const [savedEntry, setSavedEntry] = useState<HistoryEntry | null>(null);
  const [lastPlan, setLastPlan] = useState<{ scenarioId: string; plan: PrepPlan } | null>(null);

  // Mutable mirrors, so long-lived callbacks never read stale render state.
  const sessionRef = useRef<Session | null>(null);
  const phaseRef = useRef<SessionPhase>("idle");
  const modeRef = useRef<SpeechMode>("push-to-talk");
  const apiKeyRef = useRef<string | null>(null);
  const llmRef = useRef<LlmClient | null>(null);
  const bundleRef = useRef<SpeechBundle | null>(null);
  const unsubsRef = useRef<Unsubscribe[]>([]);
  const busyRef = useRef(false);
  /** Bumped whenever in-flight work must be abandoned (end, replay, restart, unmount). */
  const runRef = useRef(0);
  const pendingResumeRef = useRef<Resume>(null);
  const yourTurnSinceRef = useRef(0);
  const historyRef = useRef(history);
  const isRetryRef = useRef(false);
  /** The reply being spoken right now, piece by piece. */
  const queueRef = useRef<SpeechQueue | null>(null);
  const cutInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set when the cut-in timer stopped the mic, so the utterance that follows gets cut in on. */
  const cutInDueRef = useRef(false);

  const setPhase = useCallback((next: SessionPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const commit = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const getLlm = useCallback((): LlmClient => {
    if (llmRef.current === null) {
      llmRef.current = depsRef.current.createLlm(apiKeyRef.current ?? "");
    }
    return llmRef.current;
  }, []);

  const clearCutIn = useCallback(() => {
    if (cutInTimerRef.current !== null) clearTimeout(cutInTimerRef.current);
    cutInTimerRef.current = null;
  }, []);

  /** Starts the clock when the user starts talking; at the limit, the mic is stopped and they get cut in on. */
  const armCutIn = useCallback(() => {
    clearCutIn();
    cutInDueRef.current = false;
    if (busyRef.current || sessionRef.current?.status !== "awaiting_user") return;
    const run = runRef.current;
    cutInTimerRef.current = setTimeout(() => {
      cutInTimerRef.current = null;
      const input = bundleRef.current?.input;
      if (run !== runRef.current || busyRef.current || !input?.isListening()) return;
      cutInDueRef.current = true;
      input.stop();
    }, depsRef.current.cutInAfterMs ?? CUT_IN_AFTER_MS);
  }, [clearCutIn]);

  const detach = useCallback(() => {
    clearCutIn();
    for (const unsub of unsubsRef.current) unsub();
    unsubsRef.current = [];
  }, [clearCutIn]);

  const teardownSpeech = useCallback(() => {
    detach();
    const bundle = bundleRef.current;
    bundleRef.current = null;
    if (!bundle) return;
    bundle.output.cancel();
    if (bundle.input.isListening()) bundle.input.stop();
  }, [detach]);

  /** Where the phase settles once nothing is in flight. */
  const idlePhase = useCallback((): SessionPhase => {
    return bundleRef.current?.input.isListening() ? "listening" : "your-turn";
  }, []);

  const markYourTurn = useCallback(
    (next: SessionPhase) => {
      yourTurnSinceRef.current = depsRef.current.now();
      setPhase(next);
    },
    [setPhase],
  );

  // ---- results ----

  const runAnalysis = useCallback(
    async (ended: Session, computed: SessionMetrics) => {
      const run = runRef.current;
      if (countUserTurns(ended) < MIN_USER_TURNS_FOR_ANALYSIS) {
        setAnalysis({ status: "too-short" });
        return;
      }
      setAnalysis({ status: "loading" });
      try {
        const result = await requestAnalysis(ended, computed, getLlm());
        if (run !== runRef.current) return;
        setAnalysis({ status: "ready", analysis: result });
      } catch (caught) {
        if (run !== runRef.current) return;
        if (caught instanceof RehearsalError && caught.code === "too_short_for_analysis") {
          setAnalysis({ status: "too-short" });
          return;
        }
        if (isKeyProblem(caught)) pendingResumeRef.current = "analysis";
        setAnalysis({ status: "error", error: describeLlmError(errorKind(caught)) });
      }
    },
    [getLlm],
  );

  const remember = useCallback((ended: Session) => {
    const store = depsRef.current.history;
    if (store === undefined) return;
    const entry = entryFromSession(ended, { endedAtMs: depsRef.current.now(), retry: isRetryRef.current });
    const next = addEntry(historyRef.current, entry);
    historyRef.current = next;
    store.save(next);
    setHistory(next);
    setSavedEntry(entry);
  }, []);

  const goToResults = useCallback(
    (ended: Session) => {
      remember(ended);
      const computed = computeMetrics(ended);
      setMetrics(computed);
      setError(null);
      setPhase("idle");
      setSpeakingText(null);
      setInterimText("");
      setView("results");
      void runAnalysis(ended, computed);
    },
    [remember, runAnalysis, setPhase],
  );

  const goToKeyScreen = useCallback(
    (resume: Resume) => {
      pendingResumeRef.current = resume;
      setError(null);
      setKeyRejected(true);
      setView("key");
    },
    [],
  );

  // ---- the counterpart's turn ----

  const counterpartStep = useCallback(
    async (current: Session, opts: { cutIn?: boolean } = {}) => {
      const run = runRef.current;
      busyRef.current = true;
      setError(null);
      setPhase("thinking");
      const queue = createSpeechQueue(bundleRef.current?.output, depsRef.current.now);
      queueRef.current = queue;
      let said = "";
      // Each safe piece is spoken as soon as it arrives, while the rest is still being written.
      const speakable = (text: string) => {
        if (run !== runRef.current) {
          queue.stop();
          return;
        }
        if (said === "") setPhase("speaking");
        said = said === "" ? text : `${said} ${text}`;
        setSpeakingText(said);
        queue.push(text);
      };
      let reply;
      try {
        if (opts.cutIn === true) {
          reply = cutInReply(current);
          speakable(reply.reply);
        } else {
          reply = await requestCounterpartReply(current, getLlm(), { onSpeakable: speakable });
        }
      } catch (caught) {
        if (run !== runRef.current) return;
        queueRef.current = null;
        busyRef.current = false;
        if (isKeyProblem(caught)) {
          setPhase("idle");
          goToKeyScreen("counterpart");
          return;
        }
        setPhase("idle");
        setError(describeLlmError(errorKind(caught)));
        return;
      }
      if (run !== runRef.current) return;
      if (said === "") speakable(reply.reply);
      const spoken = await queue.done();
      if (run !== runRef.current) return;
      queueRef.current = null;

      const next = addCounterpartTurn(current, reply, {
        startedAtMs: spoken.startedAtMs,
        endedAtMs: spoken.endedAtMs,
      });
      commit(next);
      setSpeakingText(null);
      busyRef.current = false;
      if (next.status === "ended") {
        bundleRef.current?.output.cancel();
        goToResults(next);
        return;
      }
      // The cut-in stopped the mic; in continuous mode, carry on listening.
      const input = bundleRef.current?.input;
      if (opts.cutIn === true && modeRef.current === "continuous" && input && !input.isListening()) input.start();
      markYourTurn(idlePhase());
    },
    [commit, getLlm, goToKeyScreen, goToResults, idlePhase, markYourTurn, setPhase],
  );

  const handleUserText = useCallback(
    (text: string, timing: { startedAtMs: number; endedAtMs: number }) => {
      const cutIn = cutInDueRef.current;
      cutInDueRef.current = false;
      clearCutIn();
      const current = sessionRef.current;
      if (busyRef.current || current === null || current.status !== "awaiting_user") return;
      if (text.trim() === "") {
        if (phaseRef.current === "listening") setPhase("your-turn");
        return;
      }
      let next: Session;
      try {
        next = addUserTurn(current, text, timing);
      } catch {
        return;
      }
      setInterimText("");
      commit(next);
      void counterpartStep(next, { cutIn });
    },
    [clearCutIn, commit, counterpartStep, setPhase],
  );

  // ---- speech wiring ----

  const handleSpeechError = useCallback(
    (speechError: SpeechError) => {
      switch (speechError.kind) {
        case "not-allowed":
        case "audio-capture":
          setInputKind("typed");
          setNotice(MIC_DENIED_COPY);
          break;
        case "unsupported":
          setInputKind("typed");
          setNotice(VOICE_UNSUPPORTED_COPY);
          break;
        default:
          break;
      }
      setInterimText("");
      if (!busyRef.current && phaseRef.current === "listening") setPhase("your-turn");
    },
    [setPhase],
  );

  const attachSpeech = useCallback(
    (bundle: SpeechBundle) => {
      const { input, output } = bundle;
      unsubsRef.current = [
        linkBargeIn(input, output),
        input.onSpeechStart(() => {
          // Talking over the gap between two sentences also stops the rest of the reply.
          if (queueRef.current?.hasStarted() === true) queueRef.current.stop();
          armCutIn();
        }),
        input.onResult((result) => setInterimText(result.text)),
        input.onUtterance((utterance: Utterance) =>
          handleUserText(utterance.text, {
            startedAtMs: utterance.startedAtMs,
            endedAtMs: utterance.endedAtMs,
          }),
        ),
        input.onError(handleSpeechError),
        input.onEnd(() => {
          clearCutIn();
          setInterimText("");
          if (!busyRef.current && phaseRef.current === "listening") setPhase("your-turn");
        }),
      ];
    },
    [armCutIn, clearCutIn, handleSpeechError, handleUserText, setPhase],
  );

  const openSpeech = useCallback(
    (nextMode: SpeechMode) => {
      teardownSpeech();
      const bundle = depsRef.current.createSpeech({ mode: nextMode });
      bundleRef.current = bundle;
      attachSpeech(bundle);
      if (!bundle.support.recognition) {
        setInputKind("typed");
        setNotice(VOICE_UNSUPPORTED_COPY);
      }
    },
    [attachSpeech, teardownSpeech],
  );

  // ---- actions ----

  const pickScenario = useCallback((scenario: Scenario) => {
    setPrepScenario(scenario);
    setView("prep");
  }, []);

  const backToPicker = useCallback(() => {
    setPrepScenario(null);
    setView("picker");
  }, []);

  const beginSession = useCallback(
    (scenario: Scenario) => {
      runRef.current += 1;
      const run = runRef.current;
      busyRef.current = true;
      setInputKind("voice");
      setNotice(undefined);
      setError(null);
      setInterimText("");
      setMetrics(null);
      setAnalysis({ status: "loading" });
      setRetrySnapshot(null);
      isRetryRef.current = false;
      setSavedEntry(null);
      openSpeech(modeRef.current);

      const created = createSession(scenario, {
        id: depsRef.current.newId(),
        nowMs: depsRef.current.now(),
      });
      commit(created);
      setView("session");
      setPhase("speaking");
      setSpeakingText(scenario.openingLine);

      void (async () => {
        const output = bundleRef.current?.output;
        const spoken = output
          ? await output.speak(scenario.openingLine)
          : { startedAtMs: depsRef.current.now(), endedAtMs: depsRef.current.now() };
        if (run !== runRef.current) return;
        const opened = addOpeningTurn(created, {
          startedAtMs: spoken.startedAtMs,
          endedAtMs: spoken.endedAtMs,
        });
        commit(opened);
        setSpeakingText(null);
        busyRef.current = false;
        markYourTurn(idlePhase());
      })();
    },
    [commit, idlePhase, markYourTurn, openSpeech, setPhase],
  );

  const startConversation = useCallback(
    (plan: PrepPlan) => {
      if (prepScenario === null) return;
      setLastPlan({ scenarioId: prepScenario.id, plan });
      setPrepScenario(null);
      beginSession(prepScenario);
    },
    [beginSession, prepScenario],
  );

  const submitKey = useCallback(
    (key: string) => {
      apiKeyRef.current = key;
      llmRef.current = null;
      setKeyRejected(false);
      const resume = pendingResumeRef.current;
      pendingResumeRef.current = null;
      const current = sessionRef.current;
      if (resume === "counterpart" && current && current.status === "awaiting_counterpart") {
        setView("session");
        void counterpartStep(current);
      } else if (resume === "analysis" && current && current.status === "ended") {
        setView("results");
        const computed = computeMetrics(current);
        setMetrics(computed);
        void runAnalysis(current, computed);
      } else if (current === null) {
        setView("picker");
      } else {
        setView(current.status === "ended" ? "results" : "session");
      }
    },
    [counterpartStep, runAnalysis],
  );

  const toggleMic = useCallback(() => {
    const bundle = bundleRef.current;
    if (!bundle || phaseRef.current === "thinking") return;
    if (bundle.input.isListening()) {
      bundle.input.stop();
      return;
    }
    if (bundle.output.isSpeaking()) bundle.output.cancel();
    queueRef.current?.stop();
    setInterimText("");
    bundle.input.start();
    setPhase("listening");
  }, [setPhase]);

  const changeMode = useCallback(
    (next: SpeechMode) => {
      if (next === modeRef.current || busyRef.current) return;
      modeRef.current = next;
      setModeState(next);
      if (bundleRef.current) {
        const wasPhase = phaseRef.current;
        openSpeech(next);
        if (wasPhase === "listening") setPhase("your-turn");
      }
    },
    [openSpeech, setPhase],
  );

  const sendTyped = useCallback(
    (text: string) => {
      const now = depsRef.current.now();
      handleUserText(text, {
        startedAtMs: Math.min(yourTurnSinceRef.current, now),
        endedAtMs: now,
      });
    },
    [handleUserText],
  );

  const endConversation = useCallback(() => {
    const current = sessionRef.current;
    if (current === null || current.status === "ended") return;
    runRef.current += 1;
    busyRef.current = false;
    // Commit the ended session first so a late utterance from stop() is ignored.
    const ended = endSession(current, depsRef.current.now());
    commit(ended);
    const bundle = bundleRef.current;
    if (bundle) {
      bundle.output.cancel();
      if (bundle.input.isListening()) bundle.input.stop();
    }
    goToResults(ended);
  }, [commit, goToResults]);

  const retry = useCallback(() => {
    const current = sessionRef.current;
    if (current === null || current.status !== "awaiting_counterpart" || busyRef.current) return;
    void counterpartStep(current);
  }, [counterpartStep]);

  const requestNewKey = useCallback(() => {
    const current = sessionRef.current;
    if (current?.status === "ended") goToKeyScreen("analysis");
    else if (current?.status === "awaiting_counterpart") goToKeyScreen("counterpart");
    else goToKeyScreen(null);
  }, [goToKeyScreen]);

  const retryAnalysis = useCallback(() => {
    const current = sessionRef.current;
    if (current === null || current.status !== "ended") return;
    const computed = computeMetrics(current);
    setMetrics(computed);
    void runAnalysis(current, computed);
  }, [runAnalysis]);

  const retryFrom = useCallback(
    (turnIndex: number) => {
      const current = sessionRef.current;
      if (current === null) return;
      let rewound: Session;
      try {
        rewound = replayFrom(current, turnIndex);
      } catch {
        return;
      }
      runRef.current += 1;
      busyRef.current = false;
      isRetryRef.current = true;
      setSavedEntry(null);
      setRetrySnapshot({
        turnIndex,
        turns: current.turns,
        giveHistory: current.giveHistory,
        moodHistory: current.moodHistory,
      });
      commit(rewound);
      setError(null);
      setSpeakingText(null);
      setInterimText("");
      setMetrics(null);
      setAnalysis({ status: "loading" });
      setView("session");
      markYourTurn("your-turn");
    },
    [commit, markYourTurn],
  );

  const restart = useCallback(() => {
    runRef.current += 1;
    busyRef.current = false;
    teardownSpeech();
    commit(null);
    setError(null);
    setNotice(undefined);
    setSpeakingText(null);
    setInterimText("");
    setMetrics(null);
    setAnalysis({ status: "loading" });
    setRetrySnapshot(null);
    isRetryRef.current = false;
    setSavedEntry(null);
    setPrepScenario(null);
    setPhase("idle");
    setView("picker");
  }, [commit, setPhase, teardownSpeech]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    depsRef.current.history?.save([]);
    setHistory([]);
    setSavedEntry(null);
  }, []);

  useEffect(() => {
    return () => {
      runRef.current += 1;
      teardownSpeech();
    };
  }, [teardownSpeech]);

  // ---- view models ----

  const planFor = (scenarioId: string): PrepPlan | null =>
    lastPlan !== null && lastPlan.scenarioId === scenarioId ? lastPlan.plan : null;
  const prepModel: PrepViewModel | null =
    prepScenario === null ? null : { scenario: prepScenario, initial: planFor(prepScenario.id) };
  let sessionModel: SessionViewModel | null = null;
  let resultsModel: ResultsViewModel | null = null;
  if (session !== null) {
    const shown: TranscriptTurn[] = session.turns.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    }));
    if (speakingText !== null) shown.push({ speaker: "counterpart", text: speakingText });
    sessionModel = {
      title: session.scenario.title,
      counterpartRole: session.scenario.counterpartRole,
      turns: shown,
      mood: lastMood(session),
      userTurnCount: countUserTurns(session),
      phase,
      interimText,
      inputKind,
      mode,
      notice,
      error,
    };
    if (session.status === "ended" && metrics !== null) {
      resultsModel = {
        scenario: session.scenario,
        turns: session.turns,
        giveHistory: session.giveHistory,
        moodHistory: session.moodHistory,
        retry: retrySnapshot,
        plan: (() => {
          const plan = planFor(session.scenario.id);
          return hasPlan(plan) ? plan : null;
        })(),
        progress: savedEntry === null ? null : { entry: savedEntry, progress: progressFor(history, savedEntry) },
        endReason: session.endReason ?? "user_ended",
        metrics,
        analysis,
      };
    }
  }

  return {
    view,
    keyRejected,
    prep: prepModel,
    history: summarizeByScenario(history),
    session: sessionModel,
    results: resultsModel,
    actions: {
      submitKey,
      pickScenario,
      startConversation,
      backToPicker,
      clearHistory,
      toggleMic,
      changeMode,
      sendTyped,
      endConversation,
      retry,
      requestNewKey,
      retryAnalysis,
      retryFrom,
      restart,
    },
  };
}
