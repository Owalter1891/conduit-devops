# CI/CD and Infrastructure as Code for Conduit

**KTH DD2482 Project report*  
Oscar Walter (owalter@kth.se) and Gabriel Räätäri Nyström (grn@kth.se)

[Repository](https://github.com/Owalter1891/conduit-devops) · [Live application](https://16.171.189.18.sslip.io)

## Architecture and processes

We started from an [open-source example Conduit application](https://github.com/TonyMckes/conduit-realworld-example-app), where users can register, log in and publish articles. We added a repeatable build, test and deployment process around its React/Vite frontend, Express API and PostgreSQL database.

A multi-stage Dockerfile builds the frontend and installs production backend dependencies. The final image serves the frontend and API through Express as a non-root user. On AWS, Caddy handles HTTPS. PostgreSQL runs privately in a separate container with a named volume.

### Continuous integration and testing

[GitHub Actions](.github/workflows/build.yml) runs on pull requests targeting any branch, pushes to `main`, and manual requests. It validates Compose and Terraform, installs locked dependencies with `npm ci`, runs ESLint and `npm audit`, executes tests, and builds the frontend. The browser-test runner also builds and starts the full Docker application.

Tests use isolated databases and disposable Compose projects. The persistence check creates an account and article, replaces both containers while keeping the volume, then checks the original login, article, author and tags. Test containers and volumes are removed afterwards.

### Continuous delivery and deployment

After checks pass for a push to `main`, Actions publishes a Linux amd64 image to GitHub Container Registry (GHCR), tagged with the full commit SHA. A second job starts that image by its exact digest and runs smoke, write and persistence checks on a temporary runner.

Only after verification succeeds does the AWS job connect over SSH and deploy the same image digest. Compose waits for healthy services, and Actions checks the public HTTPS website. Main-branch workflow runs and a lock on the VM prevent overlapping deployments. Feature branches and manual workflow runs do not deploy.

### Infrastructure as Code

Compose defines development, integration-test and production environments, with an AWS override for Caddy. [Terraform](infra/aws/) defines a Stockholm VPC, subnet, internet gateway, routing, security rules, a fixed public IP, an Ubuntu `t3.micro` VM with an encrypted 12 GiB disk, and an IAM role for Systems Manager.

Bootstrap installs Docker, configures SSH, limits logs, adds swap and generates database/JWT secrets on the VM. An administrator applies Terraform separately; app deployments reuse the infrastructure. CI validates Terraform without applying it.

## Design decisions

We did not have any suitable projects that we have made ourselves, so we looked for an open-source project to use. We found this example app for Conduit which provided realistic accounts, authentication and persistent data. We thought this was a good project to use for this DevOps project. 

Actions keeps checks and reviews beside the code. Vitest checks JavaScript behaviour, integration tests exercise real storage, and Playwright checks browser flows.

Compose shares app configuration between testing and deployment. Terraform provides a reviewable cloud plan. One VM avoids the complexity of a managed database and load balancer.

## Component interaction, security and collaboration

The main flow is:

```text
Pull request → CI → merge to main → CI → GHCR → image verification → AWS → HTTPS smoke test
Browser → Caddy → Express (React files and API) → PostgreSQL → persistent volume
```

Jobs pass the image tag and digest to the SSH script, which sends the Compose configuration and deploys using existing VM secrets. Caddy reaches the app on internal port 3001; Express reaches PostgreSQL by its Compose service name. A [local deployment command](docs/deploying.md) also deploys and checks a digest without Node.js on the host.

ESLint rejects warnings, and `npm audit` blocks high and critical dependency findings. We updated vulnerable dependencies and added a scoped `shell-quote` override. Dependabot opens weekly npm and GitHub Actions update PRs, grouping minor and patch updates. These updates go through CI.

GitHub's `production` environment holds the SSH secret and only permits `main`. SSH password and root login are disabled. Git ignores secrets, private keys and Terraform state; Docker excludes infrastructure files. Publishing uses GitHub's built-in token.

`main` currently requires `Lint, tests and build` and one approving review, dismisses stale approvals, and protects against administrator bypass.

## Verification, limitations and trade-offs

[The successful workflow for commit `e45e2c8`](https://github.com/Owalter1891/conduit-devops/actions/runs/37955527067) demonstrates all four jobs: CI, image publishing, published-image verification and AWS deployment.

The single VM is a single point of failure. Updates can briefly interrupt service, and a failed deployment or final smoke test does not trigger automatic rollback. The named volume survives container replacement, but VM destruction deletes the database. There are no automated database backups, and Terraform state is stored locally. Sequelize currently changes the schema at startup rather than using a controlled migration process.

SSH is reachable from the internet because GitHub-hosted runners have changing IP addresses. Although the deployment key disables forwarding and interactive terminals, it can execute deployment code as root on this VM. It therefore remains a sensitive credential. Dependency checks do not replace container/OS scanning, and base-image tags and Action version tags can change. We have no scheduled infrastructure drift detection or continuous uptime monitoring. Free credits, the small VM's capacity, and external DNS/certificate services also limit the setup.

## Documented use of AI-assisted tools

We used ChatGPT throughout the project for explanations, troubleshooting and general ground work. It was used as a support tool for implementing GitHub Actions workflows, Docker and Terraform configuration and deployment scripts.