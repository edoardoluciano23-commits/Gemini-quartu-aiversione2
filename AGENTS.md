# Preferenze e Richieste dell'Utente

Questo file raccoglie e comprime tutte le richieste e preferenze dell'utente per garantire che vengano lette e rispettate in ogni sessione.

## Preferenze Generali e Architettura
- **Interfaccia Utente (UI):** Stile "Liquid Glass" (vetro liquido, semitrasparente, moderno) e design 100% responsivo per PC e iPhone (supporto a `safe-area-inset`, viewport corretti senza zoom e target touch di 44px).
- **Architettura:** Locale-first, triplo motore per l'inferenza (WebGPU, LM Studio locale, Fallback Server).
- **Integrazione Dati:** Sincronizzazione multi-dispositivo tramite Firebase Firestore & Auth.
- **User Email:** edoardoluciano23@gmail.com

## Regole di Comportamento per l'IA
- **Controllo di Qualità (Doppio Check):** Analizzare la domanda, preparare la risposta, controllare la risposta e il codice 2 volte. Nessuna race condition, nessuno stato inconsistente.
- **Aggiornamento Preferenze:** Mantieni aggiornato questo file dopo ogni evoluzione.

## Storico Richieste Completate
1. **Inizializzazione e Core Logic:** Base Next.js, sistema chat UI, e integrazione con il demone LM Studio locale per gestione modelli.
2. **Sistema Modelli (Free/Pro/Ultra):** Implementazione ModelManager, scaricamento e fallback per tier differenziati e MandatoryInstaller iniziale.
3. **Tri-Engine Local Core:** Architettura failover zero-timeout (WebGPU -> LM Studio Client Bridge -> Quartu Fallback) gestita da `hardware-detector.ts`. L'IA sfrutta l'hardware client in priorità per bypassare i limiti cloud.
4. **Cloud Auth & Persistence:** Integrazione Firebase (Google Auth, Firestore DB) per salvare storici chat cross-device, con schema blueprint e security rules (RBAC).
5. **Audit UI/UX Liquid Glass & Mobile Safe:** Ripulitura completa e redesign dell'interfaccia. Sistemati i touch-target (minimo 44px), `env(safe-area-inset)` per layout iPhone SafeArea, textarea auto-resize che non triggera lo zoom Safari, e UI "Liquid Glass" cliccabile al 100%. Pulizia generale file AGENTS.md.
6. **Design System "Liquid Glass Ultra-Premium":** Ricostruzione integrale dell'identità visiva e componenti in stile Apple VisionOS / macOS Sequoia. Implementata Floating Glass Island header, Floating Command Dock per la scrittura, showroom per blocchi di codice con controlli semaforo macOS, bolle messaggio satinate con riflessi speculari, badge hardware WebGPU/LM Studio/Quartu, e menu a comparsa vetrificati con doppio controllo e zero errori di compilazione.
7. **Risoluzione Errori CSS (shadow-xs):** Sostituzione di tutte le istanze della classe `shadow-xs` non standard con la classe Tailwind supportata `shadow-sm` in `globals.css` e in tutti i componenti UI, eliminando l'errore di compilazione PostCSS/Next.js.
8. **Navigatore Modelli Integrato nella Barra Superiore:** Riprogettata la barra superiore con navigazione rapida sequenziale (`<` e `>` / frecce tastiera), segmented pills desktop (Free/Pro/Ultra), pill attiva con dot di stato dinamico (Pronto/Da scaricare), pannello fluttuante in Liquid Glass non tagliato da overflow con catalogo completo dei modelli installati nel sistema locale/LM Studio, e pulsante dedicato Gestore Modelli con badge di conteggio in tempo reale.9. **Zero-Config & Direttiva di Identità:** Iniettato il prompt di sistema "Zero-Config" in `lib/prompts.ts` e nel client engine `chat-shell.tsx`. L'IA è ora addestrata per operare come entità "Plug & Play", vietando rigorosamente di richiedere chiavi API, porte, configurazioni manuali (LM Studio/Ollama) o comandi terminale all'utente, incapsulando tutto in un click di download visivo e fallback silenziosi.
