import { Cast } from "@/components/Character";
import { Button } from "@/components/ui";
import { MODELS, numberWord } from "@/lib/models";

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="on-cobalt screen flex flex-1 flex-col items-center justify-center bg-cobalt px-5 py-12 text-center text-cobalt-ink">
      <Cast size={72} line="var(--color-cobalt-ink)" boil className="mb-8 max-w-md" />
      <h1 className="font-hand text-5xl leading-none font-normal sm:text-6xl">
        WHICH Ai
        <br />
        KNOWs YOU BEsT?
      </h1>
      <p className="mt-5 max-w-sm text-lg">{numberWord(MODELS.length, true)} AIs think they know you. Let&rsquo;s find out.</p>
      <Button variant="primary-on-cobalt" className="mt-8" onClick={onStart}>
        Start
      </Button>
      <p className="mt-4 text-sm opacity-80">About 10 minutes · 60 quick statements</p>
    </main>
  );
}
