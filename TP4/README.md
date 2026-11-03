# TP4 · Conteneurs : Docker et Trivy

**Objectif.** Scanner l'image Docker de DELAP avec Trivy, la durcir (base minimale, utilisateur non-root, `.dockerignore`), constater la baisse des vulnérabilités, puis bloquer le pipeline si une faille CRITICAL réapparaît.
**Durée.** 50 minutes.

## Prérequis

- Docker Desktop lancé (`docker version` répond).
- Votre fork de `delap-greenops` cloné, terminal ouvert **à la racine du dépôt**.
- Le workflow `.github/workflows/ci.yml` du TP3 (job `test` vert).
- Windows : utilisez Git Bash ou WSL2 pour toutes les commandes.

---

## Étape 1 · Construire l'image de départ et la scanner

```bash
docker build -t delap .
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.58.1 image delap
```

Le premier scan télécharge la base de vulnérabilités (environ 1 minute). Cherchez la ligne `Total:` sous le titre `delap (debian ...)`, et **notez le total**.

Pour lire une ligne du rapport : `Library` (le paquet), `Vulnerability` (l'identifiant CVE), `Severity`, `Installed Version`, **`Fixed Version`** (la version qui corrige).

> Résultat de notre test (base de données Trivy du 3 nov. 2026) : `Total: 749` dont 12 CRITICAL et 157 HIGH. Votre total sera proche, mais pas identique : la base évolue chaque jour.

**Ce qui doit marcher :** un tableau de vulnérabilités s'affiche et vous avez noté votre total « avant ».

## Étape 2 · Durcir l'image

Le dossier `TP4/` contient un `Dockerfile` corrigé et un `.dockerignore`. Copiez-les à la racine (ils remplacent l'ancien `Dockerfile`).

```bash
cp TP4/Dockerfile Dockerfile
cp TP4/.dockerignore .dockerignore
cat Dockerfile
```

Ce qui change :

| Avant | Après | Pourquoi |
|---|---|---|
| `FROM nginx:1.27` (Debian, root) | `FROM nginxinc/nginx-unprivileged:1.27-alpine` | Base minimale (Alpine), nginx tourne en utilisateur non-root |
| port 80 | port **8080** | Un utilisateur non-root ne peut pas ouvrir un port inférieur à 1024 |
| tout le dépôt peut entrer dans le contexte | `.dockerignore` | `.git`, `.env`, `tests`, `k8s`… ne finissent jamais dans l'image |

```bash
docker build -t delap:hardened .
docker run -d --rm --name delap-h -p 8080:8080 delap:hardened
curl -I http://localhost:8080          # HTTP/1.1 200 OK
docker exec delap-h id                 # uid=101(nginx) : pas root
docker stop delap-h
```

**Ce qui doit marcher :** `200 OK` sur http://localhost:8080 et `id` ne renvoie pas `uid=0(root)`.

## Étape 3 · Re-scanner et comparer

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.58.1 image delap:hardened
docker image ls delap
```

Notez le total « après » et la taille des deux images.

> Résultat de notre test : `Total: 214` dont 3 CRITICAL et 57 HIGH, soit **749 → 214**. Image : 281 Mo → 76 Mo.

Il reste 3 CRITICAL (`libcrypto3`, `libssl3`, `brotli-libs`) et Trivy indique une `Fixed Version` pour chacune : la base est correcte mais l'image publiée n'a pas encore reçu les derniers correctifs. On les applique à l'étape 4.

**Ce qui doit marcher :** le total « après » est nettement plus bas que le total « avant ».

## Étape 4 · Appliquer les correctifs disponibles

Dans `Dockerfile`, ajoutez la mise à jour des paquets (on passe en root le temps de la commande, puis on revient à l'utilisateur non-root) :

```dockerfile
FROM nginxinc/nginx-unprivileged:1.27-alpine
USER root
RUN apk upgrade --no-cache
USER 101
COPY app/ /usr/share/nginx/html/
EXPOSE 8080
```

```bash
docker build -t delap:hardened .
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.58.1 image delap:hardened
```

> Résultat de notre test : `Total: 0`. Le conteneur tourne toujours en `uid=101`.

**Ce qui doit marcher :** 0 CRITICAL, et `docker exec <conteneur> id` montre toujours un utilisateur non-root.

## Étape 5 · Faire bloquer le pipeline par Trivy

Ajoutez ce job à la fin de `.github/workflows/ci.yml` (même niveau d'indentation que le job `test`). Il construit l'image puis échoue (`--exit-code 1`) si Trivy trouve au moins une vulnérabilité CRITICAL.

```yaml
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - name: Build de l'image
        run: docker build -t delap:ci .
      - name: Scan Trivy (bloquant sur CRITICAL)
        run: >
          docker run --rm
          -v /var/run/docker.sock:/var/run/docker.sock
          aquasec/trivy:0.58.1 image
          --exit-code 1 --severity CRITICAL delap:ci
```

Gardez `permissions: contents: read` en tête du fichier (TP3). Puis :

```bash
git add Dockerfile .dockerignore .github/workflows/ci.yml
git commit -m "ci: image durcie et scan Trivy bloquant sur CRITICAL"
git push
```

Ouvrez l'onglet **Actions** : le job `image` doit être vert. Vérification facultative : repassez temporairement la première ligne du `Dockerfile` à `FROM nginx:1.27`, poussez sur une branche : le job passe au rouge. Supprimez la branche ensuite.

**Ce qui doit marcher :** job `image` vert sur la branche principale, rouge avec l'ancienne image.

## Étape 6 · Installer `kind` et `kubectl` (pour la séance suivante)

| Système | `kubectl` | `kind` |
|---|---|---|
| macOS (Homebrew) | `brew install kubectl` | `brew install kind` |
| Windows (winget) | `winget install Kubernetes.kubectl` | `winget install Kubernetes.kind` |
| Linux / WSL2 | https://kubernetes.io/docs/tasks/tools/ | https://kind.sigs.k8s.io/docs/user/quick-start/#installation |

Sous Windows, ouvrez un **nouveau** terminal après l'installation pour que les commandes soient reconnues.

```bash
kubectl version --client
kind version
```

**Ce qui doit marcher :** les deux commandes affichent une version (pas de « command not found »). Docker Desktop doit rester installé : `kind` fait tourner Kubernetes dans des conteneurs.

---

## Validation

- [ ] J'ai noté le total de vulnérabilités de l'image de départ (étape 1).
- [ ] Mon image durcie répond en `200` sur le port 8080 et tourne sans root (étape 2).
- [ ] Le total après durcissement est plus bas, je l'ai comparé à l'avant (étape 3).
- [ ] Après `apk upgrade`, Trivy ne trouve plus de CRITICAL (étape 4).
- [ ] Le job `image` de la CI est vert (étape 5).
- [ ] `kubectl version --client` et `kind version` fonctionnent (étape 6).

## Si ça coince

1. **`Cannot connect to the Docker daemon` ou socket introuvable.** Docker Desktop n'est pas lancé. Sous Windows, utilisez Git Bash ; si le montage de `/var/run/docker.sock` échoue, essayez depuis WSL2.
2. **Le port 8080 est déjà pris** (`port is already allocated`). Un ancien conteneur tourne : `docker ps`, puis `docker stop <nom>`. Ou changez le port côté hôte : `-p 8081:8080`.
3. **Le job `image` est rouge alors que l'image est durcie.** Lisez la fin du log : Trivy liste la CVE et sa `Fixed Version`. Vérifiez que le `Dockerfile` à la racine contient bien `apk upgrade` (étape 4) et que vous avez poussé ce fichier.

## Pour aller plus loin

- Stéphane Robert, documentation Docker et sécurité des conteneurs : https://www.stephane-robert.info/docs/
- Documentation officielle de Trivy : https://aquasecurity.github.io/trivy/v0.58/
- Bonnes pratiques Dockerfile (Docker) : https://docs.docker.com/build/building/best-practices/
