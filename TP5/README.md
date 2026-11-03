# TP5 — Kubernetes : déployer DELAP et le durcir

**Objectif :** déployer DELAP dans un cluster Kubernetes local (`kind`), puis ajouter un `securityContext` pour que le pod ne tourne plus en root et soit accepté par la politique Pod Security `restricted`.
**Durée :** 50 minutes.

## Prérequis
- Docker Desktop lancé, `kind` et `kubectl` installés (`kind version`, `kubectl version --client`).
- Votre fork de `delap-greenops` cloné, avec le `Dockerfile` durci du TP4 (base `nginxinc/nginx-unprivileged:1.27-alpine`, port 8080).
- Un terminal ouvert à la racine du dépôt.

> Les sorties ci-dessous viennent d'un vrai essai (kind 0.33, Kubernetes 1.37). Les noms de pods et les durées changeront chez vous.

## Étape 1 — Créer le cluster

```bash
kind create cluster --name delap
kubectl get nodes
```

Sortie attendue (le nom du nœud dépend du nom du cluster) :

```
NAME                  STATUS   ROLES           AGE   VERSION
delap-control-plane   Ready    control-plane   40s   v1.37.0
```

**Ce qui doit marcher :** le nœud est `Ready`.

## Étape 2 — Mettre l'image dans le cluster

Le cluster `kind` est une machine à part : il ne voit pas les images de votre Docker. On construit l'image et on la charge dedans.

```bash
docker build -t delap:local .
kind load docker-image delap:local --name delap
```

Dans `k8s/deployment.yaml`, remplacez l'image par la vôtre et ajoutez la ligne `imagePullPolicy` :

```yaml
          image: delap:local
          imagePullPolicy: IfNotPresent
```

`IfNotPresent` dit à Kubernetes d'utiliser l'image déjà présente dans le nœud plutôt que d'aller la chercher sur Internet (elle n'existe pas là-bas).

**Ce qui doit marcher :** `docker exec delap-control-plane crictl images | grep delap` affiche `delap   local`.

## Étape 3 — Déployer et ouvrir l'application

On travaille dans un namespace dédié, `delap`.

```bash
kubectl create namespace delap
kubectl apply -k k8s/ -n delap
kubectl rollout status deployment/delap -n delap
kubectl get pods -n delap
```

Sortie attendue :

```
deployment "delap" successfully rolled out
NAME                    READY   STATUS    RESTARTS   AGE
delap-cc5c75d97-g2tkh   1/1     Running   0          1s
delap-cc5c75d97-lbdfl   1/1     Running   0          1s
```

Puis, dans un terminal, ouvrez le tunnel (il reste actif, ne le fermez pas) :

```bash
kubectl port-forward svc/delap 8080:80 -n delap
```

Dans un second terminal :

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
```

```
200
```

**Ce qui doit marcher :** 2 pods `Running`, `200` sur `http://localhost:8080/` (ouvrez-la aussi dans le navigateur). Arrêtez le tunnel avec `Ctrl+C`.

## Étape 4 — Constater le risque : qui est l'utilisateur ?

Lisez le manifeste : il n'y a aucun `securityContext`. Vérifiez le résultat sur le pod en cours :

```bash
kubectl get deployment delap -n delap -o jsonpath='{.spec.template.spec.securityContext}{"\n"}'
kubectl exec -n delap deploy/delap -- id
```

Avec le `Dockerfile` durci du TP4, l'utilisateur est déjà `nginx` :

```
uid=101(nginx) gid=101(nginx) groups=101(nginx)
```

Mais Kubernetes ne le sait pas : rien ne l'empêche d'accepter une autre image qui tourne en root (`uid=0`). C'est le manifeste qui doit l'exiger.

**Ce qui doit marcher :** vous voyez le `uid` et vous comprenez que la garantie vient de l'image, pas du cluster.

## Étape 5 — Voir ce que dit Pod Security `restricted`

Activez le niveau `restricted` sur le namespace :

```bash
kubectl label namespace delap pod-security.kubernetes.io/enforce=restricted
```

Kubernetes ne tue pas les pods existants, il avertit :

```
Warning: existing pods in namespace "delap" violate the new PodSecurity enforce level "restricted:latest"
Warning: delap-cc5c75d97-g2tkh (and 1 other pod): allowPrivilegeEscalation != false, unrestricted capabilities, runAsNonRoot != true, seccompProfile
namespace/delap labeled
```

Redémarrez le déploiement pour voir le refus :

```bash
kubectl rollout restart deployment/delap -n delap
kubectl get pods -n delap
kubectl describe rs -n delap | grep FailedCreate
```

