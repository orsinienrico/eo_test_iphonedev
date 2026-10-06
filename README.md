# EO Test App

App web accessibile da browser (HTML/CSS/JS puro, nessuna build richiesta).

## Note riunione

Prima funzione dell'app: incolli le note o la trascrizione di una riunione e ottieni
decisioni, azioni (con owner e scadenza, se presenti), punti aperti e una bozza di email
di follow-up in italiano, copiabile o apribile in Mail.

L'estrazione usa regole su parole chiave italiane (e alcune inglesi): funziona offline,
senza servizi esterni. La logica è in `js/app.js` (`analyze` e `buildFollowup`).

## Struttura

```
index.html
css/style.css
js/app.js
```

## Come avviarla in locale

Apri semplicemente `index.html` nel browser, oppure avvia un server statico, ad esempio:

```bash
python3 -m http.server 8000
```

e visita `http://localhost:8000` (anche da un iPhone sulla stessa rete, usando l'IP del computer).
