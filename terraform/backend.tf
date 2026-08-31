# Terraform Remote State Backend
# Note: For production team deployments, configure an S3 bucket and DynamoDB lock table
terraform {
  backend "s3" {
    bucket         = "ciclops-terraform-state"
    key            = "ai-news/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ciclops-terraform-locks"
  }
}
