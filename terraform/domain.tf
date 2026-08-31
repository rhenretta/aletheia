# Route 53 Hosted Zone lookup for domain_name (ciclops.io)
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

locals {
  full_subdomain = "${var.subdomain}.${var.domain_name}"
}

# Lookup existing wildcard ACM certificate for *.ciclops.io (created in us-east-1)
data "aws_acm_certificate" "wildcard_cert" {
  provider    = aws.us_east_1
  domain      = var.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}

# Route 53 DNS Alias Record for news.ciclops.io pointing to CloudFront CDN
resource "aws_route53_record" "subdomain_a" {
  count   = var.enable_custom_domain ? 1 : 0
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.full_subdomain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn[0].domain_name
    zone_id                = aws_cloudfront_distribution.cdn[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "subdomain_aaaa" {
  count   = var.enable_custom_domain ? 1 : 0
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.full_subdomain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.cdn[0].domain_name
    zone_id                = aws_cloudfront_distribution.cdn[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# CloudFront CDN Distribution for news.ciclops.io
resource "aws_cloudfront_distribution" "cdn" {
  count               = var.enable_custom_domain ? 1 : 0
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront Distribution for ${var.app_name} (${local.full_subdomain})"
  default_root_object = ""
  aliases             = [local.full_subdomain]

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "alb-origin"

    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # Optimized caching for static immutable Next.js assets
  ordered_cache_behavior {
    path_pattern     = "/_next/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 86400
    default_ttl            = 604800
    max_ttl                = 31536000
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.wildcard_cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name = "${var.app_name}-cdn"
  }
}
