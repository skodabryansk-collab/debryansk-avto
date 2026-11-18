import { useEffect, useState, type ComponentType } from 'react';

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

const modules = import.meta.glob('./mockups/**/*.tsx') as ModuleMap;

function resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const components = Object.values(mod).filter(
    (value) => typeof value === 'function',
  ) as ComponentType[];

  return (
    (mod.default as ComponentType) ||
    (mod[name] as ComponentType) ||
    components[components.length - 1]
  );
}

function PreviewRenderer({
  componentPath,
}: {
  componentPath: string;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = modules[`./mockups/${componentPath}.tsx`];

    if (!loader) {
      setError(`No component found at ${componentPath}.tsx`);
      return;
    }

    void loader()
      .then((module) => {
        if (cancelled) return;
        const component = resolveComponent(module, componentPath.split('/').pop()!);
        if (!component) {
          setError(`No exported component found in ${componentPath}.tsx`);
          return;
        }
        setComponent(() => component);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [componentPath]);

  if (error) {
    return <pre className="p-8 font-mono text-sm text-destructive">{error}</pre>;
  }
  return Component ? <Component /> : null;
}

function App() {
  const [previewPath, setPreviewPath] = useState(() =>
    window.location.hash.replace(/^#\/?/, '').replace(/\/$/, ''),
  );

  useEffect(() => {
    const onHashChange = () =>
      setPreviewPath(window.location.hash.replace(/^#\/?/, '').replace(/\/$/, ''));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (!previewPath) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <p className="font-mono text-xs uppercase tracking-[0.18em]">
          Meridian DevOps · Design system mockups
        </p>
      </main>
    );
  }

  return <PreviewRenderer componentPath={previewPath} />;
}

export default App;
