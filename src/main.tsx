import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { captureUtmParams } from './utils/utmCapture'
import { captureReferrer } from './utils/referrerCapture'
import { initVisitorLocation } from './utils/visitorLocation'

// Capture UTM params from URL on initial page load
captureUtmParams();
// Captura o referrer da entrada (usado nas métricas de fontes de tráfego)
captureReferrer();
// Estimativa da cidade do visitante (usada nas métricas de visitas/funil)
void initVisitorLocation();

createRoot(document.getElementById("root")!).render(<App />);
