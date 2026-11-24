import { CircleAlert } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { Msg } from '../i18n';
import { Button } from './ui';

interface Props {
  /** Changes when the user moves to another screen, which clears the notice. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
  resetKey: string;
}

/**
 * Keeps the header, the menu and the language selector on screen when a screen fails to
 * draw, for instance on an answer from the API in a shape nobody expected. Without it
 * the whole page goes blank.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="max-w-xl rounded-lg border border-bad bg-bad-tint p-4" data-testid="screen-error">
        <p className="flex items-start gap-2 font-semibold text-bad">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <Msg id="common:crash.title" />
        </p>
        <p className="mt-2">
          <Msg id="common:crash.body" />
        </p>
        <Button variant="secondary" className="mt-3" onClick={() => window.location.reload()}>
          <Msg id="common:crash.reload" />
        </Button>
      </div>
    );
  }
}
