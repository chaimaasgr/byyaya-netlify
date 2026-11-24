# By Yaya – version Netlify

Catalogue, panier et commande pour les clients (`/`), espace admin protégé par mot de passe (`/admin`).
Les articles, photos et commandes sont stockés dans **Netlify Blobs** (rien à installer ni à payer en plus).

## Mise en ligne
1. Créez un dépôt sur https://github.com et envoyez-y ce dossier (VS Code : onglet « Contrôle de code source » → « Publier sur GitHub »).
2. Sur https://app.netlify.com : **Add new site → Import an existing project → GitHub** → choisissez le dépôt. Laissez les réglages par défaut (le fichier `netlify.toml` configure tout).
3. Avant de valider, ouvrez **Site configuration → Environment variables** et ajoutez `ADMIN_PASSWORD` = votre mot de passe.
4. Cliquez sur **Deploy**. Votre site est en ligne sur `https://nom.netlify.app` ; l'admin est sur `https://nom.netlify.app/admin`.

Pour changer le mot de passe plus tard : modifiez la variable puis **Deploys → Trigger deploy**.

## Test en local (facultatif)
`npm install -g netlify-cli` puis, dans ce dossier : `npm install` et `netlify dev` → http://localhost:8888
