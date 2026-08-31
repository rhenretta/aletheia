# Look up existing shared VPC created by ai-resume-generator
data "aws_vpc" "shared" {
  filter {
    name   = "tag:Name"
    values = ["ai-resume-generator-vpc"]
  }
}

# Look up existing multi-AZ public subnets from ai-resume-generator
data "aws_subnet" "public_1" {
  filter {
    name   = "tag:Name"
    values = ["ai-resume-generator-public-1"]
  }
}

data "aws_subnet" "public_2" {
  filter {
    name   = "tag:Name"
    values = ["ai-resume-generator-public-2"]
  }
}

locals {
  vpc_id     = data.aws_vpc.shared.id
  subnet_ids = [data.aws_subnet.public_1.id, data.aws_subnet.public_2.id]
}
