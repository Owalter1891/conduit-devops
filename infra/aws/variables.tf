variable "aws_region" {
  type        = string
  description = "AWS region for the course VM."
  default     = "eu-north-1"
}

variable "deploy_public_key" {
  type        = string
  description = "Public half of a dedicated Ed25519 SSH deployment key. Never put the private key in Terraform."
  validation {
    condition     = can(regex("^ssh-ed25519 [A-Za-z0-9+/=]+( [^\\n]*)?$", trimspace(var.deploy_public_key)))
    error_message = "Provide one Ed25519 public key."
  }
}
