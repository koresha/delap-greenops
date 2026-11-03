# TP6 — GitOps avec Argo CD

**Objectif.** Installer Argo CD dans un cluster `kind`, lui confier le déploiement de DELAP depuis votre fork, puis constater que Git commande le cluster : un changement fait par pull request est appliqué tout seul, et une modification manuelle est annulée.
**Durée :** 50 min.

## Prérequis

- `kind`, `kubectl` et Docker Desktop installés (TP4/TP5).
- Votre fork `https://github.com/<COMPTE>/delap-greenops` avec le dossier `k8s/` (TP5).
- Un cluster `kind` vide : si le cluster `delap` du TP5 tourne encore, vous pouvez le réutiliser, sinon `kind create cluster --name delap`.

> Vérifiez d'abord : `kubectl config current-context` doit afficher `kind-delap`.

## Étape 1 — Installer Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.13.2/manifests/install.yaml
kubectl wait --for=condition=Ready pod --all -n argocd --timeout=300s
kubectl get pods -n argocd
```

**Ce qui doit marcher :** 7 pods en `Running` (`argocd-server`, `argocd-repo-server`, `argocd-application-controller`, `argocd-redis`, `argocd-dex-server`, `argocd-applicationset-controller`, `argocd-notifications-controller`). Comptez 1 à 3 minutes.

## Étape 2 — Ouvrir l'interface

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
kubectl -n argocd port-forward svc/argocd-server 8081:443
```

Laissez le `port-forward` tourner (ouvrez un second terminal pour la suite), puis allez sur <https://localhost:8081>. Acceptez l'avertissement du certificat (certificat auto-signé, local à votre poste). Identifiant : `admin`, mot de passe : la valeur affichée.

**Ce qui doit marcher :** vous voyez l'interface Argo CD, sans application pour l'instant.

## Étape 3 — Créer l'Application

Ouvrez `TP6/application.yaml` et remplacez `<COMPTE>` par votre compte GitHub. Lisez le fichier : il dit à Argo CD *quel dépôt* surveiller, *quel dossier*, et *où* déployer.

```bash
kubectl apply -f TP6/application.yaml
kubectl -n argocd get application delap
kubectl -n delap get deploy,pods
```

**Ce qui doit marcher :** l'application `delap` apparaît dans l'interface, avec l'état `Synced`. Le namespace `delap` a été créé par Argo CD (`CreateNamespace=true`) et contient un déploiement de 2 réplicas.

> Le déploiement utilise l'image `delap:local`, celle que vous avez construite au TP4 et chargée dans kind au TP5 (`kind load docker-image delap:local --name delap`). Si elle n'est pas dans le cluster, les pods restent en `ImagePullBackOff` et l'application reste `Progressing` au lieu de `Healthy`. Le GitOps fonctionne quand même : `Synced` signifie « le cluster correspond à Git ».

## Étape 4 — Changer le cluster par Git (pull request)

1. Sur GitHub, dans votre fork, créez une branche `replicas-3`.
2. Modifiez `k8s/deployment.yaml` : `replicas: 2` devient `replicas: 3`.
3. Ouvrez une pull request vers `main` et fusionnez-la.
4. Dans l'interface, cliquez sur **Refresh** (ou attendez environ 3 minutes : Argo CD interroge Git à intervalle régulier).

```bash
kubectl -n delap get deploy delap
```

**Ce qui doit marcher :** le déploiement passe à `3/3` désiré sans que vous ayez lancé `kubectl apply`. Dans l'interface, l'historique (**History and Rollback**) montre le nouveau commit.

## Étape 5 — Provoquer une dérive, voir la réparation

Modifiez le cluster « à la main », en dehors de Git :

```bash
kubectl -n delap scale deploy/delap --replicas=5
kubectl -n delap get deploy delap
```

Attendez quelques secondes et relancez la seconde commande.

**Ce qui doit marcher :** le nombre de réplicas revient à la valeur écrite dans Git (`self-heal`). Dans l'interface, regardez l'onglet **Events** de l'application : la dérive y est tracée.

Bonus : retirez `selfHeal: true` du fichier, ré-appliquez-le, refaites le `scale`. Que devient l'état de l'application ? (`OutOfSync`, sans correction automatique.)

## Validation

- [ ] Les 7 pods du namespace `argocd` sont `Running`.
- [ ] L'application `delap` est `Synced` (et `Healthy` si l'image est disponible).
- [ ] Le passage à 3 réplicas est venu d'une pull request, pas de `kubectl`.
- [ ] Un `kubectl scale` manuel a été annulé automatiquement par Argo CD.
- [ ] Capture d'écran de l'application dans l'interface, ajoutée à votre README.

## Si ça coince

1. **`ImagePullBackOff` sur les pods.** L'image `delap:local` n'est pas dans le cluster. Rechargez-la : `kind load docker-image delap:local --name delap`, puis `kubectl -n delap rollout restart deployment delap`.
2. **L'application reste `Unknown` / erreur de dépôt.** Votre fork doit être **public**, `repoURL` doit finir par `.git` et contenir votre vrai compte (plus de `<COMPTE>`). Détail : `kubectl -n argocd describe application delap`.
3. **Le mot de passe est refusé ou introuvable.** Le secret `argocd-initial-admin-secret` est lu après l'installation complète : attendez les pods `Running`. Copiez la valeur sans espace ni retour à la ligne final.

## Pour aller plus loin

- Stéphane Robert, documentation DevOps et Kubernetes (GitOps, Argo CD) : <https://www.stephane-robert.info/docs/>
- Documentation officielle Argo CD, démarrage : <https://argo-cd.readthedocs.io/en/stable/getting_started/>

*Nettoyage en fin de séance : `kind delete cluster --name delap` (seulement si vous n'en avez plus besoin).*
