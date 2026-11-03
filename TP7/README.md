# TP7 — Supply chain et gestion des secrets

**Objectif** : savoir ce que contient l'image de DELAP (SBOM), prouver qu'elle vient bien de vous (signature), et ranger un secret Kubernetes dans Git sans le révéler (Sealed Secrets).
**Durée** : 50 minutes. **Outils** : Syft, Cosign, Sealed Secrets (`kubeseal`), tous lancés en Docker ou en simple binaire.

## Prérequis

- Docker Desktop lancé, `kind` et `kubectl` installés (TP5).
- Votre fork de `koresha/delap-greenops` cloné, avec le `Dockerfile` à la racine.
- Un terminal Bash (Git Bash ou WSL2 sous Windows). Tout le TP se fait depuis la racine du dépôt.

## Étape 1 — La SBOM : la liste des ingrédients

Construisez l'image, puis demandez à Syft la liste de tout ce qu'elle contient.

```bash
docker build -t delap:local .

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  anchore/syft:v1.18.1 delap:local -o cyclonedx-json > sbom.json
```

Retrouvez nginx dans la SBOM :

```bash
grep -o '"name": *"nginx[^"]*"' sbom.json | sort -u
```

Sortie obtenue (raccourcie) :

```text
"name": "nginx"
"name": "nginx-module-geoip"
"name": "nginx-module-image-filter"
"name": "nginx-module-njs"
"name": "nginx-module-xslt"
```

Pour une lecture plus humaine, remplacez le format par `-o table` (`NAME`, `VERSION`, `TYPE` : `bash 5.2.15-2+b8 deb`, `nginx 1.27.5-1~bookworm deb`…).

