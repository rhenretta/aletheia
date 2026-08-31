# Availability Zones in Region
data "aws_availability_zones" "available" {
  state = "available"
}

# --- Cost-Optimized RDS PostgreSQL Infrastructure ($0 NAT Gateway overhead) ---
resource "random_password" "db_password" {
  length           = 24
  special          = false
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

locals {
  effective_db_password = var.db_password != "" ? var.db_password : random_password.db_password.result
}

# Public Subnets across 2 AZs for RDS Subnet Group requirements
resource "aws_db_subnet_group" "rds" {
  count       = var.create_rds ? 1 : 0
  name        = "${var.app_name}-db-subnet-group"
  subnet_ids  = data.aws_subnets.default.ids
  description = "Subnet group for ${var.app_name} RDS PostgreSQL"

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

# Security group allowing PostgreSQL traffic
resource "aws_security_group" "rds" {
  count       = var.create_rds ? 1 : 0
  name        = "${var.app_name}-rds-sg"
  description = "Allow PostgreSQL inbound traffic for ECS tasks and CI/CD migrations"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "PostgreSQL access from ECS Tasks"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  ingress {
    description = "PostgreSQL direct access for CI/CD migrations"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-rds-sg"
  }
}

# RDS PostgreSQL Instance (db.t4g.micro, Single-AZ, 20GB gp3)
resource "aws_db_instance" "postgres" {
  count                  = var.create_rds ? 1 : 0
  identifier             = "${var.app_name}-db"
  allocated_storage      = var.db_allocated_storage
  max_allocated_storage  = 50
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = var.db_instance_class
  db_name                = var.db_name
  username               = var.db_username
  password               = local.effective_db_password
  db_subnet_group_name   = aws_db_subnet_group.rds[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]
  publicly_accessible    = true
  skip_final_snapshot    = true
  storage_type           = "gp3"
  deletion_protection    = false

  tags = {
    Name = "${var.app_name}-postgres"
  }
}

locals {
  # Automatically assemble the production database URL from the provisioned RDS instance
  generated_database_url = var.create_rds ? "postgresql://${var.db_username}:${local.effective_db_password}@${aws_db_instance.postgres[0].endpoint}/${var.db_name}" : var.database_url
}
