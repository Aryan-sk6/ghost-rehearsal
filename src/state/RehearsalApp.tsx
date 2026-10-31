"use client";

import { ApiKeyForm } from "@/components/key/ApiKeyForm";
import { PrepScreen } from "@/components/prep/PrepScreen";
import { ScenarioPicker } from "@/components/picker/ScenarioPicker";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { SessionScreen } from "@/components/session/SessionScreen";
import { browserDeps, type RehearsalDeps } from "./deps";
import { useRehearsal } from "./useRehearsal";

export interface RehearsalAppProps {
  /** Injected in tests; defaults to the real browser wiring. */
  deps?: RehearsalDeps;
}

export function RehearsalApp({ deps = browserDeps }: RehearsalAppProps) {
  const { view, keyRejected, prep, session, results, actions } = useRehearsal(deps);

  if (view === "key") {
    return <ApiKeyForm onSubmit={actions.submitKey} rejected={keyRejected} />;
  }

  if (view === "results" && results !== null) {
    return (
      <ResultsScreen
        scenario={results.scenario}
        turns={results.turns}
        giveHistory={results.giveHistory}
        moodHistory={results.moodHistory}
        retry={results.retry}
        plan={results.plan}
        endReason={results.endReason}
        metrics={results.metrics}
        analysis={results.analysis}
        onRetryFrom={actions.retryFrom}
        onRetryAnalysis={actions.retryAnalysis}
        onNewKey={actions.requestNewKey}
        onRestart={actions.restart}
      />
    );
  }

  if (view === "prep" && prep !== null) {
    return (
      <PrepScreen
        key={prep.scenario.id}
        scenario={prep.scenario}
        initial={prep.initial}
        onStart={actions.startConversation}
        onBack={actions.backToPicker}
      />
    );
  }

  if (view === "session" && session !== null) {
    return (
      <SessionScreen
        title={session.title}
        counterpartRole={session.counterpartRole}
        turns={session.turns}
        mood={session.mood}
        userTurnCount={session.userTurnCount}
        phase={session.phase}
        interimText={session.interimText}
        inputKind={session.inputKind}
        mode={session.mode}
        notice={session.notice}
        error={session.error}
        onToggleMic={actions.toggleMic}
        onModeChange={actions.changeMode}
        onSendTyped={actions.sendTyped}
        onEnd={actions.endConversation}
        onRetry={actions.retry}
        onNewKey={actions.requestNewKey}
      />
    );
  }

  return <ScenarioPicker onPick={actions.pickScenario} />;
}
