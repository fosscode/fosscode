// Type declarations for ink-testing-library mock
declare module 'ink-testing-library' {
  export interface RenderResult {
    lastFrame(): string;
    rerender: () => void;
    unmount: () => void;
    stdin: {
      write: (data: string) => void;
    };
    stdout: {
      write: (data: string) => void;
    };
  }

  export function render(component: React.ReactElement): RenderResult;
}
