output "github_variables" {
  description = "Repository Actions variables. Add the SSH secret and verified host key before enabling deployment."
  value = {
    AWS_HOST           = aws_eip.app.public_ip
    AWS_DEPLOY_ENABLED = "true"
  }
}

output "app_url" {
  description = "Available after the first successful deployment."
  value       = "https://${aws_eip.app.public_ip}.sslip.io"
}

output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  value = aws_eip.app.public_ip
}
