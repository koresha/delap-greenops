# DELAP · Calculateur GreenOps

DELAP recycle le matériel informatique des entreprises et leur montre l'impact évité. Cette petite application web calcule le CO₂ et les déchets évités selon le matériel recyclé.

**Tout est fictif et pédagogique.** Ce dépôt sert de fil rouge au cours DevSecOps de l'ESGI (M2 SRC, décembre 2026). On le sécurise outil après outil, TP après TP.

## Lancer l'app

```bash
# Sans rien installer : ouvrez app/index.html dans un navigateur.
# Avec Docker :
docker build -t delap .
docker run --rm -p 8080:80 delap     # http://localhost:8080
# Tests :
node tests/greenops.test.js
```

## Les TP, dans l'ordre

| TP | Séance | Outil | Dossier |
|---|---|---|---|
| TP1 | S1 · DevSecOps et Git | Git, GitHub | [TP1](TP1/) |
| TP2 | S2 · Les secrets | gitleaks, .env, hook | [TP2](TP2/) |
| TP3 | S3 · CI/CD | GitHub Actions | [TP3](TP3/) |
| TP4 | S4 · Conteneurs | Docker, Trivy | [TP4](TP4/) |
| TP5 | S5 · Kubernetes | kind, kubectl | [TP5](TP5/) |
| TP6 | S6 · GitOps | Argo CD | [TP6](TP6/) |
| TP7 | S7 · Supply chain et secrets | Syft, Cosign, Sealed Secrets | [TP7](TP7/) |
| TP8 | S8 · Bilan | tout | [TP8](TP8/) |

## Structure

| Chemin | Rôle |
|---|---|
| `app/` | L'application (HTML, CSS, JS, sans framework) |
| `tests/` | Un test Node, sans dépendance |
| `Dockerfile` | Image nginx qui sert `app/` |
| `k8s/` | Manifestes Kubernetes (TP5, TP6) |
| `.github/workflows/` | Pipelines (créés au TP3) |

Cours de Chahine Azlouk, ESGI Paris. Ressources complémentaires : Stéphane Robert, https://www.stephane-robert.info/docs/ (avec son autorisation).
