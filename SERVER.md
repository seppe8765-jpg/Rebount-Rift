# Online spelen (samen met vrienden) - server zetten

De game zelf is één bestand (`dist/index.html`). Voor online/vrienden heb je daarnaast een kleine server nodig (`server/index.js`, geen dependencies).

1. Zet deze map (met `server/`, `src/`, `package.json`) in een GitHub-repo.
2. Maak bij een host die Node + WebSockets ondersteunt een "Web Service" van die repo (bv. Render, Railway, Fly.io):
   - Build command: leeg (er is niets te installeren)
   - Start command: `npm start`
   - De host geeft je een adres als `https://jouwspel.onrender.com`. Test: open `https://jouwspel.onrender.com/health` -> `{"ok":true,...}`.
3. Bouw de game met dat adres erin (https -> wss):
   `RR_SERVER=wss://jouwspel.onrender.com node build.mjs`
   Upload daarna het nieuwe `dist/index.html` (of de zip van `dist`) naar CrazyGames.
4. Test lokaal eerst: `node server/index.js`, open `dist/index.html?server=ws://localhost:8080` in twee tabbladen.

Let op: gratis hosts laten de server soms "slapen" (eerste verbinding duurt dan even); de game valt bij een onbereikbare server automatisch terug op offline tegen bots.
