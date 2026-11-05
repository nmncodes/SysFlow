import type { ComponentType } from '../components/nodes'

interface GraphNodeLike {
  id: string
  type: string
  label?: string
  config?: Record<string, unknown>
}

interface GraphEdgeLike {
  source: string
  target: string
}

interface TfResource {
  resourceType: string
  blockName: string
  body: string[]
}

const RESOURCE_MAP: Partial<Record<ComponentType, (name: string, node: GraphNodeLike) => TfResource[]>> = {
  loadBalancer: (name) => [{
    resourceType: 'aws_lb', blockName: name,
    body: [
      `name               = "${name}"`,
      'internal           = false',
      'load_balancer_type = "application"',
      'security_groups    = [aws_security_group.main.id]',
      'subnets            = var.public_subnet_ids',
    ],
  }],
  apiGateway: (name) => [{
    resourceType: 'aws_apigatewayv2_api', blockName: name,
    body: [
      `name          = "${name}"`,
      'protocol_type = "HTTP"',
    ],
  }],
  service: (name) => [
    {
      resourceType: 'aws_ecs_task_definition', blockName: name,
      body: [
        `family                   = "${name}"`,
        'requires_compatibilities = ["FARGATE"]',
        'network_mode             = "awsvpc"',
        'cpu                      = "256"   # TODO: size for your workload',
        'memory                   = "512"   # TODO: size for your workload',
        `container_definitions = jsonencode([{`,
        `  name  = "${name}"`,
        `  image = "PLACEHOLDER:latest" # TODO: your ECR image`,
        `  portMappings = [{ containerPort = 8080, hostPort = 8080 }]`,
        `}])`,
      ],
    },
    {
      resourceType: 'aws_ecs_service', blockName: name,
      body: [
        `name            = "${name}"`,
        'cluster         = aws_ecs_cluster.main.id',
        `task_definition = aws_ecs_task_definition.${name}.arn`,
        'desired_count   = 1  # TODO: adjust replica count',
        'launch_type     = "FARGATE"',
        'network_configuration {',
        '  subnets         = var.private_subnet_ids',
        '  security_groups = [aws_security_group.main.id]',
        '}',
      ],
    },
  ],
  worker: (name) => [{
    resourceType: 'aws_ecs_task_definition', blockName: name,
    body: [
      `family                   = "${name}"`,
      'requires_compatibilities = ["FARGATE"]',
      'network_mode             = "awsvpc"',
      'cpu                      = "256"',
      'memory                   = "512"',
      `container_definitions = jsonencode([{`,
      `  name  = "${name}"`,
      `  image = "PLACEHOLDER:latest" # TODO: your worker image`,
      `}])`,
    ],
  }],
  serverless: (name) => [{
    resourceType: 'aws_lambda_function', blockName: name,
    body: [
      `function_name = "${name}"`,
      'runtime       = "nodejs20.x"  # TODO: pick your runtime',
      'handler       = "index.handler"',
      'filename      = "PLACEHOLDER.zip" # TODO: your deployment package',
      'role          = aws_iam_role.lambda_exec.arn',
      'memory_size   = 128',
      'timeout       = 30',
    ],
  }],
  database: (name) => [{
    resourceType: 'aws_db_instance', blockName: name,
    body: [
      `identifier           = "${name}"`,
      'engine               = "postgres"',
      'engine_version       = "16"',
      'instance_class       = "db.t3.micro" # TODO: size for your workload',
      'allocated_storage    = 20',
      'db_name              = "appdb"',
      'username             = "dbadmin"',
      'password             = "CHANGE_ME" # TODO: use aws_secretsmanager_secret',
      'skip_final_snapshot  = true',
      'vpc_security_group_ids = [aws_security_group.main.id]',
    ],
  }],
  cache: (name) => [{
    resourceType: 'aws_elasticache_cluster', blockName: name,
    body: [
      `cluster_id      = "${name}"`,
      'engine          = "redis"',
      'node_type       = "cache.t3.micro" # TODO: size for your workload',
      'num_cache_nodes = 1',
      'port            = 6379',
      'security_group_ids = [aws_security_group.main.id]',
    ],
  }],
  queue: (name) => [{
    resourceType: 'aws_sqs_queue', blockName: name,
    body: [
      `name                       = "${name}"`,
      'visibility_timeout_seconds = 30',
    ],
  }],
  messageBroker: (name) => [{
    resourceType: 'aws_msk_cluster', blockName: name,
    body: [
      `cluster_name           = "${name}"`,
      'kafka_version          = "3.6.0"',
      'number_of_broker_nodes = 2',
      'broker_node_group_info {',
      '  instance_type = "kafka.t3.small" # TODO: size for your workload',
      '  client_subnets = var.private_subnet_ids',
      '  security_groups = [aws_security_group.main.id]',
      '  storage_info {',
      '    ebs_storage_info { volume_size = 100 }',
      '  }',
      '}',
    ],
  }],
  objectStorage: (name) => [{
    resourceType: 'aws_s3_bucket', blockName: name,
    body: [`bucket = "${name}-\${random_id.suffix.hex}"`],
  }],
  cdn: (name) => [{
    resourceType: 'aws_cloudfront_distribution', blockName: name,
    body: [
      'enabled = true',
      'origin {',
      `  domain_name = "PLACEHOLDER.example.com" # TODO: your origin`,
      `  origin_id   = "${name}-origin"`,
      '}',
      'default_cache_behavior {',
      '  allowed_methods  = ["GET", "HEAD"]',
      '  cached_methods   = ["GET", "HEAD"]',
      `  target_origin_id = "${name}-origin"`,
      '  viewer_protocol_policy = "redirect-to-https"',
      '  forwarded_values { query_string = false; cookies { forward = "none" } }',
      '}',
      'restrictions { geo_restriction { restriction_type = "none" } }',
      'viewer_certificate { cloudfront_default_certificate = true }',
    ],
  }],
  searchIndex: (name) => [{
    resourceType: 'aws_opensearch_domain', blockName: name,
    body: [
      `domain_name    = "${name}"`,
      'engine_version = "OpenSearch_2.11"',
      'cluster_config {',
      '  instance_type  = "t3.small.search" # TODO: size for your workload',
      '  instance_count = 1',
      '}',
      'ebs_options {',
      '  ebs_enabled = true',
      '  volume_size = 20',
      '}',
    ],
  }],
  monitoring: (name) => [{
    resourceType: 'aws_cloudwatch_dashboard', blockName: name,
    body: [
      `dashboard_name = "${name}"`,
      'dashboard_body = jsonencode({',
      '  widgets = [] # TODO: add CloudWatch widgets for your services',
      '})',
    ],
  }],
  autoScalingGroup: (name) => [{
    resourceType: 'aws_autoscaling_group', blockName: name,
    body: [
      `name             = "${name}"`,
      'min_size         = 1',
      'max_size         = 4',
      'desired_capacity = 2',
      'vpc_zone_identifier = var.private_subnet_ids',
      'launch_template {',
      `  id      = "PLACEHOLDER" # TODO: create aws_launch_template`,
      '  version = "$Latest"',
      '}',
    ],
  }],
}

