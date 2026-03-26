/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import AIStudio from './components/AIStudio';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950">
        <AIStudio />
      </div>
    </ErrorBoundary>
  );
}
