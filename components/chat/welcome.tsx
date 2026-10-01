/**
 * The greeting on an empty chat. A CSS animation, one word after another,
 * so it moves the moment it paints and costs nothing after.
 */
export function Welcome({ name }: { name: string }) {
  const text = `Hey, ${name}. Ready to dive in?`;
  const words = text.split(" ");
  return (
    <h1 className="text-balance text-center text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink-50 sm:text-[34px]">
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="inline-block animate-word-rise motion-reduce:animate-none" style={{ animationDelay: `${index * 70}ms` }}>
            {word}
          </span>
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h1>
  );
}
