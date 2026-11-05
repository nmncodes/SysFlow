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

interface PulumiResource {
  varName: string
  code: string
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

function camel(s: string): string {
  return sanitize(s).replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

const GENERATORS: Partial<Record<ComponentType, (v: string, n: GraphNodeLike, deps: string[]) => PulumiResource>> = {
  loadBalancer: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.lb.LoadBalancer("${v}", {`,
    '  loadBalancerType: "application",',
    '  securityGroups: [sg.id],',
    '  subnets: publicSubnetIds,',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  apiGateway: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.apigatewayv2.Api("${v}", {`,
    '  protocolType: "HTTP",',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  service: (v, _, deps) => ({ varName: v, code: [
    `const ${v}TaskDef = new aws.ecs.TaskDefinition("${v}-task", {`,
    `  family: "${v}",`,
    '  requiresCompatibilities: ["FARGATE"],',
    '  networkMode: "awsvpc",',
    '  cpu: "256",   // TODO: size for your workload',
    '  memory: "512", // TODO: size for your workload',
    '  containerDefinitions: JSON.stringify([{',
    `    name: "${v}",`,
    '    image: "PLACEHOLDER:latest", // TODO: your ECR image',
    '    portMappings: [{ containerPort: 8080, hostPort: 8080 }],',
    '  }]),',
    '});',
    '',
    `const ${v} = new aws.ecs.Service("${v}", {`,
    '  cluster: ecsCluster.id,',
    `  taskDefinition: ${v}TaskDef.arn,`,
    '  desiredCount: 1, // TODO: adjust',
    '  launchType: "FARGATE",',
    '  networkConfiguration: {',
    '    subnets: privateSubnetIds,',
    '    securityGroups: [sg.id],',
    '  },',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  worker: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.ecs.TaskDefinition("${v}", {`,
    `  family: "${v}",`,
    '  requiresCompatibilities: ["FARGATE"],',
    '  networkMode: "awsvpc",',
    '  cpu: "256",',
    '  memory: "512",',
    '  containerDefinitions: JSON.stringify([{',
    `    name: "${v}",`,
    '    image: "PLACEHOLDER:latest", // TODO: your worker image',
    '  }]),',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  serverless: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.lambda.Function("${v}", {`,
    '  runtime: "nodejs20.x", // TODO: pick your runtime',
    '  handler: "index.handler",',
    '  code: new pulumi.asset.FileArchive("PLACEHOLDER"), // TODO: your code',
    '  role: lambdaRole.arn,',
    '  memorySize: 128,',
    '  timeout: 30,',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  database: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.rds.Instance("${v}", {`,
    `  identifier: "${v}",`,
    '  engine: "postgres",',
    '  engineVersion: "16",',
    '  instanceClass: "db.t3.micro", // TODO: size for your workload',
    '  allocatedStorage: 20,',
    '  dbName: "appdb",',
    '  username: "dbadmin",',
    '  password: "CHANGE_ME", // TODO: use pulumi.secret() or Secrets Manager',
    '  skipFinalSnapshot: true,',
    '  vpcSecurityGroupIds: [sg.id],',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  cache: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.elasticache.Cluster("${v}", {`,
    `  clusterId: "${v}",`,
    '  engine: "redis",',
    '  nodeType: "cache.t3.micro", // TODO: size for your workload',
    '  numCacheNodes: 1,',
    '  port: 6379,',
    '  securityGroupIds: [sg.id],',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  queue: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.sqs.Queue("${v}", {`,
    '  visibilityTimeoutSeconds: 30,',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  messageBroker: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.msk.Cluster("${v}", {`,
    `  clusterName: "${v}",`,
    '  kafkaVersion: "3.6.0",',
    '  numberOfBrokerNodes: 2,',
    '  brokerNodeGroupInfo: {',
    '    instanceType: "kafka.t3.small", // TODO: size for your workload',
    '    clientSubnets: privateSubnetIds,',
    '    securityGroups: [sg.id],',
    '    storageInfo: { ebsStorageInfo: { volumeSize: 100 } },',
    '  },',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  objectStorage: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.s3.Bucket("${v}", {`,
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  cdn: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.cloudfront.Distribution("${v}", {`,
    '  enabled: true,',
    '  origins: [{',
    '    domainName: "PLACEHOLDER.example.com", // TODO: your origin',
    `    originId: "${v}-origin",`,
    '  }],',
    '  defaultCacheBehavior: {',
    '    allowedMethods: ["GET", "HEAD"],',
    '    cachedMethods: ["GET", "HEAD"],',
    `    targetOriginId: "${v}-origin",`,
    '    viewerProtocolPolicy: "redirect-to-https",',
    '    forwardedValues: { queryString: false, cookies: { forward: "none" } },',
    '  },',
    '  restrictions: { geoRestriction: { restrictionType: "none" } },',
    '  viewerCertificate: { cloudfrontDefaultCertificate: true },',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  searchIndex: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.opensearch.Domain("${v}", {`,
    `  domainName: "${v}",`,
    '  engineVersion: "OpenSearch_2.11",',
    '  clusterConfig: { instanceType: "t3.small.search", instanceCount: 1 },',
    '  ebsOptions: { ebsEnabled: true, volumeSize: 20 },',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),

  monitoring: (v, _, deps) => ({ varName: v, code: [
    `const ${v} = new aws.cloudwatch.Dashboard("${v}", {`,
    `  dashboardName: "${v}",`,
    '  dashboardBody: JSON.stringify({ widgets: [] }), // TODO: add widgets',
    deps.length ? `}, { dependsOn: [${deps.join(', ')}] });` : '});',
  ].join('\n') }),
}

const SKIP_NOTE: Partial<Record<ComponentType, string>> = {
  client: 'runs on end-user devices',
  mobile: 'runs on end-user devices',
  webBrowser: 'runs on end-user devices',
  desktopApp: 'runs on end-user computers',
  apiClient: 'calls your API - not an AWS resource',
  dns: 'use aws.route53.Zone - add manually',
  containerOrchestrator: 'implicit in ECS/EKS cluster',
  dataWarehouse: 'use aws.redshift.Cluster - add manually',
  dataLake: 'use S3 + Glue - add manually',
  webhook: 'an endpoint on your services',
  thirdPartyApi: 'external provider',
  paymentGateway: 'external provider',
  cronJob: 'use EventBridge + Lambda - add manually',
  waf: 'use aws.wafv2.WebAcl - rules are architecture-specific',
  ingress: 'handled by the ALB',
  eventBus: 'use aws.sns.Topic or EventBridge - add manually',
  logging: 'CloudWatch Logs - available by default',
  autoScalingGroup: 'use aws.autoscaling.Group with a LaunchTemplate - add manually',
}

export function generatePulumi(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): string {
  const lines: string[] = [
    '// Generated by SysFlow - a starting point, not production-ready.',
    '// Review every resource, replace PLACEHOLDER/TODO values, and add',
    '// proper networking, IAM, and secrets management before deploying.',
    '',
    'import * as pulumi from "@pulumi/pulumi";',
    'import * as aws from "@pulumi/aws";',
    '',
    '// ─── Configuration ───────────────────────────────────────────────',
    '',
    'const config = new pulumi.Config();',
    'const publicSubnetIds = config.requireObject<string[]>("publicSubnetIds");',
    'const privateSubnetIds = config.requireObject<string[]>("privateSubnetIds");',
    '',
    '// ─── Shared infrastructure ───────────────────────────────────────',
    '',
    'const sg = new aws.ec2.SecurityGroup("sysflow-main-sg", {',
    '  description: "Shared security group - TODO: tighten per service",',
    '  ingress: [{ fromPort: 0, toPort: 65535, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"] }], // TODO: restrict',
    '  egress: [{ fromPort: 0, toPort: 0, protocol: "-1", cidrBlocks: ["0.0.0.0/0"] }],',
    '});',
    '',
  ]

  const hasEcs = nodes.some((n) => n.type === 'service' || n.type === 'worker')
  if (hasEcs) {
    lines.push(
      'const ecsCluster = new aws.ecs.Cluster("sysflow-cluster", {});',
      '',
    )
  }

  const hasLambda = nodes.some((n) => n.type === 'serverless')
  if (hasLambda) {
    lines.push(
      'const lambdaRole = new aws.iam.Role("sysflow-lambda-exec", {',
      '  assumeRolePolicy: JSON.stringify({',
      '    Version: "2012-10-17",',
      '    Statement: [{ Action: "sts:AssumeRole", Effect: "Allow", Principal: { Service: "lambda.amazonaws.com" } }],',
      '  }),',
      '});',
      '',
    )
  }

  const skipped = nodes.filter((n) => !GENERATORS[n.type as ComponentType])
  if (skipped.length > 0) {
    lines.push('// ─── Not included as AWS resources ────────────────────────────────')
    for (const n of skipped) {
      const note = SKIP_NOTE[n.type as ComponentType] ?? 'no direct AWS resource mapping'
      lines.push(`// ${(n.label ?? n.id).replace(/\n/g, ' ')} (${n.type}): ${note}`)
    }
    lines.push('')
  }

  lines.push('// ─── Resources ────────────────────────────────────────────────────')
  lines.push('')

  const nameMap = new Map<string, string>()
  const usedNames = new Set<string>()
  const deployableIds = new Set<string>()

  for (const node of nodes) {
    let v = camel(node.id)
    while (usedNames.has(v)) v += '2'
    usedNames.add(v)
    nameMap.set(node.id, v)
  }

  for (const node of nodes) {
    const gen = GENERATORS[node.type as ComponentType]
    if (!gen) continue
    deployableIds.add(node.id)
    const v = nameMap.get(node.id)!
    const deps = edges
      .filter((e) => e.target === node.id && deployableIds.has(e.source))
      .map((e) => nameMap.get(e.source)!)
    const resource = gen(v, node, deps)
    lines.push(resource.code)
    lines.push('')
  }

  lines.push('// ─── Exports ──────────────────────────────────────────────────────')
  lines.push('')
  for (const node of nodes) {
    if (!deployableIds.has(node.id)) continue
    const v = nameMap.get(node.id)!
    lines.push(`export const ${v}Id = ${v}.id;`)
  }
  lines.push('')

  return lines.join('\n')
}
