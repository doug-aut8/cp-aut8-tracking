import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { captureUtmParams } from './utils/utmCapture'
import { initVisitorLocation } from './utils/visitorLocation'

// Capture UTM params from URL on initial page load
captureUtmParams();
// Estimativa da cidade do visitante (usada nas métricas de visitas/funil)
void initVisitorLocation();

createRoot(document.getElementById("root")!).render(<App />);
