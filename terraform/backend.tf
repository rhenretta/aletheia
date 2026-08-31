# Terraform Remote State Backend
# Note: For production team deployments, configure an S3 bucket and DynamoDB lock table
terraform {
  backend "s3" {
    bucket         = "ai-content-network-ciclops-terraform-state"
    key            = "aletheia/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "ai-content-network-terraform-locks"
    encrypt        = true
  }
}
