// Step 2: the AIs guess first. The guesses stay hidden until the reveal.
import { Cast } from "@/components/Character";
import { Button } from "@/components/ui";

export function GuessingScreen({
  answered,
  total,
  error,
  onContinue,
  onBack,
}: {
  answered: number;
  total: number;
  error: string | null;
  onContinue: () => void;
  onBack: () => void;
}) {
  if (error) {
    return (
      <main className="screen mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <Cast size={48} className="mb-6" />
        <h1 className="text-2xl">The AIs couldn&rsquo;t guess this time</h1>
        <p className="mt-3 leading-relaxed">{error}</p>
        <Button className="mt-8" onClick={onBack}>
          Back
        </Button>
      </main>
    );
  }
  const done = answered >= total;
  return (
    <main className="on-cobalt screen flex flex-1 flex-col items-center justify-center bg-cobalt px-5 py-12 text-center text-cobalt-ink">
      <Cast size={64} line="var(--color-cobalt-ink)" scribble={!done} className="mb-8 max-w-md" />
      <h1 className="font-hand text-4xl leading-tight font-normal sm:text-5xl">
        {done ? `${total} AIs have made their guess` : `${total} AIs are guessing...`}
      </h1>
      <p className="mt-4 max-w-sm text-lg" aria-live="polite">
        {done
          ? "Their guesses are sealed until you finish."
          : `${answered} of ${total} done. They keep guessing while you take the test, and their guesses stay hidden until the end.`}
      </p>
      <Button variant="primary-on-cobalt" className="mt-8" onClick={onContinue}>
        Take the test
      </Button>
    </main>
  );
}