**Ce qui doit marcher** : `sbom.json` fait environ 350 Ko, contient `"bomFormat": "CycloneDX"` et une centaine de composants (151 lors de nos essais, le nombre varie avec la version de l'image nginx). Notez la version exacte de nginx et le nombre de composants dans votre rendu.

## Étape 2 — Signer l'image avec Cosign

Pour rester simple et sans compte, on utilise un registre local. (Variante GHCR en fin d'étape.)

**2.1 Lancer le registre et pousser l'image**

```bash
docker run -d -p 5001:5000 --name reg registry:2
docker tag delap:local localhost:5001/delap:1.0
docker push localhost:5001/delap:1.0
```

Sortie (raccourcie) : `1.0: digest: sha256:6f1bd636dd7d... size: 856`

Si le port 5001 est déjà pris sur votre poste, prenez 5002 partout (`-p 5002:5000`, `localhost:5002/...`).

**2.2 Générer la paire de clés**

```bash
docker run --rm -e COSIGN_PASSWORD="" -v "$PWD:/w" -w /w \
  gcr.io/projectsigstore/cosign:v2.4.1 generate-key-pair
```

```text
Private key written to cosign.key
Public key written to cosign.pub
```

Ici le mot de passe de la clé est vide pour le TP. En vrai, choisissez-en un et rangez `cosign.key` dans un coffre. **Ne commitez jamais `cosign.key`** : ajoutez-la au `.gitignore`. Seule `cosign.pub` se partage.

**2.3 Signer puis vérifier**

On raccourcit la commande avec un alias :

```bash
cosign() { docker run --rm --network host -e COSIGN_PASSWORD="" -v "$PWD:/w" -w /w \
  gcr.io/projectsigstore/cosign:v2.4.1 "$@"; }

cosign sign --key cosign.key --tlog-upload=false localhost:5001/delap:1.0
cosign verify --key cosign.pub --insecure-ignore-tlog=true localhost:5001/delap:1.0
```

Sortie de `sign` (raccourcie) : `Pushing signature to: localhost:5001/delap`

Sortie de `verify` (raccourcie) :

```text
Verification for localhost:5001/delap:1.0 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The signatures were verified against the specified public key
[{"critical":{"identity":{"docker-reference":"localhost:5001/delap"},"image":{"docker-manifest-digest":"sha256:6f1bd636dd7d..."}...
```

`--tlog-upload=false` et `--insecure-ignore-tlog=true` évitent d'inscrire votre test dans le journal public Sigstore. En production on les retire.

**2.4 Voir ce qui se passe sans signature**

```bash
docker tag delap:local localhost:5001/autre:1.0 && docker push localhost:5001/autre:1.0
cosign verify --key cosign.pub --insecure-ignore-tlog=true localhost:5001/autre:1.0
```

```text
Error: no signatures found
```

**2.5 Nettoyer le registre** (à faire à la fin du TP)

```bash
docker rm -f reg
```

*Variante GHCR (bonus)* : `docker login ghcr.io` avec un token personnel `write:packages`, poussez `ghcr.io/<compte>/delap-greenops:1.0`, puis signez et vérifiez de la même façon avec cette référence. Signez de préférence par digest (`...@sha256:...`).

**Ce qui doit marcher** : `verify` affiche « The signatures were verified against the specified public key », et la vérification de `autre:1.0` échoue.

## Étape 3 — Sceller un secret avec Sealed Secrets

**3.1 Cluster et contrôleur**

```bash
kind create cluster --name delap
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/controller.yaml
kubectl -n kube-system rollout status deployment/sealed-secrets-controller --timeout=180s
```

```text
deployment "sealed-secrets-controller" successfully rolled out
```

(Si le cluster `delap` existe déjà depuis le TP5, sautez la première commande.)

**3.2 Installer `kubeseal`** (version 0.27.3, adaptez l'architecture)

```bash
# macOS Apple Silicon ; Linux : kubeseal-0.27.3-linux-amd64.tar.gz ; Mac Intel : darwin-amd64
curl -sSL -o kubeseal.tgz https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/kubeseal-0.27.3-darwin-arm64.tar.gz
tar xzf kubeseal.tgz kubeseal && ./kubeseal --version
```

```text
kubeseal version: 0.27.3
```

Sous Windows, téléchargez `kubeseal-0.27.3-windows-amd64.tar.gz` sur la page des releases de Sealed Secrets, ou installez-le avec `brew install kubeseal` si vous avez Homebrew.

**3.3 Le Secret en clair**

Le fichier `TP7/secret-exemple.yaml` contient un Secret `delap-api-key` avec une clé **fictive**. Regardez ce qu'un Secret protège vraiment :

```bash
echo "ZGVsYXAtY2xlLWZpY3RpdmUtMDAwMA==" | base64 -d
```

```text
delap-cle-fictive-0000
```

Du base64 n'est pas du chiffrement : n'importe qui peut le décoder.

**3.4 Sceller**

```bash
./kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system \
  --format yaml < TP7/secret-exemple.yaml > TP7/sealed-secret.yaml
grep -c "delap-cle" TP7/sealed-secret.yaml
```

Le `grep` doit répondre `0` : la valeur n'apparaît plus. Le fichier ressemble à ceci (raccourci) :

```yaml
kind: SealedSecret
metadata: { name: delap-api-key, namespace: default }
spec:
  encryptedData:
    apiKey: AgAex8D6/JXuATmR9J163nknDCntUTQTu/0bumUyeeUzrzIG...
```

Seul le contrôleur de **votre** cluster détient la clé privée qui sait le déchiffrer.

**3.5 Appliquer et voir le Secret apparaître**

```bash
kubectl apply -f TP7/sealed-secret.yaml
kubectl get sealedsecret,secret delap-api-key
```

```text
sealedsecret.bitnami.com/delap-api-key   3s
secret/delap-api-key   Opaque   1      3s
```

**3.6 Commiter le SealedSecret, pas le Secret**

```bash
git add TP7/sealed-secret.yaml
git commit -m "TP7: SealedSecret delap-api-key"
git push
```

`secret-exemple.yaml` ne contient qu'une valeur fictive. Avec une vraie clé, le fichier en clair ne doit jamais entrer dans Git : supprimez-le après avoir scellé, ou ajoutez-le au `.gitignore`.

**Ce qui doit marcher** : `kubectl get secret delap-api-key` existe, créé par le contrôleur, et `sealed-secret.yaml` ne contient aucune valeur lisible.

## Validation

- [ ] `sbom.json` généré par Syft, et nginx retrouvé dedans (version notée).
- [ ] Paire de clés générée, `cosign.key` hors de Git.
- [ ] Image signée dans le registre, `cosign verify` affiche la vérification réussie.
- [ ] Vérification d'une image non signée : échec constaté.
- [ ] Registre local arrêté et supprimé (`docker rm -f reg`).
- [ ] `sealed-secret.yaml` commité, et le Secret `delap-api-key` visible dans le cluster.

## Si ça coince

1. **`cosign verify` répond « signature not found in transparency log »** : vous avez signé avec `--tlog-upload=false`. Ajoutez `--insecure-ignore-tlog=true` à la vérification (sans cela, Cosign cherche l'entrée dans le journal public).
2. **`push` ou `sign` échoue sur `localhost:5001`** : un autre conteneur occupe peut-être déjà le port (`docker ps`). Utilisez 5002. Si Cosign ne joint pas le registre depuis Docker, vérifiez que `--network host` est autorisé (Docker Desktop, Réglages > Resources > Network), ou signez avec `host.docker.internal:5001` à la place de `localhost:5001`.
3. **`kubeseal` : « cannot fetch certificate »** : le contrôleur n'est pas encore prêt ou n'est pas trouvé. Attendez le `rollout status`, puis gardez `--controller-name sealed-secrets-controller --controller-namespace kube-system` (le contrôleur du manifeste officiel porte ce nom). Un SealedSecret scellé pour un autre cluster ne se déchiffrera pas : si vous recréez le cluster, rescellez.

## Pour aller plus loin

- Stéphane Robert : https://www.stephane-robert.info/docs/ (sections sécurité, supply chain et Kubernetes).
- Documentation officielle Sigstore Cosign : https://docs.sigstore.dev/cosign/signing/overview/
- Projet Sealed Secrets : https://github.com/bitnami-labs/sealed-secrets
- Format de SBOM CycloneDX : https://cyclonedx.org/
