import { createRoot } from 'react-dom/client';
import './index.css'
import { Button } from '@shared/components/ui/button';
import { AppProvider } from './app/provider';

const container = document.querySelector('.root') as HTMLDivElement;
const root = createRoot(container);

root.render(
  <AppProvider/>
);
