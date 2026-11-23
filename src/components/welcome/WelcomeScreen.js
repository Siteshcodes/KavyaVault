import './welcome.css';
import { cloudLibraryService } from '../../services/cloud/CloudLibraryService.js';

export function mountWelcomeScreen(root, onGuest) {
  root.innerHTML = `<main class="welcome-screen"><div class="welcome-card">
    <p class="welcome-kicker">काव्यकलश · Kavyakalash</p>
    <h1>आपके शब्दों का अपना घर</h1><p class="welcome-intro">साहित्यिक धरोहर व पुस्तकालय<br/>Write, preserve and revisit your poetry.</p>
    <div class="welcome-options">
      <section><h2>अतिथि के रूप में / Continue as Guest</h2><p>बिना प्रवेश लिखें और पढ़ें। आपका लेखन इस डिवाइस पर रहेगा; क्लाउड में अपने आप सुरक्षित नहीं होगा।</p><button id="welcome-guest" class="btn-secondary-action">अतिथि के रूप में आगे बढ़ें / Continue as Guest</button></section>
      <section><h2>Google से प्रवेश / Continue with Google</h2><p>अपना निजी खाता और स्वचालित क्लाउड सिंक उपयोग करें। पहले से मौजूद अतिथि रचनाएँ आपकी अनुमति के बिना नहीं मिलाई जाएँगी।</p><label><input id="welcome-remember" type="checkbox" checked /> इस ब्राउज़र में प्रवेश बनाए रखें / Keep me signed in</label><button id="welcome-google" class="btn-primary-action">Google से प्रवेश करें / Sign in</button></section>
    </div><p id="welcome-status" role="status" aria-live="polite"></p>
  </div></main>`;
  root.querySelector('#welcome-guest').addEventListener('click', onGuest);
  root.querySelector('#welcome-google').addEventListener('click', async () => {
    const button = root.querySelector('#welcome-google'); button.disabled = true;
    root.querySelector('#welcome-status').textContent = 'प्रवेश खुल रहा है… / Opening sign-in…';
    try { await cloudLibraryService.signIn(root.querySelector('#welcome-remember').checked); }
    catch (error) { root.querySelector('#welcome-status').textContent = error.message; button.disabled = false; }
  });
}
