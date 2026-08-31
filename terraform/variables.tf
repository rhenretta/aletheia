variable "aws_region" {
  description = "AWS Region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use for local development (leave empty for CI/CD)"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Deployment environment (e.g. prod, dev, staging)"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "ai-news"
}

variable "domain_name" {
  description = "Apex domain name registered in Route 53 (e.g. ciclops.io)"
  type        = string
  default     = "ciclops.io"
}

variable "subdomain" {
  description = "Subdomain prefix for the news engine (e.g. news -> news.ciclops.io)"
  type        = string
  default     = "news"
}

variable "enable_custom_domain" {
  description = "Whether to configure custom subdomain mapping and Route 53 DNS records"
  type        = bool
  default     = true
}

variable "fargate_cpu" {
  description = "Fargate task CPU units (256 = 0.25 vCPU, 512 = 0.5 vCPU)"
  type        = number
  default     = 256
}

variable "fargate_memory" {
  description = "Fargate task Memory in MiB (512, 1024)"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Desired number of running ECS Fargate tasks"
  type        = number
  default     = 1
}

# --- Runtime Secrets & Configs ---

variable "database_url" {
  description = "PostgreSQL Database URL (connects to shared RDS instance)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth encryption secret (shared with ciclops.io)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "deepseek_api_key" {
  description = "DeepSeek API Key for AI synthesis and observer adaptations"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_id" {
  description = "Shared Google OAuth Client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Shared Google OAuth Client Secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "admin_emails" {
  description = "Comma-separated list of administrator email addresses"
  type        = string
  default     = "admin@ciclops.io"
}
