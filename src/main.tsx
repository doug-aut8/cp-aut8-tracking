import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { captureUtmParams } from './utils/utmCapture'

// Capture UTM params from URL on initial page load
captureUtmParams();

createRoot(document.getElementById("root")!).render(<App />);
