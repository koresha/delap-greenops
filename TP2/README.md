# TP2 · Les secrets : trouver, sortir, bloquer

**Objectif.** Trouver la clé qui traîne dans le code de DELAP avec gitleaks, la sortir du dépôt proprement, puis installer un hook pre-commit qui empêche qu'une autre clé y entre.
Durée : 50 min. Outil : gitleaks (en Docker, rien à installer).

## Prérequis

- TP1 terminé : votre fork de `delap-greenops` est cloné et vous êtes sur `main`.
- Docker Desktop lancé (`docker version` répond).
- Un terminal Bash (macOS/Linux : Terminal ; Windows : Git Bash ou WSL2).
- Toutes les commandes se lancent **depuis la racine du dépôt** (`cd delap-greenops`).

## Étape 1 · Scanner le dépôt

gitleaks lit l'historique Git et cherche des motifs de secrets (clés d'API, jetons, mots de passe).

```bash
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 git /repo
```

Pour voir le détail de chaque trouvaille (fichier, ligne, commit, empreinte) :

```bash
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 git /repo --verbose
```

**Ce qui doit marcher.** gitleaks affiche `leaks found: 1`, règle `generic-api-key`, fichier `app/config.js`, ligne 5. Notez la ligne `Fingerprint:` : vous en aurez besoin à l'étape 3. Elle ressemble à :

```
Fingerprint: 3ab63c26bee820963bf642f6f20fc50b24a87926:app/config.js:generic-api-key:5
```

(Le premier morceau est le commit où la clé est apparue. Si votre fork a le même historique que le dépôt d'origine, c'est exactement cette valeur.)

> Windows / Git Bash : si Docker se plaint du chemin, préfixez la commande par `MSYS_NO_PATHCONV=1`.

## Étape 2 · Sortir la clé du code

Dans la vraie vie, on commence par **révoquer** la clé chez le fournisseur (ici elle est fictive, on fait comme si). Ensuite seulement on nettoie le code.

1. Ouvrez `app/config.js` et remplacez la ligne `apiKey` par une valeur lue depuis l'environnement, vide par défaut :

   ```js
   // Clé d'accès à l'API partenaire : injectée par l'environnement au déploiement, jamais dans le code.
   apiKey: window.DELAP_API_KEY || "",
   ```

2. Créez `.env.example` à la racine (un modèle commité, sans valeur) :

   ```bash
   printf 'DELAP_API_KEY=\n' > .env.example
   ```

3. Vérifiez que `.env` est bien ignoré (il l'est déjà dans ce dépôt) :

   ```bash
   grep -n '^\.env$' .gitignore
   ```

4. Lancez l'app : elle doit fonctionner exactement comme avant (la clé n'était utilisée nulle part).

   ```bash
   node tests/greenops.test.js
   ```

**Ce qui doit marcher.** `git diff` montre la clé retirée de `config.js` ; `.env.example` existe ; `Tests OK` s'affiche.

## Étape 3 · Nettoyer le scan avec `.gitleaksignore`

La clé est partie du code, mais **pas de l'historique** : gitleaks la retrouvera à chaque scan. On ne réécrit pas l'historique d'un dépôt partagé ; on déclare la trouvaille comme traitée.

Créez `.gitleaksignore` à la racine avec l'empreinte relevée à l'étape 1 et un commentaire qui dit pourquoi :

```bash
cat > .gitleaksignore <<'EOF'
# Clé fictive publiée au premier commit : révoquée le 1er déc. 2026, retirée du code au TP2.
3ab63c26bee820963bf642f6f20fc50b24a87926:app/config.js:generic-api-key:5
EOF
```

Commitez le tout, puis rescannez :

```bash
git add app/config.js .env.example .gitleaksignore
git commit -m "TP2 : sortir la clé du code"
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 git /repo
```

**Ce qui doit marcher.** `no leaks found`, code de sortie 0 (`echo $?`).

## Étape 4 · Installer le hook pre-commit

Le script `TP2/pre-commit` lance gitleaks sur les fichiers indexés (`git add`) juste avant chaque commit, et refuse le commit si un secret est trouvé.

```bash
cp TP2/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Testez-le avec un faux secret :

```bash
printf 'const token = "ghp_q7Rk2mT9xLw4Pz8vN1cB6hJ3yF5aD0eGsU2W";\n' > test-secret.js
git add test-secret.js
git commit -m "test hook"
```

**Ce qui doit marcher.** Le commit est **refusé** avec le message `COMMIT REFUSÉ : gitleaks a trouvé un secret`. `git log --oneline` ne montre pas de commit « test hook ».

Nettoyez et vérifiez qu'un commit propre passe :

```bash
git rm --cached test-secret.js && rm test-secret.js
echo "- TP2 fait" >> README.md
git add README.md && git commit -m "TP2 : hook pre-commit installé"
git push
```

## Validation

- [ ] Le scan de l'étape 1 trouve `apiKey` dans `app/config.js`.
- [ ] `app/config.js` ne contient plus de valeur de clé ; `.env.example` est commité ; `.env` est ignoré.
- [ ] `.gitleaksignore` contient l'empreinte et un commentaire « révoquée ».
- [ ] Le scan complet de l'historique répond `no leaks found`.
- [ ] Le hook refuse un commit contenant un faux secret, et accepte un commit propre.
- [ ] Tout est poussé sur votre fork.

## Si ça coince

1. **`docker: Cannot connect to the Docker daemon`** : Docker Desktop n'est pas lancé. Ouvrez-le, attendez l'icône verte, relancez.
2. **Le scan répond encore `leaks found: 1` après l'étape 3** : l'empreinte dans `.gitleaksignore` ne correspond pas. Relancez le scan avec `--verbose` et copiez la ligne `Fingerprint:` telle quelle (commit complet, chemin, règle, numéro de ligne), sans espace en trop.
3. **Le hook ne se déclenche pas** : il n'est pas exécutable ou pas au bon endroit. `ls -l .git/hooks/pre-commit` doit afficher `-rwxr-xr-x`. Les hooks ne sont pas versionnés : chaque clone doit l'installer.

## Pour aller plus loin

- Stéphane Robert, documentation DevOps/DevSecOps : https://www.stephane-robert.info/docs/ (section sécurité et gestion des secrets).
- Documentation officielle gitleaks : https://github.com/gitleaks/gitleaks (configuration, `.gitleaksignore`, intégration pre-commit et CI).
- Au TP3, le même scan tournera dans GitHub Actions : le hook protège votre poste, le pipeline protège le dépôt.
