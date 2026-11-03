# TP1 · Forker, cloner, lancer DELAP, premier commit

**Objectif :** avoir votre propre copie du dépôt DELAP sur GitHub et sur votre poste, l'app qui tourne, le test qui passe, et une première pull request fusionnée.
C'est le socle de tous les TP suivants : chaque séance repartira de ce fork.

Durée : 50 min. Séance : S1 · Le DevSecOps et Git.

## Prérequis

- Git installé (`git --version`), Docker Desktop installé et démarré (`docker --version`), VS Code.
- Un compte GitHub.
- Windows : travaillez dans Git Bash ou WSL2.
- Git configuré avec votre nom et votre e-mail (sinon, étape 1).

## Étapes

### 1. Vérifier son poste

```bash
git --version
docker --version
git config --global user.name "Prénom Nom"
git config --global user.email "vous@example.com"
```

**Ce qui doit marcher :** les deux commandes affichent une version. `git config --global --list` montre votre nom et votre e-mail.

### 2. Forker puis cloner

1. Sur GitHub, ouvrez `https://github.com/koresha/delap-greenops` et cliquez sur **Fork** (en haut à droite). Gardez le nom `delap-greenops`, validez.
2. Clonez **votre fork** (pas celui de `koresha`) :

```bash
git clone https://github.com/<votre-compte>/delap-greenops.git
cd delap-greenops
git remote -v
```

**Ce qui doit marcher :** `git remote -v` affiche `origin` avec **votre** compte dans l'URL. Le dossier contient `app/`, `tests/`, `Dockerfile`, `k8s/`, `TP1/`… `TP8/`.

### 3. Lancer DELAP

Sans rien installer : ouvrez `app/index.html` dans votre navigateur (double-clic, ou glisser-déposer dans une fenêtre).

Avec Docker (si Docker Desktop tourne) :

```bash
docker build -t delap .
docker run --rm -p 8080:80 delap
# puis http://localhost:8080 dans le navigateur ; Ctrl+C pour arrêter
```

**Ce qui doit marcher :** la page « DELAP · Combien avez-vous recyclé ? » s'affiche. Entrez quelques valeurs, cliquez **Calculer** : le CO₂ et les déchets évités apparaissent.

### 4. Lancer le test

```bash
node tests/greenops.test.js
```

**Ce qui doit marcher :** la commande affiche `Tests OK`. (Pas de `node` ? Installez Node.js LTS depuis https://nodejs.org, ou utilisez Docker : `docker run --rm -v "$PWD:/w" -w /w node:22-alpine node tests/greenops.test.js`.)

### 5. Premier commit, première pull request

Une branche, une petite modification, un commit, un push, une PR, un merge. Le geste complet.

```bash
git switch -c tp1-version
```

Dans `app/config.js`, changez `version: "1.0.0"` en `version: "1.0.1"`. Rien d'autre (la clé `apiKey` est le sujet du TP2, laissez-la).

```bash
node tests/greenops.test.js            # toujours Tests OK
git status                             # app/config.js modifié
git add app/config.js
git commit -m "TP1 : version 1.0.1"
git push -u origin tp1-version
```

Puis sur GitHub, dans **votre fork** :

1. Un bandeau propose **Compare & pull request** : cliquez.
2. Vérifiez que la base est `<votre-compte>/delap-greenops` branche `main` (et pas `koresha/…`). Si GitHub propose `koresha`, cliquez sur **base repository** et choisissez votre fork.
3. Donnez un titre, cliquez **Create pull request**.
4. Cliquez **Merge pull request**, puis **Confirm merge**.

De retour sur votre poste :

```bash
git switch main
git pull
git log --oneline -3
```

**Ce qui doit marcher :** `git log` montre votre commit « TP1 : version 1.0.1 » (et le commit de merge) sur `main`. En ouvrant `app/index.html`, le pied de page affiche `v1.0.1`.

## Validation

- [ ] `git remote -v` pointe sur **mon** fork.
- [ ] DELAP s'affiche dans le navigateur et un calcul fonctionne.
- [ ] `node tests/greenops.test.js` affiche `Tests OK`.
- [ ] Une pull request `tp1-version` est **fusionnée** dans le `main` de mon fork.
- [ ] `git log --oneline -3` sur `main` montre le commit « TP1 : version 1.0.1 ».

## Si ça coince

1. **« Please tell me who you are » au moment du commit.** Git ne connaît pas votre nom : refaites les deux `git config --global` de l'étape 1, puis relancez le `git commit`.
2. **La PR propose `koresha/delap-greenops` comme base.** C'est le dépôt d'origine, pas le vôtre : changez **base repository** pour votre fork. Si vous l'avez déjà créée vers `koresha`, fermez-la (**Close pull request**) et recommencez.
3. **`docker: Cannot connect to the Docker daemon` ou `port is already allocated`.** Docker Desktop n'est pas démarré (lancez-le et attendez l'icône verte), ou le port 8080 est pris : utilisez `-p 8081:80` et ouvrez http://localhost:8081. Dans tous les cas, `app/index.html` ouvert directement suffit pour valider le TP.

## Pour aller plus loin

- Stéphane Robert, cours Git (en français, cité avec son autorisation) : https://www.stephane-robert.info/docs/
- Documentation officielle Git, « Pro Git » en français, chapitres 1 à 3 : https://git-scm.com/book/fr/v2
- GitHub Docs, forker un dépôt et ouvrir une pull request : https://docs.github.com/fr/pull-requests
