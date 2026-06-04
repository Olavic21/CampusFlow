import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[CampusFlow]', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center"
          role="alert"
        >
          <p className="text-4xl mb-4" aria-hidden="true">
            ⚠️
          </p>
          <h1 className="text-xl font-bold mb-2">Une erreur est survenue</h1>
          <p className="text-slate-400 text-sm max-w-md mb-6">
            L&apos;application a rencontré un problème inattendu. Rechargez la page ou réessayez.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-6 py-2.5 bg-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-500 transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
