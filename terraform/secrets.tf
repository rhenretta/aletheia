# AWS SSM Parameter Store Secret Management
resource "random_password" "nextauth_secret" {
  length  = 32
  special = false
}

locals {
  effective_nextauth_secret = var.nextauth_secret != "" ? var.nextauth_secret : random_password.nextauth_secret.result
}

resource "aws_ssm_parameter" "deepseek_api_key" {
  name        = "/${var.app_name}/${var.environment}/DEEPSEEK_API_KEY"
  description = "DeepSeek API Key for ${var.app_name}"
  type        = "SecureString"
  value       = var.deepseek_api_key != "" ? var.deepseek_api_key : "placeholder-key-to-be-updated"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.app_name}/${var.environment}/DATABASE_URL"
  description = "PostgreSQL connection string for ${var.app_name}"
  type        = "SecureString"
  value       = local.generated_database_url

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "nextauth_secret" {
  name        = "/${var.app_name}/${var.environment}/NEXTAUTH_SECRET"
  description = "NextAuth JWT encryption secret shared with ciclops.io"
  type        = "SecureString"
  value       = local.effective_nextauth_secret

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "google_client_id" {
  name        = "/${var.app_name}/${var.environment}/GOOGLE_CLIENT_ID"
  description = "Google OAuth Client ID"
  type        = "String"
  value       = var.google_client_id != "" ? var.google_client_id : "placeholder-google-client-id"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "google_client_secret" {
  name        = "/${var.app_name}/${var.environment}/GOOGLE_CLIENT_SECRET"
  description = "Google OAuth Client Secret"
  type        = "SecureString"
  value       = var.google_client_secret != "" ? var.google_client_secret : "placeholder-google-secret"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "stripe_secret_key" {
  name        = "/${var.app_name}/${var.environment}/STRIPE_SECRET_KEY"
  description = "Stripe Live Secret Key for ${var.app_name}"
  type        = "SecureString"
  value       = var.stripe_secret_key != "" ? var.stripe_secret_key : "placeholder-stripe-secret-key"
}

resource "aws_ssm_parameter" "stripe_test_secret_key" {
  name        = "/${var.app_name}/${var.environment}/STRIPE_TEST_SECRET_KEY"
  description = "Stripe Test Secret Key for ${var.app_name}"
  type        = "SecureString"
  value       = var.stripe_test_secret_key != "" ? var.stripe_test_secret_key : "placeholder-stripe-test-key"
}

resource "aws_ssm_parameter" "stripe_webhook_secret" {
  name        = "/${var.app_name}/${var.environment}/STRIPE_WEBHOOK_SECRET"
  description = "Stripe Webhook Signing Secret for ${var.app_name}"
  type        = "SecureString"
  value       = var.stripe_webhook_secret != "" ? var.stripe_webhook_secret : "placeholder-stripe-webhook-secret"
}

resource "aws_ssm_parameter" "ga_measurement_id" {
  name        = "/${var.app_name}/${var.environment}/NEXT_PUBLIC_GA_MEASUREMENT_ID"
  description = "Google Analytics 4 Measurement ID for ${var.app_name}"
  type        = "String"
  value       = var.ga_measurement_id != "" ? var.ga_measurement_id : "placeholder-ga-id"

  lifecycle {
    ignore_changes = [value]
  }
}


