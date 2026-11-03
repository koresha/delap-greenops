# TP8 · Exercice de synthèse : un stagiaire est passé par là

**Objectif.** Retrouver, avec les outils des TP précédents, trois anomalies introduites dans une branche de DELAP, les corriger proprement et expliquer votre travail en 3 minutes.
**Format.** En binôme, 50 minutes, sur un seul fork (celui d'un des deux). Compte pour 30 % de la note.

## Le scénario

Vendredi soir, un stagiaire a poussé une branche `stagiaire` sur DELAP. Il voulait « faire avancer les choses ». Trois des protections mises en place cette semaine ont sauté :

1. **une clé a été poussée** dans le code ;
2. **le Dockerfile est repassé en root** (l'image durcie au TP4 ne l'est plus) ;
3. **le scan a disparu du pipeline** (le workflow ne bloque plus ce qu'il bloquait).

Vous savez quelles familles de problèmes chercher. Vous ne savez pas où exactement ni sous quelle forme. À vous de choisir l'outil.

## Prérequis

- Les TP2, TP3 et TP4 validés sur votre fork (gitleaks, workflow `ci.yml`, image non-root).
- Docker en marche, `git`, un compte GitHub.
- La branche `stagiaire` du dépôt d'origine, récupérée dans votre fork (étape 1). Si elle n'existe pas encore, le formateur la pousse en début de séance.

## Étapes

### 1. Récupérer la branche du stagiaire (2 min)

```bash
cd delap-greenops
git remote add upstream https://github.com/koresha/delap-greenops.git 2>/dev/null
git fetch upstream stagiaire
git switch -c stagiaire upstream/stagiaire
git log --oneline main..stagiaire
```

**Ce qui doit marcher :** vous voyez les commits du stagiaire. Notez-les, le ou les commits responsables font partie de la restitution.

### 2. Chercher les trois anomalies (10 min)

Un outil par anomalie. Ne lisez pas tout le dépôt à la main : laissez les outils trouver.

```bash
# Anomalie 1 : la clé. gitleaks scanne le code ET l'historique.
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 git /repo

# Anomalie 2 : le Dockerfile. Comparer avec ce que vous aviez durci au TP4.
git diff main..stagiaire -- Dockerfile .dockerignore
docker build -t delap:stagiaire . && docker run --rm delap:stagiaire whoami

# Anomalie 3 : le pipeline. Qu'est-ce qui manque par rapport à main ?
git diff main..stagiaire -- .github/workflows/
```

**Ce qui doit marcher :** trois constats écrits noir sur blanc dans un fichier `TP8/constats.md` de votre fork (quoi, où, quel commit, quel outil l'a trouvé). `whoami` dans le conteneur répond `root` : c'est l'anomalie 2.

### 3. Corriger, un commit par problème (25 min)

```bash
git switch -c correction-s8
```

- **Clé** : la sortir du code (variable d'environnement ou `config.js` qui lit une valeur vide, comme au TP2), ajouter son empreinte dans `.gitleaksignore` avec un commentaire `révoquée le …`. Dans la vraie vie, on révoque d'abord.
- **Dockerfile** : revenir à `nginxinc/nginx-unprivileged:1.27-alpine` et au port 8080, remettre le `.dockerignore` s'il a disparu.
- **Pipeline** : remettre l'étape manquante (gitleaks et/ou Trivy, selon ce que vous avez trouvé), bloquante, avec `permissions: contents: read` et des actions épinglées par SHA.

```bash
git add -A && git commit -m "fix: retirer la clé poussée par erreur"
# … puis un commit pour le Dockerfile, un pour le workflow
git push -u origin correction-s8
```

**Ce qui doit marcher :** trois commits lisibles sur `correction-s8`, poussés sur votre fork.

### 4. Prouver (5 min)

```bash
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 git /repo      # leaks found: 0
docker build -t delap:fix . && docker run --rm delap:fix whoami                   # nginx, pas root
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.58.1 image --severity CRITICAL delap:fix
```

Puis ouvrez une **pull request** `correction-s8 → main` sur votre fork. Dans sa description : les trois constats, et une capture (ou le texte) de chaque preuve : scan vide, `whoami` non-root, run GitHub Actions vert.

**Ce qui doit marcher :** le run GitHub Actions de la PR est vert, et il contient bien le scan remis.

### 5. Restituer (3 minutes, chrono)

Chaque binôme passe devant la classe. Trois questions, une minute chacune :

| Minute | Question | Ce qu'on attend |
|---|---|---|
| 1 | Comment vous l'avez trouvé ? | L'outil, la commande, l'indice. Un constat « à l'œil » ne compte qu'à moitié. |
| 2 | Comment vous l'avez corrigé ? | Le commit, la ligne changée, et pourquoi cette correction plutôt qu'une autre. |
| 3 | Comment vous le prouvez ? | Le scan vide, le `whoami`, le run vert. Une preuve par problème, dans la PR. |

Le formateur peut poser une question de relance. On s'arrête à 3 minutes, même si ce n'est pas fini : savoir aller à l'essentiel fait partie de l'exercice.

## Validation

- [ ] Branche `stagiaire` récupérée, commits du stagiaire identifiés.
- [ ] `TP8/constats.md` : trois constats, chacun avec l'outil qui l'a trouvé.
- [ ] Branche `correction-s8` : un commit par problème.
- [ ] Scan gitleaks vide sur `correction-s8`.
- [ ] `docker run --rm delap:fix whoami` ne répond pas `root`.
- [ ] Run GitHub Actions vert sur la PR, avec le scan remis et bloquant.
- [ ] PR ouverte avec les trois preuves dans sa description.
- [ ] Restitution de 3 minutes faite, les trois questions traitées.

Barème indicatif (30 % de la note) : 3 constats trouvés avec l'outil (3 pts), 3 corrections justes (3 pts), 3 preuves dans la PR (2 pts), restitution claire et à l'heure (2 pts).

## Si ça coince

1. **gitleaks ne trouve rien.** Vous scannez peut-être `main` et pas `stagiaire` : vérifiez avec `git branch --show-current`. Et relisez votre `.gitleaksignore` du TP2 : il ne doit ignorer que l'empreinte de l'ancien commit, pas une règle entière.
2. **`whoami` répond toujours `root` après correction.** Vous avez rebuild la mauvaise image ou l'ancien tag. Faites `docker build -t delap:fix .` sans cache (`--no-cache`) et vérifiez la ligne `FROM`.
3. **Le run reste rouge après avoir remis le scan.** C'est peut-être normal : la clé est encore dans un commit de la branche. Le `.gitleaksignore` doit contenir l'empreinte exacte donnée par gitleaks (`Fingerprint:`), pas une approximation.

## Pour aller plus loin

- Stéphane Robert, *DevSecOps* : https://www.stephane-robert.info/docs/ (les sept outils du module y sont documentés, en français, avec son autorisation).
- OWASP Top 10 CI/CD Security Risks : https://owasp.org/www-project-top-10-ci-cd-security-risks/ (l'anomalie 3 y figure deux fois).