const SKIP_NOTE: Partial<Record<ComponentType, string>> = {
  client: 'runs on end-user devices - not an AWS resource',
  mobile: 'runs on end-user devices - not an AWS resource',
  webBrowser: 'runs on end-user devices - not an AWS resource',
  desktopApp: 'runs on end-user computers - not an AWS resource',
  apiClient: 'calls your API - not an AWS resource',
  dns: 'use Route 53 hosted zone - add aws_route53_zone manually',
  containerOrchestrator: 'this IS the orchestrator (ECS/EKS) - already implicit',
  dataWarehouse: 'use aws_redshift_cluster or Athena - add manually for your schema',
  dataLake: 'use S3 + Glue catalog - architecture-specific, add manually',
  webhook: 'an inbound endpoint on one of your services - not a separate resource',
  thirdPartyApi: 'external provider - nothing to deploy',
  paymentGateway: 'external provider (Stripe/etc.) - nothing to deploy',
  cronJob: 'use EventBridge Scheduler + Lambda or ECS task - add manually',
  waf: 'use aws_wafv2_web_acl - rule configuration is architecture-specific',
  ingress: 'typically handled by the ALB - already covered by loadBalancer',
  eventBus: 'use aws_sns_topic or EventBridge - add manually',
  logging: 'use CloudWatch Logs - already available by default on AWS',
}

function sanitize(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^([^a-z])/, 'r_$1')
}