```
NAME                    READY   STATUS    RESTARTS   AGE
delap-cc5c75d97-g2tkh   1/1     Running   0          18s
delap-cc5c75d97-lbdfl   1/1     Running   0          18s
  ReplicaFailure   True    FailedCreate
```

Les anciens pods tournent encore, mais **aucun nouveau pod n'est créé**. La raison complète :

```bash
kubectl get events -n delap --field-selector reason=FailedCreate -o jsonpath='{.items[0].message}{"\n"}'
```

```
Error creating: pods "delap-5785fdb649-cf5cj" is forbidden: violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false (container "web" must set securityContext.allowPrivilegeEscalation=false), unrestricted capabilities (container "web" must set securityContext.capabilities.drop=["ALL"]), runAsNonRoot != true (pod or container "web" must set securityContext.runAsNonRoot=true), seccompProfile (pod or container "web" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")
```

**Ce qui doit marcher :** vous lisez les 4 manquements : `allowPrivilegeEscalation`, `capabilities`, `runAsNonRoot`, `seccompProfile`.

## Étape 6 — Ajouter le `securityContext`

Dans `k8s/deployment.yaml`, ajoutez un bloc au niveau du **pod** (sous `spec.template.spec`) et un au niveau du **conteneur** :

```yaml
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: web
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
```

Le corrigé complet est dans `TP5/deployment-securise.yaml` (essayez d'abord sans le regarder). Puis :

```bash
kubectl apply -k k8s/ -n delap
kubectl rollout status deployment/delap -n delap
kubectl get pods -n delap
```

```
deployment "delap" successfully rolled out
NAME                    READY   STATUS    RESTARTS   AGE
delap-8dd6785d9-88hlv   1/1     Running   0          0s
delap-8dd6785d9-gw5dp   1/1     Running   0          1s
```

Vérifiez l'utilisateur et l'application :

```bash
kubectl exec -n delap deploy/delap -- id
kubectl port-forward svc/delap 8080:80 -n delap
```

```
uid=101(nginx) gid=101(nginx) groups=101(nginx)
```

Dans un second terminal, `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/` répond `200`.

**Ce qui doit marcher :** les nouveaux pods sont acceptés malgré le niveau `restricted`, et l'application répond.

> `readOnlyRootFilesystem: true` est un bon réflexe, mais nginx écrit dans `/tmp` et `/var/cache` : il faudrait monter des volumes `emptyDir`. Ce n'est pas demandé ici (voir « Pour aller plus loin »).

## Étape 7 — Nettoyer

```bash
kind delete cluster --name delap
```

## Validation
- [ ] `kubectl get pods -n delap` : 2 pods `Running`.
- [ ] L'application répond `200` via `kubectl port-forward`.
- [ ] `kubectl exec -n delap deploy/delap -- id` affiche `uid=101`, pas `uid=0`.
- [ ] Le namespace `delap` porte le label `pod-security.kubernetes.io/enforce=restricted` et le déploiement durci y tourne.
- [ ] Vous savez expliquer en une phrase pourquoi la version sans `securityContext` a été refusée.
- [ ] Le `k8s/deployment.yaml` durci est commité dans votre fork.

## Si ça coince
1. **`ErrImagePull` ou `ImagePullBackOff`** : l'image n'est pas dans le cluster. Relancez `kind load docker-image delap:local --name delap` (le nom après `--name` doit être celui de votre cluster) et vérifiez l'orthographe de l'image dans le manifeste. Pour repartir : `kubectl rollout restart deployment/delap -n delap`.
2. **Mauvais cluster** : `kubectl` agit sur le contexte courant. Vérifiez avec `kubectl config current-context` (attendu : `kind-delap`) ; sinon `kubectl config use-context kind-delap`.
3. **`CreateContainerConfigError` ou pods qui ne démarrent pas après `runAsNonRoot: true`** : l'image tourne en root, ou son utilisateur n'est pas numérique. Vérifiez que vous utilisez bien l'image durcie du TP4 (`docker run --rm delap:local id` doit afficher `uid=101`), et gardez `runAsUser: 101`.

## Pour aller plus loin
- Stéphane Robert, documentation Kubernetes et sécurité : <https://www.stephane-robert.info/docs/>
- Documentation officielle, Pod Security Standards : <https://kubernetes.io/docs/concepts/security/pod-security-standards/>
- Défi : ajoutez `readOnlyRootFilesystem: true` et les volumes `emptyDir` nécessaires à nginx (`/tmp`, `/var/cache/nginx`) pour que le pod redémarre toujours.
