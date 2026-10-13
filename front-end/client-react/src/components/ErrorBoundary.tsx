import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="standalone-state" role="alert">
        <h1>This page could not be displayed</h1>
        <p>Your saved records have not been changed.</p>
        <a className="btn btn-primary" href="/">
          Return to home
        </a>
      </div>
    ) : (
      this.props.children
    );
  }
}
