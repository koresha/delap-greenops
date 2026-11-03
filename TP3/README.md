# TP3 · Votre premier pipeline avec GitHub Actions

**Objectif :** faire tourner automatiquement les tests et un scan de secrets à chaque push, avec un pipeline configuré de façon sûre.
**Durée :** 50 minutes. **Outil :** GitHub Actions.

## Prérequis

- Votre fork de `delap-greenops`, cloné sur votre poste (TP1).
- Docker Desktop lancé.
- Le TP2 terminé est un plus : le scan de secrets passera au vert si l'ancienne clé est dans `.gitleaksignore`.

## Étape 1 · Créer le workflow

```bash
mkdir -p .github/workflows
cp TP3/ci.yml .github/workflows/ci.yml
```

Ouvrez `.github/workflows/ci.yml` et repérez les 4 règles du cours : `permissions: contents: read`, les actions épinglées par SHA avec le commentaire de version, le job `secrets` qui bloque, aucune valeur secrète dans le fichier.

**Ce qui doit marcher :** le fichier existe dans `.github/workflows/` (avec le point au début).

## Étape 2 · Tester en local ce que le pipeline va lancer

```bash
node tests/greenops.test.js
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 git /repo
```

**Ce qui doit marcher :** le test affiche `Tests OK`. Gitleaks affiche `no leaks found`. S'il signale la clé de `config.js`, c'est le secret du TP2 : ajoutez son empreinte dans `.gitleaksignore` (avec un commentaire « révoquée »), sinon le pipeline sera rouge pour cette raison.

## Étape 3 · Pousser et lire un run vert

```bash
git add .github/workflows/ci.yml
git commit -m "ci : tests et scan de secrets"
git push origin main
```

Sur GitHub, ouvrez l'onglet **Actions**, cliquez sur le run, puis sur chaque job. Dépliez les steps.

**Ce qui doit marcher :** les jobs `test` et `secrets` sont verts. Vous trouvez `Tests OK` dans le log du step « Tests ».

## Étape 4 · Provoquer un run rouge

On crée une branche jetable avec une **fausse** clé (jamais un vrai secret) :

```bash
git switch -c test-secret
echo 'aws_key = "AKIAQYLPMN5HHHFPZAM2"' > fuite.txt
git add fuite.txt
git commit -m "test : faux secret"
git push origin test-secret
```

Retournez dans l'onglet **Actions**.

**Ce qui doit marcher :** le run de la branche `test-secret` est rouge, le job `secrets` a échoué et le log nomme le fichier `fuite.txt`. La valeur est une fausse clé de forme AWS, volontairement choisie pour être détectée (les clés contenant `EXAMPLE` sont ignorées par gitleaks).

## Étape 5 · Nettoyer

```bash
git switch main
git branch -D test-secret
git push origin --delete test-secret
```

**Ce qui doit marcher :** la branche a disparu de GitHub. Le faux secret n'existe plus sur `main`.

## Bonus · Construire et publier l'image sur GHCR

```bash
cp TP3/ci-image.yml .github/workflows/ci-image.yml
git add .github/workflows/ci-image.yml && git commit -m "ci : image GHCR" && git push origin main
```

Ce workflow reçoit `packages: write`, uniquement lui. Après le run, l'image est dans l'onglet **Packages** de votre profil : `ghcr.io/<votre-compte>/delap-greenops:latest`.

## Validation

- [ ] `.github/workflows/ci.yml` est présent, avec `permissions: contents: read`
- [ ] Les actions sont épinglées par SHA, avec la version en commentaire
- [ ] Un run vert sur `main` (jobs `test` et `secrets`)
- [ ] Un run rouge constaté sur la branche `test-secret`
- [ ] La branche `test-secret` est supprimée
- [ ] Bonus : l'image apparaît dans les Packages

## Si ça coince

1. **Aucun run ne démarre.** Le dossier doit s'appeler exactement `.github/workflows/` et le fichier finir par `.yml`. Vérifiez aussi que Actions est activé dans l'onglet Actions de votre fork (GitHub le désactive parfois sur un fork).
2. **Le job `secrets` est rouge sur `main`.** Gitleaks a trouvé la clé de l'ancien commit. Revenez au TP2 : `.gitleaksignore` avec l'empreinte, commitée sur `main`.
3. **Erreur YAML.** L'indentation compte : deux espaces, jamais de tabulation. Pour vérifier avant de pousser : `docker run --rm -v "$PWD":/w -w /w rhysd/actionlint:1.7.7`.
4. **Bonus : `denied` au push.** Vérifiez `packages: write` dans le workflow, et que le nom de l'image est en minuscules.

## Pour aller plus loin

- Stéphane Robert, GitHub Actions : https://www.stephane-robert.info/docs/
- Documentation officielle, durcir la sécurité de GitHub Actions : https://docs.github.com/fr/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
