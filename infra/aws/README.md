# Deploy Conduit to AWS

Terraform creates one small Ubuntu VM in Stockholm, its network and a fixed
public IP. Docker Compose runs Conduit, PostgreSQL and Caddy. Caddy provides
HTTPS at `https://PUBLIC_IP.sslip.io`, without buying a domain.

GitHub deploys through SSH with a dedicated key. This works with the new AWS
Free Plan account, where the OIDC identity-provider operations were denied.
The database is not exposed to the internet. SSH password login is disabled.

## 1. Install tools and sign in

Install [Terraform 1.16.5](https://developer.hashicorp.com/terraform/install),
[AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html),
[GitHub CLI](https://cli.github.com/) and Python 3.
Run these commands from the repository root:

```bash
aws login --profile conduit --region eu-north-1
export AWS_PROFILE=conduit
export AWS_REGION=eu-north-1
gh auth login --hostname github.com --web
bash infra/aws/check-free-plan.sh
```

## 2. Create the VM

On first setup, create a dedicated key. Do not overwrite an existing key:

```bash
mkdir -p infra/aws/.ssh
chmod 700 infra/aws/.ssh
ssh-keygen -t ed25519 -N '' -C conduit-github-deployment -f infra/aws/.ssh/deploy
```

Create `infra/aws/terraform.tfvars` containing the **public** key from
`infra/aws/.ssh/deploy.pub`:

```hcl
deploy_public_key = "ssh-ed25519 REPLACE_WITH_YOUR_PUBLIC_KEY conduit-github-deployment"
```

The private key stays in the ignored `.ssh` folder. Never put it in Terraform.
Then run:

```bash
terraform -chdir=infra/aws init
terraform -chdir=infra/aws plan -out=deployment.tfplan
```

```bash
bash infra/aws/check-free-plan.sh && terraform -chdir=infra/aws apply deployment.tfplan
```

Wait a few minutes for Docker to install. The database password and JWT key are
generated on the VM and saved in `/opt/conduit/.env.production`, readable by
root only. They are not in Git or Terraform state.

Keep `infra/aws/terraform.tfstate` and its backup private and backed up. Terraform
needs them to update or remove the VM. Commit `.terraform.lock.hcl`, but not
state, plans, `.tfvars` or private keys.

## 3. Verify the server and connect GitHub

Read the VM's SSH host key through authenticated AWS Systems Manager:

```bash
export AWS_INSTANCE_ID=$(terraform -chdir=infra/aws output -raw instance_id)
export AWS_HOST=$(terraform -chdir=infra/aws output -raw public_ip)
python3 infra/aws/verify-host.py
```

This waits for setup and saves `infra/aws/.ssh/known_hosts`. The deployment
requires that verified key; it never trusts an unverified `ssh-keyscan` result.

In GitHub **Settings → Environments**, create `production` and restrict deployment
branches to `main`. Under that environment add:

- Secret `AWS_SSH_PRIVATE_KEY`: contents of `infra/aws/.ssh/deploy`.
- Variable `AWS_SSH_KNOWN_HOSTS`: contents of `infra/aws/.ssh/known_hosts`.

Under **Settings → Secrets and variables → Actions → Variables**, add:

- `AWS_HOST`: the IP printed above.
- `AWS_DEPLOY_ENABLED`: `true`, once setup is ready.

The GHCR image must be public so the VM can pull it without a GitHub token.
The current project package is public.

## 4. Deploy and check the website

After merging to `main`, the workflow:

1. Runs checks and tests, including Terraform and Compose validation.
2. Publishes a Docker image tagged with the commit SHA.
3. Smoke-tests that exact image on a temporary runner.
4. Connects to the VM over SSH and deploys the same image digest.
5. Smoke-tests the public HTTPS website.

Main-branch runs are serialized. A lock on the VM also prevents overlapping
deployments. A failed test blocks deployment. Deployment or smoke-test failure
makes the workflow fail; there is no automatic rollback.

The workflow summary links to the site. You can also get the URL with:

```bash
terraform -chdir=infra/aws output -raw app_url
```

For the first deployment before merging, use an already published image from
a successful Actions run. Get its full tag and digest from that run's summary:

```bash
export AWS_HOST=$(terraform -chdir=infra/aws output -raw public_ip)
export AWS_SSH_KEY_FILE="$PWD/infra/aws/.ssh/deploy"
export AWS_SSH_KNOWN_HOSTS=$(cat infra/aws/.ssh/known_hosts)
export APP_IMAGE='ghcr.io/owalter1891/conduit-devops:sha-FULL_COMMIT_SHA@sha256:FULL_DIGEST'
python3 infra/aws/deploy.py
SMOKE_BASE_URL=$(terraform -chdir=infra/aws output -raw app_url) npm run test:smoke
```

The first HTTPS certificate can take a few minutes. If setup fails, use
**EC2 → Connect → Session Manager**. On the VM, run
`sudo cat /var/log/cloud-init-output.log` for installation errors or
`sudo docker ps` to see the containers. Do not share the production secrets file.

## 5. Remove it when finished

Set `AWS_DEPLOY_ENABLED` to `false` in GitHub, then run:

```bash
terraform -chdir=infra/aws plan -destroy
terraform -chdir=infra/aws destroy
```