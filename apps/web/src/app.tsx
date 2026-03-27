import { APP_NAME } from "@agent-mono/shared";
import { Button, Card } from "@agent-mono/ui";

export function App() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem" }}>
      <h1>{APP_NAME}</h1>
      <p>Enterprise Monorepo is ready! 🚀</p>

      <Card title="Welcome" description="This is a demo card from @agent-mono/ui">
        <p>The monorepo is set up with:</p>
        <ul>
          <li>📦 pnpm workspaces</li>
          <li>⚡ Turborepo for build orchestration</li>
          <li>🔧 Shared TypeScript & ESLint configs</li>
          <li>📝 Changesets for versioning</li>
        </ul>
      </Card>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  );
}