export function generateTerraform(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): string {
  const lines: string[] = [
    '# Generated by SysFlow - a starting point, not production-ready.',
    '# Review every resource, replace PLACEHOLDER/TODO values, and add',
    '# proper networking, IAM, and secrets management before deploying.',
    '',
    '# ─── Variables ───────────────────────────────────────────────────',
    '',
    'variable "aws_region" {',
    '  default = "us-east-1"',
    '}',
    '',
    'variable "public_subnet_ids" {',
    '  type        = list(string)',
    '  description = "Public subnet IDs for load balancers"',
    '}',
    '',
    'variable "private_subnet_ids" {',
    '  type        = list(string)',
    '  description = "Private subnet IDs for services and databases"',
    '}',
    '',
    '# ─── Provider ────────────────────────────────────────────────────',
    '',
    'terraform {',
    '  required_version = ">= 1.5"',
    '  required_providers {',
    '    aws = { source = "hashicorp/aws", version = "~> 5.0" }',
    '  }',
    '}',
    '',
    'provider "aws" {',
    '  region = var.aws_region',
    '}',
    '',
    'resource "random_id" "suffix" {',
    '  byte_length = 4',
    '}',
    '',
    '# ─── Shared infrastructure ───────────────────────────────────────',
    '',
    'resource "aws_security_group" "main" {',
    '  name        = "sysflow-main-sg"',
    '  description = "Shared security group - TODO: tighten per service"',
    '',
    '  ingress {',
    '    from_port   = 0',
    '    to_port     = 65535',
    '    protocol    = "tcp"',
    '    cidr_blocks = ["0.0.0.0/0"] # TODO: restrict to your VPC CIDR',
    '  }',
    '',
    '  egress {',
    '    from_port   = 0',
    '    to_port     = 0',
    '    protocol    = "-1"',
    '    cidr_blocks = ["0.0.0.0/0"]',
    '  }',
    '}',
    '',
  ]

  const hasEcs = nodes.some((n) => n.type === 'service' || n.type === 'worker')
  if (hasEcs) {
    lines.push(
      'resource "aws_ecs_cluster" "main" {',
      '  name = "sysflow-cluster"',
      '}',
      '',
    )
  }

  const hasLambda = nodes.some((n) => n.type === 'serverless')
  if (hasLambda) {
    lines.push(
      'resource "aws_iam_role" "lambda_exec" {',
      '  name = "sysflow-lambda-exec"',
      '  assume_role_policy = jsonencode({',
      '    Version = "2012-10-17"',
      '    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]',
      '  })',
      '}',
      '',
    )
  }

  const skipped = nodes.filter((n) => !RESOURCE_MAP[n.type as ComponentType])
  if (skipped.length > 0) {
    lines.push('# ─── Not included as AWS resources ────────────────────────────────')
    for (const n of skipped) {
      const note = SKIP_NOTE[n.type as ComponentType] ?? 'no direct AWS resource mapping'
      lines.push(`# ${(n.label ?? n.id).replace(/\n/g, ' ')} (${n.type}): ${note}`)
    }
    lines.push('')
  }

  lines.push('# ─── Resources ────────────────────────────────────────────────────')
  lines.push('')

  const nameMap = new Map<string, string>()
  const usedNames = new Set<string>()
  for (const node of nodes) {
    let name = sanitize(node.id)
    while (usedNames.has(name)) name += '_2'
    usedNames.add(name)
    nameMap.set(node.id, name)
  }

  const deployableIds = new Set<string>()

  for (const node of nodes) {
    const gen = RESOURCE_MAP[node.type as ComponentType]
    if (!gen) continue
    deployableIds.add(node.id)
    const name = nameMap.get(node.id)!
    const resources = gen(name, node)

    const deps = edges
      .filter((e) => e.target === node.id && deployableIds.has(e.source))
      .map((e) => {
        const depName = nameMap.get(e.source)!
        const depGen = RESOURCE_MAP[nodes.find((n) => n.id === e.source)!.type as ComponentType]
        if (!depGen) return null
        const depResources = depGen(depName, nodes.find((n) => n.id === e.source)!)
        return `${depResources[0].resourceType}.${depResources[0].blockName}`
      })
      .filter(Boolean) as string[]

    for (const res of resources) {
      lines.push(`resource "${res.resourceType}" "${res.blockName}" {`)
      for (const line of res.body) {
        lines.push(`  ${line}`)
      }
      if (deps.length > 0) {
        lines.push(`  depends_on = [${deps.join(', ')}]`)
      }
      lines.push('}')
      lines.push('')
    }
  }

  lines.push('# ─── Outputs ──────────────────────────────────────────────────────')
  lines.push('')
  for (const node of nodes) {
    if (!deployableIds.has(node.id)) continue
    const name = nameMap.get(node.id)!
    const gen = RESOURCE_MAP[node.type as ComponentType]!
    const first = gen(name, node)[0]
    lines.push(`output "${name}_id" {`)
    lines.push(`  value = ${first.resourceType}.${first.blockName}.id`)
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}
