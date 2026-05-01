import { createRoot } from 'react-dom/client';
import './index.css';
import { AppProvider } from './app/provider';
import { ErrorBoundary } from './components/error-boundary';

const container = document.querySelector('.root') as HTMLDivElement;
const root = createRoot(container);

root.render(
  <ErrorBoundary>
    <AppProvider />
  </ErrorBoundary>
);
