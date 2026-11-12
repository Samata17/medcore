export function AuthHeading({ title, description }: { title: string; description: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
