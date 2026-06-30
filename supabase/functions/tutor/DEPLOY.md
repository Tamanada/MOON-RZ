# Déploiement du tuteur IA (Edge Function `tutor`)

Le chatbot de l'app appelle déjà `https://qouzioeghhlcwxkcxplj.supabase.co/functions/v1/tutor`.
Tant que la fonction n'est pas déployée, il **retombe automatiquement** sur le mode gratuit (mots-clés).
Une fois déployée + clé configurée, il répond avec **Claude (vraie IA)**.

> Compte Supabase : **factsornofact@gmail.com** · Projet : **qouzioeghhlcwxkcxplj**

## 1) Obtenir une clé API Anthropic
- https://console.anthropic.com → **API Keys** → *Create Key* → copie la clé (`sk-ant-...`).
- Ajoute un peu de crédit (la fonction utilise le modèle **Claude Haiku** = très bon marché).

## 2) Créer le secret dans Supabase
Dashboard du projet → **Edge Functions** → **Secrets** (ou *Project Settings → Edge Functions*) :
- Nom : `ANTHROPIC_API_KEY`
- Valeur : ta clé `sk-ant-...`
- Save.

(En CLI : `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`)

## 3) Déployer la fonction
**Option dashboard (le plus simple) :**
1. Dashboard → **Edge Functions** → *Create a function*.
2. Nom exact : **`tutor`**.
3. Colle tout le contenu de `index.ts` (ce dossier) dans l'éditeur.
4. **Deploy**.
5. Ouvre les **réglages de la fonction** et mets **Verify JWT = OFF**
   (la clé publishable `sb_publishable_...` n'est pas un JWT ; la fonction est un
   proxy public sans données sensibles — la vraie protection est que la clé
   Anthropic reste côté serveur + le CORS).

**Option CLI :**
```bash
supabase functions deploy tutor --no-verify-jwt --project-ref qouzioeghhlcwxkcxplj
```

## 4) Tester
Dans l'app (recharge 2×), ouvre la bulle 💬 et pose une question : tu verras les
3 points « … » puis une réponse rédigée par l'IA. Si erreur → repli automatique
sur le mode gratuit (donc jamais de page cassée).

Test direct (terminal) :
```bash
curl -s -X POST "https://qouzioeghhlcwxkcxplj.supabase.co/functions/v1/tutor" \
  -H "apikey: sb_publishable_Ikcwnh1ZbpG-Q8SyU-UJEQ_8UVosMW6" \
  -H "Content-Type: application/json" \
  -d '{"question":"C'\''est quoi le RSI ?","lang":"fr"}'
```

## Sécurité & coûts
- ✅ La clé Anthropic **ne quitte jamais le serveur** (secret Supabase). Le client n'a que la clé publishable (publique, sans danger).
- 💸 Modèle Haiku + `max_tokens:600` = coût minime. Pour limiter l'abus plus tard :
  ajouter un **rate-limit** (par IP via une table, ou un quota) et/ou restreindre le CORS.
- 🔁 Pour changer le ton/les règles du tuteur : édite le `SYSTEM(...)` dans `index.ts` et redéploie.
